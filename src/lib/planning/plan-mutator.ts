import { nanoid } from 'nanoid';
import type {
  CanonicalPlanState,
  MutationInstruction,
  ProvenanceField,
  ComputeItem,
} from '@/types/planning';
import { createProvenanceField } from './plan-builder';
import { logger } from '@/lib/observability/logger';
import { prisma } from '@/lib/db/client';

export interface MutationResult {
  plan: CanonicalPlanState;
  changeSummary: string;
  mutatedFields: string[];
}

/**
 * Apply a mutation instruction to a canonical plan.
 * Only touches fields mentioned in the mutation.
 */
export async function mutatePlan(
  plan: CanonicalPlanState,
  instruction: MutationInstruction,
  dbPlanId: string,
  triggeredByMessageId?: string
): Promise<MutationResult> {
  const now = new Date().toISOString();
  const mutatedFields: string[] = [];
  let updatedPlan: CanonicalPlanState = { ...plan };

  // Helper to update a provenance field with user_input source
  function updateField<T>(
    field: ProvenanceField<T>,
    newValue: T,
    notes?: string
  ): ProvenanceField<T> {
    mutatedFields.push(field.provenance.sourceType);
    return createProvenanceField(newValue, 'user_input', notes);
  }

  switch (instruction.type) {
    case 'numeric_change': {
      const target = instruction.targetField;
      const newValue = instruction.newValue as number;

      if (target === 'rackCount') {
        updatedPlan = {
          ...updatedPlan,
          rackCount: updateField(plan.rackCount, newValue, instruction.description),
          // Recalculate derived totalPower
          totalPower: createProvenanceField(
            newValue * plan.rackPowerDensity.value,
            'llm_inference',
            'Recalculated from updated rack count'
          ),
        };
        mutatedFields.push('rackCount', 'totalPower');
      } else if (target === 'rackPowerDensity') {
        updatedPlan = {
          ...updatedPlan,
          rackPowerDensity: updateField(plan.rackPowerDensity, newValue, instruction.description),
          totalPower: createProvenanceField(
            plan.rackCount.value * newValue,
            'llm_inference',
            'Recalculated from updated power density'
          ),
        };
        mutatedFields.push('rackPowerDensity', 'totalPower');
      }
      break;
    }

    case 'component_swap': {
      if (instruction.targetField === 'computeInventory') {
        const oldModel = (instruction.oldValue as string)?.toLowerCase();
        const newItemData = instruction.newValue as Partial<ComputeItem>;
        const updatedInventory = plan.computeInventory.value.map((item) => {
          if (
            oldModel &&
            (item.model?.toLowerCase().includes(oldModel) ||
              item.vendor?.toLowerCase().includes(oldModel))
          ) {
            return {
              ...item,
              model: newItemData.model ?? item.model,
              vendor: newItemData.vendor ?? item.vendor,
              type: newItemData.type ?? item.type,
            } as ComputeItem;
          }
          return item;
        });
        updatedPlan = {
          ...updatedPlan,
          computeInventory: createProvenanceField(updatedInventory, 'user_input', instruction.description),
        };
        mutatedFields.push('computeInventory');
      }
      break;
    }

    case 'component_removal': {
      const removeTarget = (instruction.oldValue as string)?.toLowerCase();
      if (removeTarget) {
        const filteredInventory = plan.computeInventory.value.filter(
          (item) =>
            !item.model?.toLowerCase().includes(removeTarget) &&
            !item.type?.toLowerCase().includes(removeTarget)
        );
        updatedPlan = {
          ...updatedPlan,
          computeInventory: createProvenanceField(filteredInventory, 'user_input', instruction.description),
        };
        mutatedFields.push('computeInventory');
      }
      break;
    }

    case 'location_change': {
      const newLocation = instruction.newValue as Record<string, string>;
      updatedPlan = {
        ...updatedPlan,
        site: createProvenanceField(
          { ...plan.site.value, ...newLocation },
          'user_input',
          instruction.description
        ),
        // Flag cooling and power assumptions for re-evaluation
        coolingAssumptions: createProvenanceField(
          { ...plan.coolingAssumptions.value, notes: 'Review after location change' },
          'llm_inference',
          'Location changed - review cooling assumptions'
        ),
      };
      mutatedFields.push('site', 'coolingAssumptions');
      break;
    }

    case 'constraint_preservation': {
      const lockFields = instruction.lockedFields ?? [];
      // Mark specified fields as locked in assumptions
      const updatedAssumptions = plan.assumptions.map((a) =>
        lockFields.includes(a.field) ? { ...a, isLocked: true } : a
      );
      updatedPlan = { ...updatedPlan, assumptions: updatedAssumptions };
      mutatedFields.push('assumptions');
      break;
    }

    case 'full_rebuild': {
      const lockedFields = instruction.lockedFields ?? [];
      // Preserve locked field values
      const preservedAssumptions = plan.assumptions.filter((a) => a.isLocked);

      updatedPlan = {
        ...updatedPlan,
        // Reset all fields except locked ones
        rackCount: lockedFields.includes('rackCount')
          ? plan.rackCount
          : createProvenanceField(0, 'system_default'),
        computeInventory: lockedFields.includes('computeInventory')
          ? plan.computeInventory
          : createProvenanceField([], 'system_default'),
        assumptions: preservedAssumptions,
        openQuestions: [...plan.openQuestions, 'Plan rebuilt - please re-specify requirements'],
      };
      mutatedFields.push('rackCount', 'computeInventory', 'assumptions');
      break;
    }

    case 'general':
    default: {
      // General mutation - handled by LLM, just log
      logger.info('general_mutation', { description: instruction.description });
      break;
    }
  }

  const version = plan.version + 1;
  updatedPlan = {
    ...updatedPlan,
    version,
    updatedAt: now,
  };

  // Create PlanVersion record
  await prisma.planVersion.create({
    data: {
      id: nanoid(),
      planId: dbPlanId,
      version,
      state: updatedPlan as unknown as Record<string, unknown>,
      changeSummary: instruction.description,
      triggeredByMessageId: triggeredByMessageId ?? null,
    },
  });

  const changeSummary = `Updated fields: ${mutatedFields.join(', ')}. ${instruction.description}`;

  logger.info('plan_mutated', {
    planId: plan.planId,
    version,
    mutatedFields,
    instructionType: instruction.type,
  });

  return {
    plan: updatedPlan,
    changeSummary,
    mutatedFields,
  };
}
