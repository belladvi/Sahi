import { useNavigate } from 'react-router';
import type { Premises } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { LoadError } from '../components/LoadError';
import WhatYouNeedStepRented from '../features/registration/WhatYouNeedStepRented';
import { documentsFor, reasonFor } from '../features/registration/whatYouNeedData';
import { getDraft } from '../lib/draft';
import { useLoader } from '../lib/useLoader';

/**
 * "/checklist" — the premium "What you'll need" screen (last free screen before
 * the account wall).
 *
 * Thin wrapper around the self-contained <WhatYouNeedStepRented /> (own header +
 * CTA), same pattern as /describe. The wrapper owns only the draft load; the
 * document list and intro phrase are data-driven off the baker's premises
 * answer from qualify step 2 via `whatYouNeedData` (owners: photo, Aadhaar,
 * PAN; renters: + address proof with its helper note). The screen owns layout,
 * copy and motion.
 *
 * The stored `Premises` is the shared two-value enum (`own` | `rent`): the
 * qualify step maps "Somewhere else" onto `rent` at finish(), so the data
 * file's `other` branch is never reached from a saved draft.
 */
export function Checklist() {
  const navigate = useNavigate();
  const { status, data, reload } = useLoader<{ premises: Premises } | null>(async (signal) => {
    const d = await getDraft(signal);
    if (signal.aborted) return null;
    if (!d) {
      navigate('/eligibility');
      return null;
    }
    return { premises: d.premises ?? 'own' };
  }, [navigate]);

  if (status === 'error') {
    return (
      <AppShell>
        <AppHeader title="What you’ll need" onBack={() => navigate('/describe')} />
        <LoadError onRetry={reload} onHome={() => navigate('/')} />
      </AppShell>
    );
  }

  // Hold until the draft is loaded so the step mounts once with the right docs
  // (its entrance animation runs at mount).
  if (!data) return <AppShell>{null}</AppShell>;

  return (
    <AppShell>
      <WhatYouNeedStepRented
        reason={reasonFor(data.premises)}
        documents={documentsFor(data.premises)}
        licenceName="FSSAI Basic Registration"
        onBack={() => navigate('/describe')}
        onCreateAccount={() => navigate('/create-account')}
      />
    </AppShell>
  );
}
