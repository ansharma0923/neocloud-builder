import { nanoid } from 'nanoid';
import type {
  ParsedIntent,
  AssumptionSet,
  CanonicalPlanState,
  ProvenanceField,
  ProvenanceMetadata,
  ProvenanceSourceType,
} from '@/types/planning';
import { createChatCompletion } from '@/lib/ai/model-router';
import { logger } from '@/lib/observability/logger';

/**
 * Create a provenance field with default LLM estimate provenance.
 */
export function createProvenanceField<T>(
  value: T,
  sourceType: ProvenanceSourceType = 'llm_estimate',
  notes?: string
): ProvenanceField<T> {
  const provenance: ProvenanceMetadata = {
    sourceType,
    confidence:
      sourceType === 'user_input' || sourceType === 'workspace_confirmed'
        ? 'confirmed'
        : sourceType === 'uploaded_file'
        ? 'high'
        : sourceType === 'llm_inference'
        ? 'medium'
        : 'low',
    notes,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy:
      sourceType === 'user_input' || sourceType === 'workspace_confirmed'
        ? 'user'
        : sourceType === 'system_default'
        ? 'system'
        : 'llm',
  };
  return { value, provenance };
}

const PLAN_BUILDER_SYSTEM_PROMPT = `You are a technical planner for AI data centers and neoclouds.

Build a structured plan from the provided intent and assumptions. 

CRITICAL RULES:
- Do not hardcode any vendor specs, pricing, GPU performance data, or proprietary information
- Mark all inferred values as "llm_estimate" or "llm_inference" 
- Mark all user-provided values as "user_input"
- Be conservative with estimates and clearly note uncertainty
- Return a valid JSON plan structure

Return a JSON object representing the plan fields you can populate:
{
  "project": { "name": string, "description": string, "phase": string },
  "site": { "city": string, "state": string, "country": string },
  "rackCount": number,
  "rackPowerDensity": number,
  "totalPower": number,
  "coolingAssumptions": { "type": string, "pue": number, "notes": string },
  "networkArchitecture": { "architecture": string, "oversubscriptionRatio": string, "notes": string },
  "redundancyAssumptions": { "powerRedundancy": string, "networkRedundancy": string, "storageRedundancy": string },
  "computeInventory": [{ "id": string, "type": string, "vendor": string, "model": string, "quantity": number, "perRack": number }],
  "storageInventory": [{ "id": string, "type": string, "capacityTB": number, "quantity": number }],
  "topologyRelationships": { "spines": number, "leaves": number, "tier": string },
  "openQuestions": [string],
  "risks": [{ "id": string, "category": string, "description": string, "severity": string }],
  "notes": [string],
  "fieldSources": { "fieldName": "user_input" | "llm_estimate" | "llm_inference" | "system_default" }
}`;

/**
 * Build or update a CanonicalPlanState from parsed intent and resolved assumptions.
 */
