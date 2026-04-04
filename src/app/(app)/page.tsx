import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';

export default async function HomePage() {
  await ensureLocalUser();

  const lastChat = await prisma.chat.findFirst({
    where: { userId: LOCAL_USER_ID, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });

  if (lastChat) {
    redirect(`/chat/${lastChat.id}`);
  }

  const newChat = await prisma.chat.create({
    data: {
      userId: LOCAL_USER_ID,
      title: 'New Chat',
    },
  });

  redirect(`/chat/${newChat.id}`);
}
