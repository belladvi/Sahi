import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { demoRouter } from './demo.js';
import { deliverOtp, resetDemoOtpStore } from '../lib/auth-delivery.js';

const DEMO_EMAIL = 'qa.sahi.demo@example.com';
const DEMO_PHONE = '+919898989898';
const OTHER_PHONE = '+911112223334';

const ORIGINAL = { ...process.env };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', demoRouter);
  return app;
}

beforeEach(() => {
  resetDemoOtpStore();
  process.env.AUTH_DELIVERY_MODE = 'demo';
  process.env.DEMO_OTP_CONTACTS = `${DEMO_PHONE},${DEMO_EMAIL}`;
});

afterEach(() => {
  process.env.AUTH_DELIVERY_MODE = ORIGINAL.AUTH_DELIVERY_MODE;
  process.env.DEMO_OTP_CONTACTS = ORIGINAL.DEMO_OTP_CONTACTS;
});

describe('GET /api/demo/otp', () => {
  it('404s entirely in provider mode (generic reveal closed)', async () => {
    process.env.AUTH_DELIVERY_MODE = 'provider';
    const res = await request(makeApp()).get(`/api/demo/otp?contact=${encodeURIComponent(DEMO_PHONE)}`);
    expect(res.status).toBe(404);
  });

  it('400s when no contact is supplied', async () => {
    const res = await request(makeApp()).get('/api/demo/otp');
    expect(res.status).toBe(400);
  });

  it('returns the code for an allowlisted phone that has one', async () => {
    deliverOtp('phone', DEMO_PHONE, '123456');
    const res = await request(makeApp()).get(`/api/demo/otp?contact=${encodeURIComponent(DEMO_PHONE)}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('123456');
  });

  it('returns the code for an allowlisted email that has one', async () => {
    deliverOtp('email', DEMO_EMAIL, '654321');
    const res = await request(makeApp()).get(`/api/demo/otp?contact=${encodeURIComponent(DEMO_EMAIL)}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('654321');
  });

  it('returns a uniform null for a non-allowlisted contact (no reveal, no enumeration)', async () => {
    deliverOtp('phone', OTHER_PHONE, '999999'); // stored nothing
    const res = await request(makeApp()).get(`/api/demo/otp?contact=${encodeURIComponent(OTHER_PHONE)}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBeNull();
  });

  it('returns null for an allowlisted contact before any code is issued', async () => {
    const res = await request(makeApp()).get(`/api/demo/otp?contact=${encodeURIComponent(DEMO_EMAIL)}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBeNull();
  });
});
