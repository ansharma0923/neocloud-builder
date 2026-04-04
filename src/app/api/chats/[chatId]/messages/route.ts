import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { SendMessageSchema } from '@/schemas/api';
import { runPlanningPipeline } from '@/lib/planning/pipeline';
import { retrieveRelevantChunks, buildFileContext } from '@/lib/files/retrieval';
import { createChatCompletion } from '@/lib/ai/model-router';
import { logger } from '@/lib/observability/logger';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';
import type { CanonicalPlanState, PipelineResult } from '@/types/planning';

export async function POST(req: NextRequest, { params }: { params: { chatId: string } }) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const body = await req.json().catch(() => ({}));
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const chat = await prisma.chat.findFirst({
    where: { id: params.chatId, userId, deletedAt: null },
  });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  // Save user message
  const userMessage = await prisma.message.create({
    data: {
      id: nanoid(),
      chatId: params.chatId,
      role: 'user',
      content: parsed.data.content,
    },
  });

  // Get conversation history
  const history = await prisma.message.findMany({
    where: { chatId: params.chatId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  // Get current plan
  const canonicalPlan = await prisma.canonicalPlan.findUnique({
    where: { chatId: params.chatId },
  });

  const currentPlan = canonicalPlan
    ? (() => {
        try {
          return JSON.parse(canonicalPlan.state as string) as CanonicalPlanState;
        } catch {
          return null;
        }
      })()
    : null;

  // Get relevant file context
  const fileChunks = await retrieveRelevantChunks(parsed.data.content, params.chatId, 5).catch(() => []);
  const fileContext = buildFileContext(fileChunks);

  // Run planning pipeline
  let planResult: PipelineResult | null = null;
  let planningError: string | null = null;

  try {
    planResult = await runPlanningPipeline(
      parsed.data.content,
      history.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      currentPlan,
      { chatId: params.chatId, fileContext }
    );
  } catch (error) {
    planningError = String(error);
    logger.error('planning_pipeline_error', { chatId: params.chatId, error: planningError });
  }

  // Build a rich planning summary if we ran the pipeline and have a meaningful plan
  let planSummaryBlock = '';
  if (planResult && planResult.plan && planResult.plan.rackCount.value > 0) {
    const p = planResult.plan;
    const projectName = p.project?.value?.name ?? 'AI Data Center';
    const rackCount   = p.rackCount?.value ?? 0;
    const totalPower  = p.totalPower?.value ?? 0;
    const site        = [p.site?.value?.city, p.site?.value?.state, p.site?.value?.country].filter(Boolean).join(', ') || 'location TBD';
    const compute     = p.computeInventory?.value ?? [];
    const gpuModel    = compute[0]?.vendor && compute[0]?.model
      ? `${compute[0].vendor} ${compute[0].model}`
      : (compute[0]?.model ?? compute[0]?.type ?? 'GPU compute');
    const topology    = p.topologyRelationships?.value ?? {};
    const network     = p.networkArchitecture?.value ?? {};

    const topKeyAssumptions = (p.assumptions ?? [])
      .filter(a => a.sourceType === 'llm_estimate')
      .slice(0, 5);

    const highRisk = (p.risks ?? []).find(r => r.severity === 'critical' || r.severity === 'high');
    const openQs   = (p.openQuestions ?? []).slice(0, 3);

    planSummaryBlock = [
      `\n\n---`,
      `**📐 Plan Summary: ${projectName}**`,
      ``,
      `Designed a **${rackCount}-rack AI data center** in ${site} with **${totalPower} kW** total power capacity.`,
      `Compute: **${gpuModel}** (${compute[0]?.perRack ?? 8} GPUs/rack × ${rackCount} racks).`,
      topology.spines ? `Network: **${topology.tier ?? 'Leaf-Spine'}** — ${topology.spines} spines / ${topology.leaves ?? '?'} leaves, ${network.internalBandwidth ?? '400GbE'} uplinks.` : '',
      ``,
      topKeyAssumptions.length > 0 ? `**Key assumptions made:**` : '',
      ...topKeyAssumptions.map(a => `- **${a.field}**: ${String(a.value)} *(${a.reasoning})*`),
      ``,
      openQs.length > 0 ? `**Open questions:**` : '',
      ...openQs.map(q => `- ${q}`),
      highRisk ? `\n⚠️ **Risk flagged:** ${highRisk.description} (${highRisk.severity} severity)` : '',
      ``,
      `---`,
      `I've opened the right panel — check the **Plan tab** for full details, or click any button in the **Artifacts tab** to generate topology diagrams, BOM, or cost analysis.`,
    ].filter(l => l !== '').join('\n');
  }

  const systemPrompt = [
    'You are NeoCloud Builder, an AI-native planning assistant for AI data centers and neoclouds.',
    'Help users design rack topologies, GPU/TPU clusters, leaf-spine networks, storage, power/cooling, site layouts, BOMs, and cost estimates.',
    'Be precise, technical, and always flag when you are making estimates vs. stating facts.',
    'If you update the plan, briefly summarize what changed.',
    fileContext ? `\nRelevant uploaded documents:\n${fileContext}` : '',
    planResult ? `\nCurrent plan state: ${planResult.plan.rackCount.value} racks, version ${planResult.plan.version}` : '',
    planSummaryBlock ? `\nAfter your response, append exactly this planning summary block:\n${planSummaryBlock}` : '',
  ].filter(Boolean).join('\n');

  const conversationMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const startTime = Date.now();
  const aiResult = await createChatCompletion('fast_chat', conversationMessages, {
    chatId: params.chatId,
    temperature: 0.7,
  });
  const latencyMs = Date.now() - startTime;

  // Save assistant message
  const assistantMessage = await prisma.message.create({
    data: {
      id: nanoid(),
      chatId: params.chatId,
      role: 'assistant',
      content: aiResult.content,
      modelId: aiResult.metadata.model,
      tokenCount: aiResult.metadata.totalTokens,
      latencyMs,
      metadata: JSON.stringify({
        promptTokens: aiResult.metadata.promptTokens,
        completionTokens: aiResult.metadata.completionTokens,
        planVersion: planResult?.plan.version,
        planUpdated: !!planResult,
      }),
    },
  });

  // Save/update canonical plan
  if (planResult && planResult.plan) {
    const planData = planResult.plan as unknown as Record<string, unknown>;
    if (canonicalPlan) {
      await prisma.canonicalPlan.update({
        where: { chatId: params.chatId },
        data: {
          version: planResult.plan.version,
          state: JSON.stringify(planData),
        },
      });
    } else {
      await prisma.canonicalPlan.create({
        data: {
          id: nanoid(),
          chatId: params.chatId,
          version: planResult.plan.version,
          state: JSON.stringify(planData),
        },
      });
    }
  }

  // Update chat title if this is first message
  if (history.length <= 1) {
    try {
      const titleResult = await createChatCompletion('title_generation', [
        { role: 'system', content: 'Generate a short (3-6 word) title for this AI data center planning chat. Return only the title, nothing else.' },
        { role: 'user', content: parsed.data.content },
      ], { temperature: 0.5 });
      
      await prisma.chat.update({
        where: { id: params.chatId },
        data: { title: titleResult.content.slice(0, 100) },
      });
    } catch {
      // Non-critical, skip
    }
  }

  // Update chat updatedAt
  await prisma.chat.update({
    where: { id: params.chatId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    userMessage,
    assistantMessage,
    plan: planResult?.plan ?? null,
    assumptions: planResult?.assumptions ?? null,
    planningError,
  });
}
