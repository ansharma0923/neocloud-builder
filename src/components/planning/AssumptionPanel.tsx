'use client';

import type { AssumptionItem } from '@/types/planning';
import { cn } from '@/lib/utils';
import { Lock, Unlock } from 'lucide-react';

interface AssumptionPanelProps {
  assumptions: AssumptionItem[];
}

const CONFIDENCE_COLORS: Record<string, string> = {
  confirmed: 'text-green-400',
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-red-400',
  unknown: 'text-gray-500',
};

export function AssumptionPanel({ assumptions }: AssumptionPanelProps) {
  if (assumptions.length === 0) {
    return (
      <p className="text-[#525252] text-xs text-center py-8">
        No assumptions yet. Start planning to see inferred values.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {assumptions.map((assumption) => (
        <div
          key={assumption.id}
          className={cn(
            'p-3 rounded-lg border text-xs',
            assumption.isLocked
              ? 'bg-[#1a1a1a] border-indigo-600/30'
              : 'bg-[#161616] border-[#2a2a2a]'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-medium text-[#a3a3a3]">{assumption.field}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {assumption.isLocked ? (
                <Lock className="w-3 h-3 text-indigo-400" />
              ) : (
                <Unlock className="w-3 h-3 text-[#525252]" />
              )}
              <span className={cn('font-medium', CONFIDENCE_COLORS[assumption.confidence] ?? CONFIDENCE_COLORS.unknown)}>
                {assumption.confidence}
              </span>
            </div>
          </div>
          <p className="text-[#f5f5f5] mb-1">{String(assumption.value)}</p>
          {assumption.reasoning && (
            <p className="text-[#525252] text-[10px] leading-relaxed">{assumption.reasoning}</p>
          )}
        </div>
      ))}
    </div>
  );
}
