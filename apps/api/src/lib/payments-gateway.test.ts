import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGateway, resetGateway } from './payments.js';

// R1.5 — payment mode is explicit and fail-closed, mirroring R0's auth mode.
// The case-study environment runs `demo`; `provider` requires complete real
// configuration and NEVER silently falls back to the demo gateway.
describe('getGateway — explicit fail-closed payment mode', () => {
  const original = {
    mode: process.env.PAYMENT_MODE,
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  };

  beforeEach(() => {
    resetGateway();
    delete process.env.PAYMENT_MODE;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  afterEach(() => {
    resetGateway();
    restore('PAYMENT_MODE', original.mode);
    restore('RAZORPAY_KEY_ID', original.keyId);
    restore('RAZORPAY_KEY_SECRET', original.keySecret);
    restore('RAZORPAY_WEBHOOK_SECRET', original.webhookSecret);
  });

  function restore(key: string, value: string | undefined) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it('demo mode → the deterministic mock gateway', () => {
    process.env.PAYMENT_MODE = 'demo';
    const gw = getGateway();
    expect(gw.mock).toBe(true);
  });

  it('unset mode → fails closed (throws, never silently mocks)', () => {
    expect(() => getGateway()).toThrow();
  });

  it('invalid mode → fails closed (throws)', () => {
    process.env.PAYMENT_MODE = 'yolo';
    expect(() => getGateway()).toThrow();
  });

  it('provider mode without complete config → throws, never falls back to demo', () => {
    process.env.PAYMENT_MODE = 'provider';
    expect(() => getGateway()).toThrow();
  });

  it('provider mode with full config → the real gateway (not mock)', () => {
    process.env.PAYMENT_MODE = 'provider';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_x';
    process.env.RAZORPAY_KEY_SECRET = 'secret_x';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_x';
    const gw = getGateway();
    expect(gw.mock).toBe(false);
  });
});
