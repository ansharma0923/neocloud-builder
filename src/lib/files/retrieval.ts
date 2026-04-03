import { prisma } from '@/lib/db/client';
import { createEmbedding, createChatCompletion } from '@/lib/ai/model-router';
import { cosineSimilarity } from './ingestion';
import { logger } from '@/lib/observability/logger';

export interface RetrievedChunk {
  attachmentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

/**
 * Retrieve the most relevant chunks from uploaded files in a chat session.
 */
export async function retrieveRelevantChunks(
  query: string,
  chatId: string,
  topK: number = 5
): Promise<RetrievedChunk[]> {
  // Get all ready attachments for this chat with embeddings
  const attachments = await prisma.attachment.findMany({
    where: { chatId, status: 'ready' },
  });

  if (attachments.length === 0) return [];

  // Embed the query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await createEmbedding(query);
  } catch (error) {
    logger.warn('query_embedding_failed', { chatId, error: String(error) });
    return [];
  }

  const results: RetrievedChunk[] = [];

  for (const attachment of attachments) {
    const metadata = attachment.metadata as Record<string, unknown>;
    const chunks = metadata.chunks as Array<{
      index: number;
      text: string;
      startChar: number;
      endChar: number;
      embedding?: number[];
    }> | undefined;

    if (!chunks) continue;

    for (const chunk of chunks) {
      if (!chunk.embedding) continue;
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      results.push({
        attachmentId: attachment.id,
        filename: attachment.originalName,
        chunkIndex: chunk.index,
        text: chunk.text,
        similarity,
      });
    }
  }

  // Sort by similarity descending and take top K
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

/**
 * Format retrieved chunks into a context string with source citations.
 */
export function buildFileContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';

  const lines: string[] = ['--- Relevant File Context ---'];

  for (const chunk of chunks) {
    lines.push(`\n[Source: ${chunk.filename}, Chunk ${chunk.chunkIndex}]`);
    lines.push(chunk.text);
  }

  lines.push('\n--- End File Context ---');
  return lines.join('\n');
}

/**
 * Generate or retrieve a cached summary for an attachment.
 */
export async function getFileSummary(attachmentId: string): Promise<string> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment) {
    throw new Error(`Attachment not found: ${attachmentId}`);
  }

  const metadata = attachment.metadata as Record<string, unknown>;
  if (metadata.summary && typeof metadata.summary === 'string') {
    return metadata.summary;
  }

  if (!attachment.extractedText) {
    return `[No text content available for ${attachment.originalName}]`;
  }

  // Generate summary
  const truncatedText =
    attachment.extractedText.length > 8000
      ? attachment.extractedText.slice(0, 8000) + '...'
      : attachment.extractedText;

  const result = await createChatCompletion('file_qa', [
    {
      role: 'system',
      content:
        'You are a technical document analyst. Summarize the uploaded document concisely, focusing on key data, specifications, and planning-relevant information.',
    },
    {
      role: 'user',
      content: `Summarize this document:\n\n${truncatedText}`,
    },
  ]);

  const summary = result.content;

  // Cache the summary
  await prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      metadata: { ...metadata, summary },
    },
  });

  return summary;
}
