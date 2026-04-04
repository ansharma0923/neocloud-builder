import { nanoid } from 'nanoid';
import type { CanonicalPlanState, DiagramSpec, DiagramStyle, DiagramNode, DiagramEdge, DiagramZone } from '@/types/planning';

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
} as const;

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
  const network = plan.networkArchitecture?.value ?? {};
  const connectivity = plan.opticalOrCopperAssumptions?.value ?? {};

  const uplinkBW    = network.internalBandwidth ?? '400GbE';
  const downlinkBW  = network.uplinks ?? '100GbE';
  const transceiverType = connectivity.transceiverType ?? 'QSFP-DD';

  // Spine layer
  const spineCount = topology.spines ?? 2;
  const spineIds: string[] = [];
  for (let i = 0; i < spineCount; i++) {
    const id = `spine-${i + 1}`;
    spineIds.push(id);
    nodes.push({
      id,
      type: 'spine_switch',
      label: `Spine ${i + 1}`,
      zone: 'spine',
      metadata: { ports: topology.portsPerSpine ?? '32×400GbE' },
    });
  }

  // Leaf layer
  const leafCount = topology.leaves ?? Math.ceil((plan.rackCount.value || 4) / 2);
  const leafIds: string[] = [];
  for (let i = 0; i < leafCount; i++) {
    const id = `leaf-${i + 1}`;
    leafIds.push(id);
    nodes.push({
      id,
      type: 'leaf_switch',
      label: `Leaf ${i + 1}`,
      zone: 'leaf',
      metadata: { ports: topology.portsPerLeaf ?? '48×100GbE' },
    });

    // Connect each leaf to every spine (full mesh)
    for (const spineId of spineIds) {
      edges.push({
        id: `${spineId}-${id}`,
        source: spineId,
        target: id,
        type: 'uplink',
        label: uplinkBW,
        metadata: { bandwidth: uplinkBW, transceiverType, color: PALETTE.spine },
      });
    }
  }

  // Compute nodes
  const computeItems = plan.computeInventory.value;
  const rackCount = plan.rackCount.value || 4;
  const racksPerLeaf = Math.max(1, Math.ceil(rackCount / leafCount));

  for (let r = 0; r < Math.min(rackCount, 16); r++) {
    const leafIndex = Math.floor(r / racksPerLeaf);
    const leafId = leafIds[Math.min(leafIndex, leafIds.length - 1)];
    const vendor = computeItems[0]?.vendor ?? 'NVIDIA';
    const model = computeItems[0]?.model ?? computeItems[0]?.type ?? 'H100 SXM5';
    const computeLabel = `${vendor} ${model}\nRack ${r + 1}`;

    const rackId = `rack-${r + 1}`;
    nodes.push({
      id: rackId,
      type: 'compute_rack',
      label: computeLabel,
      zone: 'compute',
      metadata: {
        powerKw: plan.rackPowerDensity.value,
        vendor,
        model,
        gpuCount: computeItems[0]?.perRack ?? 8,
      },
    });
    edges.push({
      id: `${leafId}-${rackId}`,
      source: leafId,
      target: rackId,
      type: 'downlink',
      label: downlinkBW,
      metadata: { bandwidth: downlinkBW, color: PALETTE.compute },
    });
  }

  // Zones — using mandatory color palette
  zones.push({ id: 'spine', label: 'Spine Layer (AI Fabric)', color: PALETTE.spine, nodes: spineIds });
  zones.push({ id: 'leaf',  label: 'Leaf Layer',              color: PALETTE.compute, nodes: leafIds });
  zones.push({
    id: 'compute',
    label: 'Compute Layer',
    color: PALETTE.frontend,
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
      rackCount:   String(plan.rackCount.value),
      powerPerRack: `${plan.rackPowerDensity.value ?? 10}kW`,
      spineCount:  String(spineCount),
      leafCount:   String(leafCount),
      uplinkBW,
      downlinkBW,
      transceiverType,
    },
    metadata: {
      planId: plan.planId,
      planVersion: plan.version,
      generatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

function buildLogicalArch(plan: CanonicalPlanState): DiagramSpec {
  const network = plan.networkArchitecture?.value ?? {};
  const uplinkBW  = network.internalBandwidth ?? '400GbE';
  const downlinkBW = network.uplinks ?? '100GbE';

  const nodes: DiagramNode[] = [
    { id: 'mgmt',    type: 'management',     label: 'Management Plane',                      zone: 'management' },
    { id: 'control', type: 'control',         label: 'Control Plane',                          zone: 'control' },
    { id: 'compute', type: 'compute_cluster', label: `Compute (${plan.rackCount.value} racks)`, zone: 'compute' },
    { id: 'storage', type: 'storage_cluster', label: 'Storage Layer',                          zone: 'storage' },
    { id: 'network', type: 'network_fabric',  label: 'Network Fabric',                         zone: 'network' },
    { id: 'cooling', type: 'cooling',         label: 'Cooling Infrastructure',                 zone: 'infrastructure' },
    { id: 'power',   type: 'power',           label: `Power (${plan.totalPower.value ?? 0}kW)`, zone: 'infrastructure' },
  ];

  const edges: DiagramEdge[] = [
    { id: 'mgmt-control',     source: 'mgmt',    target: 'control',  type: 'management', label: '25G mgmt',           metadata: { color: PALETTE.management } },
    { id: 'control-compute',  source: 'control', target: 'compute',  type: 'control',    label: 'orchestration',      metadata: { color: PALETTE.spine } },
    { id: 'compute-network',  source: 'compute', target: 'network',  type: 'data',       label: `${uplinkBW} AI fabric`, metadata: { color: PALETTE.spine } },
    { id: 'compute-storage',  source: 'compute', target: 'storage',  type: 'storage',    label: `${downlinkBW} storage`, metadata: { color: PALETTE.storage } },
    { id: 'power-compute',    source: 'power',   target: 'compute',  type: 'power',      label: 'power',              metadata: { color: PALETTE.management } },
    { id: 'cooling-compute',  source: 'cooling', target: 'compute',  type: 'cooling',    label: 'cooling',            metadata: { color: PALETTE.frontend } },
  ];

  return {
    id: nanoid(),
    style: 'logical_arch',
    title: `${plan.project.value.name} — Logical Architecture`,
    nodes,
    edges,
    zones: [
      { id: 'management',    label: 'Management',    color: PALETTE.management, nodes: ['mgmt'] },
      { id: 'control',       label: 'Control',       color: PALETTE.spine,      nodes: ['control'] },
      { id: 'compute',       label: 'Compute',       color: PALETTE.frontend,   nodes: ['compute'] },
      { id: 'storage',       label: 'Storage',       color: PALETTE.storage,    nodes: ['storage'] },
      { id: 'network',       label: 'Network',       color: PALETTE.spine,      nodes: ['network'] },
      { id: 'infrastructure', label: 'Infrastructure', color: PALETTE.reserved,  nodes: ['cooling', 'power'] },
    ],
    labels: {},
    metadata: { planId: plan.planId, planVersion: plan.version },
    createdAt: new Date().toISOString(),
  };
}

function buildSiteLayout(plan: CanonicalPlanState): DiagramSpec {
  const nodes: DiagramNode[] = [
    { id: 'mep',          type: 'mep_room',     label: 'MEP / Power',                                     zone: 'utility' },
    { id: 'cooling_plant', type: 'cooling',      label: 'Cooling Plant',                                    zone: 'utility' },
    { id: 'row_a',        type: 'rack_row',      label: `Row A (${Math.ceil(plan.rackCount.value / 2)} racks)`, zone: 'data_hall' },
    { id: 'row_b',        type: 'rack_row',      label: `Row B (${Math.floor(plan.rackCount.value / 2)} racks)`, zone: 'data_hall' },
    { id: 'network_room', type: 'network_room',  label: 'Network / Meet-Me',                               zone: 'network' },
    { id: 'loading_dock', type: 'loading',       label: 'Loading Dock',                                    zone: 'facility' },
  ];

  const edges: DiagramEdge[] = [
    { id: 'mep-row_a',          source: 'mep',          target: 'row_a', type: 'power',   label: 'power',    metadata: { color: PALETTE.management } },
    { id: 'mep-row_b',          source: 'mep',          target: 'row_b', type: 'power',   label: 'power',    metadata: { color: PALETTE.management } },
    { id: 'cooling-row_a',      source: 'cooling_plant', target: 'row_a', type: 'cooling', label: 'cooling',  metadata: { color: PALETTE.frontend } },
    { id: 'cooling-row_b',      source: 'cooling_plant', target: 'row_b', type: 'cooling', label: 'cooling',  metadata: { color: PALETTE.frontend } },
    { id: 'network-row_a',      source: 'network_room', target: 'row_a', type: 'network', label: '400GbE',   metadata: { color: PALETTE.spine } },
    { id: 'network-row_b',      source: 'network_room', target: 'row_b', type: 'network', label: '400GbE',   metadata: { color: PALETTE.spine } },
  ];

  return {
    id: nanoid(),
    style: 'site_layout',
    title: `${plan.project.value.name} — Site Layout`,
    nodes,
    edges,
    zones: [
      { id: 'data_hall', label: 'Data Hall',  color: PALETTE.storage,    nodes: ['row_a', 'row_b'] },
      { id: 'utility',   label: 'Utility',    color: PALETTE.reserved,   nodes: ['mep', 'cooling_plant'] },
      { id: 'network',   label: 'Network',    color: PALETTE.spine,      nodes: ['network_room'] },
      { id: 'facility',  label: 'Facility',   color: PALETTE.management, nodes: ['loading_dock'] },
    ],
    labels: {},
    metadata: { planId: plan.planId, planVersion: plan.version },
    createdAt: new Date().toISOString(),
  };
}

function buildRackRow(plan: CanonicalPlanState): DiagramSpec {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const rackCount = Math.min(plan.rackCount.value || 8, 20);

  const computeItem = plan.computeInventory.value[0];
  const vendor = computeItem?.vendor ?? 'NVIDIA';
  const model  = computeItem?.model  ?? computeItem?.type ?? 'H100 SXM5';
  const gpuPerRack = computeItem?.perRack ?? 8;
  const powerKw = plan.rackPowerDensity.value ?? 10;

  for (let i = 0; i < rackCount; i++) {
    nodes.push({
      id: `rack-${i + 1}`,
      type: 'rack',
      label: `R${String(i + 1).padStart(2, '0')}\n${vendor} ${model}`,
      zone: 'row',
      metadata: { powerKw, gpuCount: gpuPerRack, vendor, model },
    });
  }

  // Add ToR switches
  const torCount = Math.ceil(rackCount / 4);
  for (let t = 0; t < torCount; t++) {
    const torId = `tor-${t + 1}`;
    nodes.push({
      id: torId,
      type: 'tor_switch',
      label: `ToR ${t + 1}\n100GbE`,
      zone: 'network',
      metadata: { ports: '48×25GbE + 8×100GbE' },
    });
    for (let r = t * 4; r < Math.min((t + 1) * 4, rackCount); r++) {
      edges.push({
        id: `${torId}-rack-${r + 1}`,
        source: torId,
        target: `rack-${r + 1}`,
        type: 'downlink',
        label: '100GbE',
        metadata: { bandwidth: '100GbE', color: PALETTE.compute },
      });
    }
  }

  return {
    id: nanoid(),
    style: 'rack_row',
    title: `${plan.project.value.name} — Rack Row View`,
    nodes,
    edges,
    zones: [
      { id: 'row',     label: 'Compute Rack Row', color: PALETTE.frontend, nodes: nodes.filter(n => n.zone === 'row').map(n => n.id) },
      { id: 'network', label: 'ToR Network',       color: PALETTE.spine,   nodes: nodes.filter(n => n.zone === 'network').map(n => n.id) },
    ],
    labels: { powerPerRack: `${powerKw}kW`, gpuPerRack: String(gpuPerRack), model },
    metadata: { planId: plan.planId, planVersion: plan.version },
    createdAt: new Date().toISOString(),
  };
}

function buildPresentation(plan: CanonicalPlanState): DiagramSpec {
  return buildLogicalArch(plan);
}

function buildSchematic(plan: CanonicalPlanState): DiagramSpec {
  return buildTopology2D(plan);
}
