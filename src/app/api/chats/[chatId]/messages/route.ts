import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { SendMessageSchema } from '@/schemas/api';
import { runPlanningPipeline } from '@/lib/planning/pipeline';
import { retrieveRelevantChunks, buildFileContext } from '@/lib/files/retrieval';
import { createChatCompletion } from '@/lib/ai/model-router';
import { logger } from '@/lib/observability/logger';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import type { CanonicalPlanState, PipelineResult } from '@/types/planning';

export async function POST(req: NextRequest, { params }: { params: { chatId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

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

  const currentPlan = canonicalPlan ? (canonicalPlan.state as unknown as CanonicalPlanState) : null;

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

  // Build AI response
  const systemPrompt = [
    'You are NeoCloud Builder, an AI-native planning assistant for AI data centers and neoclouds.',
    'Help users design rack topologies, GPU/TPU clusters, leaf-spine networks, storage, power/cooling, site layouts, BOMs, and cost estimates.',
    'Be precise, technical, and always flag when you are making estimates vs. stating facts.',
    'If you update the plan, briefly summarize what changed.',
    fileContext ? `\nRelevant uploaded documents:\n${fileContext}` : '',
    planResult ? `\nCurrent plan state: ${planResult.plan.rackCount.value} racks, version ${planResult.plan.version}` : '',
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
      metadata: {
        promptTokens: aiResult.metadata.promptTokens,
        completionTokens: aiResult.metadata.completionTokens,
        planVersion: planResult?.plan.version,
        planUpdated: !!planResult,
      },
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
          state: planData,
        },
      });
    } else {
      await prisma.canonicalPlan.create({
        data: {
          id: nanoid(),
          chatId: params.chatId,
          version: planResult.plan.version,
          state: planData,
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
