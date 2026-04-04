import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string; artifactId: string } }
) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const artifact = await prisma.artifact.findFirst({
    where: { id: params.artifactId, chatId: params.chatId },
  });
  if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });

  let parsedContent: unknown = artifact.content;
  try {
    if (artifact.content) {
      parsedContent = JSON.parse(artifact.content as string);
    }
  } catch {
    // keep original string value
  }

  return NextResponse.json({ ...artifact, content: parsedContent });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { chatId: string; artifactId: string } }
) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const artifact = await prisma.artifact.findFirst({
    where: { id: params.artifactId, chatId: params.chatId },
  });
  if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });

  await prisma.artifact.delete({ where: { id: params.artifactId } });
  return NextResponse.json({ success: true });
}
