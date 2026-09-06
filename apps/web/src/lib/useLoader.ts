import { useCallback, useEffect, useState } from 'react';

/**
 * Runs an initial data load with guaranteed cleanup and a recoverable error state
 * (R1). The loader receives an AbortSignal (pass it to `apiGet`) and returns the
 * screen's data; a throw (network / timeout / 5xx) becomes `status: 'error'` with
 * a `reload()` to retry. Unmount aborts the request and suppresses any late state
 * update, so a screen can never hang on a permanent spinner or log a post-unmount
 * warning. Redirect-on-empty stays the caller's job: navigate inside the loader
 * and return whatever the screen should render (often `null`).
 */
export type LoaderStatus = 'loading' | 'ready' | 'error';

export interface Loader<T> {
  status: LoaderStatus;
  data: T | null;
  reload: () => void;
}

export function useLoader<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[]): Loader<T> {
  const [status, setStatus] = useState<LoaderStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setStatus('loading');
    loader(controller.signal)
      .then((result) => {
        if (!alive) return;
        setData(result);
        setStatus('ready');
      })
      .catch(() => {
        if (!alive || controller.signal.aborted) return; // unmount → stay quiet
        setStatus('error');
      });
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  return { status, data, reload };
}
