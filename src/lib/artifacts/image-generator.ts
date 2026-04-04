import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/observability/logger';
import type { DiagramSpec } from '@/types/planning';

export interface GeneratedDiagramArtifact {
  artifactId: string;
  specArtifactId: string;
}

/**
 * Save a DiagramSpec as a generated_image artifact.
 * The actual rendering happens client-side in DiagramRenderer.tsx.
 * No DALL-E call is made.
 */
export async function generateDiagramImage(
  spec: DiagramSpec,
  chatId: string,
  planVersionId?: string
): Promise<GeneratedDiagramArtifact> {
  const artifactId = nanoid();

  logger.info('diagram_artifact_create', { artifactId, style: spec.style });

  await prisma.artifact.create({
    data: {
      id: artifactId,
      chatId,
      planVersionId: planVersionId ?? null,
      type: 'generated_image',
      title: spec.title,
      content: JSON.stringify(spec),
      status: 'ready',
      metadata: JSON.stringify({ style: spec.style, renderedClient: true }),
    },
  });

  return { artifactId, specArtifactId: artifactId };
}

/**
 * Keep refineDiagramStyle for API compatibility but no longer calls DALL-E.
 */
export async function refineDiagramStyle(
  existingSpec: DiagramSpec,
  _styleInstruction: string,
  chatId: string
): Promise<GeneratedDiagramArtifact> {
  const refined: DiagramSpec = {
    ...existingSpec,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  };
  return generateDiagramImage(refined, chatId);
}
