import { createChatCompletion } from '@/lib/ai/model-router';
import type { ParsedIntent, CanonicalPlanState } from '@/types/planning';
import { logger } from '@/lib/observability/logger';

const INTENT_SYSTEM_PROMPT = `You are a technical intent parser for an AI data center planning application.

Analyze the user's message and extract:
1. The intent type: "new_plan" (starting fresh), "mutation" (changing existing plan), "query" (asking about the plan), "artifact_request" (requesting a document/diagram), or "clarification" (seeking clarification)
2. Explicit constraints: specific values the user stated clearly (rack count, power density, location, compute types, etc.)
3. Implicit goals: what the user is trying to achieve that wasn't explicitly stated
4. Modification targets: what parts of an existing plan the user wants to change (if mutation)
5. Missing information: important planning parameters that weren't provided

Return a JSON object with this structure:
{
  "type": "new_plan" | "mutation" | "query" | "artifact_request" | "clarification",
  "explicitConstraints": { key: value pairs of explicitly stated values },
  "implicitGoals": ["goal 1", "goal 2"],
  "modificationTargets": ["field1", "field2"],
  "missingInformation": ["missing item 1", "missing item 2"],
  "confidence": "high" | "medium" | "low"
}`;

/**
 * Parse the user's intent from their message and conversation context.
 */
export async function parseIntent(
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
  currentPlan?: CanonicalPlanState | null
): Promise<ParsedIntent> {
  const contextMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: INTENT_SYSTEM_PROMPT },
  ];

  // Add recent conversation context (last 5 messages)
  const recentHistory = conversationHistory.slice(-5);
  for (const msg of recentHistory) {
    contextMessages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  let planContext = '';
  if (currentPlan) {
    planContext = `\n\nCurrent plan exists: version ${currentPlan.version}, project "${currentPlan.project.value.name}", ${currentPlan.rackCount.value} racks.`;
  }

  contextMessages.push({
    role: 'user',
    content: `Parse the intent from this message:${planContext}\n\nUser message: "${message}"`,
  });

  try {
    const result = await createChatCompletion('structured_extraction', contextMessages, {
      responseFormat: { type: 'json_object' },
      temperature: 0.1,
    });

    const parsed = JSON.parse(result.content) as Partial<ParsedIntent>;

    return {
      type: parsed.type ?? 'query',
      explicitConstraints: parsed.explicitConstraints ?? {},
      implicitGoals: parsed.implicitGoals ?? [],
      modificationTargets: parsed.modificationTargets ?? [],
      missingInformation: parsed.missingInformation ?? [],
      rawMessage: message,
      confidence: parsed.confidence ?? 'medium',
    };
  } catch (error) {
    logger.error('intent_parsing_failed', { error: String(error), message });
    // Return a safe fallback
    return {
      type: 'query',
      explicitConstraints: {},
      implicitGoals: [],
      modificationTargets: [],
      missingInformation: [],
      rawMessage: message,
      confidence: 'low',
    };
  }
}
