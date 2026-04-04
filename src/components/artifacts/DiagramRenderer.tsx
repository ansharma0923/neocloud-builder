'use client';

import type { DiagramSpec, DiagramNode, DiagramZone } from '@/types/planning';

interface DiagramRendererProps {
  spec: DiagramSpec;
  width?: number;
  height?: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const DEFAULT_ZONE_COLOR = '#4f46e5';

function zoneColor(zone: DiagramZone | undefined): string {
  return zone?.color ?? DEFAULT_ZONE_COLOR;
}

// ─── Topology 2D ─────────────────────────────────────────────────────────────

function Topology2D({ spec, width, height }: { spec: DiagramSpec; width: number; height: number }) {
  const PADDING = 32;
  const BAND_LABEL_W = 0;
  const NODE_W = 80;
  const NODE_H = 32;
  const ROW_H = 80;
  const HEADER_H = 30;

  // Group nodes into layers by zone
  const zoneMap = new Map<string, DiagramZone>(spec.zones.map((z) => [z.id, z]));
  const nodeZone = new Map<string, DiagramZone>();
  for (const zone of spec.zones) {
    for (const nid of zone.nodes) {
      const z = zoneMap.get(zone.id);
      if (z) nodeZone.set(nid, z);
    }
  }

  // Order zones top→bottom (spine, leaf, compute order)
  const ZONE_ORDER = ['spine', 'leaf', 'compute', 'network', 'management', 'infrastructure'];
  const sortedZones = [...spec.zones].sort((a, b) => {
    const ai = ZONE_ORDER.findIndex((k) => a.id.includes(k));
    const bi = ZONE_ORDER.findIndex((k) => b.id.includes(k));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Assign y rows
  const zoneRow = new Map<string, number>();
  sortedZones.forEach((z, i) => zoneRow.set(z.id, i));
  const numRows = sortedZones.length || 1;

  const usableW = width - PADDING * 2 - BAND_LABEL_W;
  const usableH = height - PADDING - HEADER_H;
  const rowHeight = Math.max(ROW_H, usableH / numRows);

  // Assign x positions per zone row
  const nodePos = new Map<string, { x: number; y: number }>();
  for (const zone of sortedZones) {
    const row = zoneRow.get(zone.id) ?? 0;
    const nodesInZone = zone.nodes;
    const count = nodesInZone.length;
    nodesInZone.forEach((nid, i) => {
      const x = PADDING + BAND_LABEL_W + (usableW / (count + 1)) * (i + 1) - NODE_W / 2;
      const y = HEADER_H + PADDING / 2 + row * rowHeight + (rowHeight - NODE_H) / 2;
      nodePos.set(nid, { x, y });
    });
  }

  const nodeMap = new Map<string, DiagramNode>(spec.nodes.map((n) => [n.id, n]));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#0a0a0a', display: 'block' }}
    >
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#4b5563" />
        </marker>
      </defs>

      {/* Title */}
      <text
        x={PADDING}
        y={18}
        fontFamily="ui-monospace, monospace"
        fontSize={13}
        fontWeight={600}
        fill="#e5e7eb"
      >
        {spec.title}
      </text>

      {/* Zone bands */}
      {sortedZones.map((zone) => {
        const row = zoneRow.get(zone.id) ?? 0;
        const color = zoneColor(zone);
        const y = HEADER_H + PADDING / 2 + row * rowHeight;
        return (
          <rect
            key={zone.id}
            x={PADDING}
            y={y}
            width={usableW}
            height={rowHeight - 4}
            rx={6}
            fill={hexToRgba(color, 0.08)}
            stroke={hexToRgba(color, 0.25)}
            strokeWidth={1}
          />
        );
      })}

      {/* Zone labels */}
      {sortedZones.map((zone) => {
        const row = zoneRow.get(zone.id) ?? 0;
        const color = zoneColor(zone);
        const y = HEADER_H + PADDING / 2 + row * rowHeight + 12;
        return (
          <text
            key={`label-${zone.id}`}
            x={PADDING + 8}
            y={y}
            fontFamily="ui-monospace, monospace"
            fontSize={9}
            fill={color}
            opacity={0.8}
          >
            {zone.label}
          </text>
        );
      })}

      {/* Edges */}
      {spec.edges.map((edge) => {
        const src = nodePos.get(edge.source);
        const tgt = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const x1 = src.x + NODE_W / 2;
        const y1 = src.y + NODE_H;
        const x2 = tgt.x + NODE_W / 2;
        const y2 = tgt.y;
        return (
          <line
            key={edge.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#4b5563"
            strokeWidth={1.5}
            markerEnd={edge.type === 'directed' ? 'url(#arrow)' : undefined}
          />
        );
      })}

      {/* Nodes */}
      {spec.nodes.map((node) => {
        const pos = nodePos.get(node.id);
        if (!pos) return null;
        const zone = nodeZone.get(node.id);
        const color = zoneColor(zone);
        return (
          <g key={node.id}>
            <rect
              x={pos.x}
              y={pos.y}
              width={NODE_W}
              height={NODE_H}
              rx={4}
              fill={hexToRgba(color, 0.2)}
              stroke={color}
              strokeWidth={1.5}
            />
            <text
              x={pos.x + NODE_W / 2}
              y={pos.y + NODE_H / 2 + 4}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={9}
              fill="#f5f5f5"
            >
              {node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Logical Arch ─────────────────────────────────────────────────────────────

function LogicalArch({ spec, width, height }: { spec: DiagramSpec; width: number; height: number }) {
  const PADDING = 32;
  const LEFT_LABEL_W = 72;
  const NODE_W = 90;
  const NODE_H = 34;
  const HEADER_H = 28;

  const usableH = height - HEADER_H - PADDING;
  const laneH = Math.max(60, usableH / Math.max(spec.zones.length, 1));
  const usableW = width - PADDING * 2 - LEFT_LABEL_W;

  const zoneMap = new Map<string, DiagramZone>(spec.zones.map((z) => [z.id, z]));
  const nodeZone = new Map<string, DiagramZone>();
  for (const zone of spec.zones) {
    for (const nid of zone.nodes) {
      const z = zoneMap.get(zone.id);
      if (z) nodeZone.set(nid, z);
    }
  }

  const nodePos = new Map<string, { x: number; y: number }>();
  spec.zones.forEach((zone, zi) => {
    const count = zone.nodes.length;
    zone.nodes.forEach((nid, i) => {
      const x = PADDING + LEFT_LABEL_W + (usableW / (count + 1)) * (i + 1) - NODE_W / 2;
      const y = HEADER_H + zi * laneH + (laneH - NODE_H) / 2;
      nodePos.set(nid, { x, y });
    });
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#0a0a0a', display: 'block' }}
    >
      <defs>
        <marker id="arrow-la" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#4b5563" />
        </marker>
      </defs>

      {/* Title */}
      <text
        x={PADDING}
        y={18}
        fontFamily="ui-monospace, monospace"
        fontSize={13}
        fontWeight={600}
        fill="#e5e7eb"
      >
        {spec.title}
      </text>

      {/* Swimlane bands */}
      {spec.zones.map((zone, zi) => {
        const color = zoneColor(zone);
        const y = HEADER_H + zi * laneH;
        return (
          <g key={zone.id}>
            <rect
              x={PADDING + LEFT_LABEL_W}
              y={y + 2}
              width={usableW}
              height={laneH - 4}
              rx={4}
              fill={hexToRgba(color, 0.07)}
              stroke={hexToRgba(color, 0.2)}
              strokeWidth={1}
            />
            <text
              x={PADDING + LEFT_LABEL_W - 6}
              y={y + laneH / 2 + 4}
              textAnchor="end"
              fontFamily="ui-monospace, monospace"
              fontSize={9}
              fill={color}
            >
              {zone.label.length > 10 ? zone.label.slice(0, 9) + '…' : zone.label}
            </text>
          </g>
        );
      })}

      {/* Edges — quadratic bezier */}
      {spec.edges.map((edge) => {
        const src = nodePos.get(edge.source);
        const tgt = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const x1 = src.x + NODE_W / 2;
        const y1 = src.y + NODE_H;
        const x2 = tgt.x + NODE_W / 2;
        const y2 = tgt.y;
        const cy = (y1 + y2) / 2;
        return (
          <path
            key={edge.id}
            d={`M${x1},${y1} Q${x1},${cy} ${x2},${y2}`}
            fill="none"
            stroke="#4b5563"
            strokeWidth={1.5}
            markerEnd="url(#arrow-la)"
          />
        );
      })}

      {/* Nodes */}
      {spec.nodes.map((node) => {
        const pos = nodePos.get(node.id);
        if (!pos) return null;
        const zone = nodeZone.get(node.id);
        const color = zoneColor(zone);
        return (
          <g key={node.id}>
            <rect
              x={pos.x}
              y={pos.y}
              width={NODE_W}
              height={NODE_H}
              rx={4}
              fill={hexToRgba(color, 0.2)}
              stroke={color}
              strokeWidth={1.5}
            />
            <text
              x={pos.x + NODE_W / 2}
              y={pos.y + NODE_H / 2 + 4}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={9}
              fill="#f5f5f5"
            >
              {node.label.length > 13 ? node.label.slice(0, 12) + '…' : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Site Layout ──────────────────────────────────────────────────────────────

function SiteLayout({ spec, width, height }: { spec: DiagramSpec; width: number; height: number }) {
  const PADDING = 32;
  const HEADER_H = 28;
  const ROOM_W = 110;
  const ROOM_H = 60;
  const COLS = 2;
  const GAP = 16;

  const usableW = width - PADDING * 2;
  const colW = usableW / COLS;

  const zoneMap = new Map<string, DiagramZone>(spec.zones.map((z) => [z.id, z]));
  const nodeZone = new Map<string, DiagramZone>();
  for (const zone of spec.zones) {
    for (const nid of zone.nodes) {
      const z = zoneMap.get(zone.id);
      if (z) nodeZone.set(nid, z);
    }
  }

  const nodePos = new Map<string, { x: number; y: number }>();
  spec.nodes.forEach((node, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PADDING + col * colW + (colW - ROOM_W) / 2;
    const y = HEADER_H + PADDING / 2 + row * (ROOM_H + GAP);
    nodePos.set(node.id, { x, y });
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#0a0a0a', display: 'block' }}
    >
      <defs>
        <marker id="arrow-sl" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#374151" />
        </marker>
      </defs>

      {/* Title */}
      <text
        x={PADDING}
        y={18}
        fontFamily="ui-monospace, monospace"
        fontSize={13}
        fontWeight={600}
        fill="#e5e7eb"
      >
        {spec.title}
      </text>

      {/* Edges — dashed */}
      {spec.edges.map((edge) => {
        const src = nodePos.get(edge.source);
        const tgt = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        return (
          <line
            key={edge.id}
            x1={src.x + ROOM_W / 2}
            y1={src.y + ROOM_H / 2}
            x2={tgt.x + ROOM_W / 2}
            y2={tgt.y + ROOM_H / 2}
            stroke="#374151"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd="url(#arrow-sl)"
          />
        );
      })}

      {/* Rooms */}
      {spec.nodes.map((node) => {
        const pos = nodePos.get(node.id);
        if (!pos) return null;
        const zone = nodeZone.get(node.id);
        const color = zoneColor(zone);
        return (
          <g key={node.id}>
            <rect
              x={pos.x}
              y={pos.y}
              width={ROOM_W}
              height={ROOM_H}
              rx={6}
              fill={hexToRgba(color, 0.18)}
              stroke={color}
              strokeWidth={1.5}
            />
            <text
              x={pos.x + ROOM_W / 2}
              y={pos.y + ROOM_H / 2 + 4}
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
              fontSize={9}
              fill="#f5f5f5"
            >
              {node.label.length > 14 ? node.label.slice(0, 13) + '…' : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Fallback (rack_row / presentation / schematic) ──────────────────────────

function GenericDiagram({ spec, width, height }: { spec: DiagramSpec; width: number; height: number }) {
  // Reuse Topology2D layout as a sensible fallback
  return <Topology2D spec={spec} width={width} height={height} />;
}

// ─── Public component ─────────────────────────────────────────────────────────

export function DiagramRenderer({ spec, width = 900, height = 540 }: DiagramRendererProps) {
  switch (spec.style) {
    case 'topology_2d':
    case 'schematic':
      return <Topology2D spec={spec} width={width} height={height} />;
    case 'logical_arch':
    case 'presentation':
      return <LogicalArch spec={spec} width={width} height={height} />;
    case 'site_layout':
      return <SiteLayout spec={spec} width={width} height={height} />;
    default:
      return <GenericDiagram spec={spec} width={width} height={height} />;
  }
}
