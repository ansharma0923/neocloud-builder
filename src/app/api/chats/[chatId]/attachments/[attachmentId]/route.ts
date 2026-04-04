import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getStorageAdapter } from '@/lib/files/storage';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { chatId: string; attachmentId: string } }
) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const attachment = await prisma.attachment.findFirst({
    where: { id: params.attachmentId, chatId: params.chatId, userId },
  });
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });

  const storage = getStorageAdapter();
  await storage.delete(attachment.storagePath).catch(() => {});
  await prisma.attachment.delete({ where: { id: params.attachmentId } });

  return NextResponse.json({ success: true });
}
