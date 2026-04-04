import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';

export async function GET(req: NextRequest, { params }: { params: { chatId: string } }) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const attachments = await prisma.attachment.findMany({
    where: { chatId: params.chatId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json(attachments);
}
