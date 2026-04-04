import type { CanonicalPlanState } from '@/types/planning';

// ─── Mandatory color palette (never change) ───────────────────────────────────
const C = {
  spine:      '#2563EB',   // AI Fabric / Spine switches
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

/** Return a string value, or a sensible engineering default. NEVER returns 'N/A'. */
function withDefault(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '' || value === 'N/A') return fallback;
  return String(value);
}

/** Strip leading '#' for use inside PlantUML color expressions. */
function stripHash(color: string): string {
  return color.replace('#', '');
}

export function buildPlantUMLScript(plan: CanonicalPlanState, style: string): string {
  switch (style) {
    case 'topology_2d': return buildTopologyPlantUML(plan);
    case 'logical_arch': return buildLogicalArchPlantUML(plan);
    case 'site_layout': return buildSiteLayoutPlantUML(plan);
    default: return buildTopologyPlantUML(plan);
  }
}

export function buildTopologyPlantUML(plan: CanonicalPlanState): string {
  const projectName   = withDefault(plan.project?.value?.name, 'AI Data Center');
  const topology      = plan.topologyRelationships?.value ?? {};
  const connectivity  = plan.opticalOrCopperAssumptions?.value ?? {};
  const network       = plan.networkArchitecture?.value ?? {};
  const compute       = plan.computeInventory?.value ?? [];
  const rackCount     = plan.rackCount?.value ?? 0;

  const spines        = topology.spines ?? 2;
  const leaves        = topology.leaves ?? 4;
  // Use sensible Arista defaults when not populated
  const portsPerSpine  = withDefault(topology.portsPerSpine, '32×400GbE');
  const portsPerLeaf   = withDefault(topology.portsPerLeaf,  '48×100GbE + 8×400GbE');
  const uplinkBW       = withDefault(network.internalBandwidth, '400GbE');
  const downlinkBW     = withDefault(network.uplinks, '100GbE');
  const transceiverType = withDefault(connectivity.transceiverType, 'QSFP-DD');
  const cableStandard   = withDefault(connectivity.cableStandard, 'SMF');

  const firstCompute   = compute[0];
  const computeVendor  = withDefault(firstCompute?.vendor, 'NVIDIA');
  const computeModel   = withDefault(firstCompute?.model ?? firstCompute?.type, 'H100 SXM5');
  const perRackGPUs    = withDefault(firstCompute?.perRack, '8');
  const rackPowerKw    = withDefault(plan.rackPowerDensity?.value, '10');

  const displayRacks   = Math.min(rackCount || 8, 8);
  const extraRacks     = rackCount > 8 ? rackCount - 8 : 0;
  const leavesPerSpine = Math.ceil(leaves / spines);

  const lines: string[] = [
    '@startuml',
    '',
    'left to right direction',
    '',
    'skinparam backgroundColor #F8FAFC',
    'skinparam defaultFontColor #1E293B',
    'skinparam defaultFontName "Helvetica"',
    'skinparam defaultFontSize 11',
    'skinparam component {',
    `  BackgroundColor<<spine>> ${C.spine}`,
    '  BorderColor<<spine>> #1E40AF',
    '  FontColor<<spine>> #FFFFFF',
    `  BackgroundColor<<leaf>> ${C.compute}`,
    '  BorderColor<<leaf>> #2563EB',
    '  FontColor<<leaf>> #1E293B',
    '  BackgroundColor<<rack>> #DBEAFE',
    '  BorderColor<<rack>> #93C5FD',
    '  FontColor<<rack>> #1E3A8A',
    '}',
    `skinparam ArrowColor ${C.spine}`,
    'skinparam ArrowFontColor #334155',
    'skinparam ArrowFontSize 9',
    'skinparam PackageBackgroundColor #F1F5F9',
    'skinparam PackageBorderColor #CBD5E1',
    'skinparam PackageFontColor #334155',
    'skinparam NoteBackgroundColor #FEF9C3',
    'skinparam NoteBorderColor #FDE047',
    'skinparam NoteFontColor #713F12',
    '',
    `title ${projectName} — Network Topology`,
    '',
    // ─── Spine layer ──────────────────────────────────────────────────────────
    'package "Spine Layer" {',
  ];

  for (let i = 0; i < spines; i++) {
    lines.push(`  component "Spine-${i + 1}\\n${portsPerSpine}" as spine_${i + 1} <<spine>>`);
  }
  lines.push('}', '');

  // ─── Leaf packages grouped by spine domain ────────────────────────────────
  for (let s = 0; s < spines; s++) {
    const domainLeaves: number[] = [];
    for (let l = 0; l < leavesPerSpine; l++) {
      const leafIdx = s * leavesPerSpine + l + 1;
      if (leafIdx <= leaves) domainLeaves.push(leafIdx);
    }
    if (domainLeaves.length === 0) continue;
    lines.push(`package "Spine-${s + 1} Domain" {`);
    for (const li of domainLeaves) {
      lines.push(`  component "Leaf-${li}\\n${portsPerLeaf}" as leaf_${li} <<leaf>>`);
    }
    lines.push('}', '');
  }

  // ─── Compute racks ────────────────────────────────────────────────────────
  lines.push('package "Compute Layer" {');
  for (let r = 0; r < displayRacks; r++) {
    lines.push(`  component "Rack-${r + 1}\\n${computeVendor} ${computeModel}\\n${perRackGPUs} × GPU / ${rackPowerKw} kW" as rack_${r + 1} <<rack>>`);
  }
  if (extraRacks > 0) {
    lines.push(`  note "...and ${extraRacks} more racks" as extra_note`);
  }
  lines.push('}', '');

  // ─── Spine → Leaf edges (blue / AI fabric, labeled with uplink bandwidth) ─
  for (let s = 1; s <= spines; s++) {
    for (let l = 1; l <= leaves; l++) {
      lines.push(`spine_${s} -[#${stripHash(C.spine)}]-> leaf_${l} : "${uplinkBW}"`);
    }
  }
  lines.push('');

  // ─── Leaf → Rack edges (light blue / compute downlink) ────────────────────
  const racksPerLeaf = Math.max(1, Math.ceil(displayRacks / leaves));
  for (let l = 1; l <= leaves; l++) {
    for (let r = 0; r < racksPerLeaf; r++) {
      const rackIdx = (l - 1) * racksPerLeaf + r + 1;
      if (rackIdx <= displayRacks) {
        lines.push(`leaf_${l} -[#${stripHash(C.compute)}]-> rack_${rackIdx} : "${downlinkBW}"`);
      }
    }
  }
  lines.push('');

  // ─── Legend ───────────────────────────────────────────────────────────────
  lines.push(
    'legend bottom',
    '  **Legend — NeoCloud Network Topology**',
    '  |= Component |= Color |= Role |',
    `  |<${C.spine}> Spine | Blue | AI Fabric / Spine Switches |`,
    `  |<${C.compute}> Leaf | Light Blue | Leaf Switches |`,
    `  |<#DBEAFE> Rack | Steel | Compute Racks |`,
    '  |= Link |= Color |= Bandwidth |',
    `  | Spine ↔ Leaf | Blue | ${uplinkBW} (AI Fabric Uplink) |`,
    `  | Leaf ↔ Rack | Light Blue | ${downlinkBW} (Compute Downlink) |`,
    `  Spines: ${spines}   Leaves: ${leaves}   Racks: ${rackCount || displayRacks}   Transceiver: ${transceiverType}   Cable: ${cableStandard}`,
    'endlegend',
    '',
    '@enduml',
  );

  return lines.join('\n');
}

