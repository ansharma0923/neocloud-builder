import type { CanonicalPlanState } from '@/types/planning';

function na(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  return String(value);
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
  const projectName = na(plan.project?.value?.name);
  const topology = plan.topologyRelationships?.value ?? {};
  const connectivity = plan.opticalOrCopperAssumptions?.value ?? {};
  const network = plan.networkArchitecture?.value ?? {};
  const compute = plan.computeInventory?.value ?? [];
  const rackCount = plan.rackCount?.value ?? 0;
  const rackCountDisplay = na(plan.rackCount?.value);
  const rackPowerDensity = na(plan.rackPowerDensity?.value);

  const spines = topology.spines ?? 2;
  const leaves = topology.leaves ?? 4;
  const portsPerSpine = na(topology.portsPerSpine);
  const portsPerLeaf = na(topology.portsPerLeaf);
  const oversubRatio = na(network.oversubscriptionRatio);
  const internalBandwidth = na(network.internalBandwidth);
  const transceiverType = na(connectivity.transceiverType);
  const cableStandard = na(connectivity.cableStandard);

  const firstCompute = compute[0];
  const computeVendor = na(firstCompute?.vendor);
  const computeModel = na(firstCompute?.model ?? firstCompute?.type);
  const perRackGPUs = na(firstCompute?.perRack);

  const displayRacks = Math.min(rackCount, 16);
  const extraRacks = rackCount > 16 ? rackCount - 16 : 0;

  const spineComponents = Array.from({ length: spines }, (_, i) => {
    const id = `spine_${i + 1}`;
    return `  component "Spine-${i + 1}\\n${portsPerSpine} ports\\n${internalBandwidth} uplinks" as ${id} <<spine>>`;
  });

  const leafComponents = Array.from({ length: leaves }, (_, i) => {
    const id = `leaf_${i + 1}`;
    return `  component "Leaf-${i + 1}\\n${portsPerLeaf} ports\\nOversubscription: ${oversubRatio}" as ${id} <<leaf>>`;
  });

  const rackComponents = Array.from({ length: displayRacks }, (_, i) => {
    const id = `rack_${i + 1}`;
    return `  component "Rack-${i + 1}\\n${computeVendor} ${computeModel}\\n${perRackGPUs} GPUs\\n${rackPowerDensity} kW" as ${id} <<rack>>`;
  });

  if (extraRacks > 0) {
    rackComponents.push(`  note "... and ${extraRacks} more racks" as extra_racks_note`);
  }

  const spineLeafEdges: string[] = [];
  for (let s = 1; s <= spines; s++) {
    for (let l = 1; l <= leaves; l++) {
      spineLeafEdges.push(`spine_${s} --> leaf_${l} : "${internalBandwidth}\\n${transceiverType}"`);
    }
  }

  const leafRackEdges: string[] = [];
  for (let l = 1; l <= leaves; l++) {
    const racksPerLeaf = Math.ceil(displayRacks / leaves);
    for (let r = 0; r < racksPerLeaf; r++) {
      const rackIdx = (l - 1) * racksPerLeaf + r + 1;
      if (rackIdx <= displayRacks) {
        leafRackEdges.push(`leaf_${l} --> rack_${rackIdx} : "${internalBandwidth}\\n${cableStandard}"`);
      }
    }
  }

  const lines: string[] = [
    '@startuml',
    '',
    'skinparam backgroundColor #0a0a0a',
    'skinparam defaultFontColor #a3a3a3',
    'skinparam defaultFontName "Helvetica"',
    'skinparam component {',
    '  BackgroundColor<<spine>> #1e3a5f',
    '  BorderColor<<spine>> #4f8ef7',
    '  FontColor<<spine>> #93c5fd',
    '  BackgroundColor<<leaf>> #0e3a2f',
    '  BorderColor<<leaf>> #10b981',
    '  FontColor<<leaf>> #6ee7b7',
    '  BackgroundColor<<rack>> #2d1b4e',
    '  BorderColor<<rack>> #8b5cf6',
    '  FontColor<<rack>> #c4b5fd',
    '}',
    'skinparam ArrowColor #4b5563',
    'skinparam NoteBackgroundColor #1a1a1a',
    'skinparam NoteBorderColor #2a2a2a',
    'skinparam NoteFontColor #6b7280',
    'skinparam PackageBackgroundColor #111111',
    'skinparam PackageBorderColor #2a2a2a',
    'skinparam PackageFontColor #f5f5f5',
    '',
    `title ${projectName} — Network Topology`,
    '',
    'package "Spine Layer" {',
    ...spineComponents,
    '}',
    '',
    'package "Leaf Layer" {',
    ...leafComponents,
    '}',
    '',
    'package "Compute Layer" {',
    ...rackComponents,
    '}',
    '',
    ...spineLeafEdges,
    '',
    ...leafRackEdges,
    '',
    'legend right',
    '  |= Color |= Layer |',
    '  |<#4f8ef7> | Spine (blue) |',
    '  |<#10b981> | Leaf (green) |',
    '  |<#8b5cf6> | Rack (purple) |',
    `  Spines: ${spines}  |  Leaves: ${leaves}  |  Racks: ${rackCountDisplay}`,
    `  Internal Bandwidth: ${internalBandwidth}`,
    `  Transceiver: ${transceiverType}  |  Cable: ${cableStandard}`,
    'endlegend',
    '',
    '@enduml',
  ];

  return lines.join('\n');
}

