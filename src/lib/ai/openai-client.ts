import OpenAI from 'openai';

let clientInstance: OpenAI | null = null;

/**
 * Get or create the OpenAI client singleton.
 * Reads API key from environment variable.
 */
export function createOpenAIClient(): OpenAI {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. Configure it in your .env.local file.'
    );
  }

  clientInstance = new OpenAI({ apiKey });
  return clientInstance;
}

/**
 * Reset the client (useful for testing).
 */
export function resetOpenAIClient(): void {
  clientInstance = null;
}
