import { redirect } from 'next/navigation';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/db/client';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const lastChat = await prisma.chat.findFirst({
    where: { userId: session.user.id as string, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });

  if (lastChat) {
    redirect(`/chat/${lastChat.id}`);
  }

  const newChat = await prisma.chat.create({
    data: {
      userId: session.user.id as string,
      title: 'New Chat',
    },
  });

  redirect(`/chat/${newChat.id}`);
}