export function buildLogicalArchPlantUML(plan: CanonicalPlanState): string {
  const projectName = na(plan.project?.value?.name);
  const network = plan.networkArchitecture?.value ?? {};
  const cooling = plan.coolingAssumptions?.value ?? {};
  const redundancy = plan.redundancyAssumptions?.value ?? {};
  const topology = plan.topologyRelationships?.value ?? {};
  const connectivity = plan.opticalOrCopperAssumptions?.value ?? {};
  const compute = plan.computeInventory?.value ?? [];
  const storage = plan.storageInventory?.value ?? [];
  const services = plan.managementServices?.value ?? [];
  const rackCount = na(plan.rackCount?.value);
  const totalPower = na(plan.totalPower?.value);

  const arch = na(network.architecture);
  const oversubRatio = na(network.oversubscriptionRatio);
  const uplinks = na(network.uplinks);
  const internalBandwidth = na(network.internalBandwidth);
  const coolingType = na(cooling.type);
  const pue = na(cooling.pue);
  const wue = na(cooling.waterUsageEffectiveness);
  const powerRedundancy = na(redundancy.powerRedundancy);
  const storageRedundancy = na(redundancy.storageRedundancy);
  const spines = na(topology.spines);
  const leaves = na(topology.leaves);
  const portsPerLeaf = na(topology.portsPerLeaf);
  const portsPerSpine = na(topology.portsPerSpine);
  const tier = na(topology.tier);

  const serviceNames = services.length > 0
    ? services.map(s => `    [${na(s.name)}]`).join('\n')
    : '    [No management services defined]';

  const computeItems = compute.length > 0
    ? compute.map(c => `    [${na(c.vendor)} ${na(c.model ?? c.type)} x${na(c.quantity)} / ${na(c.perRack)}/rack]`).join('\n')
    : '    [No compute inventory defined]';

  const storageItems = storage.length > 0
    ? storage.map(s => `    [${na(s.type)} ${na(s.vendor)} ${na(s.model)} ${na(s.capacityTB)}TB]`).join('\n')
    : '    [No storage inventory defined]';

  const lines: string[] = [
    '@startuml',
    '',
    'skinparam backgroundColor #0a0a0a',
    'skinparam defaultFontColor #a3a3a3',
    'skinparam defaultFontName "Helvetica"',
    'skinparam node {',
    '  BackgroundColor #1a1a2e',
    '  BorderColor #4b5563',
    '  FontColor #f5f5f5',
    '}',
    'skinparam frame {',
    '  BackgroundColor #111111',
    '  BorderColor #2a2a2a',
    '  FontColor #f5f5f5',
    '}',
    'skinparam database {',
    '  BackgroundColor #0c2340',
    '  BorderColor #3b82f6',
    '  FontColor #93c5fd',
    '}',
    'skinparam ArrowColor #4b5563',
    'skinparam NoteBackgroundColor #1a1a1a',
    'skinparam NoteBorderColor #2a2a2a',
    'skinparam NoteFontColor #6b7280',
    '',
    `title ${projectName} — Logical Architecture`,
    '',
    'frame "Management" {',
    '  node "Management Services" as mgmt_node #2d1654 {',
    serviceNames,
    '  }',
    '}',
    '',
    'frame "Control Plane" {',
    '  node "Network Architecture" as ctrl_node #2a1a00 {',
    `    [Architecture: ${arch}]`,
    `    [Oversubscription: ${oversubRatio}]`,
    `    [Uplinks: ${uplinks}]`,
    '  }',
    '}',
    '',
    'frame "Compute" {',
    `  node "Compute (${rackCount} racks)" as compute_node #0a2e1a {`,
    computeItems,
    `    [Total Power: ${totalPower} kW]`,
    '  }',
    '}',
    '',
    'frame "Storage" {',
    '  database "Storage Inventory" as storage_db {',
    storageItems,
    `    [Redundancy: ${storageRedundancy}]`,
    '  }',
    '}',
    '',
    'frame "Network Fabric" {',
    '  node "Topology" as net_node #0c1d3a {',
    `    [Tier: ${tier}]`,
    `    [Spines: ${spines} / Leaves: ${leaves}]`,
    `    [Ports/Leaf: ${portsPerLeaf} / Ports/Spine: ${portsPerSpine}]`,
    '  }',
    '}',
    '',
    'frame "Infrastructure" {',
    '  node "Cooling" as cooling_node #1a1f2e {',
    `    [Type: ${coolingType}]`,
    `    [PUE: ${pue}]`,
    `    [WUE: ${wue}]`,
    '  }',
    '  node "Power" as power_node #1a1f2e {',
    `    [Total: ${totalPower} kW]`,
    `    [Redundancy: ${powerRedundancy}]`,
    '  }',
    '}',
    '',
    'mgmt_node --> ctrl_node : "management traffic"',
    'ctrl_node --> compute_node : "orchestration"',
    `compute_node --> storage_db : "${internalBandwidth} data fabric"`,
    `storage_db --> storage_db : "${storageRedundancy} storage"`,
    `power_node --> compute_node : "${totalPower} kW / ${powerRedundancy}"`,
    `cooling_node --> compute_node : "${coolingType} / PUE ${pue}"`,
    '',
    'legend right',
    '  |= Frame |= Description |',
    '  | Management | Orchestration & monitoring services |',
    '  | Control Plane | Network architecture & routing |',
    '  | Compute | GPU/CPU racks & processing |',
    '  | Storage | Persistent data layer |',
    '  | Network Fabric | Spine-leaf switching fabric |',
    '  | Infrastructure | Power & cooling systems |',
    `  Total Power: ${totalPower} kW  |  Racks: ${rackCount}`,
    `  PUE: ${pue}  |  Redundancy: ${powerRedundancy}`,
    'endlegend',
    '',
    '@enduml',
  ];

  return lines.join('\n');
}

