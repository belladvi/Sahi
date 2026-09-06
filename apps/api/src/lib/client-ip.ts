/**
 * Trusted-proxy-aware client IP resolution for rate limiting (Ticket 27A / R0).
 *
 * On Railway (and most PaaS) the app runs behind the platform's edge proxy, which
 * appends the real client IP to `X-Forwarded-For`; internal hops are private-addressed.
 * We therefore walk the forwarded chain from the RIGHT, skip trusted (private/reserved)
 * proxy hops, and return the first *untrusted* (public) address — the real client.
 *
 * This never trusts a caller-supplied leftmost value: a client that injects a fake
 * public IP puts it to the LEFT of the address the edge appended, so the right-to-left
 * walk returns the genuine client, not the spoof. It fails CLOSED (returns null) when
 * the chain is empty, entirely trusted, or contains a malformed hop — so a bad value
 * degrades to "no per-client key" rather than an attacker-chosen one.
 *
 * The resolved value is written to a canonical header that Better Auth reads
 * (`advanced.ipAddress.ipAddressHeaders`), so Better Auth never parses raw caller
 * headers itself. Trusted ranges and the source header are overridable via env
 * (`TRUSTED_PROXY_CIDRS`, `CLIENT_IP_HEADER`) so the boundary can be tuned to the
 * platform's *verified* behaviour without a code change.
 */

/** Header we set ourselves and hand to Better Auth. Inbound copies are stripped. */
export const CANONICAL_IP_HEADER = 'x-sahi-client-ip';

/** Default proxy hops we treat as trusted: private + reserved ranges. */
const DEFAULT_TRUSTED_CIDRS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '100.64.0.0/10', // carrier-grade NAT — common inside PaaS internal networks
  '::1/128',
  'fc00::/7', // IPv6 unique-local
  'fe80::/10', // IPv6 link-local
];

type ParsedIp = { version: 4 | 6; value: bigint };
type Cidr = { version: 4 | 6; base: bigint; prefix: number };

function maskFor(version: 4 | 6, prefix: number): bigint {
  const bits = version === 4 ? 32 : 128;
  if (prefix <= 0) return 0n;
  const full = (1n << BigInt(bits)) - 1n;
  return (full << BigInt(bits - prefix)) & full;
}

function expandIpv6(input: string): string[] | null {
  const addr = input.split('%')[0] ?? ''; // drop zone id
  if (addr.includes('.')) return null; // embedded IPv4 handled separately (mapped form)
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : null;
  let groups: string[];
  if (tail === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
  }
  return groups.map((g) => g.padStart(4, '0'));
}

/** Parse an IPv4/IPv6 address (incl. IPv4-mapped IPv6) into a comparable integer. */
function parseIp(raw: string): ParsedIp | null {
  const ip = raw.trim();
  if (ip === '') return null;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) collapses to the IPv4 address.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  const candidate = mapped?.[1] ?? ip;

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(candidate)) {
    const parts = candidate.split('.').map(Number);
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
    let value = 0n;
    for (const p of parts) value = (value << 8n) | BigInt(p);
    return { version: 4, value };
  }

  if (ip.includes(':')) {
    const groups = expandIpv6(ip);
    if (!groups) return null;
    let value = 0n;
    for (const g of groups) value = (value << 16n) | BigInt(parseInt(g, 16));
    return { version: 6, value };
  }

  return null;
}

function parseCidr(entry: string): Cidr | null {
  const parts = entry.trim().split('/');
  const ip = parseIp(parts[0] ?? '');
  if (!ip) return null;
  const prefixStr = parts[1];
  const bits = ip.version === 4 ? 32 : 128;
  const prefix = prefixStr === undefined ? bits : Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return null;
  return { version: ip.version, base: ip.value & maskFor(ip.version, prefix), prefix };
}

function inCidr(ip: ParsedIp, cidr: Cidr): boolean {
  if (ip.version !== cidr.version) return false;
  return (ip.value & maskFor(ip.version, cidr.prefix)) === cidr.base;
}

/** Trusted-proxy CIDRs, from `TRUSTED_PROXY_CIDRS` or the private/reserved defaults. */
export function trustedProxyCidrs(): Cidr[] {
  const raw = process.env.TRUSTED_PROXY_CIDRS;
  const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_TRUSTED_CIDRS;
  return list.map(parseCidr).filter((c): c is Cidr => c !== null);
}

/** Canonical string form (IPv4-mapped IPv6 collapses to IPv4; IPv6 lower-cased). */
function canonical(raw: string): string {
  const ip = raw.trim();
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];
  return ip.includes(':') ? ip.toLowerCase() : ip;
}

/**
 * Resolve the real client IP from a forwarded-for header value. Returns null
 * (fail closed) when nothing trustworthy can be determined.
 */
export function resolveClientIp(
  forwardedFor: string | string[] | undefined,
  cidrs: Cidr[] = trustedProxyCidrs(),
): string | null {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  if (!header) return null;
  const hops = header.split(',').map((s) => s.trim()).filter(Boolean);
  if (hops.length === 0) return null;

  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = hops[i];
    if (hop === undefined) continue;
    const parsed = parseIp(hop);
    if (!parsed) return null; // malformed hop -> fail closed
    if (cidrs.some((c) => inCidr(parsed, c))) continue; // trusted proxy hop -> skip
    return canonical(hop); // first untrusted hop = real client
  }
  return null; // entire chain trusted -> fail closed
}
