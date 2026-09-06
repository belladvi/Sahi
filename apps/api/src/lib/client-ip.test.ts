import { describe, it, expect } from 'vitest';
import { resolveClientIp, CANONICAL_IP_HEADER } from './client-ip.js';

// Default trusted ranges are private/reserved; a Railway-style chain is
// `<client...>, <edge/internal private hops>` so the real client is the first
// *public* address from the right.

describe('resolveClientIp — trusted-proxy boundary', () => {
  it('returns the client public IP behind one private proxy hop', () => {
    expect(resolveClientIp('203.0.113.7, 10.0.0.5')).toBe('203.0.113.7');
  });

  it('two legitimate clients resolve to distinct IPs (no shared bucket)', () => {
    const a = resolveClientIp('203.0.113.7, 10.0.0.5');
    const b = resolveClientIp('198.51.100.22, 10.0.0.5');
    expect(a).toBe('203.0.113.7');
    expect(b).toBe('198.51.100.22');
    expect(a).not.toBe(b);
  });

  it('a spoofed leftmost public IP cannot bypass throttling — the edge-appended client wins', () => {
    // Attacker injects 1.2.3.4; the platform edge appends the real client 203.0.113.7,
    // then an internal private hop. Right-to-left skips the private hop and returns the
    // real client, never the spoofed leftmost value.
    expect(resolveClientIp('1.2.3.4, 203.0.113.7, 10.0.0.5')).toBe('203.0.113.7');
  });

  it('a client that rotates the spoofed value still shares one real-client bucket', () => {
    const first = resolveClientIp('9.9.9.9, 203.0.113.7, 10.0.0.5');
    const second = resolveClientIp('8.8.8.8, 203.0.113.7, 10.0.0.5');
    expect(first).toBe('203.0.113.7');
    expect(second).toBe('203.0.113.7'); // same real client -> same bucket despite rotating spoof
  });

  it('fails closed when the chain is entirely trusted/private', () => {
    expect(resolveClientIp('10.0.0.5, 192.168.1.1')).toBeNull();
  });

  it('fails closed on a malformed hop', () => {
    expect(resolveClientIp('not-an-ip, 10.0.0.5')).toBeNull();
    expect(resolveClientIp('203.0.113.7, garbage')).toBeNull();
  });

  it('returns null for empty / missing headers', () => {
    expect(resolveClientIp(undefined)).toBeNull();
    expect(resolveClientIp('')).toBeNull();
    expect(resolveClientIp('   ')).toBeNull();
  });

  it('handles a single direct public value', () => {
    expect(resolveClientIp('203.0.113.7')).toBe('203.0.113.7');
  });

  it('collapses an IPv4-mapped IPv6 client to plain IPv4', () => {
    expect(resolveClientIp('::ffff:203.0.113.7, 10.0.0.5')).toBe('203.0.113.7');
  });

  it('resolves a public IPv6 client behind an IPv6 link-local hop', () => {
    expect(resolveClientIp('2001:db8::1, fe80::1')).toBe('2001:db8::1');
  });

  it('accepts an array-valued header (joined)', () => {
    expect(resolveClientIp(['203.0.113.7', '10.0.0.5'])).toBe('203.0.113.7');
  });

  it('exposes a stable canonical header name', () => {
    expect(CANONICAL_IP_HEADER).toBe('x-sahi-client-ip');
  });
});