export function buildLogicalArchPlantUML(plan: CanonicalPlanState): string {
  const projectName    = withDefault(plan.project?.value?.name, 'AI Data Center');
  const network        = plan.networkArchitecture?.value ?? {};
  const cooling        = plan.coolingAssumptions?.value ?? {};
  const redundancy     = plan.redundancyAssumptions?.value ?? {};
  const topology       = plan.topologyRelationships?.value ?? {};
  const connectivity   = plan.opticalOrCopperAssumptions?.value ?? {};
  const compute        = plan.computeInventory?.value ?? [];
  const storage        = plan.storageInventory?.value ?? [];
  const services       = plan.managementServices?.value ?? [];
  const rackCount      = withDefault(plan.rackCount?.value, '0');
  const totalPower     = withDefault(plan.totalPower?.value, 'TBD');

  const arch           = withDefault(network.architecture, 'Leaf-Spine');
  const oversubRatio   = withDefault(network.oversubscriptionRatio, '1:1');
  const uplinkBW       = withDefault(network.internalBandwidth, '400GbE');
  const downlinkBW     = withDefault(network.uplinks, '100GbE');
  const coolingType    = withDefault(cooling.type, 'Direct Liquid Cooling');
  const pue            = withDefault(cooling.pue, '1.3');
  const wue            = withDefault(cooling.waterUsageEffectiveness, '1.2');
  const powerRedundancy = withDefault(redundancy.powerRedundancy, '2N');
  const storageRedundancy = withDefault(redundancy.storageRedundancy, 'RAID-6');
  const spines         = withDefault(topology.spines, '2');
  const leaves         = withDefault(topology.leaves, '4');
  const portsPerLeaf   = withDefault(topology.portsPerLeaf, '48×100GbE');
  const portsPerSpine  = withDefault(topology.portsPerSpine, '32×400GbE');
  const tier           = withDefault(topology.tier, 'Tier-3');
  const transceiverType = withDefault(connectivity.transceiverType, 'QSFP-DD');

  const serviceNames = services.length > 0
    ? services.map(s => `    [${withDefault(s.name, 'Service')}]`).join('\n')
    : '    [Grafana / Prometheus]\n    [Ansible / Terraform]\n    [IPAM / DCIM]';

  const computeItems = compute.length > 0
    ? compute.map(c => `    [${withDefault(c.vendor, 'NVIDIA')} ${withDefault(c.model ?? c.type, 'H100 SXM5')} ×${withDefault(c.quantity, '1')} / ${withDefault(c.perRack, '8')}/rack]`).join('\n')
    : '    [NVIDIA H100 SXM5 / 8 per rack]';

  const storageItems = storage.length > 0
    ? storage.map(s => `    [${withDefault(s.type, 'NVMe')} ${withDefault(s.vendor, '')} ${withDefault(s.model, '')} ${withDefault(s.capacityTB, '')}TB]`).join('\n')
    : '    [NVMe / All-Flash Storage]';

  const lines: string[] = [
    '@startuml',
    '',
    'skinparam backgroundColor #F8FAFC',
    'skinparam defaultFontColor #1E293B',
    'skinparam defaultFontName "Helvetica"',
    'skinparam defaultFontSize 11',
    'skinparam node {',
    `  BackgroundColor #EFF6FF`,
    `  BorderColor ${C.spine}`,
    '  FontColor #1E293B',
    '}',
    'skinparam frame {',
    '  BackgroundColor #F1F5F9',
    '  BorderColor #CBD5E1',
    '  FontColor #334155',
    '}',
    'skinparam database {',
    `  BackgroundColor #F0FDF4`,
    `  BorderColor ${C.storage}`,
    '  FontColor #14532D',
    '}',
    `skinparam ArrowColor ${C.spine}`,
    'skinparam ArrowFontColor #334155',
    'skinparam ArrowFontSize 9',
    'skinparam NoteBackgroundColor #FEF9C3',
    'skinparam NoteBorderColor #FDE047',
    '',
    `title ${projectName} — Logical Architecture`,
    '',
    'frame "Management Plane" {',
    `  node "Management Services" as mgmt_node #FEF3C7 {`,
    serviceNames,
    '  }',
    '}',
    '',
    'frame "Control Plane" {',
    `  node "Network Control" as ctrl_node #EFF6FF {`,
    `    [Arch: ${arch}]`,
    `    [Oversubscription: ${oversubRatio}]`,
    `    [Uplinks: ${uplinkBW}]`,
    '  }',
    '}',
    '',
    'frame "Compute Plane" {',
    `  node "Compute (${rackCount} racks)" as compute_node #F0FDF4 {`,
    computeItems,
    `    [Total Power: ${totalPower} kW]`,
    '  }',
    '}',
    '',
    'frame "Storage Plane" {',
    '  database "Storage Inventory" as storage_db {',
    storageItems,
    `    [Redundancy: ${storageRedundancy}]`,
    '  }',
    '}',
    '',
    'frame "Network Fabric" {',
    `  node "Topology" as net_node #EFF6FF {`,
    `    [${tier} Leaf-Spine]`,
    `    [Spines: ${spines} / Leaves: ${leaves}]`,
    `    [Ports/Leaf: ${portsPerLeaf}]`,
    `    [Ports/Spine: ${portsPerSpine}]`,
    '  }',
    '}',
    '',
    'frame "Infrastructure" {',
    `  node "Cooling" as cooling_node #F0F9FF {`,
    `    [Type: ${coolingType}]`,
    `    [PUE: ${pue}  WUE: ${wue}]`,
    '  }',
    `  node "Power" as power_node #FFF7ED {`,
    `    [Total: ${totalPower} kW]`,
    `    [Redundancy: ${powerRedundancy}]`,
    '  }',
    '}',
    '',
    `mgmt_node -[#${stripHash(C.management)}]-> ctrl_node : "25G mgmt"`,
    `ctrl_node -[#${stripHash(C.spine)}]-> compute_node : "orchestration"`,
    `compute_node -[#${stripHash(C.spine)}]-> net_node : "${uplinkBW} AI fabric"`,
    `compute_node -[#${stripHash(C.storage)}]-> storage_db : "${downlinkBW} storage"`,
    `power_node -[#${stripHash(C.management)}]-> compute_node : "${totalPower} kW / ${powerRedundancy}"`,
    `cooling_node -[#${stripHash(C.frontend)}]-> compute_node : "${coolingType} / PUE ${pue}"`,
    '',
    'legend bottom',
    '  **Legend — Logical Architecture**',
    '  |= Plane |= Description |',
    '  | Management | Orchestration & monitoring |',
    '  | Control | Network architecture & routing |',
    '  | Compute | GPU/CPU racks |',
    '  | Storage | Persistent data layer |',
    '  | Network | Spine-leaf switching fabric |',
    '  | Infrastructure | Power & cooling |',
    '  |= Link |= Color |= Purpose |',
    `  | Blue | ${C.spine} | AI Fabric / Spine |`,
    `  | Green | ${C.storage} | Storage |`,
    `  | Cyan | ${C.frontend} | Cooling / Front-End |`,
    `  | Orange | ${C.management} | Management |`,
    `  Racks: ${rackCount}   Power: ${totalPower} kW   PUE: ${pue}   Redundancy: ${powerRedundancy}   Transceiver: ${transceiverType}`,
    'endlegend',
    '',
    '@enduml',
  ];

  return lines.join('\n');
}

