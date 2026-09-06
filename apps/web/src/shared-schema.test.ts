import { describe, it, expect } from 'vitest';
import { createNoteSchema, maskAadhaar, isMaskedAadhaar, documentsSchema, computeTrustScore, renewalCohort, renewalStatus, nextRouteForStatus } from '@sahi/shared';

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

// The single source of truth for "given an application's real state, where does
// the connected journey resume?" — used post-OTP so we never route blindly to /pay.
describe('nextRouteForStatus (shared resume routing)', () => {
  it('a draft goes to Payment', () => {
    expect(nextRouteForStatus('draft')).toBe('/pay');
  });

  it('a paid application resumes at Upload (never back to Payment)', () => {
    expect(nextRouteForStatus('paid')).toBe('/upload');
  });

  it('preparing/filed/gov_query resume at Filing Status', () => {
    expect(nextRouteForStatus('preparing')).toBe('/status');
    expect(nextRouteForStatus('filed')).toBe('/status');
    expect(nextRouteForStatus('gov_query')).toBe('/status');
  });

  it('an approved licence resumes at the Dashboard', () => {
    expect(nextRouteForStatus('approved')).toBe('/dashboard');
  });
});

describe('Renewal cohort + due-date (shared)', () => {
  it('detects cohort from the issue date (1 Apr 2026 cutoff)', () => {
    expect(renewalCohort(new Date('2026-09-05'))).toBe('perpetual');
    expect(renewalCohort(new Date('2026-03-31'))).toBe('legacy');
  });

  it('due date is one year after issue when never renewed', () => {
    const s = renewalStatus(new Date('2026-09-05T00:00:00Z'), null, new Date('2026-09-05T00:00:00Z'));
    expect(s.dueDate.slice(0, 10)).toBe('2027-09-05');
    expect(s.state).toBe('active');
  });

  it('flags due-soon within 30 days and overdue past the date', () => {
    const issued = new Date('2026-09-05T00:00:00Z');
    const dueSoon = renewalStatus(issued, null, new Date('2027-08-20T00:00:00Z'));
    expect(dueSoon.state).toBe('due-soon');
    const overdue = renewalStatus(issued, null, new Date('2027-10-01T00:00:00Z'));
    expect(overdue.state).toBe('overdue');
  });

  it('a renewal pushes the due date out a year from the renewal', () => {
    const s = renewalStatus(new Date('2026-09-05T00:00:00Z'), new Date('2027-09-01T00:00:00Z'), new Date('2027-09-01T00:00:00Z'));
    expect(s.dueDate.slice(0, 10)).toBe('2028-09-01');
    expect(s.state).toBe('active');
  });
});
