import { describe, it, expect } from 'vitest';
import { createNoteSchema, maskAadhaar, isMaskedAadhaar, documentsSchema, computeTrustScore } from '@sahi/shared';

// The web app validates with the SAME schema module the API uses on the server.
describe('createNoteSchema (shared, used client-side)', () => {
  it('rejects blank text', () => {
    expect(createNoteSchema.safeParse({ text: '   ' }).success).toBe(false);
  });

  it('accepts valid text', () => {
    expect(createNoteSchema.safeParse({ text: 'hello' }).success).toBe(true);
  });
});

describe('Aadhaar masking (shared)', () => {
  it('masks all but the last 4 digits', () => {
    expect(maskAadhaar('1234 5678 9012')).toBe('XXXX XXXX 9012');
    expect(maskAadhaar('123456789012')).toBe('XXXX XXXX 9012');
    expect(isMaskedAadhaar('XXXX XXXX 9012')).toBe(true);
  });

  it('documentsSchema rejects a full Aadhaar number (never persisted raw)', () => {
    expect(documentsSchema.safeParse({ aadhaarMasked: '1234 5678 9012' }).success).toBe(false);
    expect(documentsSchema.safeParse({ aadhaarMasked: 'XXXX XXXX 9012' }).success).toBe(true);
  });
});

describe('Trust Score (shared scoring rules)', () => {
  it('all facts true → 100', () => {
    const { score } = computeTrustScore({ licenceActive: true, feeCurrent: true, documentsVerified: true, emailOnFile: true });
    expect(score).toBe(100);
  });

  it('weights sum to 100 and each missing factor subtracts its weight', () => {
    const { score, factors } = computeTrustScore({ licenceActive: true, feeCurrent: true, documentsVerified: true, emailOnFile: false });
    expect(score).toBe(85); // 100 − 15 (email)
    const email = factors.find((f) => f.key === 'emailOnFile');
    expect(email?.done).toBe(false);
    expect(email?.points).toBe(15);
  });

  it('no facts → 0, and the breakdown lists every factor as an improve step', () => {
    const { score, factors } = computeTrustScore({ licenceActive: false, feeCurrent: false, documentsVerified: false, emailOnFile: false });
    expect(score).toBe(0);
    expect(factors).toHaveLength(4);
    expect(factors.every((f) => !f.done)).toBe(true);
  });

  it('licence active alone is the biggest single factor (40)', () => {
    const { score } = computeTrustScore({ licenceActive: true, feeCurrent: false, documentsVerified: false, emailOnFile: false });
    expect(score).toBe(40);
  });
});
