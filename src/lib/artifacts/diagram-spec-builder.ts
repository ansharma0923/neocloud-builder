import { nanoid } from 'nanoid';
import type { CanonicalPlanState, DiagramSpec, DiagramStyle, DiagramNode, DiagramEdge, DiagramZone } from '@/types/planning';

// ─── Mandatory color palette ──────────────────────────────────────────────────
// These colors are fixed by the design system. Do not add or change them.
export const DIAGRAM_PALETTE = {
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

// Zone-id → color mapping using the mandatory palette
const ZONE_COLOR: Record<string, string> = {
  spine:          DIAGRAM_PALETTE.core,
  leaf:           DIAGRAM_PALETTE.services,
  compute:        DIAGRAM_PALETTE.compute,
  storage:        DIAGRAM_PALETTE.storage,
  management:     DIAGRAM_PALETTE.management,
  control:        DIAGRAM_PALETTE.services,
  network:        DIAGRAM_PALETTE.core,
  infrastructure: DIAGRAM_PALETTE.management,
  data_hall:      DIAGRAM_PALETTE.compute,
  utility:        DIAGRAM_PALETTE.management,
  facility:       DIAGRAM_PALETTE.reserved,
  security:       DIAGRAM_PALETTE.security,
  row:            DIAGRAM_PALETTE.compute,
};

function zoneColorFor(id: string): string {
  // Match by exact key first, then by substring
  if (ZONE_COLOR[id]) return ZONE_COLOR[id];
  for (const key of Object.keys(ZONE_COLOR)) {
    if (id.includes(key)) return ZONE_COLOR[key];
  }
  return DIAGRAM_PALETTE.core;
}

/** Maximum number of compute racks to render inline; additional racks are omitted for clarity. */
const MAX_DISPLAY_RACKS = 12;

/**
 * Convert a canonical plan to a structured diagram specification.
 * Never sends raw user text to image generation.
 */
export function buildDiagramSpec(
  plan: CanonicalPlanState,
  style: DiagramStyle
): DiagramSpec {
  switch (style) {
    case 'topology_2d':
      return buildTopology2D(plan);
    case 'logical_arch':
      return buildLogicalArch(plan);
    case 'site_layout':
      return buildSiteLayout(plan);
    case 'rack_row':
      return buildRackRow(plan);
    case 'presentation':
      return buildPresentation(plan);
    case 'schematic':
      return buildSchematic(plan);
    default:
      return buildTopology2D(plan);
  }
}

function buildTopology2D(plan: CanonicalPlanState): DiagramSpec {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const zones: DiagramZone[] = [];
  const topology = plan.topologyRelationships.value;
  const network = plan.networkArchitecture.value;
  const connectivity = plan.opticalOrCopperAssumptions.value;

  // Uplink label from plan data (concise, only when available)
  const uplinkLabel = network.internalBandwidth ?? undefined;
  const downlinkLabel = connectivity.cableStandard ?? undefined;

  // Spine layer
  const spineCount = topology.spines ?? 2;
  const spineIds: string[] = [];
  for (let i = 0; i < spineCount; i++) {
    const id = `spine-${i + 1}`;
    spineIds.push(id);
    nodes.push({ id, type: 'spine_switch', label: `Spine ${i + 1}`, zone: 'spine' });
  }

  // Leaf layer
  const leafCount = topology.leaves ?? Math.ceil((plan.rackCount.value || 4) / 2);
  const leafIds: string[] = [];
  for (let i = 0; i < leafCount; i++) {
    const id = `leaf-${i + 1}`;
    leafIds.push(id);
    nodes.push({ id, type: 'leaf_switch', label: `Leaf ${i + 1}`, zone: 'leaf' });

    // Connect each leaf to every spine (full mesh)
    for (const spineId of spineIds) {
      edges.push({
        id: `${spineId}-${id}`,
        source: spineId,
        target: id,
        label: uplinkLabel,
        type: 'uplink',
      });
    }
  }

  // Compute nodes
  const computeItems = plan.computeInventory.value;
  const rackCount = plan.rackCount.value || 4;
  const racksPerLeaf = Math.max(1, Math.ceil(rackCount / leafCount));
  const displayRacks = Math.min(rackCount, MAX_DISPLAY_RACKS);

  for (let r = 0; r < displayRacks; r++) {
    const leafIndex = Math.floor(r / racksPerLeaf);
    const leafId = leafIds[Math.min(leafIndex, leafIds.length - 1)];
    const computeLabel = computeItems[0]
      ? `${computeItems[0].model ?? computeItems[0].type} Rack ${r + 1}`
      : `Compute Rack ${r + 1}`;

    const rackId = `rack-${r + 1}`;
    nodes.push({ id: rackId, type: 'compute_rack', label: computeLabel, zone: 'compute' });
    edges.push({ id: `${leafId}-${rackId}`, source: leafId, target: rackId, label: downlinkLabel, type: 'downlink' });
  }

  // Zones — LR column order: spine → leaf → compute
  zones.push({ id: 'spine', label: 'Spine Layer', color: DIAGRAM_PALETTE.core, nodes: spineIds });
  zones.push({ id: 'leaf', label: 'Leaf Layer', color: DIAGRAM_PALETTE.services, nodes: leafIds });
  zones.push({
    id: 'compute',
    label: 'Compute Layer',
    color: DIAGRAM_PALETTE.compute,
    nodes: nodes.filter((n) => n.zone === 'compute').map((n) => n.id),
  });

  return {
    id: nanoid(),
    style: 'topology_2d',
    title: `${plan.project.value.name} — Network Topology`,
    nodes,
    edges,
    zones,
    labels: {
      rackCount: String(plan.rackCount.value),
      powerPerRack: plan.rackPowerDensity.value ? `${plan.rackPowerDensity.value}kW` : '',
      spineCount: String(spineCount),
      leafCount: String(leafCount),
    },
    metadata: {
      planId: plan.planId,
      planVersion: plan.version,
      generatedAt: new Date().toISOString(),
      layout: 'LR',
    },
    createdAt: new Date().toISOString(),
  };
}

function buildLogicalArch(plan: CanonicalPlanState): DiagramSpec {
  const rackLabel = plan.rackCount.value ? `Compute (${plan.rackCount.value} racks)` : 'Compute';
  const powerLabel = plan.totalPower.value ? `Power (${plan.totalPower.value}kW)` : 'Power';

  const nodes: DiagramNode[] = [
    { id: 'mgmt', type: 'management', label: 'Management Plane', zone: 'management' },
    { id: 'control', type: 'control', label: 'Control Plane', zone: 'control' },
    { id: 'compute', type: 'compute_cluster', label: rackLabel, zone: 'compute' },
    { id: 'storage', type: 'storage_cluster', label: 'Storage Layer', zone: 'storage' },
    { id: 'network', type: 'network_fabric', label: 'Network Fabric', zone: 'network' },
    { id: 'cooling', type: 'cooling', label: 'Cooling', zone: 'infrastructure' },
    { id: 'power', type: 'power', label: powerLabel, zone: 'infrastructure' },
  ];

  const edges: DiagramEdge[] = [
    { id: 'mgmt-control', source: 'mgmt', target: 'control', type: 'management', label: 'mgmt' },
    { id: 'control-compute', source: 'control', target: 'compute', type: 'control', label: 'orchestrate' },
    { id: 'compute-network', source: 'compute', target: 'network', type: 'data', label: 'data fabric' },
    { id: 'compute-storage', source: 'compute', target: 'storage', type: 'storage', label: 'storage I/O' },
    { id: 'power-compute', source: 'power', target: 'compute', type: 'power', label: 'power' },
    { id: 'cooling-compute', source: 'cooling', target: 'compute', type: 'cooling', label: 'cooling' },
  ];

  return {
    id: nanoid(),
    style: 'logical_arch',
    title: `${plan.project.value.name} — Logical Architecture`,
    nodes,
    edges,
    zones: [
      { id: 'management', label: 'Management', color: DIAGRAM_PALETTE.management, nodes: ['mgmt'] },
      { id: 'control', label: 'Control', color: DIAGRAM_PALETTE.services, nodes: ['control'] },
      { id: 'compute', label: 'Compute', color: DIAGRAM_PALETTE.compute, nodes: ['compute'] },
      { id: 'storage', label: 'Storage', color: DIAGRAM_PALETTE.storage, nodes: ['storage'] },
      { id: 'network', label: 'Network', color: DIAGRAM_PALETTE.core, nodes: ['network'] },
      { id: 'infrastructure', label: 'Infrastructure', color: DIAGRAM_PALETTE.management, nodes: ['cooling', 'power'] },
    ],
    labels: {},
    metadata: { planId: plan.planId, planVersion: plan.version, layout: 'LR' },
    createdAt: new Date().toISOString(),
  };
}

function buildSiteLayout(plan: CanonicalPlanState): DiagramSpec {
  const rowA = plan.rackCount.value ? Math.ceil(plan.rackCount.value / 2) : 0;
  const rowB = plan.rackCount.value ? Math.floor(plan.rackCount.value / 2) : 0;

  const nodes: DiagramNode[] = [
    { id: 'mep', type: 'mep_room', label: 'MEP / Power', zone: 'utility' },
    { id: 'cooling_plant', type: 'cooling', label: 'Cooling Plant', zone: 'utility' },
    { id: 'row_a', type: 'rack_row', label: rowA ? `Row A (${rowA} racks)` : 'Row A', zone: 'data_hall' },
    { id: 'row_b', type: 'rack_row', label: rowB ? `Row B (${rowB} racks)` : 'Row B', zone: 'data_hall' },
    { id: 'network_room', type: 'network_room', label: 'Network / Meet-Me', zone: 'network' },
    { id: 'loading_dock', type: 'loading', label: 'Loading Dock', zone: 'facility' },
  ];

  const edges: DiagramEdge[] = [
    { id: 'mep-row_a', source: 'mep', target: 'row_a', type: 'power', label: 'power' },
    { id: 'mep-row_b', source: 'mep', target: 'row_b', type: 'power', label: 'power' },
    { id: 'cooling_plant-row_a', source: 'cooling_plant', target: 'row_a', type: 'cooling', label: 'cooling' },
    { id: 'cooling_plant-row_b', source: 'cooling_plant', target: 'row_b', type: 'cooling', label: 'cooling' },
    { id: 'network_room-row_a', source: 'network_room', target: 'row_a', type: 'network', label: 'network' },
    { id: 'network_room-row_b', source: 'network_room', target: 'row_b', type: 'network', label: 'network' },
  ];

  return {
    id: nanoid(),
    style: 'site_layout',
    title: `${plan.project.value.name} — Site Layout`,
    nodes,
    edges,
    zones: [
      { id: 'data_hall', label: 'Data Hall', color: zoneColorFor('data_hall'), nodes: ['row_a', 'row_b'] },
      { id: 'utility', label: 'Utility', color: zoneColorFor('utility'), nodes: ['mep', 'cooling_plant'] },
      { id: 'network', label: 'Network', color: zoneColorFor('network'), nodes: ['network_room'] },
      { id: 'facility', label: 'Facility', color: zoneColorFor('facility'), nodes: ['loading_dock'] },
    ],
    labels: {},
    metadata: { planId: plan.planId, planVersion: plan.version, layout: 'grid' },
    createdAt: new Date().toISOString(),
  };
}

function buildRackRow(plan: CanonicalPlanState): DiagramSpec {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const rackCount = Math.min(plan.rackCount.value || 8, 16);

  for (let i = 0; i < rackCount; i++) {
    const computeItem = plan.computeInventory.value[0];
    const rackLabel = computeItem?.model
      ? `R${String(i + 1).padStart(2, '0')} · ${computeItem.model}`
      : `Rack ${String(i + 1).padStart(2, '0')}`;
    nodes.push({
      id: `rack-${i + 1}`,
      type: 'rack',
      label: rackLabel,
      zone: 'row',
      metadata: { powerKw: plan.rackPowerDensity.value },
    });
  }

  // Add ToR switches
  const torCount = Math.ceil(rackCount / 4);
  for (let t = 0; t < torCount; t++) {
    const torId = `tor-${t + 1}`;
    nodes.push({ id: torId, type: 'tor_switch', label: `ToR ${t + 1}`, zone: 'network' });
    for (let r = t * 4; r < Math.min((t + 1) * 4, rackCount); r++) {
      edges.push({ id: `${torId}-rack-${r + 1}`, source: torId, target: `rack-${r + 1}`, type: 'downlink' });
    }
  }

  return {
    id: nanoid(),
    style: 'rack_row',
    title: `${plan.project.value.name} — Rack Row View`,
    nodes,
    edges,
    zones: [
      { id: 'network', label: 'Network', color: DIAGRAM_PALETTE.core, nodes: nodes.filter(n => n.zone === 'network').map(n => n.id) },
      { id: 'row', label: 'Rack Row', color: DIAGRAM_PALETTE.compute, nodes: nodes.filter(n => n.zone === 'row').map(n => n.id) },
    ],
    labels: { powerPerRack: plan.rackPowerDensity.value ? `${plan.rackPowerDensity.value}kW` : '' },
    metadata: { planId: plan.planId, planVersion: plan.version, layout: 'TD' },
    createdAt: new Date().toISOString(),
  };
}

function buildPresentation(plan: CanonicalPlanState): DiagramSpec {
  return buildLogicalArch(plan);
}

function buildSchematic(plan: CanonicalPlanState): DiagramSpec {
  return buildTopology2D(plan);
}
