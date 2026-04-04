'use client';

import type { DiagramSpec, DiagramNode, DiagramZone } from '@/types/planning';

interface DiagramRendererProps {
  spec: DiagramSpec;
  width?: number;
  height?: number;
  svgId?: string;
}

// ─── Mandatory color palette ──────────────────────────────────────────────────
// These colors are fixed by the design system. Do not add or change them.

const PALETTE = {
  core:       '#2563EB', // Primary Fabric / Core
  storage:    '#16A34A', // Data / Storage
  services:   '#06B6D4', // Front-end / Services
  management: '#F59E0B', // Management
  security:   '#EF4444', // Security / Boundary
  accel:      '#9333EA', // Special Compute / Accel
  altCompute: '#F97316', // Alternative Compute
  secCompute: '#EAB308', // Secondary Compute
  compute:    '#60A5FA', // General Compute
  reserved:   '#E5E7EB', // Reserved / Empty
} as const;

// Zone-id → color using the mandatory palette
const ZONE_COLOR_MAP: Record<string, string> = {
  spine:          PALETTE.core,
  leaf:           PALETTE.services,
  compute:        PALETTE.compute,
  storage:        PALETTE.storage,
  management:     PALETTE.management,
  control:        PALETTE.services,
  network:        PALETTE.core,
  infrastructure: PALETTE.management,
  data_hall:      PALETTE.compute,
  utility:        PALETTE.management,
  facility:       PALETTE.reserved,
  security:       PALETTE.security,
  row:            PALETTE.compute,
};

// Edge type → stroke color
const EDGE_COLOR_MAP: Record<string, string> = {
  uplink:     PALETTE.core,
  downlink:   PALETTE.services,
  management: PALETTE.management,
  control:    PALETTE.management,
  data:       PALETTE.core,
  storage:    PALETTE.storage,
  power:      PALETTE.security,
  cooling:    PALETTE.accel,
  network:    PALETTE.core,
  directed:   PALETTE.core,
};

const DEFAULT_ZONE_COLOR = PALETTE.core;
const DEFAULT_EDGE_COLOR = PALETTE.core;

const BG_COLOR     = '#FFFFFF';
const TEXT_DARK    = '#1E293B';
const TEXT_MUTED   = '#64748B';
const FONT_FAMILY  = 'Arial, Helvetica, sans-serif';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function zoneColorFor(zone: DiagramZone | undefined, fallback = DEFAULT_ZONE_COLOR): string {
  if (!zone) return fallback;
  if (zone.color) return zone.color;
  for (const key of Object.keys(ZONE_COLOR_MAP)) {
    if (zone.id.includes(key)) return ZONE_COLOR_MAP[key];
  }
  return fallback;
}

function edgeColorFor(type?: string): string {
  if (!type) return DEFAULT_EDGE_COLOR;
  return EDGE_COLOR_MAP[type] ?? DEFAULT_EDGE_COLOR;
}

// ─── Arrow marker defs ────────────────────────────────────────────────────────

const MARKER_COLORS: [string, string][] = [
  ['core',       PALETTE.core],
  ['services',   PALETTE.services],
  ['management', PALETTE.management],
  ['storage',    PALETTE.storage],
  ['security',   PALETTE.security],
  ['accel',      PALETTE.accel],
  ['compute',    PALETTE.compute],
  ['default',    DEFAULT_EDGE_COLOR],
];

