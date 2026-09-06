import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAuthDeliveryMode,
  deliverOtp,
  peekDemoOtp,
  isDemoContactAllowed,
  resetDemoOtpStore,
} from './auth-delivery.js';

// Synthetic, non-personal demo identities (the case-study allowlist). Nothing
// routes to a real inbox/SIM: example.com is RFC-reserved and the number is a
// shared synthetic demo value.
const DEMO_EMAIL = 'qa.sahi.demo@example.com';
const DEMO_PHONE = '+919898989898';
const OTHER_EMAIL = 'stranger@example.com';
const OTHER_PHONE = '+911112223334';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  resetDemoOtpStore();
  process.env.AUTH_DELIVERY_MODE = 'demo';
  process.env.DEMO_OTP_CONTACTS = `${DEMO_PHONE},${DEMO_EMAIL}`;
});

afterEach(() => {
  process.env.AUTH_DELIVERY_MODE = ORIGINAL.AUTH_DELIVERY_MODE;
  process.env.DEMO_OTP_CONTACTS = ORIGINAL.DEMO_OTP_CONTACTS;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('auth delivery mode', () => {
  it('defaults to provider (fail closed) when unset', () => {
    delete process.env.AUTH_DELIVERY_MODE;
    expect(getAuthDeliveryMode()).toBe('provider');
  });

  it('treats an invalid value as provider (fail closed)', () => {
    process.env.AUTH_DELIVERY_MODE = 'DEMO'; // wrong case -> not accepted
    expect(getAuthDeliveryMode()).toBe('provider');
    process.env.AUTH_DELIVERY_MODE = 'sms';
    expect(getAuthDeliveryMode()).toBe('provider');
  });

  it('is demo only when explicitly set', () => {
    process.env.AUTH_DELIVERY_MODE = 'demo';
    expect(getAuthDeliveryMode()).toBe('demo');
  });
});

describe('provider mode fails closed', () => {
  it('throws instead of pretending to send (no vendor wired in R0)', () => {
    process.env.AUTH_DELIVERY_MODE = 'provider';
    expect(() => deliverOtp('email', DEMO_EMAIL, '123456')).toThrow(/not configured/i);
    expect(() => deliverOtp('phone', DEMO_PHONE, '123456')).toThrow(/not configured/i);
  });

  it('reveals nothing in provider mode even for an allowlisted contact', () => {
    process.env.AUTH_DELIVERY_MODE = 'provider';
    expect(peekDemoOtp(DEMO_EMAIL)).toBeNull();
    expect(peekDemoOtp(DEMO_PHONE)).toBeNull();
  });
});

describe('demo mode reveal is allowlist-gated', () => {
  it('allowlisted phone + email can retrieve their code', () => {
    deliverOtp('phone', DEMO_PHONE, '111111');
    deliverOtp('email', DEMO_EMAIL, '222222');
    expect(peekDemoOtp(DEMO_PHONE)).toBe('111111');
    expect(peekDemoOtp(DEMO_EMAIL)).toBe('222222');
  });

  it('matches an allowlisted email case-insensitively', () => {
    deliverOtp('email', DEMO_EMAIL.toUpperCase(), '333333');
    expect(peekDemoOtp(DEMO_EMAIL)).toBe('333333');
    expect(peekDemoOtp(DEMO_EMAIL.toUpperCase())).toBe('333333');
  });

  it('a non-allowlisted contact is never stored and never revealed', () => {
    expect(isDemoContactAllowed(OTHER_EMAIL)).toBe(false);
    expect(isDemoContactAllowed(OTHER_PHONE)).toBe(false);
    deliverOtp('email', OTHER_EMAIL, '444444'); // does not throw, but stores nothing
    deliverOtp('phone', OTHER_PHONE, '555555');
    expect(peekDemoOtp(OTHER_EMAIL)).toBeNull();
    expect(peekDemoOtp(OTHER_PHONE)).toBeNull();
  });
});

describe('expiry and restart', () => {
  it('a demo code expires after its TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    deliverOtp('phone', DEMO_PHONE, '666666');
    expect(peekDemoOtp(DEMO_PHONE)).toBe('666666');
    vi.setSystemTime(new Date('2026-01-01T00:05:01Z')); // > 300s later
    expect(peekDemoOtp(DEMO_PHONE)).toBeNull();
  });

  it('a restart (cleared store) drops all demo codes', () => {
    deliverOtp('email', DEMO_EMAIL, '777777');
    expect(peekDemoOtp(DEMO_EMAIL)).toBe('777777');
    resetDemoOtpStore(); // simulates a fresh process
    expect(peekDemoOtp(DEMO_EMAIL)).toBeNull();
  });
});

describe('no-PII logging', () => {
  it('never logs the OTP, phone or email', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    deliverOtp('phone', DEMO_PHONE, '888888');
    deliverOtp('email', DEMO_EMAIL, '999999');
    const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).not.toContain('888888');
    expect(logged).not.toContain('999999');
    expect(logged).not.toContain(DEMO_PHONE);
    expect(logged).not.toContain(DEMO_EMAIL);
    expect(logged).toMatch(/correlationId=/);
  });
});
