import { useNavigate } from 'react-router';
import { documentChecklist, type DocItem, type Premises } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { LoadError } from '../components/LoadError';
import WhatYouNeedStep, { type NeededDoc } from '../features/registration/WhatYouNeedStep';
import { getDraft } from '../lib/draft';
import { useLoader } from '../lib/useLoader';

/**
 * "/checklist" — the premium "What you'll need" screen (last free screen before
 * the account wall).
 *
 * Thin wrapper around the self-contained <WhatYouNeedStep /> (own header + CTA),
 * same pattern as /describe. The wrapper owns only the draft load and the
 * document list: the shared `documentChecklist` (own=2 / rent=3, the same
 * own/rent rule the Upload screen applies to its tiles) plus PAN, so the baker
 * sees photo, Aadhaar, PAN (+ address proof if renting). The screen owns
 * layout, copy and motion.
 */

/** Presentation for each shared checklist item: label — one-line description,
 * plus an optional reassurance note (rendered as the animated gold-bar note). */
const DOC_PRESENTATION: Record<string, NeededDoc> = {
  photo: { label: 'Passport-size photo' },
  aadhaar: { label: 'Aadhaar', desc: 'Identity proof' },
  address_proof: { label: 'Address proof', desc: 'Bill or rent agreement' },
};

/** PAN is asked for on this screen (product decision, 2026-09-08) in addition to
 * the shared upload list: photo, Aadhaar, PAN, then address proof for renters. */
const PAN_DOC: NeededDoc = {
  label: 'PAN',
  desc: 'Business identity',
  note: 'PAN counts as your business identity, as required by the food authority.',
};

function toNeededDocs(items: DocItem[]): NeededDoc[] {
  const docs = items.map((it) => DOC_PRESENTATION[it.key] ?? { label: it.label });
  const afterAadhaar = docs.findIndex((d) => d.label === 'Aadhaar') + 1;
  docs.splice(afterAadhaar > 0 ? afterAadhaar : docs.length, 0, PAN_DOC);
  return docs;
}

export function Checklist() {
  const navigate = useNavigate();
  const { status, data, reload } = useLoader<{ premises: Premises; items: DocItem[] } | null>(async (signal) => {
    const d = await getDraft(signal);
    if (signal.aborted) return null;
    if (!d) {
      navigate('/eligibility');
      return null;
    }
    const premises = d.premises ?? 'own';
    return { premises, items: documentChecklist(premises) };
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
      <WhatYouNeedStep
        reason={data.premises === 'rent' ? 'rent your kitchen' : 'own your kitchen'}
        licenceName="FSSAI Basic Registration"
        documents={toNeededDocs(data.items)}
        onBack={() => navigate('/describe')}
        onCreateAccount={() => navigate('/create-account')}
      />
    </AppShell>
  );
}
