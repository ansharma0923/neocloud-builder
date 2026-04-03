import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { UpdateChatSchema } from '@/schemas/api';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest, { params }: { params: { chatId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

  const chat = await prisma.chat.findFirst({
    where: { id: params.chatId, userId, deletedAt: null },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      attachments: { where: { status: { not: 'failed' } } },
    },
  });

  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  return NextResponse.json(chat);
}

export async function PATCH(req: NextRequest, { params }: { params: { chatId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

  const body = await req.json().catch(() => ({}));
  const parsed = UpdateChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const updated = await prisma.chat.update({
    where: { id: params.chatId },
    data: { title: parsed.data.title },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { chatId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  await prisma.chat.update({
    where: { id: params.chatId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
