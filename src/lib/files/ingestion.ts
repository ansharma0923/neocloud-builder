import path from 'path';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db/client';
import { getStorageAdapter } from './storage';
import { createEmbedding } from '@/lib/ai/model-router';
import { logger } from '@/lib/observability/logger';

export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const CHUNK_SIZE = 1000; // characters
export const CHUNK_OVERLAP = 200; // characters

export interface FileChunk {
  index: number;
  text: string;
  embedding?: number[];
  startChar: number;
  endChar: number;
}

export interface IngestionResult {
  attachmentId: string;
  filename: string;
  chunks: number;
  extractedTextLength: number;
}

/**
 * Validate file type and size before ingestion.
 */
export function validateFile(
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  if (!SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
    };
  }
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${size} bytes. Maximum size: ${MAX_FILE_SIZE} bytes`,
    };
  }
  return { valid: true };
}

/**
 * Extract text content from a file buffer based on its MIME type.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  if (mimeType.startsWith('image/')) {
    // Images: return metadata only
    return `[Image file: ${filename}]`;
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv') {
    return buffer.toString('utf-8');
  }

  if (mimeType === 'application/json') {
    try {
      const json = JSON.parse(buffer.toString('utf-8'));
      return JSON.stringify(json, null, 2);
    } catch {
      return buffer.toString('utf-8');
    }
  }

  if (mimeType === 'application/pdf') {
    try {
      // Dynamic import to avoid issues in environments without native deps
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      return result.text;
    } catch (error) {
      logger.warn('pdf_extraction_failed', { filename, error: String(error) });
      return `[PDF content extraction failed: ${filename}]`;
    }
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      logger.warn('docx_extraction_failed', { filename, error: String(error) });
      return `[DOCX content extraction failed: ${filename}]`;
    }
  }

  if (
    mimeType ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`Sheet: ${sheetName}\n${csv}`);
      }
      return sheets.join('\n\n');
    } catch (error) {
      logger.warn('xlsx_extraction_failed', { filename, error: String(error) });
      return `[XLSX content extraction failed: ${filename}]`;
    }
  }

  return `[Unsupported content type: ${mimeType}]`;
}

/**
 * Split text into overlapping chunks for embedding.
 */
export function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): FileChunk[] {
  if (text.length === 0) return [];

  const chunks: FileChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push({
      index,
      text: text.slice(start, end),
      startChar: start,
      endChar: end,
    });
    start += chunkSize - overlap;
    index++;
  }

  return chunks;
}

/**
 * Calculate cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Ingest a file: validate, store, extract text, chunk, embed, and mark ready.
 */
export async function ingestFile(params: {
  buffer: Buffer;
  filename: string;
  originalName: string;
  mimeType: string;
  chatId: string;
  userId: string;
  messageId?: string;
}): Promise<IngestionResult> {
  const { buffer, filename, originalName, mimeType, chatId, userId, messageId } = params;

  // 1. Validate
  const validation = validateFile(mimeType, buffer.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Store to filesystem
  const attachmentId = nanoid();
  const storagePath = `attachments/${chatId}/${attachmentId}${path.extname(originalName)}`;

  const storage = getStorageAdapter();
  await storage.save(storagePath, buffer, {
    attachmentId,
    chatId,
    userId,
    originalName,
    mimeType,
  });

  // 3. Create attachment record
  const attachment = await prisma.attachment.create({
    data: {
      id: attachmentId,
      chatId,
      messageId: messageId ?? null,
      userId,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
      storagePath,
      status: 'processing',
    },
  });

  try {
    // 4. Extract text
    const extractedText = await extractText(buffer, mimeType, originalName);

    // 5. Chunk text
    const chunks = chunkText(extractedText);

    // 6. Embed chunks (skip for images)
    if (!mimeType.startsWith('image/') && chunks.length > 0) {
      const embeddedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const embedding = await createEmbedding(chunk.text);
            return { ...chunk, embedding };
          } catch (error) {
            logger.warn('chunk_embedding_failed', { attachmentId, chunkIndex: chunk.index, error: String(error) });
            return chunk;
          }
        })
      );

      // 7. Store embeddings as JSON in attachment metadata
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          extractedText,
          status: 'ready',
          metadata: {
            chunks: embeddedChunks.map((c) => ({
              index: c.index,
              text: c.text,
              startChar: c.startChar,
              endChar: c.endChar,
              embedding: c.embedding,
            })),
          },
        },
      });
    } else {
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          extractedText,
          status: 'ready',
        },
      });
    }

    logger.info('file_ingested', { attachmentId, chunks: chunks.length, textLength: extractedText.length });

    return {
      attachmentId,
      filename,
      chunks: chunks.length,
      extractedTextLength: extractedText.length,
    };
  } catch (error) {
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { status: 'failed' },
    });
    throw error;
  }
}
