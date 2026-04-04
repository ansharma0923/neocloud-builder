import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { MutatePlanSchema } from '@/schemas/api';
import { createChatCompletion } from '@/lib/ai/model-router';
import { mutatePlan } from '@/lib/planning/plan-mutator';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';
import type { CanonicalPlanState, MutationInstruction } from '@/types/planning';

export async function POST(req: NextRequest, { params }: { params: { chatId: string } }) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const body = await req.json().catch(() => ({}));
  const parsed = MutatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const canonicalPlan = await prisma.canonicalPlan.findUnique({ where: { chatId: params.chatId } });
  if (!canonicalPlan) return NextResponse.json({ error: 'No plan found for this chat' }, { status: 404 });

  const currentPlan = canonicalPlan.state as unknown as CanonicalPlanState;

  // Use LLM to extract mutation instruction from the description
  const extractResult = await createChatCompletion('structured_extraction', [
    {
      role: 'system',
      content: `Extract a mutation instruction from the user's request. Return JSON:
{
  "type": "numeric_change"|"component_swap"|"component_removal"|"location_change"|"constraint_preservation"|"full_rebuild"|"general",
  "targetField": "fieldName or null",
  "oldValue": "old value or null",
  "newValue": "new value or null",
  "description": "human-readable change summary",
  "lockedFields": ["field1", "field2"] or []
}`,
    },
    { role: 'user', content: parsed.data.instruction },
  ], { responseFormat: { type: 'json_object' } });

  let instruction: MutationInstruction;
  try {
    instruction = JSON.parse(extractResult.content) as MutationInstruction;
  } catch {
    instruction = { type: 'general', description: parsed.data.instruction };
  }

  const result = await mutatePlan(
    currentPlan,
    instruction,
    canonicalPlan.id,
    parsed.data.messageId
  );

  // Update canonical plan
  await prisma.canonicalPlan.update({
    where: { chatId: params.chatId },
    data: {
      version: result.plan.version,
      state: result.plan as unknown as Record<string, unknown>,
    },
  });

  return NextResponse.json({
    plan: result.plan,
    changeSummary: result.changeSummary,
    mutatedFields: result.mutatedFields,
  });
}
