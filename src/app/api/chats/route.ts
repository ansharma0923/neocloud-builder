import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { CreateChatSchema, PaginationSchema } from '@/schemas/api';
import { logger } from '@/lib/observability/logger';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id as string;

  const { searchParams } = new URL(req.url);
  const pagination = PaginationSchema.parse({
    page: searchParams.get('page') ?? '1',
    limit: searchParams.get('limit') ?? '20',
  });

  const skip = (pagination.page - 1) * pagination.limit;

  const [chats, total] = await Promise.all([
    prisma.chat.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pagination.limit,
      include: {
        _count: { select: { messages: true } },
      },
    }),
    prisma.chat.count({ where: { userId, deletedAt: null } }),
  ]);

  return NextResponse.json({
    chats,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id as string;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  // Ensure user exists in DB
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: session.user.email ?? `${userId}@unknown.com`,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    },
  });

  const chat = await prisma.chat.create({
    data: {
      id: nanoid(),
      userId,
      workspaceId: parsed.data.workspaceId ?? null,
      title: parsed.data.title ?? 'New Chat',
    },
  });

  logger.info('chat_created', { chatId: chat.id, userId });
  return NextResponse.json(chat, { status: 201 });
}
