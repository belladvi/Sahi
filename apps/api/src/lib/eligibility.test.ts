import { describe, it, expect } from 'vitest';
import { evaluateEligibility, documentChecklist, TOTAL_FEE_RUPEES } from '@sahi/shared';

describe('eligibility', () => {
  it('basic turnover qualifies for FSSAI Basic at ₹599', () => {
    const r = evaluateEligibility('basic');
    expect(r.eligible).toBe(true);
    expect(r.licence).toBe('basic');
    expect(r.total).toBe(TOTAL_FEE_RUPEES);
    expect(r.total).toBe(599);
  });

  it('above the ceiling shows the soft State/Central branch (no hard fail)', () => {
    const r = evaluateEligibility('above');
    expect(r.eligible).toBe(false);
    expect(r.licence).toBe('state-or-central');
    expect(r.message).toMatch(/State or Central/i);
  });
});

describe('document checklist', () => {
  it('own premises = 2 items', () => {
    expect(documentChecklist('own')).toHaveLength(2);
  });
  it('rented premises = 3 items (adds address proof)', () => {
    const items = documentChecklist('rent');
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.key)).toContain('address_proof');
  });
});
