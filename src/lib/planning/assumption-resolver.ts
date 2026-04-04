import { nanoid } from 'nanoid';
import { createChatCompletion } from '@/lib/ai/model-router';
import type { ParsedIntent, CanonicalPlanState, AssumptionSet, AssumptionItem } from '@/types/planning';
import { logger } from '@/lib/observability/logger';

const ASSUMPTION_SYSTEM_PROMPT = `You are a senior AI data center architect and technical planning expert for neoclouds.

Given a parsed planning intent, identify missing fields and propose concrete engineering values.

CRITICAL RULES:
1. ALWAYS propose concrete values — never leave a field empty or say "unknown".
2. Use current industry best-practices for AI data centers as defaults:
   - GPU compute: NVIDIA H100 SXM5, 8 per rack, ~10 kW/rack total (compute + overhead)
   - Network: Arista leaf-spine, 100GbE downlinks, 400GbE uplinks, QSFP-DD transceivers, SMF-OS2 fiber
   - Leaf switch ports: 48×100GbE downlinks + 8×400GbE uplinks (Arista default)
   - Spine switch ports: 32×400GbE (Arista default)
   - Cooling: Direct Liquid Cooling (DLC), PUE 1.3, WUE 1.2
   - Power redundancy: 2N
   - Network redundancy: dual-homed
   - Storage redundancy: RAID-6
3. Mark all proposed values as "llm_estimate" with confidence "medium".
4. Log every estimate as an assumption so the user knows what was inferred.
5. For GPU cluster sizing: if user says "N GPU nodes", calculate racks = ceil(N / 8), power = racks × 10 kW.
6. For leaf-spine sizing: leaves = ceil(racks / 4), spines = 2 (or 4 for >64 racks).

Return a JSON object:
{
  "assumptions": [
    {
      "id": "unique_id",
      "field": "fieldName",
      "value": "concrete proposed value",
      "reasoning": "engineering rationale",
      "confidence": "medium",
      "sourceType": "llm_estimate",
      "createdAt": "ISO timestamp"
    }
  ],
  "missingFields": ["field1", "field2"],
  "warnings": ["warning 1"]
}`;

/**
 * Resolve assumptions for missing planning fields based on parsed intent.
 */
export async function resolveAssumptions(
  intent: ParsedIntent,
  currentPlan?: CanonicalPlanState | null
): Promise<AssumptionSet> {
  const contextParts: string[] = [
    `Intent type: ${intent.type}`,
    `Explicit constraints: ${JSON.stringify(intent.explicitConstraints)}`,
    `Implicit goals: ${intent.implicitGoals.join(', ')}`,
    `Missing information: ${intent.missingInformation.join(', ')}`,
  ];

  if (currentPlan) {
    contextParts.push(`Current plan: ${currentPlan.rackCount.value} racks, project "${currentPlan.project.value.name}"`);
  }

  const contextStr = contextParts.join('\n');

  try {
    const result = await createChatCompletion(
      'canonical_planning',
      [
        { role: 'system', content: ASSUMPTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Identify assumptions needed for this planning request:\n\n${contextStr}`,
        },
      ],
      {
        responseFormat: { type: 'json_object' },
        temperature: 0.2,
      }
    );

    const parsed = JSON.parse(result.content) as {
      assumptions?: Partial<AssumptionItem>[];
      missingFields?: string[];
      warnings?: string[];
    };

    const assumptions: AssumptionItem[] = (parsed.assumptions ?? []).map((a) => ({
      id: a.id ?? nanoid(),
      field: a.field ?? 'unknown',
      value: a.value,
      reasoning: a.reasoning ?? '',
      confidence: a.confidence ?? 'low',
      sourceType: a.sourceType ?? 'llm_estimate',
      isLocked: false,
      createdAt: a.createdAt ?? new Date().toISOString(),
    }));

    return {
      assumptions,
      missingFields: parsed.missingFields ?? [],
      warnings: parsed.warnings ?? [],
    };
  } catch (error) {
    logger.error('assumption_resolution_failed', { error: String(error) });
    return {
      assumptions: [],
      missingFields: intent.missingInformation,
      warnings: ['Failed to resolve assumptions automatically. Please provide more information.'],
    };
  }
}
