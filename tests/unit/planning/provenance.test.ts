import { describe, it, expect } from 'vitest';
import { createProvenanceField } from '@/lib/planning/plan-builder';

describe('ProvenanceField', () => {
  it('creates a user_input field with confirmed confidence', () => {
    const field = createProvenanceField(10, 'user_input');
    expect(field.value).toBe(10);
    expect(field.provenance.sourceType).toBe('user_input');
    expect(field.provenance.confidence).toBe('confirmed');
    expect(field.provenance.lastUpdatedBy).toBe('user');
  });

  it('creates an llm_estimate field with low confidence', () => {
    const field = createProvenanceField(20, 'llm_estimate');
    expect(field.provenance.confidence).toBe('low');
    expect(field.provenance.lastUpdatedBy).toBe('llm');
  });

  it('creates an llm_inference field with medium confidence', () => {
    const field = createProvenanceField('value', 'llm_inference');
    expect(field.provenance.confidence).toBe('medium');
  });

  it('creates an uploaded_file field with high confidence', () => {
    const field = createProvenanceField(42, 'uploaded_file');
    expect(field.provenance.confidence).toBe('high');
  });

  it('creates a system_default field with system updatedBy', () => {
    const field = createProvenanceField([], 'system_default');
    expect(field.provenance.lastUpdatedBy).toBe('system');
  });

  it('never promotes llm_estimate to confirmed', () => {
    const field = createProvenanceField(100, 'llm_estimate');
    expect(field.provenance.confidence).not.toBe('confirmed');
  });

  it('includes lastUpdatedAt timestamp', () => {
    const field = createProvenanceField(1, 'user_input');
    expect(field.provenance.lastUpdatedAt).toBeTruthy();
    expect(new Date(field.provenance.lastUpdatedAt).getTime()).toBeGreaterThan(0);
  });

  it('accepts optional notes', () => {
    const field = createProvenanceField(5, 'llm_estimate', 'test note');
    expect(field.provenance.notes).toBe('test note');
  });
});
