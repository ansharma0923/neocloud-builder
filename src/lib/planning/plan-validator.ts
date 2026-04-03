import type { CanonicalPlanState, ValidationResult } from '@/types/planning';

/**
 * Validate a CanonicalPlanState for structural consistency and provenance completeness.
 */
export function validatePlan(plan: CanonicalPlanState): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unknownConfidenceFields: string[] = [];

  // Check required top-level fields
  if (!plan.planId) errors.push('planId is required');
  if (!plan.version || plan.version < 1) errors.push('version must be >= 1');
  if (!plan.createdAt) errors.push('createdAt is required');

  // Check provenance fields
  const provenanceFields: [string, { value: unknown; provenance: { confidence: string; sourceType: string; lastUpdatedAt?: string } }][] = [
    ['project', plan.project],
    ['site', plan.site],
    ['rackCount', plan.rackCount],
    ['rackPowerDensity', plan.rackPowerDensity],
    ['totalPower', plan.totalPower],
    ['coolingAssumptions', plan.coolingAssumptions],
    ['networkArchitecture', plan.networkArchitecture],
    ['redundancyAssumptions', plan.redundancyAssumptions],
    ['computeInventory', plan.computeInventory],
    ['storageInventory', plan.storageInventory],
    ['topologyRelationships', plan.topologyRelationships],
    ['costSummary', plan.costSummary],
  ];

  for (const [fieldName, field] of provenanceFields) {
    if (!field.provenance) {
      errors.push(`Field "${fieldName}" is missing provenance metadata`);
      continue;
    }

    if (field.provenance.confidence === 'unknown') {
      unknownConfidenceFields.push(fieldName);
      warnings.push(`Field "${fieldName}" has unknown confidence - review required`);
    }

    if (!field.provenance.lastUpdatedAt) {
      warnings.push(`Field "${fieldName}" is missing lastUpdatedAt timestamp`);
    }
  }

  // Logical consistency checks
  if (plan.rackCount.value > 0 && plan.rackPowerDensity.value > 0) {
    const expectedPower = plan.rackCount.value * plan.rackPowerDensity.value;
    const actualPower = plan.totalPower.value;
    // Allow 10% variance for rounding/overheads
    if (actualPower > 0 && Math.abs(actualPower - expectedPower) / expectedPower > 0.1) {
      warnings.push(
        `totalPower (${actualPower}kW) may be inconsistent with rackCount (${plan.rackCount.value}) × rackPowerDensity (${plan.rackPowerDensity.value}kW) = ${expectedPower}kW`
      );
    }
  }

  if (plan.rackCount.value === 0) {
    warnings.push('rackCount is 0 - plan may be incomplete');
  }

  // Check BOM consistency
  const { bom } = plan;
  if (bom.quotedItems.length + bom.estimatedItems.length > 0) {
    const computedTotal = bom.quotedItems.reduce((sum, item) => sum + item.totalPrice.value, 0) +
      bom.estimatedItems.reduce((sum, item) => sum + item.totalPrice.value, 0);
    if (Math.abs(computedTotal - bom.grandTotal.value) > 1) {
      warnings.push('BOM grandTotal does not match sum of line items');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    unknownConfidenceFields,
  };
}
