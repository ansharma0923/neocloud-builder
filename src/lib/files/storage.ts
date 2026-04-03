import fs from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/observability/logger';

export interface StorageAdapter {
  save(storagePath: string, buffer: Buffer, metadata: Record<string, unknown>): Promise<string>;
  get(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
}

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? process.env.LOCAL_STORAGE_PATH ?? './uploads';
  }

  private resolvePath(storagePath: string): string {
    // Prevent path traversal attacks
    const normalized = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.basePath, normalized);
  }

  async save(
    storagePath: string,
    buffer: Buffer,
    metadata: Record<string, unknown>
  ): Promise<string> {
    const fullPath = this.resolvePath(storagePath);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, buffer);

    // Write metadata sidecar file
    const metaPath = `${fullPath}.meta.json`;
    await fs.writeFile(metaPath, JSON.stringify({ ...metadata, savedAt: new Date().toISOString() }, null, 2));

    logger.info('storage_save', { storagePath, size: buffer.length });
    return storagePath;
  }

  async get(storagePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(storagePath);
    const buffer = await fs.readFile(fullPath);
    logger.info('storage_get', { storagePath, size: buffer.length });
    return buffer;
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = this.resolvePath(storagePath);
    await fs.unlink(fullPath).catch(() => {});
    await fs.unlink(`${fullPath}.meta.json`).catch(() => {});
    logger.info('storage_delete', { storagePath });
  }

  async exists(storagePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(storagePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton storage adapter
let storageInstance: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (storageInstance) return storageInstance;

  const adapter = process.env.STORAGE_ADAPTER ?? 'local';
  if (adapter === 'local') {
    storageInstance = new LocalStorageAdapter();
  } else {
    throw new Error(`Unknown storage adapter: ${adapter}. Supported: local`);
  }

  return storageInstance;
}
