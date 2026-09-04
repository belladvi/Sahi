import { describe, it, expect } from 'vitest';
import { createNoteSchema, maskAadhaar, isMaskedAadhaar, documentsSchema } from '@sahi/shared';

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
