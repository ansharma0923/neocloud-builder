import { z } from 'zod';

export const ProvenanceSourceTypeSchema = z.enum([
  'user_input',
  'uploaded_file',
  'workspace_confirmed',
  'llm_inference',
  'llm_estimate',
  'system_default',
]);

export const ProvenanceConfidenceSchema = z.enum([
  'confirmed',
  'high',
  'medium',
  'low',
  'unknown',
]);

export const ProvenanceUpdatedBySchema = z.enum(['user', 'system', 'llm']);

export const ProvenanceMetadataSchema = z.object({
  sourceType: ProvenanceSourceTypeSchema,
  sourceReference: z.string().optional(),
  confidence: ProvenanceConfidenceSchema,
  notes: z.string().optional(),
  lastUpdatedAt: z.string(),
  lastUpdatedBy: ProvenanceUpdatedBySchema,
});

export function ProvenanceFieldSchema<T extends z.ZodType>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    provenance: ProvenanceMetadataSchema,
  });
}

export const ProjectInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  phase: z.string().optional(),
  targetDate: z.string().optional(),
});

export const SiteInfoSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  notes: z.string().optional(),
});

export const CoolingInfoSchema = z.object({
  type: z.string().optional(),
  pue: z.number().optional(),
  waterUsageEffectiveness: z.number().optional(),
  notes: z.string().optional(),
});

export const NetworkInfoSchema = z.object({
  architecture: z.string().optional(),
  oversubscriptionRatio: z.string().optional(),
  uplinks: z.string().optional(),
  internalBandwidth: z.string().optional(),
  notes: z.string().optional(),
});

export const RedundancyInfoSchema = z.object({
  powerRedundancy: z.string().optional(),
  networkRedundancy: z.string().optional(),
  storageRedundancy: z.string().optional(),
  notes: z.string().optional(),
});

export const ComputeItemSchema = z.object({
  id: z.string(),
  type: z.enum(['gpu', 'tpu', 'cpu', 'accelerator', 'other']),
  vendor: z.string().optional(),
  model: z.string().optional(),
  quantity: z.number().optional(),
  perRack: z.number().optional(),
  notes: z.string().optional(),
});

export const StorageItemSchema = z.object({
  id: z.string(),
  type: z.enum(['nvme', 'hdd', 'object', 'tape', 'other']),
  vendor: z.string().optional(),
  model: z.string().optional(),
  capacityTB: z.number().optional(),
  quantity: z.number().optional(),
  notes: z.string().optional(),
});

export const ServiceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  quantity: z.number().optional(),
});

export const ConnectivityInfoSchema = z.object({
  type: z.enum(['optical', 'copper', 'mixed']).optional(),
  cableStandard: z.string().optional(),
  transceiverType: z.string().optional(),
  notes: z.string().optional(),
});

export const TopologyInfoSchema = z.object({
  spines: z.number().optional(),
  leaves: z.number().optional(),
  portsPerLeaf: z.number().optional(),
  portsPerSpine: z.number().optional(),
  tier: z.string().optional(),
  notes: z.string().optional(),
});

export const BOMLineItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  vendor: z.string().optional(),
  partNumber: z.string().optional(),
  quantity: ProvenanceFieldSchema(z.number()),
  unitPrice: ProvenanceFieldSchema(z.number()),
  totalPrice: ProvenanceFieldSchema(z.number()),
  isQuoted: z.boolean(),
  sourceReference: z.string().optional(),
  notes: z.string().optional(),
});

export const BOMStateSchema = z.object({
  quotedItems: z.array(BOMLineItemSchema),
  estimatedItems: z.array(BOMLineItemSchema),
  totalQuoted: ProvenanceFieldSchema(z.number()),
  totalEstimated: ProvenanceFieldSchema(z.number()),
  grandTotal: ProvenanceFieldSchema(z.number()),
  currency: z.string(),
  generatedAt: z.string(),
});

export const CostInfoSchema = z.object({
  capex: z.number().optional(),
  opexMonthly: z.number().optional(),
  opexAnnual: z.number().optional(),
  costPerRack: z.number().optional(),
  costPerGPU: z.number().optional(),
  breakdownByCategory: z.record(z.number()).optional(),
  notes: z.string().optional(),
});

export const AssumptionItemSchema = z.object({
  id: z.string(),
  field: z.string(),
  value: z.unknown(),
  reasoning: z.string(),
  confidence: ProvenanceConfidenceSchema,
  sourceType: ProvenanceSourceTypeSchema,
  isLocked: z.boolean().optional(),
  createdAt: z.string(),
});

export const RiskItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  mitigation: z.string().optional(),
});

export const CanonicalPlanStateSchema = z.object({
  planId: z.string(),
  version: z.number(),
  project: ProvenanceFieldSchema(ProjectInfoSchema),
  site: ProvenanceFieldSchema(SiteInfoSchema),
  rackCount: ProvenanceFieldSchema(z.number()),
  rackPowerDensity: ProvenanceFieldSchema(z.number()),
  totalPower: ProvenanceFieldSchema(z.number()),
  coolingAssumptions: ProvenanceFieldSchema(CoolingInfoSchema),
  networkArchitecture: ProvenanceFieldSchema(NetworkInfoSchema),
  redundancyAssumptions: ProvenanceFieldSchema(RedundancyInfoSchema),
  computeInventory: ProvenanceFieldSchema(z.array(ComputeItemSchema)),
  storageInventory: ProvenanceFieldSchema(z.array(StorageItemSchema)),
  managementServices: ProvenanceFieldSchema(z.array(ServiceItemSchema)),
  opticalOrCopperAssumptions: ProvenanceFieldSchema(ConnectivityInfoSchema),
  topologyRelationships: ProvenanceFieldSchema(TopologyInfoSchema),
  bom: BOMStateSchema,
  costSummary: ProvenanceFieldSchema(CostInfoSchema),
  assumptions: z.array(AssumptionItemSchema),
  risks: z.array(RiskItemSchema),
  openQuestions: z.array(z.string()),
  notes: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ParsedIntentSchema = z.object({
  type: z.enum(['new_plan', 'mutation', 'query', 'artifact_request', 'clarification']),
  explicitConstraints: z.record(z.unknown()),
  implicitGoals: z.array(z.string()),
  modificationTargets: z.array(z.string()),
  missingInformation: z.array(z.string()),
  rawMessage: z.string(),
  confidence: ProvenanceConfidenceSchema,
});
