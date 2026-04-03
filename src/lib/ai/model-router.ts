import type { ModelTask, ModelRunMetadata } from '@/types/planning';
import { logger } from '@/lib/observability/logger';

const MODEL_ENV_MAP: Record<ModelTask, string> = {
  fast_chat: 'OPENAI_MODEL_FAST',
  deep_reasoning: 'OPENAI_MODEL_REASONING',
  file_qa: 'OPENAI_MODEL_FILE_QA',
  structured_extraction: 'OPENAI_MODEL_STRUCTURED',
  canonical_planning: 'OPENAI_MODEL_STRUCTURED',
  artifact_generation: 'OPENAI_MODEL_REASONING',
  title_generation: 'OPENAI_MODEL_TITLE',
  embedding: 'OPENAI_MODEL_EMBEDDING',
  moderation: 'OPENAI_MODEL_MODERATION',
  image_generation: 'OPENAI_MODEL_IMAGE',
};

/**
 * Get the model name for a given task from environment variables.
 * Throws if the environment variable is not set.
 */
export function getModelForTask(task: ModelTask): string {
  const envKey = MODEL_ENV_MAP[task];
  const model = process.env[envKey];
  if (!model) {
    throw new Error(
      `Model not configured for task "${task}". Set environment variable ${envKey}.`
    );
  }
  return model;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' } | { type: 'text' };
  stream?: boolean;
  chatId?: string;
  messageId?: string;
}

export interface ChatCompletionResult {
  content: string;
  metadata: ModelRunMetadata;
}

/**
 * Create a chat completion using the model appropriate for the given task.
 * Logs the run and tracks latency and token counts.
 */
export async function createChatCompletion(
  task: ModelTask,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const { createOpenAIClient } = await import('./openai-client');
  const client = createOpenAIClient();
  const model = getModelForTask(task);
  const startTime = Date.now();

  logger.info('model_call_start', {
    task,
    model,
    messageCount: messages.length,
    chatId: options.chatId,
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      response_format: options.responseFormat,
    });

    const latencyMs = Date.now() - startTime;
    const choice = response.choices[0];
    const content = choice.message.content ?? '';
    const usage = response.usage;

    const metadata: ModelRunMetadata = {
      model,
      task,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      latencyMs,
      status: 'success',
    };

    logger.info('model_call_complete', {
      task,
      model,
      latencyMs,
      totalTokens: metadata.totalTokens,
      chatId: options.chatId,
    });

    return { content, metadata };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('model_call_error', {
      task,
      model,
      latencyMs,
      error: errorMessage,
      chatId: options.chatId,
    });

    throw error;
  }
}

/**
 * Create an embedding for the given text.
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const { createOpenAIClient } = await import('./openai-client');
  const client = createOpenAIClient();
  const model = getModelForTask('embedding');
  const startTime = Date.now();

  try {
    const response = await client.embeddings.create({
      model,
      input: text,
    });

    const latencyMs = Date.now() - startTime;
    logger.info('embedding_complete', { model, latencyMs });

    return response.data[0].embedding;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('embedding_error', { error: errorMessage });
    throw error;
  }
}

/**
 * Generate an image from a prompt.
 */
export async function createImage(
  prompt: string,
  options: { size?: '1024x1024' | '1792x1024' | '1024x1792'; quality?: 'standard' | 'hd' } = {}
): Promise<string> {
  const { createOpenAIClient } = await import('./openai-client');
  const client = createOpenAIClient();
  const model = getModelForTask('image_generation');
  const startTime = Date.now();

  try {
    const response = await client.images.generate({
      model,
      prompt,
      size: options.size ?? '1792x1024',
      quality: options.quality ?? 'hd',
      n: 1,
    });

    const latencyMs = Date.now() - startTime;
    logger.info('image_generation_complete', { model, latencyMs });

    const url = response.data[0].url;
    if (!url) {
      throw new Error('No image URL returned from image generation API');
    }
    return url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('image_generation_error', { error: errorMessage });
    throw error;
  }
}

/**
 * Moderate content using the moderation API.
 */
export async function moderateContent(
  text: string
): Promise<{ flagged: boolean; categories: Record<string, boolean> }> {
  const { createOpenAIClient } = await import('./openai-client');
  const client = createOpenAIClient();
  const model = getModelForTask('moderation');

  try {
    const response = await client.moderations.create({
      model,
      input: text,
    });

    const result = response.results[0];
    return {
      flagged: result.flagged,
      categories: result.categories as unknown as Record<string, boolean>,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('moderation_error', { error: errorMessage });
    throw error;
  }
}