export function buildSiteLayoutPlantUML(plan: CanonicalPlanState): string {
  const projectName = na(plan.project?.value?.name);
  const cooling = plan.coolingAssumptions?.value ?? {};
  const redundancy = plan.redundancyAssumptions?.value ?? {};
  const network = plan.networkArchitecture?.value ?? {};
  const topology = plan.topologyRelationships?.value ?? {};
  const connectivity = plan.opticalOrCopperAssumptions?.value ?? {};
  const compute = plan.computeInventory?.value ?? [];
  const rackCount = plan.rackCount?.value ?? 0;
  const rackCountDisplay = na(plan.rackCount?.value);
  const totalPower = na(plan.totalPower?.value);

  const coolingType = na(cooling.type);
  const pue = na(cooling.pue);
  const wue = na(cooling.waterUsageEffectiveness);
  const powerRedundancy = na(redundancy.powerRedundancy);
  const arch = na(network.architecture);
  const internalBandwidth = na(network.internalBandwidth);
  const transceiverType = na(connectivity.transceiverType);
  const spines = na(topology.spines);
  const leaves = na(topology.leaves);

  const firstCompute = compute[0];
  const gpuModel = na(firstCompute?.model ?? firstCompute?.type);
  const rackPowerDensity = na(plan.rackPowerDensity?.value);

  const rowA = Math.ceil(rackCount / 2);
  const rowB = Math.floor(rackCount / 2);

  const lines: string[] = [
    '@startuml',
    '',
    'skinparam backgroundColor #0a0a0a',
    'skinparam defaultFontColor #a3a3a3',
    'skinparam defaultFontName "Helvetica"',
    'skinparam rectangle {',
    '  BackgroundColor #111111',
    '  BorderColor #2a2a2a',
    '  FontColor #f5f5f5',
    '}',
    'skinparam node {',
    '  BackgroundColor #1a1a2e',
    '  BorderColor #4b5563',
    '  FontColor #f5f5f5',
    '}',
    'skinparam ArrowColor #4b5563',
    'skinparam NoteBackgroundColor #1a1a1a',
    'skinparam NoteBorderColor #2a2a2a',
    'skinparam NoteFontColor #6b7280',
    '',
    `title ${projectName} — Site Layout`,
    '',
    'rectangle "Data Hall" #0a2e1a {',
    '  node "Row A" as row_a #0a2e1a {',
    `    [${rowA} racks | ${gpuModel} | ${rackPowerDensity} kW/rack | ${coolingType}]`,
    '  }',
    '  node "Row B" as row_b #0a2e1a {',
    `    [${rowB} racks | ${gpuModel} | ${rackPowerDensity} kW/rack | ${coolingType}]`,
    '  }',
    '}',
    '',
    'rectangle "Utility Room" #1a1f2e {',
    '  node "MEP / Power" as mep_node #1a1f2e {',
    `    [Total: ${totalPower} kW]`,
    `    [Redundancy: ${powerRedundancy}]`,
    '  }',
    '  node "Cooling Plant" as cooling_node #1a1f2e {',
    `    [Type: ${coolingType}]`,
    `    [PUE: ${pue}]`,
    `    [WUE: ${wue}]`,
    '  }',
    '}',
    '',
    'rectangle "Network / Meet-Me" #0c1d3a {',
    '  node "Network Room" as net_node #0c1d3a {',
    `    [Arch: ${arch}]`,
    `    [Spines: ${spines} / Leaves: ${leaves}]`,
    `    [Bandwidth: ${internalBandwidth}]`,
    '  }',
    '}',
    '',
    'rectangle "Facility" #1a1010 {',
    '  node "Loading Dock" as dock_node #1a1010 {',
    `    [${rackCountDisplay} racks total]`,
    '  }',
    '}',
    '',
    `mep_node --> row_a : "power\\n${totalPower} kW / ${powerRedundancy}"`,
    `mep_node --> row_b : "power\\n${totalPower} kW / ${powerRedundancy}"`,
    `cooling_node --> row_a : "${coolingType}\\nPUE ${pue}"`,
    `cooling_node --> row_b : "${coolingType}\\nPUE ${pue}"`,
    `net_node --> row_a : "${internalBandwidth}\\n${transceiverType}"`,
    `net_node --> row_b : "${internalBandwidth}\\n${transceiverType}"`,
    '',
    'legend right',
    '  |= Color |= Zone |',
    '  |<#22c55e> | Data Hall (green) |',
    '  |<#6b7280> | Utility Room (gray) |',
    '  |<#3b82f6> | Network Room (blue) |',
    '  |<#6b1a1a> | Facility (red) |',
    `  Total Power: ${totalPower} kW  |  Cooling: ${coolingType}`,
    `  PUE: ${pue}  |  Racks: ${rackCountDisplay}  |  GPU: ${gpuModel}`,
    'endlegend',
    '',
    '@enduml',
  ];

  return lines.join('\n');
}
