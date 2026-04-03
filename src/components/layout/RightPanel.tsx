'use client';

import { useAppStore } from '@/store/app-store';
import { X, FileText, Brain, Package, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RightPanelProps {
  chatId: string;
}

const TABS = [
  { id: 'plan' as const, label: 'Plan', icon: Layout },
  { id: 'assumptions' as const, label: 'Assumptions', icon: Brain },
  { id: 'artifacts' as const, label: 'Artifacts', icon: Package },
  { id: 'files' as const, label: 'Files', icon: FileText },
];

export function RightPanel({ chatId: _chatId }: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab, setRightPanelOpen } = useAppStore();

  return (
    <aside className="w-80 flex-shrink-0 bg-[#111111] border-l border-[#2a2a2a] flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-[#2a2a2a]">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setRightPanelTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
                  rightPanelTab === tab.id
                    ? 'bg-[#1a1a1a] text-[#f5f5f5]'
                    : 'text-[#525252] hover:text-[#a3a3a3]'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="p-1 rounded hover:bg-[#1a1a1a] text-[#525252] hover:text-[#a3a3a3]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm text-[#a3a3a3]">
        <p className="text-center py-8 text-[#525252]">
          {rightPanelTab === 'plan' && 'Plan details will appear here after planning begins.'}
          {rightPanelTab === 'assumptions' && 'Assumptions will be listed here.'}
          {rightPanelTab === 'artifacts' && 'Generated artifacts will appear here.'}
          {rightPanelTab === 'files' && 'Uploaded files will be listed here.'}
        </p>
      </div>
    </aside>
  );
}
