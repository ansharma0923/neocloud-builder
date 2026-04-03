'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ChatThread } from '@/components/chat/ChatThread';
import { MessageInput } from '@/components/chat/MessageInput';
import { WelcomeScreen } from '@/components/chat/WelcomeScreen';
import { useAppStore } from '@/store/app-store';
import { SlidersHorizontal } from 'lucide-react';

interface Message {
  id: string;
  role: string;
  content: string;
  modelId?: string | null;
  tokenCount?: number | null;
  latencyMs?: number | null;
  createdAt: string;
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { chatId } = params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { setCurrentChatId, setRightPanelOpen, clearUploadQueue, uploadQueue } = useAppStore();

  useEffect(() => {
    setCurrentChatId(chatId);
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/chats/${chatId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleSend = useCallback(async (content: string, files?: File[]) => {
    if (!content.trim() && !files?.length) return;

    setSending(true);
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      if (files && files.length > 0) {
        await Promise.all(
          files.map((file) => {
            const formData = new FormData();
            formData.append('file', file);
            return fetch(`/api/chats/${chatId}/upload`, { method: 'POST', body: formData });
          })
        );
        clearUploadQueue();
      }

      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith('temp-')),
          data.userMessage,
          data.assistantMessage,
        ]);
      }
    } finally {
      setSending(false);
    }
  }, [chatId, clearUploadQueue]);

  return (
    <AppShell chatId={chatId}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          <h1 className="text-sm font-medium text-[#a3a3a3]">Chat</h1>
          <button
            onClick={() => setRightPanelOpen(true)}
            className="p-2 rounded-lg text-[#525252] hover:text-[#a3a3a3] hover:bg-[#111111] transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[#525252] text-sm">Loading...</div>
        ) : messages.length === 0 ? (
          <WelcomeScreen onPromptSelect={(prompt) => handleSend(prompt)} />
        ) : (
          <ChatThread messages={messages} isStreaming={sending} />
        )}

        <MessageInput
          onSend={handleSend}
          disabled={sending}
          placeholder="Describe your AI data center requirements..."
        />
      </div>
    </AppShell>
  );
}
