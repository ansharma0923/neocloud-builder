'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquare, Trash2, Edit3, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isToday, isYesterday, subDays, isAfter } from 'date-fns';

interface Chat {
  id: string;
  title: string;
  updatedAt: string;
}

interface SidebarProps {
  currentChatId?: string;
}

export function Sidebar({ currentChatId }: SidebarProps) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    fetchChats();
  }, []);

  async function fetchChats() {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createNewChat() {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' }),
    });
    if (res.ok) {
      const chat = await res.json();
      router.push(`/chat/${chat.id}`);
      fetchChats();
    }
  }

  async function deleteChat(id: string) {
    await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (currentChatId === id) {
      router.push('/');
    }
  }

  async function renameChat(id: string, title: string) {
    await fetch(`/api/chats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    setEditingId(null);
  }

  function groupChats(chats: Chat[]) {
    const today: Chat[] = [];
    const yesterday: Chat[] = [];
    const week: Chat[] = [];
    const older: Chat[] = [];

    for (const chat of chats) {
      const date = new Date(chat.updatedAt);
      if (isToday(date)) today.push(chat);
      else if (isYesterday(date)) yesterday.push(chat);
      else if (isAfter(date, subDays(new Date(), 7))) week.push(chat);
      else older.push(chat);
    }
    return { today, yesterday, week, older };
  }

  const groups = groupChats(chats);

  return (
    <aside className="w-60 flex-shrink-0 bg-[#111111] border-r border-[#2a2a2a] flex flex-col h-full">
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-[#f5f5f5] text-sm">NeoCloud Builder</span>
        </div>
      </div>

      <div className="p-3">
        <button
          onClick={createNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="text-[#525252] text-xs text-center py-4">Loading...</div>
        ) : chats.length === 0 ? (
          <div className="text-[#525252] text-xs text-center py-4">No chats yet</div>
        ) : (
          <>
            {groups.today.length > 0 && (
              <ChatGroup label="Today" chats={groups.today} currentChatId={currentChatId} onDelete={deleteChat} onRename={renameChat} editingId={editingId} setEditingId={setEditingId} editTitle={editTitle} setEditTitle={setEditTitle} />
            )}
            {groups.yesterday.length > 0 && (
              <ChatGroup label="Yesterday" chats={groups.yesterday} currentChatId={currentChatId} onDelete={deleteChat} onRename={renameChat} editingId={editingId} setEditingId={setEditingId} editTitle={editTitle} setEditTitle={setEditTitle} />
            )}
            {groups.week.length > 0 && (
              <ChatGroup label="Last 7 Days" chats={groups.week} currentChatId={currentChatId} onDelete={deleteChat} onRename={renameChat} editingId={editingId} setEditingId={setEditingId} editTitle={editTitle} setEditTitle={setEditTitle} />
            )}
            {groups.older.length > 0 && (
              <ChatGroup label="Older" chats={groups.older} currentChatId={currentChatId} onDelete={deleteChat} onRename={renameChat} editingId={editingId} setEditingId={setEditingId} editTitle={editTitle} setEditTitle={setEditTitle} />
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function ChatGroup({
  label,
  chats,
  currentChatId,
  onDelete,
  onRename,
  editingId,
  setEditingId,
  editTitle,
  setEditTitle,
}: {
  label: string;
  chats: Chat[];
  currentChatId?: string;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editTitle: string;
  setEditTitle: (title: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-[#525252] text-xs font-medium px-3 py-1 uppercase tracking-wide">{label}</p>
      {chats.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isActive={chat.id === currentChatId}
          onDelete={onDelete}
          onRename={onRename}
          isEditing={editingId === chat.id}
          editTitle={editTitle}
          setEditingId={setEditingId}
          setEditTitle={setEditTitle}
        />
      ))}
    </div>
  );
}

function ChatItem({
  chat,
  isActive,
  onDelete,
  onRename,
  isEditing,
  editTitle,
  setEditingId,
  setEditTitle,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isEditing: boolean;
  editTitle: string;
  setEditingId: (id: string | null) => void;
  setEditTitle: (title: string) => void;
}) {
  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg px-3 py-2 text-sm cursor-pointer',
        isActive ? 'bg-[#1a1a1a] text-[#f5f5f5]' : 'text-[#a3a3a3] hover:bg-[#161616] hover:text-[#f5f5f5]'
      )}
    >
      {isEditing ? (
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename(chat.id, editTitle);
            if (e.key === 'Escape') setEditingId(null);
          }}
          onBlur={() => onRename(chat.id, editTitle)}
          className="flex-1 bg-transparent outline-none text-[#f5f5f5] text-sm"
          onClick={(e) => e.preventDefault()}
        />
      ) : (
        <Link href={`/chat/${chat.id}`} className="flex-1 truncate min-w-0 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{chat.title}</span>
        </Link>
      )}

      {!isEditing && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
          <button
            onClick={(e) => { e.preventDefault(); setEditingId(chat.id); setEditTitle(chat.title); }}
            className="p-1 rounded hover:bg-[#2a2a2a] text-[#525252] hover:text-[#a3a3a3]"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); onDelete(chat.id); }}
            className="p-1 rounded hover:bg-[#2a2a2a] text-[#525252] hover:text-red-400"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
