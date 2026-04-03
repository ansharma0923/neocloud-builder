import { nanoid } from 'nanoid';
import { createChatCompletion } from '@/lib/ai/model-router';
import type { ParsedIntent, CanonicalPlanState, AssumptionSet, AssumptionItem } from '@/types/planning';
import { logger } from '@/lib/observability/logger';

const ASSUMPTION_SYSTEM_PROMPT = `You are a technical planning expert for AI data centers and neoclouds.

Given a parsed planning intent, identify:
1. Fields that must be filled to build a coherent plan
2. Proposed values for missing fields - clearly labeled as estimates or inferences
3. NEVER present estimates as confirmed facts

CRITICAL RULES:
- All proposed values must be clearly marked as "llm_estimate" or "llm_inference" 
- Never use vendor-specific specs, pricing, or proprietary data
- Use general engineering principles for estimates
- List what information is genuinely missing and needs user input

Return a JSON object:
{
  "assumptions": [
    {
      "id": "unique_id",
      "field": "fieldName",
      "value": "proposed value",
      "reasoning": "why this value was chosen",
      "confidence": "high" | "medium" | "low",
      "sourceType": "llm_estimate" | "llm_inference",
      "createdAt": "ISO timestamp"
    }
  ],
  "missingFields": ["field1", "field2"],
  "warnings": ["warning 1", "warning 2"]
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
