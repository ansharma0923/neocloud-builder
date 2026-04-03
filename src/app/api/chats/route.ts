import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { CreateChatSchema, PaginationSchema } from '@/schemas/api';
import { logger } from '@/lib/observability/logger';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';

export async function GET(req: NextRequest) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

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
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateChatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

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
