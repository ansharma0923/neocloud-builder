import { nanoid } from 'nanoid';
import { createImage } from '@/lib/ai/model-router';
import { getStorageAdapter } from '@/lib/files/storage';
import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/observability/logger';
import type { DiagramSpec, DiagramStyle } from '@/types/planning';

/**
 * Build an optimized image generation prompt from a structured DiagramSpec.
 * Never passes raw user text to the image model.
 */
function buildImagePrompt(spec: DiagramSpec, style: DiagramStyle): string {
  const nodeTypeGroups = spec.nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.type] = (acc[node.type] ?? 0) + 1;
    return acc;
  }, {});

  const nodeDescription = Object.entries(nodeTypeGroups)
    .map(([type, count]) => `${count} ${type.replace(/_/g, ' ')} node${count > 1 ? 's' : ''}`)
    .join(', ');

  const zoneDescription = spec.zones
    .map((z) => z.label)
    .join(', ');

  const styleDescriptions: Record<DiagramStyle, string> = {
    topology_2d: 'a clean 2D network topology diagram, top-down view, showing leaf-spine architecture with labeled switch nodes and server racks connected by lines',
    logical_arch: 'a logical architecture diagram with layered boxes and directional arrows showing data flow and dependencies',
    site_layout: 'a 2D floor plan site layout diagram showing room zones with labeled areas and infrastructure connections',
    rack_row: 'a side-view rack row diagram showing individual server rack units with dimensions and labeling',
    presentation: 'a clean minimal presentation-ready architecture diagram with branded color blocks and simple icons',
    schematic: 'a technical schematic diagram with precise lines, nodes, and detailed labeling like an engineering drawing',
  };

  const styleDesc = styleDescriptions[style] ?? styleDescriptions.topology_2d;

  return [
    `Technical infrastructure diagram: ${styleDesc}.`,
    `Contains: ${nodeDescription}.`,
    `Zones/layers: ${zoneDescription}.`,
    `Title: "${spec.title}".`,
    `Color scheme: dark background (#0a0a0a), indigo accent (#6366f1), teal nodes (#0891b2), green compute (#059669), white labels.`,
    `Style: professional technical documentation, clean lines, no gradients, high contrast, minimal but information-dense.`,
    `No text outside of labels. No decorative elements. No logos.`,
  ].join(' ');
}

export interface GeneratedDiagramArtifact {
  artifactId: string;
  imageUrl: string;
  specArtifactId: string;
  storagePath: string;
}

/**
 * Generate a diagram image from a DiagramSpec.
 * Stores the image and creates Artifact records.
 */
export async function generateDiagramImage(
  spec: DiagramSpec,
  chatId: string,
  planVersionId?: string
): Promise<GeneratedDiagramArtifact> {
  const specArtifactId = nanoid();
  const imageArtifactId = nanoid();

  // 1. Store the spec as an artifact
  await prisma.artifact.create({
    data: {
      id: specArtifactId,
      chatId,
      planVersionId: planVersionId ?? null,
      type: 'diagram_spec',
      title: spec.title,
      content: spec as unknown as Record<string, unknown>,
      status: 'ready',
      metadata: { style: spec.style },
    },
  });

  // 2. Create pending image artifact
  await prisma.artifact.create({
    data: {
      id: imageArtifactId,
      chatId,
      planVersionId: planVersionId ?? null,
      type: 'generated_image',
      title: `${spec.title} (Image)`,
      content: { specId: specArtifactId },
      status: 'generating',
    },
  });

  try {
    // 3. Build optimized prompt and generate image
    const prompt = buildImagePrompt(spec, spec.style);
    logger.info('image_generation_start', { imageArtifactId, style: spec.style });

    const imageUrl = await createImage(prompt, { size: '1792x1024', quality: 'hd' });

    // 4. Download and store the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status}`);
    }
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const storagePath = `artifacts/${chatId}/${imageArtifactId}.png`;

    const storage = getStorageAdapter();
    await storage.save(storagePath, imageBuffer, {
      artifactId: imageArtifactId,
      specArtifactId,
      chatId,
    });

    // 5. Update artifact with storage path
    await prisma.artifact.update({
      where: { id: imageArtifactId },
      data: {
        content: { specId: specArtifactId, storagePath, originalUrl: imageUrl },
        status: 'ready',
      },
    });

    logger.info('image_generation_complete', { imageArtifactId, storagePath });

    return {
      artifactId: imageArtifactId,
      imageUrl,
      specArtifactId,
      storagePath,
    };
  } catch (error) {
    await prisma.artifact.update({
      where: { id: imageArtifactId },
      data: { status: 'failed', metadata: { error: String(error) } },
    });
    throw error;
  }
}

/**
 * Apply a style refinement to an existing diagram spec and generate a new image.
 */
export async function refineDiagramStyle(
  existingSpec: DiagramSpec,
  styleInstruction: string,
  chatId: string
): Promise<GeneratedDiagramArtifact> {
  // Apply refinement: only update safe metadata, never raw text in prompt
  const refinedSpec: DiagramSpec = {
    ...existingSpec,
    id: nanoid(),
    metadata: {
      ...existingSpec.metadata,
      refinement: styleInstruction.slice(0, 100), // Truncate to prevent injection
      refinedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  return generateDiagramImage(refinedSpec, chatId);
}
