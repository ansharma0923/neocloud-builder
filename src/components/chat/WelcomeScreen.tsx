'use client';

import { Zap } from 'lucide-react';

const EXAMPLE_PROMPTS = [
  {
    title: 'Design a GPU cluster',
    description: 'Plan a 10-rack AI training cluster with leaf-spine networking',
  },
  {
    title: 'Power and cooling',
    description: 'Calculate power requirements for 500kW data center with liquid cooling',
  },
  {
    title: 'Network topology',
    description: 'Design a 3-tier leaf-spine fabric for 256 GPU nodes',
  },
  {
    title: 'Generate a BOM',
    description: 'Create a bill of materials for a neocloud with 8 compute racks',
  },
];

interface WelcomeScreenProps {
  onPromptSelect: (prompt: string) => void;
}

export function WelcomeScreen({ onPromptSelect }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
      <div className="flex flex-col items-center mb-12">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-[#f5f5f5] mb-2">NeoCloud Builder</h1>
        <p className="text-[#a3a3a3] text-sm">AI-native infrastructure planning for AI data centers</p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-2xl w-full">
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPromptSelect(prompt.description)}
            className="text-left p-4 rounded-xl border border-[#2a2a2a] bg-[#111111] hover:bg-[#161616] hover:border-[#333333] transition-all group"
          >
            <p className="text-[#f5f5f5] text-sm font-medium mb-1 group-hover:text-indigo-400 transition-colors">{prompt.title}</p>
            <p className="text-[#525252] text-xs leading-relaxed">{prompt.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
