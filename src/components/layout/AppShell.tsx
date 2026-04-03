'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { useAppStore } from '@/store/app-store';

interface AppShellProps {
  children: ReactNode;
  chatId?: string;
}

export function AppShell({ children, chatId }: AppShellProps) {
  const { rightPanelOpen } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar currentChatId={chatId} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>

      {rightPanelOpen && chatId && (
        <RightPanel chatId={chatId} />
      )}
    </div>
  );
}
