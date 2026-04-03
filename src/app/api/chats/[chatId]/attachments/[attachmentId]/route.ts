import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getStorageAdapter } from '@/lib/files/storage';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { chatId: string; attachmentId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id as string;

  const attachment = await prisma.attachment.findFirst({
    where: { id: params.attachmentId, chatId: params.chatId, userId },
  });
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  const storage = getStorageAdapter();
  await storage.delete(attachment.storagePath).catch(() => {});
  await prisma.attachment.delete({ where: { id: params.attachmentId } });

  return NextResponse.json({ success: true });
}
