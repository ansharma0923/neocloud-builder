'use client';

import { cn } from '@/lib/utils';
import type { ProvenanceMetadata } from '@/types/planning';

interface ProvenanceBadgeProps {
  provenance: ProvenanceMetadata;
  showLabel?: boolean;
}

const SOURCE_CONFIG = {
  user_input: { label: 'User', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
  uploaded_file: { label: 'File', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  workspace_confirmed: { label: 'Confirmed', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  llm_inference: { label: 'Inferred', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  llm_estimate: { label: 'Estimate', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  system_default: { label: 'Default', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
} as const;

export function ProvenanceBadge({ provenance, showLabel = true }: ProvenanceBadgeProps) {
  const config = SOURCE_CONFIG[provenance.sourceType] ?? SOURCE_CONFIG.system_default;

  return (
    <span
      title={[
        `Source: ${provenance.sourceType}`,
        `Confidence: ${provenance.confidence}`,
        provenance.notes ? `Notes: ${provenance.notes}` : '',
        `Updated: ${provenance.lastUpdatedAt}`,
        `By: ${provenance.lastUpdatedBy}`,
      ].filter(Boolean).join('\n')}
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border',
        config.color
      )}
    >
      {showLabel && config.label}
    </span>
  );
}
