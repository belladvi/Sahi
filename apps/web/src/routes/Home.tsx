import { useEffect, useState } from 'react';
import { APP_NAME, type HealthResponse } from '@sahi/shared';

export function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    fetch(`${base}/api/health`)
      .then((res) => (res.ok ? (res.json() as Promise<HealthResponse>) : null))
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>{APP_NAME}</h1>
      <p>FSSAI registration for Bangalore home bakers — walking skeleton.</p>
      <p data-testid="api-status">API status: {health ? health.status : 'checking…'}</p>
    </main>
  );
}
