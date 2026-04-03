import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { ingestFile } from '@/lib/files/ingestion';
import { LOCAL_USER_ID } from '@/lib/auth/local-user';
import { ensureLocalUser } from '@/lib/db/seed-local-user';
import { logger } from '@/lib/observability/logger';

export async function POST(req: NextRequest, { params }: { params: { chatId: string } }) {
  await ensureLocalUser();
  const userId = LOCAL_USER_ID;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${nanoid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const result = await ingestFile({
      buffer,
      filename,
      originalName: file.name,
      mimeType: file.type,
      chatId: params.chatId,
      userId,
    });

    logger.info('file_uploaded', { chatId: params.chatId, attachmentId: result.attachmentId });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error('file_upload_error', { chatId: params.chatId, error: String(error) });
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
