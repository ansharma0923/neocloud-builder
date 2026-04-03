import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest, { params }: { params: { chatId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const plan = await prisma.canonicalPlan.findUnique({ where: { chatId: params.chatId } });
  if (!plan) return NextResponse.json(null);

  return NextResponse.json(plan);
}
