import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/db/client', () => ({
  prisma: {
    planVersion: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { mutatePlan } from '@/lib/planning/plan-mutator';
import { createEmptyPlan, createProvenanceField } from '@/lib/planning/plan-builder';
import type { CanonicalPlanState, ComputeItem } from '@/types/planning';

function makePlan(overrides: Partial<CanonicalPlanState> = {}): CanonicalPlanState {
  return {
    ...createEmptyPlan(),
    rackCount: createProvenanceField(10, 'user_input'),
    rackPowerDensity: createProvenanceField(20, 'user_input'),
    totalPower: createProvenanceField(200, 'user_input'),
    computeInventory: createProvenanceField<ComputeItem[]>([
      { id: '1', type: 'gpu', vendor: 'NVIDIA', model: 'H100', quantity: 8, perRack: 8 },
      { id: '2', type: 'gpu', vendor: 'Google', model: 'TPU-v4', quantity: 4, perRack: 4 },
    ], 'user_input'),
    site: createProvenanceField({ city: 'Los Angeles', state: 'CA', country: 'US' }, 'user_input'),
    ...overrides,
  };
}

describe('plan-mutator', () => {
  it('updates rackCount and recalculates totalPower', async () => {
    const plan = makePlan();
    const result = await mutatePlan(
      plan,
      { type: 'numeric_change', targetField: 'rackCount', newValue: 6, description: 'Reduce from 10 to 6 racks' },
      'db-plan-id'
    );
    expect(result.plan.rackCount.value).toBe(6);
    expect(result.plan.totalPower.value).toBe(6 * 20); // 6 racks * 20kW
    expect(result.plan.rackCount.provenance.sourceType).toBe('user_input');
    expect(result.mutatedFields).toContain('rackCount');
  });

  it('swaps a compute component', async () => {
    const plan = makePlan();
    const result = await mutatePlan(
      plan,
      { type: 'component_swap', targetField: 'computeInventory', oldValue: 'H100', newValue: { model: 'MI400X', vendor: 'AMD', type: 'gpu' } as ComputeItem, description: 'Swap H100 to MI400X' },
      'db-plan-id'
    );
    const inventory = result.plan.computeInventory.value;
    expect(inventory.some((i) => i.model === 'MI400X')).toBe(true);
    expect(inventory.some((i) => i.model === 'H100')).toBe(false);
    expect(result.plan.computeInventory.provenance.sourceType).toBe('user_input');
  });

  it('removes a compute component', async () => {
    const plan = makePlan();
    const result = await mutatePlan(
      plan,
      { type: 'component_removal', oldValue: 'TPU', description: 'Remove TPU' },
      'db-plan-id'
    );
    const inventory = result.plan.computeInventory.value;
    expect(inventory.some((i) => i.model?.includes('TPU'))).toBe(false);
    expect(inventory.some((i) => i.model === 'H100')).toBe(true);
  });

  it('updates location', async () => {
    const plan = makePlan();
    const result = await mutatePlan(
      plan,
      { type: 'location_change', newValue: { city: 'Dallas', state: 'TX' }, description: 'Move to Dallas' },
      'db-plan-id'
    );
    expect(result.plan.site.value.city).toBe('Dallas');
    expect(result.plan.site.provenance.sourceType).toBe('user_input');
  });

  it('does not touch fields not mentioned in mutation', async () => {
    const plan = makePlan();
    const result = await mutatePlan(
      plan,
      { type: 'numeric_change', targetField: 'rackCount', newValue: 6, description: 'Reduce racks' },
      'db-plan-id'
    );
    // storageInventory unchanged
    expect(result.plan.storageInventory.provenance.sourceType).toBe(plan.storageInventory.provenance.sourceType);
  });

  it('preserves locked fields in constraint_preservation', async () => {
    const plan = {
      ...makePlan(),
      assumptions: [{ id: 'a1', field: 'redundancyAssumptions', value: 'N+1', reasoning: 'required', confidence: 'confirmed' as const, sourceType: 'user_input' as const, isLocked: false, createdAt: new Date().toISOString() }],
    };
    const result = await mutatePlan(
      plan,
      { type: 'constraint_preservation', lockedFields: ['redundancyAssumptions'], description: 'Lock redundancy' },
      'db-plan-id'
    );
    const lockedAssumption = result.plan.assumptions.find((a) => a.field === 'redundancyAssumptions');
    expect(lockedAssumption?.isLocked).toBe(true);
  });

  it('increments version on mutation', async () => {
    const plan = makePlan();
    const result = await mutatePlan(
      plan,
      { type: 'numeric_change', targetField: 'rackCount', newValue: 5, description: 'Change racks' },
      'db-plan-id'
    );
    expect(result.plan.version).toBe(plan.version + 1);
  });
});
