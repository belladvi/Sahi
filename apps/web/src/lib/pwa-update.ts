import { registerSW } from 'virtual:pwa-register';

/** The slice of a React Router data router this module needs. */
export interface RouterLike {
  state: { location: { pathname: string } };
  subscribe: (fn: (state: { location: { pathname: string } }) => void) => () => void;
}

/**
 * Registers the PWA service worker and applies new builds automatically — at a
 * safe moment.
 *
 * Why: the app precaches its bundle. After a deploy, a returning visitor's first
 * load is served from the OLD precache, and with the bare injected register
 * script nothing ever swapped it in, so every screen looked stale for the whole
 * session until a manual refresh.
 *
 * Why not reload the instant the new worker activates (`autoUpdate`): on a slow
 * link that moment can arrive many seconds in, while the baker is typing on
 * /describe or mid-payment — a hard reload there loses her work. So the plugin
 * runs in `prompt` mode: when a new build is waiting (`onNeedRefresh`) we hold
 * it, and apply it (skip-waiting + one reload) at the NEXT route change, when
 * nothing is in flight and every screen re-reads its state from the server.
 * If she never navigates, the waiting worker takes over on her next visit.
 */
export function installPwaUpdates(router: RouterLike): void {
  let applyUpdate: (() => void) | null = null;
  const updateSW = registerSW({
    onNeedRefresh() {
      applyUpdate = () => {
        void updateSW(true);
      };
    },
  });

  let lastPath = router.state.location.pathname;
  router.subscribe((state) => {
    const path = state.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    if (applyUpdate) {
      const apply = applyUpdate;
      applyUpdate = null;
      apply();
    }
  });
}
