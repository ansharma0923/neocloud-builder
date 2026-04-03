import { parseIntent } from './intent-parser';
import { resolveAssumptions } from './assumption-resolver';
import { buildPlan } from './plan-builder';
import { validatePlan } from './plan-validator';
import type {
  CanonicalPlanState,
  PipelineResult,
} from '@/types/planning';
import { logger } from '@/lib/observability/logger';

/**
 * Run the full planning pipeline:
 * 1. Parse intent from user message
 * 2. Resolve assumptions for missing fields
 * 3. Build/update the canonical plan
 * 4. Validate the plan
 */
export async function runPlanningPipeline(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  currentPlan: CanonicalPlanState | null,
  options: {
    chatId?: string;
    fileContext?: string;
  } = {}
): Promise<PipelineResult> {
  const startTime = Date.now();

  logger.info('pipeline_start', { chatId: options.chatId, hasExistingPlan: !!currentPlan });

  // 1. Parse intent
  const intent = await parseIntent(message, conversationHistory, currentPlan);
  logger.info('intent_parsed', { type: intent.type, confidence: intent.confidence, chatId: options.chatId });

  // Skip full planning for queries and clarifications
  if (intent.type === 'query' || intent.type === 'clarification') {
    const validation = currentPlan ? validatePlan(currentPlan) : { isValid: true, errors: [], warnings: [], unknownConfidenceFields: [] };
    return {
      plan: currentPlan ?? (await buildPlan(intent, { assumptions: [], missingFields: [], warnings: [] }, null)),
      assumptions: { assumptions: [], missingFields: [], warnings: [] },
      validation,
    };
  }

  // 2. Resolve assumptions
  const assumptionSet = await resolveAssumptions(intent, currentPlan);
  logger.info('assumptions_resolved', {
    count: assumptionSet.assumptions.length,
    missing: assumptionSet.missingFields.length,
    chatId: options.chatId,
  });

  // 3. Build/update plan
  const plan = await buildPlan(intent, assumptionSet, currentPlan);

  // 4. Validate
  const validation = validatePlan(plan);

  const latencyMs = Date.now() - startTime;
  logger.info('pipeline_complete', {
    chatId: options.chatId,
    latencyMs,
    planVersion: plan.version,
    isValid: validation.isValid,
    warnings: validation.warnings.length,
  });

  return {
    plan,
    assumptions: assumptionSet,
    validation,
  };
}
