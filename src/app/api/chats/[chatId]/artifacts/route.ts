import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { GenerateArtifactSchema } from '@/schemas/api';
import { buildDiagramSpec } from '@/lib/artifacts/diagram-spec-builder';
import { generateDiagramImage } from '@/lib/artifacts/image-generator';
import { buildPlantUMLScript } from '@/lib/artifacts/plantuml-builder';
import {
  buildExecutiveSummary,
  buildTechnicalSummary,
  buildBOM,
  buildCostSummary,
  buildMarkdownExport,
} from '@/lib/artifacts/artifact-builders';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';
import type { CanonicalPlanState, DiagramStyle } from '@/types/planning';

export async function GET(req: NextRequest, { params }: { params: { chatId: string } }) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const artifacts = await prisma.artifact.findMany({
    where: { chatId: params.chatId, status: { not: 'failed' } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(artifacts);
}

export async function POST(req: NextRequest, { params }: { params: { chatId: string } }) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const body = await req.json().catch(() => ({}));
  const parsed = GenerateArtifactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const canonicalPlan = await prisma.canonicalPlan.findUnique({ where: { chatId: params.chatId } });
  if (!canonicalPlan) return NextResponse.json({ error: 'No plan found' }, { status: 404 });

  let plan: CanonicalPlanState;
  try {
    plan = JSON.parse(canonicalPlan.state as string) as CanonicalPlanState;
  } catch {
    return NextResponse.json({ error: 'Failed to parse plan state' }, { status: 500 });
  }
  const { type, style } = parsed.data;

  let content: string | Record<string, unknown>;
  let title: string;

  try {
    switch (type) {
      case 'summary':
        content = await buildExecutiveSummary(plan);
        title = `Executive Summary — ${plan.project.value.name}`;
        break;
      case 'report':
        content = await buildTechnicalSummary(plan);
        title = `Technical Summary — ${plan.project.value.name}`;
        break;
      case 'bom':
        content = buildBOM(plan);
        title = `Bill of Materials — ${plan.project.value.name}`;
        break;
      case 'cost_sheet':
        content = buildCostSummary(plan);
        title = `Cost Summary — ${plan.project.value.name}`;
        break;
      case 'diagram_spec': {
        const spec = buildDiagramSpec(plan, (style ?? 'topology_2d') as DiagramStyle);
        content = spec as unknown as Record<string, unknown>;
        title = spec.title;
        break;
      }
      case 'generated_image': {
        const spec = buildDiagramSpec(plan, (style ?? 'topology_2d') as DiagramStyle);
        const result = await generateDiagramImage(spec, params.chatId, canonicalPlan.id);
        const artifact = await prisma.artifact.findUnique({ where: { id: result.artifactId } });
        return NextResponse.json(artifact, { status: 201 });
      }
      case 'export_package':
        content = buildMarkdownExport(plan);
        title = `Export — ${plan.project.value.name}`;
        break;
      case 'plantuml': {
        const scriptStyle = style ?? 'topology_2d';
        const script = buildPlantUMLScript(plan, scriptStyle);
        content = { script, style: scriptStyle };
        title = `PlantUML — ${plan.project.value.name} (${scriptStyle})`;
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown artifact type' }, { status: 400 });
    }

    const artifact = await prisma.artifact.create({
      data: {
        id: nanoid(),
        chatId: params.chatId,
        planVersionId: canonicalPlan.id,
        type,
        title,
        content: typeof content === 'string' ? JSON.stringify({ text: content }) : JSON.stringify(content),
        status: 'ready',
      },
    });

    return NextResponse.json(artifact, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
