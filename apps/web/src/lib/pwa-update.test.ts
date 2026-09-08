import { describe, it, expect, vi, beforeEach } from 'vitest';

type RegisterOpts = { onNeedRefresh?: () => void; immediate?: boolean };
const updateSW = vi.fn(async () => {});
let opts: RegisterOpts = {};
const registerSW = vi.fn((o: RegisterOpts) => {
  opts = o;
  return updateSW;
});
vi.mock('virtual:pwa-register', () => ({ registerSW: (o: RegisterOpts) => registerSW(o) }));

const { installPwaUpdates } = await import('./pwa-update');

type Listener = (state: { location: { pathname: string } }) => void;
function fakeRouter(pathname = '/') {
  const listeners: Listener[] = [];
  return {
    state: { location: { pathname } },
    subscribe: (fn: Listener) => {
      listeners.push(fn);
      return () => {};
    },
    go: (p: string) => listeners.forEach((fn) => fn({ location: { pathname: p } })),
  };
}

describe('installPwaUpdates', () => {
  beforeEach(() => {
    registerSW.mockClear();
    updateSW.mockClear();
    opts = {};
  });

  it('registers the worker through the plugin client (which owns the reload on update)', () => {
    installPwaUpdates(fakeRouter());
    expect(registerSW).toHaveBeenCalledTimes(1);
    expect(opts.onNeedRefresh).toBeTypeOf('function');
  });

  it('applies a waiting update at the NEXT route change, never mid-screen', () => {
    const r = fakeRouter('/describe');
    installPwaUpdates(r);
    opts.onNeedRefresh?.(); // new build's worker is installed and waiting
    expect(updateSW).not.toHaveBeenCalled(); // baker may be typing — don't reload now
    r.go('/describe'); // same path (e.g. search/hash) → still not
    expect(updateSW).not.toHaveBeenCalled();
    r.go('/checklist');
    expect(updateSW).toHaveBeenCalledTimes(1);
    expect(updateSW).toHaveBeenCalledWith(true);
    r.go('/create-account'); // applied once only
    expect(updateSW).toHaveBeenCalledTimes(1);
  });

  it('does nothing on route changes when no update is waiting', () => {
    const r = fakeRouter('/');
    installPwaUpdates(r);
    r.go('/eligibility');
    expect(updateSW).not.toHaveBeenCalled();
  });
});
