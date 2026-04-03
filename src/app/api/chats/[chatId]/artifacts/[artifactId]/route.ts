import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string; artifactId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const artifact = await prisma.artifact.findFirst({
    where: { id: params.artifactId, chatId: params.chatId },
  });
  if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });

  return NextResponse.json(artifact);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { chatId: string; artifactId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

  const chat = await prisma.chat.findFirst({ where: { id: params.chatId, userId, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const artifact = await prisma.artifact.findFirst({
    where: { id: params.artifactId, chatId: params.chatId },
  });
  if (!artifact) return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });

  await prisma.artifact.delete({ where: { id: params.artifactId } });
  return NextResponse.json({ success: true });
}