function ArrowDefs() {
  return (
    <defs>
      {MARKER_COLORS.map(([name, color]) => (
        <marker key={name} id={`arw-${name}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

function markerIdFor(edgeType?: string): string {
  if (!edgeType) return 'arw-default';
  if (edgeType === 'uplink' || edgeType === 'data' || edgeType === 'network') return 'arw-core';
  if (edgeType === 'downlink')   return 'arw-services';
  if (edgeType === 'management' || edgeType === 'control') return 'arw-management';
  if (edgeType === 'storage')    return 'arw-storage';
  if (edgeType === 'power')      return 'arw-security';
  if (edgeType === 'cooling')    return 'arw-accel';
  return 'arw-default';
}

// ─── Legend component ─────────────────────────────────────────────────────────

interface LegendEntry { label: string; color: string; }

function DiagramLegend({
  x, y, width,
  nodeEntries,
  edgeEntries,
}: {
  x: number;
  y: number;
  width: number;
  nodeEntries: LegendEntry[];
  edgeEntries: LegendEntry[];
}) {
  const SWATCH = 12;
  const ROW_H  = 18;
  const COL_W  = Math.max(120, width / 2 - 20);
  const PAD    = 12;

  const leftItems  = nodeEntries;
  const rightItems = edgeEntries;

  return (
    <g>
      {/* background */}
      <rect x={x} y={y} width={width} height={ROW_H * Math.max(leftItems.length, rightItems.length) + PAD * 2 + 16}
        rx={6} fill="#F8FAFC" stroke="#E2E8F0" strokeWidth={1} />

      {/* "Legend" label */}
      <text x={x + PAD} y={y + PAD + 10} fontFamily={FONT_FAMILY} fontSize={10} fontWeight={700}
        fill={TEXT_MUTED} letterSpacing="0.5">
        LEGEND
      </text>

      {/* Node entries (left column) */}
      {leftItems.map((e, i) => (
        <g key={`ln-${i}`}>
          <rect x={x + PAD} y={y + PAD + 18 + i * ROW_H} width={SWATCH} height={SWATCH}
            rx={2} fill={hexToRgba(e.color, 0.2)} stroke={e.color} strokeWidth={1.2} />
          <text x={x + PAD + SWATCH + 6} y={y + PAD + 18 + i * ROW_H + 9}
            fontFamily={FONT_FAMILY} fontSize={10} fill={TEXT_DARK} dominantBaseline="middle">
            {e.label}
          </text>
        </g>
      ))}

      {/* Edge entries (right column) */}
      {rightItems.map((e, i) => (
        <g key={`le-${i}`}>
          <line x1={x + PAD + COL_W} y1={y + PAD + 18 + i * ROW_H + 6}
            x2={x + PAD + COL_W + SWATCH} y2={y + PAD + 18 + i * ROW_H + 6}
            stroke={e.color} strokeWidth={2} />
          <text x={x + PAD + COL_W + SWATCH + 6} y={y + PAD + 18 + i * ROW_H + 9}
            fontFamily={FONT_FAMILY} fontSize={10} fill={TEXT_DARK} dominantBaseline="middle">
            {e.label}
          </text>
        </g>
      ))}
    </g>
  );
}

// ─── Topology 2D — Left-to-Right layout ───────────────────────────────────────

function Topology2D({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  const PAD        = 40;
  const NODE_W     = 120;
  const NODE_H     = 32;
  const NODE_GAP_V = 10;
  const COL_INNER  = 24;  // horizontal padding inside column band
  const HEADER_H   = 36;
  const ZONE_LBL_H = 22;
  const LEGEND_H   = 90;

  // Build zone lookup maps
  const zoneMap  = new Map<string, DiagramZone>(spec.zones.map(z => [z.id, z]));
  const nodeZone = new Map<string, DiagramZone>();
  for (const zone of spec.zones) {
    for (const nid of zone.nodes) {
      const z = zoneMap.get(zone.id);
      if (z) nodeZone.set(nid, z);
    }
  }

  // LR column order: spine → leaf → compute → others
  const ZONE_COL_ORDER = ['spine', 'leaf', 'compute', 'network', 'storage', 'management', 'security', 'infrastructure'];
  const sortedZones = [...spec.zones].sort((a, b) => {
    const ai = ZONE_COL_ORDER.findIndex(k => a.id.includes(k));
    const bi = ZONE_COL_ORDER.findIndex(k => b.id.includes(k));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const numCols   = sortedZones.length || 1;
  const usableW   = width - PAD * 2;
  const colBandW  = usableW / numCols;
  const colContentW = colBandW - COL_INNER * 2;
  const nodeDisplayW = Math.min(NODE_W, colContentW);

  // Calculate natural height needed
  const maxNodes  = Math.max(...sortedZones.map(z => z.nodes.length), 1);
  const contentH  = ZONE_LBL_H + maxNodes * (NODE_H + NODE_GAP_V) - NODE_GAP_V;
  const naturalH  = HEADER_H + PAD + contentH + PAD + LEGEND_H;
  const svgH      = Math.max(height, naturalH);
  const scale     = svgH > height ? height / svgH : 1;

  // Column x positions
  const colX = new Map<string, number>();
  sortedZones.forEach((zone, ci) => {
    colX.set(zone.id, PAD + ci * colBandW);
  });

  // Node positions (left edge of node box)
  const nodePos = new Map<string, { x: number; y: number }>();
  for (const zone of sortedZones) {
    const cx = (colX.get(zone.id) ?? 0) + COL_INNER + (colContentW - nodeDisplayW) / 2;
    zone.nodes.forEach((nid, ni) => {
      const y = HEADER_H + PAD + ZONE_LBL_H + ni * (NODE_H + NODE_GAP_V);
      nodePos.set(nid, { x: cx, y });
    });
  }

  const nodeMap = new Map(spec.nodes.map(n => [n.id, n]));

  // Unique edge types for legend
  const edgeTypeSet = new Set(spec.edges.map(e => e.type).filter(Boolean));
  const edgeLegendItems: LegendEntry[] = Array.from(edgeTypeSet).map(t => ({
    label: t ?? 'link',
    color: edgeColorFor(t),
  }));
  const zoneLegendItems: LegendEntry[] = sortedZones.map(z => ({
    label: z.label,
    color: zoneColorFor(z),
  }));

  return (
    <svg id={svgId} width={width} height={height}
      viewBox={`0 0 ${width} ${Math.round(naturalH)}`}
      preserveAspectRatio="xMidYMin meet"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: BG_COLOR, display: 'block' }}>
      <ArrowDefs />

      {/* subtle drop-shadow filter */}
      <defs>
        <filter id="node-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Title */}
      <text x={PAD} y={22} fontFamily={FONT_FAMILY} fontSize={13} fontWeight={700} fill={TEXT_DARK}>
        {spec.title}
      </text>

      {/* Zone column bands */}
      {sortedZones.map(zone => {
        const cx = colX.get(zone.id) ?? 0;
        const color = zoneColorFor(zone);
        const bandH = zone.nodes.length * (NODE_H + NODE_GAP_V) - NODE_GAP_V + ZONE_LBL_H + PAD / 2;
        return (
          <g key={`band-${zone.id}`}>
            <rect x={cx + 4} y={HEADER_H + PAD / 2}
              width={colBandW - 8} height={bandH}
              rx={8}
              fill={hexToRgba(color, 0.06)}
              stroke={hexToRgba(color, 0.22)}
              strokeWidth={1} />
            <text x={cx + colBandW / 2} y={HEADER_H + PAD / 2 + 15}
              textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={10} fontWeight={700}
              fill={color}>
              {zone.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Edges — LR bezier curves */}
      {spec.edges.map(edge => {
        const src = nodePos.get(edge.source);
        const tgt = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const color  = edgeColorFor(edge.type);
        const markerId = markerIdFor(edge.type);
        // Exit from right edge of source node, enter from left edge of target node
        const x1 = src.x + nodeDisplayW;
        const y1 = src.y + NODE_H / 2;
        const x2 = tgt.x - 6;
        const y2 = tgt.y + NODE_H / 2;
        const mx  = (x1 + x2) / 2;
        const labelX = mx;
        const labelY = (y1 + y2) / 2 - 4;
        return (
          <g key={edge.id}>
            <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.7}
              markerEnd={`url(#${markerId})`} />
            {edge.label && (
              <text x={labelX} y={labelY} textAnchor="middle"
                fontFamily={FONT_FAMILY} fontSize={9} fill={color} fontWeight={500}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {spec.nodes.map(node => {
        const pos   = nodePos.get(node.id);
        if (!pos) return null;
        const zone  = nodeZone.get(node.id);
        const color = zoneColorFor(zone);
        const nodeRef = nodeMap.get(node.id);
        return (
          <g key={node.id} filter="url(#node-shadow)">
            <rect x={pos.x} y={pos.y} width={nodeDisplayW} height={NODE_H} rx={5}
              fill={hexToRgba(color, 0.13)} stroke={color} strokeWidth={1.5} />
            <text x={pos.x + nodeDisplayW / 2} y={pos.y + NODE_H / 2 + 4}
              textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={10} fill={TEXT_DARK} fontWeight={500}>
              {(nodeRef?.label ?? node.label).replace(/\s+Rack\s+\d+/, ` R${node.id.replace(/\D/g, '')}`)}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <DiagramLegend
        x={PAD}
        y={HEADER_H + PAD + contentH + 12}
        width={width - PAD * 2}
        nodeEntries={zoneLegendItems}
        edgeEntries={edgeLegendItems}
      />
    </svg>
  );
}

// ─── Logical Arch — Left-to-Right swimlane layout ─────────────────────────────

function LogicalArch({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  const PAD       = 40;
  const NODE_W    = 130;
  const NODE_H    = 44;
  const HEADER_H  = 36;
  const LEGEND_H  = 90;
  const LANE_GAP  = 12;

  // LR order for logical arch: management → control → compute → storage → network → infrastructure
  const ZONE_ORDER = ['management', 'control', 'compute', 'storage', 'network', 'infrastructure'];
  const sortedZones = [...spec.zones].sort((a, b) => {
    const ai = ZONE_ORDER.findIndex(k => a.id.includes(k));
    const bi = ZONE_ORDER.findIndex(k => b.id.includes(k));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const numCols    = sortedZones.length || 1;
  const usableW    = width - PAD * 2;
  const laneW      = (usableW - (numCols - 1) * LANE_GAP) / numCols;

  const zoneMap  = new Map<string, DiagramZone>(spec.zones.map(z => [z.id, z]));
  const nodeZone = new Map<string, DiagramZone>();
  for (const zone of spec.zones) {
    for (const nid of zone.nodes) {
      const z = zoneMap.get(zone.id);
      if (z) nodeZone.set(nid, z);
    }
  }

  // Column positions
  const colX = new Map<string, number>();
  sortedZones.forEach((zone, ci) => {
    colX.set(zone.id, PAD + ci * (laneW + LANE_GAP));
  });

  // Node positions — centered in their column
  const nodePos = new Map<string, { x: number; y: number }>();
  for (const zone of sortedZones) {
    const cx = (colX.get(zone.id) ?? 0) + (laneW - NODE_W) / 2;
    zone.nodes.forEach((nid, ni) => {
      const y = HEADER_H + PAD + ni * (NODE_H + 16);
      nodePos.set(nid, { x: cx, y });
    });
  }

  const maxNodesInCol = Math.max(...sortedZones.map(z => z.nodes.length), 1);
  const contentH = maxNodesInCol * (NODE_H + 16) - 16;
  const naturalH = HEADER_H + PAD + contentH + PAD + LEGEND_H;

  const edgeTypeSet = new Set(spec.edges.map(e => e.type).filter(Boolean));
  const edgeLegendItems: LegendEntry[] = Array.from(edgeTypeSet).map(t => ({
    label: t ?? 'link', color: edgeColorFor(t),
  }));
  const zoneLegendItems: LegendEntry[] = sortedZones.map(z => ({
    label: z.label, color: zoneColorFor(z),
  }));

  return (
    <svg id={svgId} width={width} height={height}
      viewBox={`0 0 ${width} ${Math.round(naturalH)}`}
      preserveAspectRatio="xMidYMin meet"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: BG_COLOR, display: 'block' }}>
      <ArrowDefs />
      <defs>
        <filter id="la-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Title */}
      <text x={PAD} y={22} fontFamily={FONT_FAMILY} fontSize={13} fontWeight={700} fill={TEXT_DARK}>
        {spec.title}
      </text>

      {/* Lane backgrounds */}
      {sortedZones.map(zone => {
        const cx    = colX.get(zone.id) ?? 0;
        const color = zoneColorFor(zone);
        const laneH = zone.nodes.length * (NODE_H + 16) - 16 + PAD;
        return (
          <g key={`lane-${zone.id}`}>
            <rect x={cx} y={HEADER_H + PAD / 2} width={laneW} height={laneH}
              rx={8} fill={hexToRgba(color, 0.06)} stroke={hexToRgba(color, 0.22)} strokeWidth={1} />
            <text x={cx + laneW / 2} y={HEADER_H + PAD / 2 + 14}
              textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={10} fontWeight={700} fill={color}>
              {zone.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Edges — horizontal bezier */}
      {spec.edges.map(edge => {
        const src = nodePos.get(edge.source);
        const tgt = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const color    = edgeColorFor(edge.type);
        const markerId = markerIdFor(edge.type);
        const x1 = src.x + NODE_W;
        const y1 = src.y + NODE_H / 2;
        const x2 = tgt.x - 6;
        const y2 = tgt.y + NODE_H / 2;
        const mx  = (x1 + x2) / 2;
        return (
          <g key={edge.id}>
            <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.75}
              markerEnd={`url(#${markerId})`} />
            {edge.label && (
              <text x={mx} y={Math.min(y1, y2) - 4}
                textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={9} fill={color} fontWeight={500}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {spec.nodes.map(node => {
        const pos   = nodePos.get(node.id);
        if (!pos) return null;
        const zone  = nodeZone.get(node.id);
        const color = zoneColorFor(zone);
        return (
          <g key={node.id} filter="url(#la-shadow)">
            <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={6}
              fill={hexToRgba(color, 0.13)} stroke={color} strokeWidth={1.5} />
            <text x={pos.x + NODE_W / 2} y={pos.y + NODE_H / 2 + 4}
              textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={10} fill={TEXT_DARK} fontWeight={500}>
              {node.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <DiagramLegend
        x={PAD} y={HEADER_H + PAD + contentH + 12}
        width={width - PAD * 2}
        nodeEntries={zoneLegendItems}
        edgeEntries={edgeLegendItems}
      />
    </svg>
  );
}

// ─── Site Layout — Grid layout ────────────────────────────────────────────────

function SiteLayout({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  const PAD      = 40;
  const HEADER_H = 36;
  const ROOM_W   = 160;
  const ROOM_H   = 90;
  const COLS     = 2;
  const H_GAP    = 24;
  const V_GAP    = 20;
  const LEGEND_H = 90;

  const zoneMap  = new Map<string, DiagramZone>(spec.zones.map(z => [z.id, z]));
  const nodeZone = new Map<string, DiagramZone>();
  for (const zone of spec.zones) {
    for (const nid of zone.nodes) {
      const z = zoneMap.get(zone.id);
      if (z) nodeZone.set(nid, z);
    }
  }

  const usableW  = width - PAD * 2;
  const colW     = (usableW - H_GAP) / COLS;

  const nodePos  = new Map<string, { x: number; y: number }>();
  spec.nodes.forEach((node, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x   = PAD + col * (colW) + (colW - ROOM_W) / 2;
    const y   = HEADER_H + PAD / 2 + row * (ROOM_H + V_GAP);
    nodePos.set(node.id, { x, y });
  });

  const rows     = Math.ceil(spec.nodes.length / COLS);
  const contentH = rows * (ROOM_H + V_GAP) - V_GAP;
  const naturalH = HEADER_H + PAD / 2 + contentH + PAD + LEGEND_H;

  const edgeTypeSet = new Set(spec.edges.map(e => e.type).filter(Boolean));
  const edgeLegendItems: LegendEntry[] = Array.from(edgeTypeSet).map(t => ({
    label: t ?? 'link', color: edgeColorFor(t),
  }));
  const zoneLegendItems: LegendEntry[] = spec.zones.map(z => ({
    label: z.label, color: zoneColorFor(z),
  }));

  return (
    <svg id={svgId} width={width} height={height}
      viewBox={`0 0 ${width} ${Math.round(naturalH)}`}
      preserveAspectRatio="xMidYMin meet"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: BG_COLOR, display: 'block' }}>
      <ArrowDefs />
      <defs>
        <filter id="sl-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Title */}
      <text x={PAD} y={22} fontFamily={FONT_FAMILY} fontSize={13} fontWeight={700} fill={TEXT_DARK}>
        {spec.title}
      </text>

      {/* Edges */}
      {spec.edges.map(edge => {
        const src = nodePos.get(edge.source);
        const tgt = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const color    = edgeColorFor(edge.type);
        const markerId = markerIdFor(edge.type);
        const x1 = src.x + ROOM_W / 2;
        const y1 = src.y + ROOM_H;
        const x2 = tgt.x + ROOM_W / 2;
        const y2 = tgt.y;
        const mx  = (x1 + x2) / 2;
        const my  = (y1 + y2) / 2;
        return (
          <g key={edge.id}>
            <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
              fill="none" stroke={color} strokeWidth={1.5}
              strokeDasharray={edge.type === 'power' || edge.type === 'cooling' ? '5 3' : undefined}
              strokeOpacity={0.7} markerEnd={`url(#${markerId})`} />
            {edge.label && (
              <text x={mx} y={my - 4} textAnchor="middle"
                fontFamily={FONT_FAMILY} fontSize={9} fill={color} fontWeight={500}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Room nodes */}
      {spec.nodes.map(node => {
        const pos   = nodePos.get(node.id);
        if (!pos) return null;
        const zone  = nodeZone.get(node.id);
        const color = zoneColorFor(zone);
        return (
          <g key={node.id} filter="url(#sl-shadow)">
            <rect x={pos.x} y={pos.y} width={ROOM_W} height={ROOM_H} rx={8}
              fill={hexToRgba(color, 0.12)} stroke={color} strokeWidth={1.5} />
            {/* zone indicator stripe */}
            <rect x={pos.x} y={pos.y} width={ROOM_W} height={6} rx={8}
              fill={color} opacity={0.5} />
            <text x={pos.x + ROOM_W / 2} y={pos.y + ROOM_H / 2 + 4}
              textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={11} fill={TEXT_DARK} fontWeight={500}>
              {node.label}
            </text>
            {zone && (
              <text x={pos.x + ROOM_W / 2} y={pos.y + ROOM_H / 2 + 18}
                textAnchor="middle" fontFamily={FONT_FAMILY} fontSize={9} fill={TEXT_MUTED}>
                {zone.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <DiagramLegend
        x={PAD} y={HEADER_H + PAD / 2 + contentH + 12}
        width={width - PAD * 2}
        nodeEntries={zoneLegendItems}
        edgeEntries={edgeLegendItems}
      />
    </svg>
  );
}

// ─── Generic (rack_row / presentation / schematic) ────────────────────────────

function GenericDiagram({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  return <Topology2D spec={spec} width={width} height={height} svgId={svgId} />;
}

// ─── Public component ─────────────────────────────────────────────────────────

export function DiagramRenderer({ spec, width = 900, height = 540, svgId }: DiagramRendererProps) {
  switch (spec.style) {
    case 'topology_2d':
    case 'schematic':
    case 'rack_row':
      return <Topology2D spec={spec} width={width} height={height} svgId={svgId} />;
    case 'logical_arch':
    case 'presentation':
      return <LogicalArch spec={spec} width={width} height={height} svgId={svgId} />;
    case 'site_layout':
      return <SiteLayout spec={spec} width={width} height={height} svgId={svgId} />;
    default:
      return <GenericDiagram spec={spec} width={width} height={height} svgId={svgId} />;
  }
}
