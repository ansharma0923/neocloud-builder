'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';

interface Message {
  id: string;
  role: string;
  content: string;
  modelId?: string | null;
  tokenCount?: number | null;
  latencyMs?: number | null;
  createdAt: string;
}

interface ChatThreadProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function ChatThread({ messages, isStreaming }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isStreaming && (
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-600/40 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex gap-1 py-3">
            <span className="w-1.5 h-1.5 bg-[#525252] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-[#525252] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-[#525252] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
          isUser
            ? 'bg-[#2a2a2a] border border-[#333333]'
            : 'bg-indigo-600/20 border border-indigo-600/40'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-[#a3a3a3]" />
        ) : (
          <Bot className="w-4 h-4 text-indigo-400" />
        )}
      </div>

      <div className={cn('max-w-[80%] min-w-0', isUser && 'items-end flex flex-col')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm',
            isUser
              ? 'bg-indigo-600/20 border border-indigo-600/30 text-[#f5f5f5]'
              : 'bg-[#111111] border border-[#2a2a2a] text-[#f5f5f5]'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-[#2a2a2a]"
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && (message.modelId || message.tokenCount || message.latencyMs) && (
          <div className="flex items-center gap-3 mt-1.5 px-1">
            {message.modelId && (
              <span className="text-[10px] text-[#525252]">{message.modelId}</span>
            )}
            {message.tokenCount && (
              <span className="text-[10px] text-[#525252]">{message.tokenCount} tokens</span>
            )}
            {message.latencyMs && (
              <span className="text-[10px] text-[#525252]">{message.latencyMs}ms</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
