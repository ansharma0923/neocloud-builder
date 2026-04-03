import { nanoid } from 'nanoid';
import type { CanonicalPlanState, DiagramSpec, DiagramStyle, DiagramNode, DiagramEdge, DiagramZone } from '@/types/planning';

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
        type: 'uplink',
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
    const computeLabel = computeItems[0]
      ? `${computeItems[0].model ?? computeItems[0].type} Rack ${r + 1}`
      : `Compute Rack ${r + 1}`;

    const rackId = `rack-${r + 1}`;
    nodes.push({ id: rackId, type: 'compute_rack', label: computeLabel, zone: 'compute' });
    edges.push({ id: `${leafId}-${rackId}`, source: leafId, target: rackId, type: 'downlink' });
  }

  // Zones
  zones.push({ id: 'spine', label: 'Spine Layer', color: '#4f46e5', nodes: spineIds });
  zones.push({ id: 'leaf', label: 'Leaf Layer', color: '#0891b2', nodes: leafIds });
  zones.push({
    id: 'compute',
    label: 'Compute Layer',
    color: '#059669',
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
      powerPerRack: `${plan.rackPowerDensity.value}kW`,
      spineCount: String(spineCount),
      leafCount: String(leafCount),
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
  const nodes: DiagramNode[] = [
    { id: 'mgmt', type: 'management', label: 'Management Plane', zone: 'management' },
    { id: 'control', type: 'control', label: 'Control Plane', zone: 'control' },
    { id: 'compute', type: 'compute_cluster', label: `Compute (${plan.rackCount.value} racks)`, zone: 'compute' },
    { id: 'storage', type: 'storage_cluster', label: 'Storage Layer', zone: 'storage' },
    { id: 'network', type: 'network_fabric', label: 'Network Fabric', zone: 'network' },
    { id: 'cooling', type: 'cooling', label: 'Cooling Infrastructure', zone: 'infrastructure' },
    { id: 'power', type: 'power', label: `Power (${plan.totalPower.value}kW total)`, zone: 'infrastructure' },
  ];

  const edges: DiagramEdge[] = [
    { id: 'mgmt-control', source: 'mgmt', target: 'control', type: 'management' },
    { id: 'control-compute', source: 'control', target: 'compute', type: 'control' },
    { id: 'compute-network', source: 'compute', target: 'network', type: 'data' },
    { id: 'compute-storage', source: 'compute', target: 'storage', type: 'storage' },
    { id: 'power-compute', source: 'power', target: 'compute', type: 'power' },
    { id: 'cooling-compute', source: 'cooling', target: 'compute', type: 'cooling' },
  ];

  return {
    id: nanoid(),
    style: 'logical_arch',
    title: `${plan.project.value.name} — Logical Architecture`,
    nodes,
    edges,
    zones: [
      { id: 'management', label: 'Management', color: '#7c3aed', nodes: ['mgmt'] },
      { id: 'control', label: 'Control', color: '#4f46e5', nodes: ['control'] },
      { id: 'compute', label: 'Compute', color: '#059669', nodes: ['compute'] },
      { id: 'storage', label: 'Storage', color: '#0891b2', nodes: ['storage'] },
      { id: 'network', label: 'Network', color: '#d97706', nodes: ['network'] },
      { id: 'infrastructure', label: 'Infrastructure', color: '#6b7280', nodes: ['cooling', 'power'] },
    ],
    labels: {},
    metadata: { planId: plan.planId, planVersion: plan.version },
    createdAt: new Date().toISOString(),
  };
}

function buildSiteLayout(plan: CanonicalPlanState): DiagramSpec {
  const nodes: DiagramNode[] = [
    { id: 'mep', type: 'mep_room', label: 'MEP / Power', zone: 'utility' },
    { id: 'cooling_plant', type: 'cooling', label: 'Cooling Plant', zone: 'utility' },
    { id: 'row_a', type: 'rack_row', label: `Row A (${Math.ceil(plan.rackCount.value / 2)} racks)`, zone: 'data_hall' },
    { id: 'row_b', type: 'rack_row', label: `Row B (${Math.floor(plan.rackCount.value / 2)} racks)`, zone: 'data_hall' },
    { id: 'network_room', type: 'network_room', label: 'Network/Meet-Me', zone: 'network' },
    { id: 'loading_dock', type: 'loading', label: 'Loading Dock', zone: 'facility' },
  ];

  const edges: DiagramEdge[] = [
    { id: 'mep-row_a', source: 'mep', target: 'row_a', type: 'power' },
    { id: 'mep-row_b', source: 'mep', target: 'row_b', type: 'power' },
    { id: 'cooling_plant-row_a', source: 'cooling_plant', target: 'row_a', type: 'cooling' },
    { id: 'cooling_plant-row_b', source: 'cooling_plant', target: 'row_b', type: 'cooling' },
    { id: 'network_room-row_a', source: 'network_room', target: 'row_a', type: 'network' },
    { id: 'network_room-row_b', source: 'network_room', target: 'row_b', type: 'network' },
  ];

  return {
    id: nanoid(),
    style: 'site_layout',
    title: `${plan.project.value.name} — Site Layout`,
    nodes,
    edges,
    zones: [
      { id: 'data_hall', label: 'Data Hall', color: '#059669', nodes: ['row_a', 'row_b'] },
      { id: 'utility', label: 'Utility', color: '#6b7280', nodes: ['mep', 'cooling_plant'] },
      { id: 'network', label: 'Network', color: '#4f46e5', nodes: ['network_room'] },
      { id: 'facility', label: 'Facility', color: '#374151', nodes: ['loading_dock'] },
    ],
    labels: {},
    metadata: { planId: plan.planId, planVersion: plan.version },
    createdAt: new Date().toISOString(),
  };
}

function buildRackRow(plan: CanonicalPlanState): DiagramSpec {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const rackCount = Math.min(plan.rackCount.value || 8, 20); // Limit for display

  for (let i = 0; i < rackCount; i++) {
    const computeItem = plan.computeInventory.value[0];
    nodes.push({
      id: `rack-${i + 1}`,
      type: 'rack',
      label: `R${String(i + 1).padStart(2, '0')}\n${computeItem?.model ?? 'Compute'}`,
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
      { id: 'row', label: 'Rack Row', color: '#059669', nodes: nodes.filter(n => n.zone === 'row').map(n => n.id) },
      { id: 'network', label: 'Network', color: '#4f46e5', nodes: nodes.filter(n => n.zone === 'network').map(n => n.id) },
    ],
    labels: { powerPerRack: `${plan.rackPowerDensity.value}kW` },
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
