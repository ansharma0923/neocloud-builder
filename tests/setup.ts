// Test setup file
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.OPENAI_MODEL_FAST = 'gpt-4o-mini';
process.env.OPENAI_MODEL_REASONING = 'o1-preview';
process.env.OPENAI_MODEL_FILE_QA = 'gpt-4o';
process.env.OPENAI_MODEL_STRUCTURED = 'gpt-4o';
process.env.OPENAI_MODEL_IMAGE = 'dall-e-3';
process.env.OPENAI_MODEL_TITLE = 'gpt-4o-mini';
process.env.OPENAI_MODEL_EMBEDDING = 'text-embedding-3-small';
process.env.OPENAI_MODEL_MODERATION = 'omni-moderation-latest';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
