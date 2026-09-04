import { describe, it, expect } from 'vitest';
import { createNoteSchema } from '@sahi/shared';

// The web app validates with the SAME schema module the API uses on the server.
describe('createNoteSchema (shared, used client-side)', () => {
  it('rejects blank text', () => {
    expect(createNoteSchema.safeParse({ text: '   ' }).success).toBe(false);
  });

  it('accepts valid text', () => {
    expect(createNoteSchema.safeParse({ text: 'hello' }).success).toBe(true);
  });
});
