import type { CanonicalPlanState } from '@/types/planning';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function na(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

/** Returns a concise label only when the value is meaningful (non-empty). */
function edgeLabel(...parts: string[]): string {
  const meaningful = parts.filter(Boolean);
  return meaningful.length > 0 ? meaningful.join(' · ') : '';
}

/** Maximum number of racks to render inline; additional racks are summarised as a note. */
const MAX_DISPLAY_RACKS = 12;

// ─── Mandatory color palette (skinparam values) ───────────────────────────────
// Colors match the fixed design-system palette. Do not change.

const SK_LIGHT_BG      = '#FFFFFF';
const SK_FONT          = '#1E293B';
const SK_FONT_NAME     = '"Arial, Helvetica"';
const SK_ARROW         = '#94A3B8';

// Node / component background and border colors by role
const SK_SPINE_BG      = '#DBEAFE';  // light blue  (core / fabric)
const SK_SPINE_BORDER  = '#2563EB';
const SK_SPINE_FONT    = '#1E3A8A';

const SK_LEAF_BG       = '#CFFAFE';  // light cyan  (services layer)
const SK_LEAF_BORDER   = '#06B6D4';
const SK_LEAF_FONT     = '#164E63';

const SK_COMPUTE_BG    = '#EFF6FF';  // pale blue   (general compute)
const SK_COMPUTE_BORDER= '#60A5FA';
const SK_COMPUTE_FONT  = '#1E3A8A';

const SK_STORAGE_BG    = '#DCFCE7';  // light green (storage)
const SK_STORAGE_BORDER= '#16A34A';
const SK_STORAGE_FONT  = '#14532D';

const SK_MGMT_BG       = '#FEF3C7';  // light amber (management)
const SK_MGMT_BORDER   = '#F59E0B';
const SK_MGMT_FONT     = '#78350F';

const SK_ZONE_BG       = '#F8FAFC';  // very light gray for packages
const SK_ZONE_BORDER   = '#CBD5E1';
const SK_ZONE_FONT     = '#334155';

const SK_NOTE_BG       = '#F1F5F9';
const SK_NOTE_BORDER   = '#CBD5E1';
const SK_NOTE_FONT     = '#64748B';

// ─── Common skinparam block ───────────────────────────────────────────────────

function baseSkinparams(): string[] {
  return [
    `skinparam backgroundColor ${SK_LIGHT_BG}`,
    `skinparam defaultFontColor ${SK_FONT}`,
    `skinparam defaultFontName ${SK_FONT_NAME}`,
    `skinparam defaultFontSize 11`,
    `skinparam ArrowColor ${SK_ARROW}`,
    `skinparam ArrowFontColor ${SK_FONT}`,
    `skinparam ArrowFontSize 10`,
    `skinparam NoteBackgroundColor ${SK_NOTE_BG}`,
    `skinparam NoteBorderColor ${SK_NOTE_BORDER}`,
    `skinparam NoteFontColor ${SK_NOTE_FONT}`,
    `skinparam PackageBackgroundColor ${SK_ZONE_BG}`,
    `skinparam PackageBorderColor ${SK_ZONE_BORDER}`,
    `skinparam PackageFontColor ${SK_ZONE_FONT}`,
    `skinparam shadowing false`,
    `skinparam roundCorner 6`,
  ];
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function buildPlantUMLScript(plan: CanonicalPlanState, style: string): string {
  switch (style) {
    case 'topology_2d': return buildTopologyPlantUML(plan);
    case 'logical_arch': return buildLogicalArchPlantUML(plan);
    case 'site_layout': return buildSiteLayoutPlantUML(plan);
    default: return buildTopologyPlantUML(plan);
  }
}

// ─── Topology (left-to-right) ─────────────────────────────────────────────────

export function buildTopologyPlantUML(plan: CanonicalPlanState): string {
  const projectName  = na(plan.project?.value?.name) || 'Infrastructure';
  const topology     = plan.topologyRelationships?.value ?? {};
  const connectivity = plan.opticalOrCopperAssumptions?.value ?? {};
  const network      = plan.networkArchitecture?.value ?? {};
  const compute      = plan.computeInventory?.value ?? [];
  const rackCount    = plan.rackCount?.value ?? 0;

  const spines  = topology.spines ?? 2;
  const leaves  = topology.leaves ?? 4;

  // Labels sourced from plan data only — empty means label is omitted
  const uplinkLabel   = edgeLabel(na(network.internalBandwidth), na(connectivity.transceiverType));
  const downlinkLabel = edgeLabel(na(connectivity.cableStandard));
  const oversubText   = na(network.oversubscriptionRatio);
  const portsPerSpine = na(topology.portsPerSpine);
  const portsPerLeaf  = na(topology.portsPerLeaf);

  const firstCompute  = compute[0];
  const computeLabel  = [na(firstCompute?.vendor), na(firstCompute?.model ?? firstCompute?.type)]
    .filter(Boolean).join(' ') || 'Compute';

  const displayRacks  = Math.min(rackCount, MAX_DISPLAY_RACKS);
  const extraRacks    = rackCount > MAX_DISPLAY_RACKS ? rackCount - MAX_DISPLAY_RACKS : 0;

  const spineComponents = Array.from({ length: spines }, (_, i) => {
    const portInfo = portsPerSpine ? `\\n${portsPerSpine} ports` : '';
    return `  component "Spine-${i + 1}${portInfo}" as spine_${i + 1} <<spine>>`;
  });

  const leafComponents = Array.from({ length: leaves }, (_, i) => {
    const portInfo = portsPerLeaf ? `\\n${portsPerLeaf} ports` : '';
    const overInfo = oversubText ? `\\nOsub ${oversubText}` : '';
    return `  component "Leaf-${i + 1}${portInfo}${overInfo}" as leaf_${i + 1} <<leaf>>`;
  });

  const rackComponents = Array.from({ length: displayRacks }, (_, i) => {
    return `  component "Rack-${i + 1}\\n${computeLabel}" as rack_${i + 1} <<rack>>`;
  });
  if (extraRacks > 0) {
    rackComponents.push(`  note "…and ${extraRacks} more racks" as extra_note`);
  }

  // Semantic arrow colors — matching the fixed design-system palette
  const ARROW_UPLINK   = '#2563EB'; // core / fabric
  const ARROW_DOWNLINK = '#06B6D4'; // services / leaf

  const spineLeafEdges: string[] = [];
  for (let s = 1; s <= spines; s++) {
    for (let l = 1; l <= leaves; l++) {
      const lbl = uplinkLabel ? ` : "${uplinkLabel}"` : '';
      spineLeafEdges.push(`spine_${s} -[${ARROW_UPLINK}]-> leaf_${l}${lbl}`);
    }
  }

  const leafRackEdges: string[] = [];
  for (let l = 1; l <= leaves; l++) {
    const racksPerLeaf = Math.ceil(displayRacks / leaves);
    for (let r = 0; r < racksPerLeaf; r++) {
      const rackIdx = (l - 1) * racksPerLeaf + r + 1;
      if (rackIdx <= displayRacks) {
        const lbl = downlinkLabel ? ` : "${downlinkLabel}"` : '';
        leafRackEdges.push(`leaf_${l} -[${ARROW_DOWNLINK}]-> rack_${rackIdx}${lbl}`);
      }
    }
  }

  const lines: string[] = [
    '@startuml',
    '',
    'left to right direction',
    '',
    ...baseSkinparams(),
    'skinparam component {',
    `  BackgroundColor<<spine>> ${SK_SPINE_BG}`,
    `  BorderColor<<spine>> ${SK_SPINE_BORDER}`,
    `  FontColor<<spine>> ${SK_SPINE_FONT}`,
    `  BackgroundColor<<leaf>> ${SK_LEAF_BG}`,
    `  BorderColor<<leaf>> ${SK_LEAF_BORDER}`,
    `  FontColor<<leaf>> ${SK_LEAF_FONT}`,
    `  BackgroundColor<<rack>> ${SK_COMPUTE_BG}`,
    `  BorderColor<<rack>> ${SK_COMPUTE_BORDER}`,
    `  FontColor<<rack>> ${SK_COMPUTE_FONT}`,
    '}',
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
    '  Node Colors',
    `  <back:${SK_SPINE_BG}><color:${SK_SPINE_BORDER}>Spine</color></back>  : core / fabric`,
    `  <back:${SK_LEAF_BG}><color:${SK_LEAF_BORDER}>Leaf</color></back>   : services layer`,
    `  <back:${SK_COMPUTE_BG}><color:${SK_COMPUTE_BORDER}>Rack</color></back>   : compute`,
    '  ----',
    '  Connection Colors',
    `  <color:#2563EB>━━</color> Blue  : uplink (spine → leaf)`,
    `  <color:#06B6D4>━━</color> Cyan  : downlink (leaf → rack)`,
    'endlegend',
    '',
    '@enduml',
  ];

  return lines.join('\n');
}

// ─── Logical Architecture (left-to-right) ─────────────────────────────────────

export function buildLogicalArchPlantUML(plan: CanonicalPlanState): string {
  const projectName  = na(plan.project?.value?.name) || 'Infrastructure';
  const network      = plan.networkArchitecture?.value ?? {};
  const cooling      = plan.coolingAssumptions?.value ?? {};
  const redundancy   = plan.redundancyAssumptions?.value ?? {};
  const topology     = plan.topologyRelationships?.value ?? {};
  const compute      = plan.computeInventory?.value ?? [];
  const storage      = plan.storageInventory?.value ?? [];
  const services     = plan.managementServices?.value ?? [];

  const rackCount    = plan.rackCount?.value;
  const totalPower   = plan.totalPower?.value;

  const arch         = na(network.architecture);
  const coolingType  = na(cooling.type);
  const pue          = na(cooling.pue);
  const powerRed     = na(redundancy.powerRedundancy);
  const spines       = na(topology.spines);
  const leaves       = na(topology.leaves);
  const bw           = na(network.internalBandwidth);

  /** Render a list of items as PlantUML sub-components, filtering out blank labels. */
  function toSubComponents(labels: string[]): string {
    return labels.filter(Boolean).map(l => `  [${l}]`).join('\n');
  }

  const serviceNames = toSubComponents(
    services.map(s => na(s.name))
  );

  const computeItems = toSubComponents(
    compute.map(c => [na(c.vendor), na(c.model ?? c.type), c.quantity ? `x${c.quantity}` : ''].filter(Boolean).join(' '))
  );

  const storageItems = toSubComponents(
    storage.map(s => [na(s.type), na(s.vendor), na(s.model), s.capacityTB ? `${s.capacityTB}TB` : ''].filter(Boolean).join(' '))
  );

  const rackLabel    = rackCount ? `Compute (${rackCount} racks)` : 'Compute';
  const powerLabel   = totalPower ? `Power (${totalPower} kW)` : 'Power';

  const mgmtToCtrl   = 'management traffic';
  const ctrlToComp   = 'orchestration';
  const compToStore  = bw ? `${bw} data fabric` : 'data fabric';
  const powerToComp  = powerRed || 'power';
  const coolToComp   = coolingType || 'cooling';

  const archLine     = arch ? `    [Arch: ${arch}]` : '';
  const topoLine     = spines && leaves ? `    [Spines: ${spines} / Leaves: ${leaves}]` : '';
  const totalPwrLine = totalPower ? `    [Total Power: ${totalPower} kW]` : '';
  const pueLine      = pue ? `    [PUE: ${pue}]` : '';
  const redLine      = powerRed ? `    [Redundancy: ${powerRed}]` : '';

  // Semantic arrow colors — matching the fixed design-system palette
  const ARROW_MGMT    = '#F59E0B'; // management / amber
  const ARROW_CTRL    = '#2563EB'; // control / core blue
  const ARROW_STORAGE = '#16A34A'; // storage / green
  const ARROW_POWER   = '#EF4444'; // power / security red
  const ARROW_COOLING = '#9333EA'; // cooling / purple

  const lines: string[] = [
    '@startuml',
    '',
    'left to right direction',
    '',
    ...baseSkinparams(),
    'skinparam rectangle {',
    `  BackgroundColor ${SK_ZONE_BG}`,
    `  BorderColor ${SK_ZONE_BORDER}`,
    `  FontColor ${SK_ZONE_FONT}`,
    '}',
    'skinparam node {',
    `  BackgroundColor ${SK_MGMT_BG}`,
    `  BorderColor ${SK_MGMT_BORDER}`,
    `  FontColor ${SK_MGMT_FONT}`,
    '}',
    'skinparam database {',
    `  BackgroundColor ${SK_STORAGE_BG}`,
    `  BorderColor ${SK_STORAGE_BORDER}`,
    `  FontColor ${SK_STORAGE_FONT}`,
    '}',
    '',
    `title ${projectName} — Logical Architecture`,
    '',
    'rectangle "Management" {',
    `  node "Management Services" as mgmt_node {`,
    serviceNames,
    '  }',
    '}',
    '',
    'rectangle "Control Plane" {',
    '  node "Network Architecture" as ctrl_node {',
    archLine,
    topoLine,
    '  }',
    '}',
    '',
    `rectangle "Compute" {`,
    `  node "${rackLabel}" as compute_node {`,
    computeItems,
    totalPwrLine,
    '  }',
    '}',
    '',
    'rectangle "Storage" {',
    '  database "Storage Layer" as storage_db {',
    storageItems,
    '  }',
    '}',
    '',
    'rectangle "Infrastructure" {',
    '  node "Cooling" as cooling_node {',
    coolingType ? `    [${coolingType}]` : '',
    pueLine,
    '  }',
    `  node "${powerLabel}" as power_node {`,
    redLine,
    '  }',
    '}',
    '',
    `mgmt_node -[${ARROW_MGMT}]-> ctrl_node : "${mgmtToCtrl}"`,
    `ctrl_node -[${ARROW_CTRL}]-> compute_node : "${ctrlToComp}"`,
    `compute_node -[${ARROW_STORAGE}]-> storage_db : "${compToStore}"`,
    `power_node -[${ARROW_POWER}]-> compute_node : "${powerToComp}"`,
    `cooling_node -[${ARROW_COOLING}]-> compute_node : "${coolToComp}"`,
    '',
    'legend right',
    '  Node Colors',
    `  <back:${SK_MGMT_BG}><color:${SK_MGMT_BORDER}>Management</color></back>`,
    `  <back:${SK_STORAGE_BG}><color:${SK_STORAGE_BORDER}>Storage</color></back>`,
    `  <back:${SK_COMPUTE_BG}><color:${SK_COMPUTE_BORDER}>Compute</color></back>`,
    '  ----',
    '  Connection Colors',
    `  <color:#F59E0B>━━</color> Amber  : management`,
    `  <color:#2563EB>━━</color> Blue   : control / data fabric`,
    `  <color:#16A34A>━━</color> Green  : storage I/O`,
    `  <color:#EF4444>━━</color> Red    : power`,
    `  <color:#9333EA>━━</color> Purple : cooling`,
    'endlegend',
    '',
    '@enduml',
  ].filter((line): line is string => typeof line === 'string');

  return lines.join('\n');
}

// ─── Site Layout (top-down) ───────────────────────────────────────────────────

export function buildSiteLayoutPlantUML(plan: CanonicalPlanState): string {
  const projectName  = na(plan.project?.value?.name) || 'Infrastructure';
  const cooling      = plan.coolingAssumptions?.value ?? {};
  const redundancy   = plan.redundancyAssumptions?.value ?? {};
  const network      = plan.networkArchitecture?.value ?? {};
  const topology     = plan.topologyRelationships?.value ?? {};
  const compute      = plan.computeInventory?.value ?? [];
  const rackCount    = plan.rackCount?.value ?? 0;
  const totalPower   = plan.totalPower?.value;

  const coolingType  = na(cooling.type);
  const pue          = na(cooling.pue);
  const powerRed     = na(redundancy.powerRedundancy);
  const arch         = na(network.architecture);
  const bw           = na(network.internalBandwidth);
  const spines       = na(topology.spines);
  const leaves       = na(topology.leaves);

  const firstCompute = compute[0];
  const computeLabel = [na(firstCompute?.vendor), na(firstCompute?.model ?? firstCompute?.type)]
    .filter(Boolean).join(' ') || 'Compute';

  const rowA = Math.ceil(rackCount / 2);
  const rowB = Math.floor(rackCount / 2);

  const rowALabel        = rowA ? `${rowA} racks · ${computeLabel}` : computeLabel;
  const rowBLabel        = rowB ? `${rowB} racks · ${computeLabel}` : computeLabel;
  const powerEdgeLabel   = [totalPower ? `${totalPower} kW` : '', powerRed].filter(Boolean).join(' / ');
  const coolingEdgeLabel = [coolingType, pue ? `PUE ${pue}` : ''].filter(Boolean).join(' · ');
  const netEdgeLabel     = [arch, bw].filter(Boolean).join(' · ');
  const topoInfo         = spines && leaves ? `${spines} spines / ${leaves} leaves` : '';

  // Semantic arrow colors — matching the fixed design-system palette
  const ARROW_POWER   = '#EF4444'; // power / security red
  const ARROW_COOLING = '#9333EA'; // cooling / purple
  const ARROW_NETWORK = '#2563EB'; // network / core blue

  const lines: string[] = [
    '@startuml',
    '',
    ...baseSkinparams(),
    'skinparam rectangle {',
    `  BackgroundColor ${SK_ZONE_BG}`,
    `  BorderColor ${SK_ZONE_BORDER}`,
    `  FontColor ${SK_ZONE_FONT}`,
    '}',
    'skinparam node {',
    `  BackgroundColor ${SK_COMPUTE_BG}`,
    `  BorderColor ${SK_COMPUTE_BORDER}`,
    `  FontColor ${SK_COMPUTE_FONT}`,
    '}',
    '',
    `title ${projectName} — Site Layout`,
    '',
    'rectangle "Data Hall" {',
    `  node "Row A\\n${rowALabel}" as row_a`,
    `  node "Row B\\n${rowBLabel}" as row_b`,
    '}',
    '',
    'rectangle "Utility Room" {',
    `  node "MEP / Power" as mep_node`,
    `  node "Cooling Plant" as cooling_node`,
    '}',
    '',
    'rectangle "Network / Meet-Me" {',
    `  node "Network Room${topoInfo ? `\\n${topoInfo}` : ''}" as net_node`,
    '}',
    '',
    'rectangle "Facility" {',
    `  node "Loading Dock${rackCount ? `\\n${rackCount} racks total` : ''}" as dock_node`,
    '}',
    '',
    `mep_node -[${ARROW_POWER}]-> row_a : "${powerEdgeLabel || 'power'}"`,
    `mep_node -[${ARROW_POWER}]-> row_b : "${powerEdgeLabel || 'power'}"`,
    `cooling_node -[${ARROW_COOLING}]-> row_a : "${coolingEdgeLabel || 'cooling'}"`,
    `cooling_node -[${ARROW_COOLING}]-> row_b : "${coolingEdgeLabel || 'cooling'}"`,
    `net_node -[${ARROW_NETWORK}]-> row_a : "${netEdgeLabel || 'network'}"`,
    `net_node -[${ARROW_NETWORK}]-> row_b : "${netEdgeLabel || 'network'}"`,
    '',
    'legend right',
    '  Zone Colors',
    `  <back:${SK_COMPUTE_BG}><color:${SK_COMPUTE_BORDER}>Data Hall</color></back>`,
    `  <back:${SK_MGMT_BG}><color:${SK_MGMT_BORDER}>Utility</color></back>`,
    `  <back:${SK_SPINE_BG}><color:${SK_SPINE_BORDER}>Network</color></back>`,
    '  ----',
    '  Connection Colors',
    `  <color:#EF4444>━━</color> Red    : power`,
    `  <color:#9333EA>━━</color> Purple : cooling`,
    `  <color:#2563EB>━━</color> Blue   : network`,
    'endlegend',
    '',
    '@enduml',
  ];

  return lines.join('\n');
}
