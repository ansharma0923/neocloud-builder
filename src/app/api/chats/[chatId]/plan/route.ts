import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';

export async function GET(req: NextRequest, { params }: { params: { chatId: string } }) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const plan = await prisma.canonicalPlan.findUnique({ where: { chatId: params.chatId } });
  if (!plan) return NextResponse.json(null);
  let parsedState: unknown;
  try {
    parsedState = JSON.parse(plan.state as string);
  } catch {
    return NextResponse.json({ error: 'Failed to parse plan state' }, { status: 500 });
  }
  return NextResponse.json({
    ...plan,
    state: parsedState,
  });
}
