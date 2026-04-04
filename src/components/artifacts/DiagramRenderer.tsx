'use client';

import type { DiagramSpec, DiagramNode, DiagramEdge, DiagramZone } from '@/types/planning';

interface DiagramRendererProps {
  spec: DiagramSpec;
  width?: number;
  height?: number;
  svgId?: string;
}

// ─── Mandatory color palette (never change) ───────────────────────────────────
const PALETTE = {
  spine:      '#2563EB',   // AI Fabric / Spine
  storage:    '#16A34A',   // Storage
  frontend:   '#06B6D4',   // Front End / Services
  management: '#F59E0B',   // Management
  security:   '#EF4444',   // Security / OOB
  compute:    '#60A5FA',   // CPU / General Compute
  reserved:   '#E5E7EB',   // Reserved / Empty
  tpu:        '#9333EA',   // Google TPU
  nvidia:     '#F97316',   // NVIDIA Rubin
  amd:        '#EAB308',   // AMD MI400X
  bg:         '#FFFFFF',
  bgAlt:      '#F8FAFC',
  text:       '#1E293B',
  textSub:    '#64748B',
  border:     '#CBD5E1',
} as const;

// Zone-id → color mapping aligned to the mandatory palette
const ZONE_COLORS: Record<string, string> = {
  spine:          PALETTE.spine,
  leaf:           PALETTE.compute,
  compute:        PALETTE.frontend,
  storage:        PALETTE.storage,
  network:        PALETTE.spine,
  management:     PALETTE.management,
  control:        PALETTE.spine,
  infrastructure: PALETTE.reserved,
  data_hall:      PALETTE.storage,
  utility:        '#94A3B8',
  facility:       PALETTE.management,
  row:            PALETTE.frontend,
};

