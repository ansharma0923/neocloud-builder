import { describe, it, expect } from 'vitest';
import { validatePlan } from '@/lib/planning/plan-validator';
import { createEmptyPlan } from '@/lib/planning/plan-builder';

describe('plan-validator', () => {
  it('validates a valid empty plan without errors', () => {
    const plan = createEmptyPlan();
    const result = validatePlan(plan);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when rackCount is 0', () => {
    const plan = createEmptyPlan();
    const result = validatePlan(plan);
    expect(result.warnings.some((w) => w.includes('rackCount is 0'))).toBe(true);
  });

  it('returns isValid true when no errors', () => {
    const plan = createEmptyPlan();
    const result = validatePlan(plan);
    expect(result.isValid).toBe(true);
  });

  it('returns isValid false when planId is missing', () => {
    const plan = { ...createEmptyPlan(), planId: '' };
    const result = validatePlan(plan);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('planId'))).toBe(true);
  });

  it('warns on power inconsistency', () => {
    const plan = {
      ...createEmptyPlan(),
      rackCount: { value: 10, provenance: { sourceType: 'user_input' as const, confidence: 'confirmed' as const, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: 'user' as const } },
      rackPowerDensity: { value: 10, provenance: { sourceType: 'user_input' as const, confidence: 'confirmed' as const, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: 'user' as const } },
      totalPower: { value: 50, provenance: { sourceType: 'llm_estimate' as const, confidence: 'low' as const, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: 'llm' as const } },
    };
    const result = validatePlan(plan);
    expect(result.warnings.some((w) => w.includes('inconsistent'))).toBe(true);
  });

  it('flags unknown confidence fields', () => {
    const plan = {
      ...createEmptyPlan(),
      rackCount: { value: 5, provenance: { sourceType: 'llm_estimate' as const, confidence: 'unknown' as const, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: 'llm' as const } },
    };
    const result = validatePlan(plan);
    expect(result.unknownConfidenceFields).toContain('rackCount');
  });
});