export async function buildPlan(
  intent: ParsedIntent,
  assumptions: AssumptionSet,
  priorPlan?: CanonicalPlanState | null
): Promise<CanonicalPlanState> {
  const contextParts = [
    `Intent: ${intent.type}`,
    `Explicit constraints: ${JSON.stringify(intent.explicitConstraints)}`,
    `Implicit goals: ${intent.implicitGoals.join(', ')}`,
    `Resolved assumptions: ${JSON.stringify(assumptions.assumptions.map((a) => ({ field: a.field, value: a.value, source: a.sourceType })))}`,
  ];

  if (priorPlan) {
    contextParts.push(`Prior plan: ${JSON.stringify({
      rackCount: priorPlan.rackCount.value,
      site: priorPlan.site.value,
      project: priorPlan.project.value,
    })}`);
  }

  try {
    const result = await createChatCompletion(
      'canonical_planning',
      [
        { role: 'system', content: PLAN_BUILDER_SYSTEM_PROMPT },
        { role: 'user', content: `Build plan from:\n${contextParts.join('\n')}` },
      ],
      {
        responseFormat: { type: 'json_object' },
        temperature: 0.2,
      }
    );

    const parsed = JSON.parse(result.content) as Record<string, unknown>;
    const fieldSources = (parsed.fieldSources as Record<string, ProvenanceSourceType>) ?? {};

    const getSource = (field: string): ProvenanceSourceType => {
      return fieldSources[field] ?? 'llm_estimate';
    };

    // Get explicit user-input fields from intent
    const userInputFields = new Set(Object.keys(intent.explicitConstraints));

    const now = new Date().toISOString();
    const planId = priorPlan?.planId ?? nanoid();

    const plan: CanonicalPlanState = {
      planId,
      version: (priorPlan?.version ?? 0) + 1,
      project: createProvenanceField(
        { name: 'Unnamed Project', ...(parsed.project as Record<string, string>) },
        userInputFields.has('project') ? 'user_input' : getSource('project')
      ),
      site: createProvenanceField(
        (parsed.site as Record<string, string | undefined>) ?? {},
        userInputFields.has('site') || userInputFields.has('location') ? 'user_input' : getSource('site')
      ),
      rackCount: createProvenanceField(
        typeof parsed.rackCount === 'number' ? parsed.rackCount : 0,
        userInputFields.has('rackCount') ? 'user_input' : getSource('rackCount')
      ),
      rackPowerDensity: createProvenanceField(
        typeof parsed.rackPowerDensity === 'number' ? parsed.rackPowerDensity : 0,
        userInputFields.has('rackPowerDensity') ? 'user_input' : getSource('rackPowerDensity')
      ),
      totalPower: createProvenanceField(
        typeof parsed.totalPower === 'number' ? parsed.totalPower : 0,
        getSource('totalPower')
      ),
      coolingAssumptions: createProvenanceField(
        (parsed.coolingAssumptions as Record<string, unknown>) ?? {},
        getSource('coolingAssumptions')
      ),
      networkArchitecture: createProvenanceField(
        (parsed.networkArchitecture as Record<string, unknown>) ?? {},
        getSource('networkArchitecture')
      ),
      redundancyAssumptions: createProvenanceField(
        (parsed.redundancyAssumptions as Record<string, unknown>) ?? {},
        getSource('redundancyAssumptions')
      ),
      computeInventory: createProvenanceField(
        Array.isArray(parsed.computeInventory) ? parsed.computeInventory as never[] : [],
        userInputFields.has('computeInventory') ? 'user_input' : getSource('computeInventory')
      ),
      storageInventory: createProvenanceField(
        Array.isArray(parsed.storageInventory) ? parsed.storageInventory as never[] : [],
        getSource('storageInventory')
      ),
      managementServices: createProvenanceField([], 'system_default'),
      opticalOrCopperAssumptions: createProvenanceField({}, 'llm_estimate'),
      topologyRelationships: createProvenanceField(
        (parsed.topologyRelationships as Record<string, unknown>) ?? {},
        getSource('topologyRelationships')
      ),
      bom: {
        quotedItems: [],
        estimatedItems: [],
        totalQuoted: createProvenanceField(0, 'system_default'),
        totalEstimated: createProvenanceField(0, 'system_default'),
        grandTotal: createProvenanceField(0, 'system_default'),
        currency: 'USD',
        generatedAt: now,
      },
      costSummary: createProvenanceField({}, 'llm_estimate'),
      assumptions: assumptions.assumptions,
      risks: Array.isArray(parsed.risks) ? parsed.risks as never[] : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions as string[] : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes as string[] : [],
      createdAt: priorPlan?.createdAt ?? now,
      updatedAt: now,
    };

    logger.info('plan_built', { planId, version: plan.version, rackCount: plan.rackCount.value });
    return plan;
  } catch (error) {
    logger.error('plan_build_failed', { error: String(error) });
    // Return a minimal empty plan
    return createEmptyPlan(intent);
  }
}

/**
 * Create a minimal empty plan from intent.
 */
export function createEmptyPlan(intent?: ParsedIntent): CanonicalPlanState {
  const now = new Date().toISOString();
  const projectName = (intent?.explicitConstraints['projectName'] as string) ?? 'Unnamed Project';

  return {
    planId: nanoid(),
    version: 1,
    project: createProvenanceField({ name: projectName }, intent?.explicitConstraints['projectName'] ? 'user_input' : 'system_default'),
    site: createProvenanceField({}, 'system_default'),
    rackCount: createProvenanceField(0, 'system_default'),
    rackPowerDensity: createProvenanceField(0, 'system_default'),
    totalPower: createProvenanceField(0, 'system_default'),
    coolingAssumptions: createProvenanceField({}, 'system_default'),
    networkArchitecture: createProvenanceField({}, 'system_default'),
    redundancyAssumptions: createProvenanceField({}, 'system_default'),
    computeInventory: createProvenanceField([], 'system_default'),
    storageInventory: createProvenanceField([], 'system_default'),
    managementServices: createProvenanceField([], 'system_default'),
    opticalOrCopperAssumptions: createProvenanceField({}, 'system_default'),
    topologyRelationships: createProvenanceField({}, 'system_default'),
    bom: {
      quotedItems: [],
      estimatedItems: [],
      totalQuoted: createProvenanceField(0, 'system_default'),
      totalEstimated: createProvenanceField(0, 'system_default'),
      grandTotal: createProvenanceField(0, 'system_default'),
      currency: 'USD',
      generatedAt: now,
    },
    costSummary: createProvenanceField({}, 'system_default'),
    assumptions: [],
    risks: [],
    openQuestions: [],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };
}
