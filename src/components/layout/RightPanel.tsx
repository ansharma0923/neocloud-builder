'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { X, FileText, Brain, Package, Layout, Loader2, Maximize2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanonicalPlanState, DiagramSpec } from '@/types/planning';
import { DiagramRenderer } from '@/components/artifacts/DiagramRenderer';

interface RightPanelProps {
  chatId: string;
}

const DIAGRAM_FULL_W = 900;
const DIAGRAM_FULL_H = 540;

interface Artifact {
  id: string;
  type: string;
  title: string;
  status: string;
  content: string | null;
  createdAt: string;
}

const TABS = [
  { id: 'plan' as const, label: 'Plan', icon: Layout },
  { id: 'assumptions' as const, label: 'Assumptions', icon: Brain },
  { id: 'artifacts' as const, label: 'Artifacts', icon: Package },
  { id: 'files' as const, label: 'Files', icon: FileText },
];

const ARTIFACT_BUTTONS = [
  { label: '2D Topology Diagram', body: { type: 'generated_image', style: 'topology_2d' } },
  { label: 'Logical Arch Diagram', body: { type: 'generated_image', style: 'logical_arch' } },
  { label: 'Site Layout Diagram', body: { type: 'generated_image', style: 'site_layout' } },
  { label: 'Bill of Materials', body: { type: 'bom' } },
  { label: 'Cost Sheet', body: { type: 'cost_sheet' } },
  { label: 'Executive Summary', body: { type: 'summary' } },
  { label: 'Export Package', body: { type: 'export_package' } },
] as const;

export function RightPanel({ chatId }: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab, setRightPanelOpen } = useAppStore();

  const [plan, setPlan] = useState<CanonicalPlanState | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${chatId}/plan`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data?.state ?? null);
      }
    } catch {
      // ignore
    }
  }, [chatId]);

  const fetchArtifacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats/${chatId}/artifacts`);
      if (res.ok) {
        const data = await res.json();
        setArtifacts(data);
      }
    } catch {
      // ignore
    }
  }, [chatId]);

  useEffect(() => {
    if (rightPanelTab === 'plan') {
      fetchPlan();
    } else if (rightPanelTab === 'artifacts') {
      fetchArtifacts();
    }
  }, [rightPanelTab, fetchPlan, fetchArtifacts]);

  async function handleGenerate(body: Record<string, string>): Promise<void> {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/chats/${chatId}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchArtifacts();
      } else {
        const data = await res.json().catch(() => ({}));
        setGenerateError(data.error ?? 'Generation failed. Please try again.');
      }
    } catch {
      setGenerateError('Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

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
        {rightPanelTab === 'plan' && (
          <PlanTab plan={plan} />
        )}
        {rightPanelTab === 'artifacts' && (
          <ArtifactsTab
            artifacts={artifacts}
            generating={generating}
            generateError={generateError}
            onGenerate={handleGenerate}
          />
        )}
        {rightPanelTab === 'assumptions' && (
          <p className="text-center py-8 text-[#525252]">Assumptions will be listed here.</p>
        )}
        {rightPanelTab === 'files' && (
          <p className="text-center py-8 text-[#525252]">Uploaded files will be listed here.</p>
        )}
      </div>
    </aside>
  );
}