export function buildSiteLayoutPlantUML(plan: CanonicalPlanState): string {
  const projectName    = withDefault(plan.project?.value?.name, 'AI Data Center');
  const cooling        = plan.coolingAssumptions?.value ?? {};
  const redundancy     = plan.redundancyAssumptions?.value ?? {};
  const network        = plan.networkArchitecture?.value ?? {};
  const topology       = plan.topologyRelationships?.value ?? {};
  const connectivity   = plan.opticalOrCopperAssumptions?.value ?? {};
  const compute        = plan.computeInventory?.value ?? [];
  const rackCount      = plan.rackCount?.value ?? 0;
  const totalPower     = withDefault(plan.totalPower?.value, 'TBD');

  const coolingType     = withDefault(cooling.type, 'Direct Liquid Cooling');
  const pue             = withDefault(cooling.pue, '1.3');
  const wue             = withDefault(cooling.waterUsageEffectiveness, '1.2');
  const powerRedundancy = withDefault(redundancy.powerRedundancy, '2N');
  const arch            = withDefault(network.architecture, 'Leaf-Spine');
  const uplinkBW        = withDefault(network.internalBandwidth, '400GbE');
  const transceiverType = withDefault(connectivity.transceiverType, 'QSFP-DD');
  const spines          = withDefault(topology.spines, '2');
  const leaves          = withDefault(topology.leaves, '4');

  const firstCompute    = compute[0];
  const gpuModel        = withDefault(firstCompute?.model ?? firstCompute?.type, 'H100 SXM5');
  const rackPowerKw     = withDefault(plan.rackPowerDensity?.value, '10');
  const rackCountStr    = String(rackCount || 'TBD');

  const rowA = Math.ceil((rackCount || 8) / 2);
  const rowB = Math.floor((rackCount || 8) / 2);

  const lines: string[] = [
    '@startuml',
    '',
    'skinparam backgroundColor #F8FAFC',
    'skinparam defaultFontColor #1E293B',
    'skinparam defaultFontName "Helvetica"',
    'skinparam defaultFontSize 11',
    'skinparam rectangle {',
    '  BackgroundColor #F1F5F9',
    '  BorderColor #CBD5E1',
    '  FontColor #334155',
    '}',
    'skinparam node {',
    '  BackgroundColor #EFF6FF',
    `  BorderColor ${C.spine}`,
    '  FontColor #1E293B',
    '}',
    `skinparam ArrowColor ${C.spine}`,
    'skinparam ArrowFontColor #334155',
    'skinparam ArrowFontSize 9',
    'skinparam NoteBackgroundColor #FEF9C3',
    'skinparam NoteBorderColor #FDE047',
    'skinparam NoteFontColor #713F12',
    '',
    `title ${projectName} — Site Layout`,
    '',
    // ─── Data Hall: Row A and Row B side-by-side inside the rectangle ────────
    'rectangle "Data Hall" #E8FFF3 {',
    '  rectangle "Row A" as row_a #D1FAE5 {',
    `    [${rowA} racks | ${gpuModel} | ${rackPowerKw} kW/rack]`,
    '  }',
    '  rectangle "Row B" as row_b #D1FAE5 {',
    `    [${rowB} racks | ${gpuModel} | ${rackPowerKw} kW/rack]`,
    '  }',
    '}',
    '',
    // ─── Utility Room ─────────────────────────────────────────────────────────
    'rectangle "Utility Room" #F1F5F9 {',
    '  node "MEP / Power" as mep_node {',
    `    [Total: ${totalPower} kW | ${powerRedundancy}]`,
    '  }',
    '  node "Cooling Plant" as cooling_node {',
    `    [Type: ${coolingType} | PUE: ${pue}]`,
    '  }',
    `  note right of cooling_node : WUE: ${wue}`,
    '}',
    '',
    // ─── Network Room ─────────────────────────────────────────────────────────
    'rectangle "Network / Meet-Me" #EFF6FF {',
    '  node "Network Room" as net_node {',
    `    [${arch} | Spines: ${spines} / Leaves: ${leaves}]`,
    `    [Uplink: ${uplinkBW} | ${transceiverType}]`,
    '  }',
    '}',
    '',
    // ─── Facility ─────────────────────────────────────────────────────────────
    'rectangle "Facility" #FFF7ED {',
    '  node "Loading Dock" as dock_node {',
    `    [${rackCountStr} racks total]`,
    '  }',
    '}',
    '',
    // ─── Connections: one arrow per zone pair (not per row) ───────────────────
    `mep_node -[#${stripHash(C.management)}]-> row_a : "power / ${powerRedundancy}"`,
    `mep_node -[#${stripHash(C.management)}]-> row_b : "power / ${powerRedundancy}"`,
    `cooling_node -[#${stripHash(C.frontend)}]-> row_a : "${coolingType}"`,
    `cooling_node -[#${stripHash(C.frontend)}]-> row_b : "${coolingType}"`,
    `net_node -[#${stripHash(C.spine)}]-> row_a : "${uplinkBW}"`,
    `net_node -[#${stripHash(C.spine)}]-> row_b : "${uplinkBW}"`,
    '',
    // ─── Legend ───────────────────────────────────────────────────────────────
    'legend bottom',
    '  **Legend — Site Layout**',
    '  |= Zone |= Color |= Description |',
    `  |<#D1FAE5> Data Hall | Green | Compute rows / GPU racks |`,
    `  |<#F1F5F9> Utility | Gray | Power & cooling plant |`,
    `  |<#EFF6FF> Network | Blue | Meet-me / switching |`,
    `  |<#FFF7ED> Facility | Amber | Loading dock / staging |`,
    '  |= Link |= Color |= Purpose |',
    `  | Blue | ${C.spine} | Network (${uplinkBW}) |`,
    `  | Cyan | ${C.frontend} | Cooling |`,
    `  | Orange | ${C.management} | Power |`,
    `  Total Power: ${totalPower} kW   Cooling: ${coolingType}   PUE: ${pue}   Racks: ${rackCountStr}`,
    'endlegend',
    '',
    '@enduml',
  ];

  return lines.join('\n');
}