// Edge-type → color mapping
const EDGE_COLORS: Record<string, string> = {
  uplink:     PALETTE.spine,
  downlink:   PALETTE.compute,
  storage:    PALETTE.storage,
  management: PALETTE.management,
  cooling:    PALETTE.frontend,
  power:      PALETTE.management,
  network:    PALETTE.spine,
  control:    PALETTE.spine,
  data:       PALETTE.spine,
  directed:   PALETTE.spine,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function zoneColor(zone: DiagramZone | undefined): string {
  if (!zone) return PALETTE.spine;
  return ZONE_COLORS[zone.id] ?? zone.color ?? PALETTE.spine;
}

function edgeColor(edge: DiagramEdge): string {
  // Use metadata color override first
  const metaColor = edge.metadata?.color;
  if (typeof metaColor === 'string') return metaColor;
  return EDGE_COLORS[edge.type ?? ''] ?? PALETTE.border;
}

// ─── Topology 2D — left-to-right layout ──────────────────────────────────────

function Topology2D({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  const PADDING    = 36;
  const NODE_W     = 120;
  const NODE_H     = 44;
  const LEGEND_H   = 110;
  const HEADER_H   = 28;

  // Group nodes into layers by zone (left-to-right: spine → leaf → compute)
  const ZONE_ORDER = ['spine', 'leaf', 'compute', 'storage', 'network', 'management', 'control', 'infrastructure'];

  const zoneMap = new Map<string, DiagramZone>(spec.zones.map((z) => [z.id, z]));
  const nodeZone = new Map<string, DiagramZone>();
  for (const zone of spec.zones) {
    for (const nid of zone.nodes) {
      const z = zoneMap.get(zone.id);
      if (z) nodeZone.set(nid, z);
    }
  }

  const sortedZones = [...spec.zones].sort((a, b) => {
    const ai = ZONE_ORDER.findIndex((k) => a.id.includes(k));
    const bi = ZONE_ORDER.findIndex((k) => b.id.includes(k));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const numCols  = sortedZones.length || 1;
  const usableW  = width - PADDING * 2;
  const usableH  = height - HEADER_H - PADDING - LEGEND_H;
  const colWidth = usableW / numCols;

  // Assign positions: columns = zones, rows = nodes within zone
  const nodePos = new Map<string, { x: number; y: number }>();
  const zoneCol = new Map<string, number>();
  sortedZones.forEach((z, ci) => {
    zoneCol.set(z.id, ci);
    z.nodes.forEach((nid, ri) => {
      const totalRows = z.nodes.length;
      const x = PADDING + ci * colWidth + (colWidth - NODE_W) / 2;
      const y = HEADER_H + PADDING / 2 + (usableH / Math.max(totalRows, 1)) * (ri + 0.5) - NODE_H / 2;
      nodePos.set(nid, { x, y });
    });
  });

  const nodeMap = new Map<string, DiagramNode>(spec.nodes.map((n) => [n.id, n]));

  return (
    <svg
      id={svgId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: PALETTE.bgAlt, display: 'block', borderRadius: 8 }}
    >
      <defs>
        {/* Arrow markers per palette color */}
        {Object.entries(EDGE_COLORS).map(([key, color]) => (
          <marker key={key} id={`arrow-${key}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        ))}
        <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={PALETTE.border} />
        </marker>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Background */}
      <rect x={0} y={0} width={width} height={height} fill={PALETTE.bgAlt} rx={8} />

      {/* Title */}
      <text x={PADDING} y={20} fontFamily="Helvetica, Arial, sans-serif" fontSize={13} fontWeight={600} fill={PALETTE.text}>
        {spec.title}
      </text>

      {/* Column zone bands */}
      {sortedZones.map((zone) => {
        const col   = zoneCol.get(zone.id) ?? 0;
        const color = zoneColor(zone);
        const x     = PADDING + col * colWidth;
        const y     = HEADER_H;
        return (
          <g key={zone.id}>
            <rect
              x={x + 2} y={y + 2}
              width={colWidth - 4} height={usableH - 4}
              rx={6}
              fill={hexToRgba(color, 0.07)}
              stroke={hexToRgba(color, 0.22)}
              strokeWidth={1}
            />
            <text
              x={x + colWidth / 2} y={y + 14}
              textAnchor="middle"
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize={9}
              fontWeight={600}
              fill={color}
              letterSpacing={0.5}
            >
              {zone.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Edges with bandwidth labels */}
      {spec.edges.map((edge) => {
        const src  = nodePos.get(edge.source);
        const tgt  = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const color     = edgeColor(edge);
        const markerId  = `arrow-${edge.type ?? 'default'}`;
        // Horizontal (left-to-right): connect right side of source to left side of target
        const x1 = src.x + NODE_W;
        const y1 = src.y + NODE_H / 2;
        const x2 = tgt.x;
        const y2 = tgt.y + NODE_H / 2;
        const cx = (x1 + x2) / 2;
        const labelX = cx;
        const labelY = (y1 + y2) / 2 - 4;
        return (
          <g key={edge.id}>
            <path
              d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeOpacity={0.7}
              markerEnd={`url(#${markerId})`}
            />
            {edge.label && (
              <text
                x={labelX} y={labelY}
                textAnchor="middle"
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={8}
                fill={color}
                fontWeight={600}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {spec.nodes.map((node) => {
        const pos   = nodePos.get(node.id);
        if (!pos) return null;
        const zone  = nodeZone.get(node.id);
        const color = zoneColor(zone);
        const lines = node.label.split('\n');
        return (
          <g key={node.id} filter="url(#shadow)">
            <rect
              x={pos.x} y={pos.y}
              width={NODE_W} height={NODE_H}
              rx={6}
              fill={hexToRgba(color, 0.15)}
              stroke={color}
              strokeWidth={1.5}
            />
            {lines.map((line, i) => (
              <text
                key={i}
                x={pos.x + NODE_W / 2}
                y={pos.y + NODE_H / 2 + (i - (lines.length - 1) / 2) * 13 + 4}
                textAnchor="middle"
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={10}
                fontWeight={i === 0 ? 600 : 400}
                fill={PALETTE.text}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}

      {/* Legend */}
      <Legend spec={spec} y={height - LEGEND_H} width={width} padding={PADDING} />
    </svg>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ spec, y, width, padding }: { spec: DiagramSpec; y: number; width: number; padding: number }) {
  const zones = spec.zones.slice(0, 6);
  const cellW = Math.floor((width - padding * 2) / Math.max(zones.length, 1));
  const BOX   = 10;

  // Edge type legend entries (unique types with labels)
  const edgeTypes: Array<{ type: string; label: string; color: string }> = [];
  const seen = new Set<string>();
  for (const e of spec.edges) {
    const key = e.type ?? 'default';
    if (!seen.has(key) && e.label) {
      seen.add(key);
      edgeTypes.push({ type: key, label: e.label, color: edgeColor(e) });
    }
  }

  return (
    <g>
      <rect x={padding} y={y + 4} width={width - padding * 2} height={96} rx={6} fill={hexToRgba('#CBD5E1', 0.3)} stroke={PALETTE.border} strokeWidth={1} />
      <text x={padding + 8} y={y + 16} fontFamily="Helvetica, Arial, sans-serif" fontSize={9} fontWeight={700} fill={PALETTE.textSub} letterSpacing={0.5}>LEGEND</text>

      {/* Node / zone colors */}
      <text x={padding + 8} y={y + 30} fontFamily="Helvetica, Arial, sans-serif" fontSize={8} fill={PALETTE.textSub}>Nodes</text>
      {zones.map((zone, i) => {
        const color = zoneColor(zone);
        const lx = padding + 8 + i * cellW;
        return (
          <g key={zone.id}>
            <rect x={lx} y={y + 35} width={BOX} height={BOX} rx={2} fill={hexToRgba(color, 0.3)} stroke={color} strokeWidth={1} />
            <text x={lx + BOX + 4} y={y + 44} fontFamily="Helvetica, Arial, sans-serif" fontSize={8} fill={PALETTE.text}>{zone.label}</text>
          </g>
        );
      })}

      {/* Edge colors */}
      {edgeTypes.length > 0 && (
        <>
          <text x={padding + 8} y={y + 64} fontFamily="Helvetica, Arial, sans-serif" fontSize={8} fill={PALETTE.textSub}>Links</text>
          {edgeTypes.slice(0, 6).map((et, i) => {
            const lx = padding + 8 + i * cellW;
            return (
              <g key={et.type}>
                <line x1={lx} y1={y + 72} x2={lx + BOX + 4} y2={y + 72} stroke={et.color} strokeWidth={2} />
                <text x={lx + BOX + 8} y={y + 76} fontFamily="Helvetica, Arial, sans-serif" fontSize={8} fill={PALETTE.text}>{et.label}</text>
              </g>
            );
          })}
        </>
      )}

      {/* Metadata summary */}
      {Object.keys(spec.labels).length > 0 && (
        <text x={padding + 8} y={y + 92} fontFamily="Helvetica, Arial, sans-serif" fontSize={8} fill={PALETTE.textSub}>
          {Object.entries(spec.labels).map(([k, v]) => `${k}: ${v}`).join('   ')}
        </text>
      )}
    </g>
  );
}

// ─── Logical Arch (horizontal swimlane) ──────────────────────────────────────

function LogicalArch({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  const PADDING      = 36;
  const LEFT_LABEL_W = 88;
  const NODE_W       = 140;
  const NODE_H       = 44;
  const HEADER_H     = 28;
  const LEGEND_H     = 110;

  const usableH   = height - HEADER_H - PADDING - LEGEND_H;
  const laneH     = Math.max(64, usableH / Math.max(spec.zones.length, 1));
  const usableW   = width - PADDING * 2 - LEFT_LABEL_W;

  const zoneMap  = new Map<string, DiagramZone>(spec.zones.map((z) => [z.id, z]));
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
      id={svgId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: PALETTE.bgAlt, display: 'block', borderRadius: 8 }}
    >
      <defs>
        {Object.entries(EDGE_COLORS).map(([key, color]) => (
          <marker key={key} id={`arrow-la-${key}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        ))}
        <filter id="shadow-la" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
        </filter>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill={PALETTE.bgAlt} rx={8} />

      <text x={PADDING} y={20} fontFamily="Helvetica, Arial, sans-serif" fontSize={13} fontWeight={600} fill={PALETTE.text}>
        {spec.title}
      </text>

      {/* Swimlane bands */}
      {spec.zones.map((zone, zi) => {
        const color = zoneColor(zone);
        const y     = HEADER_H + zi * laneH;
        return (
          <g key={zone.id}>
            <rect
              x={PADDING + LEFT_LABEL_W + 2} y={y + 2}
              width={usableW - 4} height={laneH - 4}
              rx={4}
              fill={hexToRgba(color, 0.07)}
              stroke={hexToRgba(color, 0.2)}
              strokeWidth={1}
            />
            <text
              x={PADDING + LEFT_LABEL_W - 8} y={y + laneH / 2 + 4}
              textAnchor="end"
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize={9}
              fontWeight={600}
              fill={color}
            >
              {zone.label}
            </text>
          </g>
        );
      })}

      {/* Edges */}
      {spec.edges.map((edge) => {
        const src  = nodePos.get(edge.source);
        const tgt  = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const color    = edgeColor(edge);
        const markerId = `arrow-la-${edge.type ?? 'default'}`;
        const x1 = src.x + NODE_W / 2;
        const y1 = src.y + NODE_H;
        const x2 = tgt.x + NODE_W / 2;
        const y2 = tgt.y;
        const cy = (y1 + y2) / 2;
        return (
          <g key={edge.id}>
            <path
              d={`M${x1},${y1} Q${x1},${cy} ${x2},${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeOpacity={0.75}
              markerEnd={`url(#${markerId})`}
            />
            {edge.label && (
              <text
                x={(x1 + x2) / 2 + 6} y={cy}
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={8}
                fill={color}
                fontWeight={600}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {spec.nodes.map((node) => {
        const pos   = nodePos.get(node.id);
        if (!pos) return null;
        const zone  = nodeZone.get(node.id);
        const color = zoneColor(zone);
        const lines = node.label.split('\n');
        return (
          <g key={node.id} filter="url(#shadow-la)">
            <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={6} fill={hexToRgba(color, 0.15)} stroke={color} strokeWidth={1.5} />
            {lines.map((line, i) => (
              <text
                key={i}
                x={pos.x + NODE_W / 2}
                y={pos.y + NODE_H / 2 + (i - (lines.length - 1) / 2) * 13 + 4}
                textAnchor="middle"
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={10}
                fontWeight={i === 0 ? 600 : 400}
                fill={PALETTE.text}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}

      <Legend spec={spec} y={height - LEGEND_H} width={width} padding={PADDING} />
    </svg>
  );
}

// ─── Site Layout ──────────────────────────────────────────────────────────────

function SiteLayout({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  const PADDING  = 36;
  const HEADER_H = 28;
  const ROOM_W   = 160;
  const ROOM_H   = 88;
  const LEGEND_H = 110;
  const COLS     = 2;
  const GAP      = 20;

  const usableW = width - PADDING * 2;
  const colW    = usableW / COLS;

  const zoneMap  = new Map<string, DiagramZone>(spec.zones.map((z) => [z.id, z]));
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
    const x   = PADDING + col * colW + (colW - ROOM_W) / 2;
    const y   = HEADER_H + PADDING / 2 + row * (ROOM_H + GAP);
    nodePos.set(node.id, { x, y });
  });

  return (
    <svg
      id={svgId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: PALETTE.bgAlt, display: 'block', borderRadius: 8 }}
    >
      <defs>
        {Object.entries(EDGE_COLORS).map(([key, color]) => (
          <marker key={key} id={`arrow-sl-${key}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        ))}
        <filter id="shadow-sl" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.08" />
        </filter>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill={PALETTE.bgAlt} rx={8} />

      <text x={PADDING} y={20} fontFamily="Helvetica, Arial, sans-serif" fontSize={13} fontWeight={600} fill={PALETTE.text}>
        {spec.title}
      </text>

      {/* Edges with type-colored dashes */}
      {spec.edges.map((edge) => {
        const src  = nodePos.get(edge.source);
        const tgt  = nodePos.get(edge.target);
        if (!src || !tgt) return null;
        const color    = edgeColor(edge);
        const markerId = `arrow-sl-${edge.type ?? 'default'}`;
        const x1 = src.x + ROOM_W / 2;
        const y1 = src.y + ROOM_H / 2;
        const x2 = tgt.x + ROOM_W / 2;
        const y2 = tgt.y + ROOM_H / 2;
        return (
          <g key={edge.id}>
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              strokeOpacity={0.7}
              markerEnd={`url(#${markerId})`}
            />
            {edge.label && (
              <text
                x={(x1 + x2) / 2 + 4} y={(y1 + y2) / 2 - 4}
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={8}
                fill={color}
                fontWeight={600}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Room nodes */}
      {spec.nodes.map((node) => {
        const pos   = nodePos.get(node.id);
        if (!pos) return null;
        const zone  = nodeZone.get(node.id);
        const color = zoneColor(zone);
        const lines = node.label.split('\n');
        return (
          <g key={node.id} filter="url(#shadow-sl)">
            <rect x={pos.x} y={pos.y} width={ROOM_W} height={ROOM_H} rx={8} fill={hexToRgba(color, 0.15)} stroke={color} strokeWidth={1.5} />
            {lines.map((line, i) => (
              <text
                key={i}
                x={pos.x + ROOM_W / 2}
                y={pos.y + ROOM_H / 2 + (i - (lines.length - 1) / 2) * 14 + 4}
                textAnchor="middle"
                fontFamily="Helvetica, Arial, sans-serif"
                fontSize={10}
                fontWeight={i === 0 ? 600 : 400}
                fill={PALETTE.text}
              >
                {line}
              </text>
            ))}
            {/* Zone badge */}
            <text
              x={pos.x + 8} y={pos.y + 14}
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize={8}
              fontWeight={700}
              fill={color}
            >
              {zone?.label?.toUpperCase() ?? ''}
            </text>
          </g>
        );
      })}

      <Legend spec={spec} y={height - LEGEND_H} width={width} padding={PADDING} />
    </svg>
  );
}

// ─── Rack Elevation renderer ──────────────────────────────────────────────────

function RackElevation({ spec, width, height, svgId }: { spec: DiagramSpec; width: number; height: number; svgId?: string }) {
  const PADDING   = 36;
  const HEADER_H  = 28;
  const LEGEND_H  = 110;
  const RACK_W    = 180;
  const U_H       = 18;    // height per rack unit
  const RACK_U    = 42;    // standard rack units
  const GAP       = 24;

  const racks    = spec.nodes.filter((n) => n.zone === 'row' || n.type === 'rack');
  const switches = spec.nodes.filter((n) => n.zone === 'network' || n.type === 'tor_switch');

  const racksPerGroup = 4;
  const numGroups     = Math.ceil(racks.length / racksPerGroup);
  const groupW        = RACK_W + GAP;
  const usableH       = height - HEADER_H - PADDING - LEGEND_H;

  return (
    <svg
      id={svgId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: PALETTE.bgAlt, display: 'block', borderRadius: 8 }}
    >
      <defs>
        <filter id="shadow-re" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.1" />
        </filter>
      </defs>

      <rect x={0} y={0} width={width} height={height} fill={PALETTE.bgAlt} rx={8} />

      <text x={PADDING} y={20} fontFamily="Helvetica, Arial, sans-serif" fontSize={13} fontWeight={600} fill={PALETTE.text}>
        {spec.title}
      </text>

      {/* ToR switches row at top */}
      {switches.map((sw, i) => {
        const x = PADDING + i * groupW;
        const y = HEADER_H + 8;
        return (
          <g key={sw.id} filter="url(#shadow-re)">
            <rect x={x} y={y} width={RACK_W} height={U_H * 2} rx={4} fill={hexToRgba(PALETTE.spine, 0.15)} stroke={PALETTE.spine} strokeWidth={1.5} />
            <text x={x + RACK_W / 2} y={y + U_H + 4} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={9} fontWeight={600} fill={PALETTE.text}>
              {sw.label.split('\n')[0]}
            </text>
          </g>
        );
      })}

      {/* Compute racks */}
      {racks.map((rack, ri) => {
        const groupIdx  = Math.floor(ri / racksPerGroup);
        const rackInGrp = ri % racksPerGroup;
        const x         = PADDING + groupIdx * groupW;
        const yBase     = HEADER_H + 8 + U_H * 3 + 8; // below ToR row
        const rackH     = Math.min(RACK_U * U_H, usableH - U_H * 3 - 32);
        const slotH     = rackH / RACK_U;

        // GPU slots (center rows 4-14 for compute cards, approx)
        const gpuCount      = (rack.metadata?.gpuCount as number) ?? 8;
        const powerKw       = (rack.metadata?.powerKw as number) ?? 10;
        const model         = (rack.metadata?.model as string) ?? 'H100 SXM5';
        const computeStartU = 4;
        const computeEndU   = Math.min(computeStartU + gpuCount, RACK_U - 4);

        return (
          <g key={rack.id} filter="url(#shadow-re)">
            {/* Rack frame */}
            <rect x={x} y={yBase + rackInGrp * 4} width={RACK_W} height={rackH} rx={4} fill="#F1F5F9" stroke="#94A3B8" strokeWidth={1.5} />

            {/* U-position guides */}
            {[2, 4, 16, 30, 38].map((u) => (
              <line key={u} x1={x + 2} y1={yBase + rackInGrp * 4 + u * slotH} x2={x + RACK_W - 2} y2={yBase + rackInGrp * 4 + u * slotH} stroke="#E2E8F0" strokeWidth={0.5} strokeDasharray="2 2" />
            ))}

            {/* Management switch — top 2U */}
            <rect x={x + 4} y={yBase + rackInGrp * 4 + 1 * slotH} width={RACK_W - 8} height={slotH * 2} rx={2} fill={hexToRgba(PALETTE.management, 0.2)} stroke={PALETTE.management} strokeWidth={1} />
            <text x={x + RACK_W / 2} y={yBase + rackInGrp * 4 + 2 * slotH + 4} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={7} fill={PALETTE.text}>OOB Switch</text>

            {/* GPU compute slots */}
            {Array.from({ length: computeEndU - computeStartU }, (_, i) => {
              const u  = computeStartU + i;
              const cy = yBase + rackInGrp * 4 + u * slotH;
              return (
                <rect key={u} x={x + 4} y={cy} width={RACK_W - 8} height={slotH - 1} rx={1} fill={hexToRgba(PALETTE.frontend, 0.3)} stroke={PALETTE.frontend} strokeWidth={0.5} />
              );
            })}
            <text x={x + RACK_W / 2} y={yBase + rackInGrp * 4 + (computeStartU + (computeEndU - computeStartU) / 2) * slotH + 4}
              textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={8} fontWeight={600} fill={PALETTE.text}>
              {`${gpuCount}× GPU`}
            </text>
            <text x={x + RACK_W / 2} y={yBase + rackInGrp * 4 + (computeStartU + (computeEndU - computeStartU) / 2) * slotH + 14}
              textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={7} fill={PALETTE.textSub}>
              {model}
            </text>

            {/* Power / PDU — bottom 2U */}
            <rect x={x + 4} y={yBase + rackInGrp * 4 + (RACK_U - 3) * slotH} width={RACK_W - 8} height={slotH * 2} rx={2} fill={hexToRgba(PALETTE.management, 0.15)} stroke="#94A3B8" strokeWidth={0.5} />
            <text x={x + RACK_W / 2} y={yBase + rackInGrp * 4 + (RACK_U - 2) * slotH + 4} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={7} fill={PALETTE.text}>PDU</text>

            {/* Rack label + stats */}
            <text x={x + RACK_W / 2} y={yBase + rackInGrp * 4 - 4} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={9} fontWeight={700} fill={PALETTE.text}>
              {rack.label.split('\n')[0]}
            </text>
            <text x={x + RACK_W / 2} y={yBase + rackInGrp * 4 + rackH + 12} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={8} fill={PALETTE.textSub}>
              {`${powerKw}kW  42U`}
            </text>
          </g>
        );
      })}

      <Legend spec={spec} y={height - LEGEND_H} width={width} padding={PADDING} />
    </svg>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function DiagramRenderer({ spec, width = 900, height = 540, svgId }: DiagramRendererProps) {
  switch (spec.style) {
    case 'topology_2d':
    case 'schematic':
      return <Topology2D spec={spec} width={width} height={height} svgId={svgId} />;
    case 'logical_arch':
    case 'presentation':
      return <LogicalArch spec={spec} width={width} height={height} svgId={svgId} />;
    case 'site_layout':
      return <SiteLayout spec={spec} width={width} height={height} svgId={svgId} />;
    case 'rack_row':
      return <RackElevation spec={spec} width={width} height={height} svgId={svgId} />;
    default:
      return <Topology2D spec={spec} width={width} height={height} svgId={svgId} />;
  }
}