function PlanTab({ plan }: { plan: CanonicalPlanState | null }) {
  if (!plan) {
    return <p className="text-center py-8 text-[#525252]">Plan details will appear here after planning begins.</p>;
  }

  const compute = plan.computeInventory?.value ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-[#1a1a1a] rounded-lg p-3 space-y-2">
        <h3 className="text-xs font-semibold text-[#f5f5f5] uppercase tracking-wide">Overview</h3>
        <div className="flex justify-between text-xs">
          <span className="text-[#525252]">Rack Count</span>
          <span className="text-[#a3a3a3]">{plan.rackCount?.value ?? '—'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#525252]">Total Power</span>
          <span className="text-[#a3a3a3]">
            {plan.totalPower?.value != null ? `${plan.totalPower.value} kW` : '—'}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[#525252]">Rack Density</span>
          <span className="text-[#a3a3a3]">
            {plan.rackPowerDensity?.value != null ? `${plan.rackPowerDensity.value} kW/rack` : '—'}
          </span>
        </div>
      </div>

      {compute.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-lg p-3 space-y-2">
          <h3 className="text-xs font-semibold text-[#f5f5f5] uppercase tracking-wide">Compute Inventory</h3>
          {compute.map((item) => (
            <div key={item.id} className="text-xs space-y-0.5">
              <div className="flex justify-between">
                <span className="text-[#a3a3a3]">{item.vendor ?? ''} {item.model ?? item.type}</span>
                <span className="text-[#525252]">×{item.quantity ?? 1}</span>
              </div>
              {item.perRack != null && (
                <div className="text-[#525252] text-[10px]">{item.perRack}/rack</div>
              )}
            </div>
          ))}
        </div>
      )}

      {plan.project?.value?.name && (
        <div className="bg-[#1a1a1a] rounded-lg p-3 space-y-1">
          <h3 className="text-xs font-semibold text-[#f5f5f5] uppercase tracking-wide">Project</h3>
          <p className="text-xs text-[#a3a3a3]">{plan.project.value.name}</p>
          {plan.project.value.description && (
            <p className="text-[10px] text-[#525252]">{plan.project.value.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ArtifactsTab({
  artifacts,
  generating,
  generateError,
  onGenerate,
}: {
  artifacts: Artifact[];
  generating: boolean;
  generateError: string | null;
  onGenerate: (body: Record<string, string>) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[#f5f5f5] uppercase tracking-wide">Generate</h3>
        {ARTIFACT_BUTTONS.map((btn) => (
          <button
            key={btn.label}
            disabled={generating}
            onClick={() => onGenerate(btn.body as Record<string, string>)}
            className="w-full text-left px-3 py-2 rounded bg-[#1a1a1a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#222222] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {generateError && (
        <p className="text-xs text-red-400 py-1">{generateError}</p>
      )}

      {generating && (
        <div className="flex items-center gap-2 text-xs text-[#a3a3a3] py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Building diagram...</span>
        </div>
      )}

      {artifacts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#f5f5f5] uppercase tracking-wide">Generated</h3>
          {artifacts.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      )}

      {artifacts.length === 0 && !generating && (
        <p className="text-center py-4 text-[#525252] text-xs">Generated artifacts will appear here.</p>
      )}
    </div>
  );
}

function DiagramThumbnail({ spec, svgId, onClick }: { spec: DiagramSpec; svgId: string; onClick: () => void }) {
  const scale = 256 / DIAGRAM_FULL_W;
  const thumbH = Math.round(DIAGRAM_FULL_H * scale);
  return (
    <div
      className="relative cursor-pointer group"
      style={{ width: 256, height: thumbH, overflow: 'hidden' }}
      onClick={onClick}
    >
      <div style={{ width: DIAGRAM_FULL_W, height: DIAGRAM_FULL_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <DiagramRenderer spec={spec} width={DIAGRAM_FULL_W} height={DIAGRAM_FULL_H} svgId={svgId} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white font-medium flex items-center gap-1">
          <Maximize2 className="w-3.5 h-3.5" />
          Click to expand
        </span>
      </div>
    </div>
  );
}

function DiagramModal({ spec, svgId, title, onClose }: { spec: DiagramSpec; svgId: string; title: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSavePng() {
    const svgEl = document.getElementById(svgId) as SVGSVGElement | null;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const SCALE = 2;
      const canvas = document.createElement('canvas');
      canvas.width = DIAGRAM_FULL_W * SCALE;
      canvas.height = DIAGRAM_FULL_H * SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      const safeName = title.replace(/[/\\:*?"<>|\x00]/g, '_').replace(/\s+/g, '_');
      a.download = `${safeName}.png`;
      a.click();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] rounded-xl overflow-hidden flex flex-col"
        style={{ width: DIAGRAM_FULL_W + 32, maxWidth: '98vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a]">
          <span className="text-sm font-medium text-[#f5f5f5]">{title}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSavePng}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#1a1a1a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#222222] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Save as PNG
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[#1a1a1a] text-[#525252] hover:text-[#a3a3a3]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-auto">
          <DiagramRenderer spec={spec} width={DIAGRAM_FULL_W} height={DIAGRAM_FULL_H} svgId={svgId} />
        </div>
      </div>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [modalOpen, setModalOpen] = useState(false);
  let parsedContent: Record<string, unknown> | null = null;
  try {
    if (artifact.content) {
      parsedContent = JSON.parse(artifact.content);
    }
  } catch {
    // ignore
  }

  const diagramSpec: DiagramSpec | null =
    artifact.type === 'generated_image' &&
    parsedContent &&
    'nodes' in parsedContent &&
    'style' in parsedContent
      ? (parsedContent as unknown as DiagramSpec)
      : null;

  const svgId = `diagram-svg-${artifact.id}`;

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[#a3a3a3] font-medium leading-tight">{artifact.title}</p>
        <span className="text-[10px] text-[#525252] shrink-0">{artifact.type}</span>
      </div>
      {diagramSpec && (
        <div className="w-full rounded border border-[#2a2a2a] overflow-hidden">
          <DiagramThumbnail spec={diagramSpec} svgId={`thumb-${svgId}`} onClick={() => setModalOpen(true)} />
        </div>
      )}
      {diagramSpec && modalOpen && (
        <DiagramModal
          spec={diagramSpec}
          svgId={svgId}
          title={artifact.title}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
