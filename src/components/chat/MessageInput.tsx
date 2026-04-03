'use client';

import { useState, useRef, useCallback } from 'react';
import { SendHorizontal, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

interface MessageInputProps {
  onSend: (content: string, files?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadQueue, addToUploadQueue, removeFromUploadQueue } = useAppStore();

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed && uploadQueue.length === 0) return;
    onSend(trimmed, uploadQueue.length > 0 ? uploadQueue : undefined);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, uploadQueue, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((f) => addToUploadQueue(f));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => addToUploadQueue(f));
  };

  const canSend = (value.trim().length > 0 || uploadQueue.length > 0) && !disabled;

  return (
    <div className="px-4 pb-6 pt-2">
      {uploadQueue.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {uploadQueue.map((file) => (
            <div
              key={file.name}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161616] border border-[#2a2a2a] rounded-full text-xs text-[#a3a3a3]"
            >
              <span className="truncate max-w-[160px]">{file.name}</span>
              <button
                onClick={() => removeFromUploadQueue(file.name)}
                className="text-[#525252] hover:text-[#a3a3a3]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className="relative flex items-end gap-2 bg-[#111111] border border-[#2a2a2a] rounded-2xl px-4 py-3 focus-within:border-indigo-600/60 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg text-[#525252] hover:text-[#a3a3a3] hover:bg-[#1a1a1a] transition-colors flex-shrink-0"
          type="button"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Describe your AI data center requirements...'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-[#f5f5f5] text-sm placeholder-[#525252] outline-none resize-none min-h-[24px] max-h-40 leading-6"
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'p-1.5 rounded-lg transition-colors flex-shrink-0',
            canSend
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'bg-[#1a1a1a] text-[#525252] cursor-not-allowed'
          )}
          type="button"
        >
          <SendHorizontal className="w-4 h-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.json,.png,.jpg,.jpeg,.webp"
      />

      <p className="text-[10px] text-[#525252] text-center mt-2">
        Enter to send · Shift+Enter for newline · Drag and drop files
      </p>
    </div>
  );
}
