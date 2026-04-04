// Provenance metadata - attached to every meaningful planning field
export type ProvenanceSourceType =
  | 'user_input'
  | 'uploaded_file'
  | 'workspace_confirmed'
  | 'llm_inference'
  | 'llm_estimate'
  | 'system_default';

export type ProvenanceConfidence = 'confirmed' | 'high' | 'medium' | 'low' | 'unknown';

export type ProvenanceUpdatedBy = 'user' | 'system' | 'llm';

export interface ProvenanceMetadata {
  sourceType: ProvenanceSourceType;
  sourceReference?: string;
  confidence: ProvenanceConfidence;
  notes?: string;
  lastUpdatedAt: string;
  lastUpdatedBy: ProvenanceUpdatedBy;
}

export interface ProvenanceField<T> {
  value: T;
  provenance: ProvenanceMetadata;
}

// Domain types
export interface ProjectInfo {
  name: string;
  description?: string;
  phase?: string;
  targetDate?: string;
}

export interface SiteInfo {
  city?: string;
  state?: string;
  country?: string;
  region?: string;
  notes?: string;
}

export interface CoolingInfo {
  type?: string;
  pue?: number;
  waterUsageEffectiveness?: number;
  notes?: string;
}

export interface NetworkInfo {
  architecture?: string;
  oversubscriptionRatio?: string;
  uplinks?: string;
  internalBandwidth?: string;
  notes?: string;
}

export interface RedundancyInfo {
  powerRedundancy?: string;
  networkRedundancy?: string;
  storageRedundancy?: string;
  notes?: string;
}

export interface ComputeItem {
  id: string;
  type: 'gpu' | 'tpu' | 'cpu' | 'accelerator' | 'other';
  vendor?: string;
  model?: string;
  quantity?: number;
  perRack?: number;
  notes?: string;
}

export interface StorageItem {
  id: string;
  type: 'nvme' | 'hdd' | 'object' | 'tape' | 'other';
  vendor?: string;
  model?: string;
  capacityTB?: number;
  quantity?: number;
  notes?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  type: string;
  description?: string;
  quantity?: number;
}

export interface ConnectivityInfo {
  type?: 'optical' | 'copper' | 'mixed';
  cableStandard?: string;
  transceiverType?: string;
  notes?: string;
}

export interface TopologyInfo {
  spines?: number;
  leaves?: number;
  portsPerLeaf?: number;
  portsPerSpine?: number;
  tier?: string;
  notes?: string;
}

export interface BOMLineItem {
  id: string;
  category: string;
  description: string;
  vendor?: string;
  partNumber?: string;
  quantity: ProvenanceField<number>;
  unitPrice: ProvenanceField<number>;
  totalPrice: ProvenanceField<number>;
  isQuoted: boolean;
  sourceReference?: string;
  notes?: string;
}

export interface BOMState {
  quotedItems: BOMLineItem[];
  estimatedItems: BOMLineItem[];
  totalQuoted: ProvenanceField<number>;
  totalEstimated: ProvenanceField<number>;
  grandTotal: ProvenanceField<number>;
  currency: string;
  generatedAt: string;
}

export interface CostInfo {
  capex?: number;
  opexMonthly?: number;
  opexAnnual?: number;
  costPerRack?: number;
  costPerGPU?: number;
  breakdownByCategory?: Record<string, number>;
  notes?: string;
}

export interface AssumptionItem {
  id: string;
  field: string;
  value: unknown;
  reasoning: string;
  confidence: ProvenanceConfidence;
  sourceType: ProvenanceSourceType;
  isLocked?: boolean;
  createdAt: string;
}

export interface RiskItem {
  id: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

export interface CanonicalPlanState {
  planId: string;
  version: number;
  project: ProvenanceField<ProjectInfo>;
  site: ProvenanceField<SiteInfo>;
  rackCount: ProvenanceField<number>;
  rackPowerDensity: ProvenanceField<number>;
  totalPower: ProvenanceField<number>;
  coolingAssumptions: ProvenanceField<CoolingInfo>;
  networkArchitecture: ProvenanceField<NetworkInfo>;
  redundancyAssumptions: ProvenanceField<RedundancyInfo>;
  computeInventory: ProvenanceField<ComputeItem[]>;
  storageInventory: ProvenanceField<StorageItem[]>;
  managementServices: ProvenanceField<ServiceItem[]>;
  opticalOrCopperAssumptions: ProvenanceField<ConnectivityInfo>;
  topologyRelationships: ProvenanceField<TopologyInfo>;
  bom: BOMState;
  costSummary: ProvenanceField<CostInfo>;
  assumptions: AssumptionItem[];
  risks: RiskItem[];
  openQuestions: string[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ParsedIntent {
  type: 'new_plan' | 'mutation' | 'query' | 'artifact_request' | 'clarification';
  explicitConstraints: Record<string, unknown>;
  implicitGoals: string[];
  modificationTargets: string[];
  missingInformation: string[];
  rawMessage: string;
  confidence: ProvenanceConfidence;
}

export interface AssumptionSet {
  assumptions: AssumptionItem[];
  missingFields: string[];
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  unknownConfidenceFields: string[];
}

export interface PipelineResult {
  plan: CanonicalPlanState;
  assumptions: AssumptionSet;
  validation: ValidationResult;
  changeSummary?: string;
}

export interface MutationInstruction {
  type: 'numeric_change' | 'component_swap' | 'component_removal' | 'location_change' | 'constraint_preservation' | 'full_rebuild' | 'general';
  targetField?: string;
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
  lockedFields?: string[];
}

// Diagram types
export type DiagramStyle = 'topology_2d' | 'logical_arch' | 'site_layout' | 'rack_row' | 'presentation' | 'schematic';

export interface DiagramNode {
  id: string;
  type: string;
  label: string;
  zone?: string;
  metadata?: Record<string, unknown>;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface DiagramZone {
  id: string;
  label: string;
  color?: string;
  nodes: string[];
}

export interface DiagramSpec {
  id: string;
  style: DiagramStyle;
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  zones: DiagramZone[];
  labels: Record<string, string>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Model types
export type ModelTask =
  | 'fast_chat'
  | 'deep_reasoning'
  | 'file_qa'
  | 'structured_extraction'
  | 'canonical_planning'
  | 'artifact_generation'
  | 'title_generation'
  | 'embedding'
  | 'moderation'
  | 'image_generation';

export interface ModelRunMetadata {
  model: string;
  task: ModelTask;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: 'success' | 'error';
  error?: string;
}

// Artifact types
export type ArtifactType =
  | 'summary'
  | 'report'
  | 'bom'
  | 'cost_sheet'
  | 'diagram_spec'
  | 'generated_image'
  | 'export_package'
  | 'plantuml';

export type ArtifactStatus = 'pending' | 'generating' | 'ready' | 'failed';
