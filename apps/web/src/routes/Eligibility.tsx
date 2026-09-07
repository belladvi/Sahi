import { useState } from 'react';
import { useNavigate } from 'react-router';
import { evaluateEligibility, type Premises, type TurnoverBand } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { Surface } from '../components/ui/Surface';
import { updateDraft } from '../lib/draft';
import QualifyMakeStep, { type MakeOption } from '../features/qualify/QualifyMakeStep';
import CookLocationStep, { type CookOption } from '../features/qualify/CookLocationStep';

// Step-2 premium options map onto the existing two-value `Premises` enum so the
// backend/checklist/upload/Form-A stay unchanged (additive — no shared/DB edit).
// "Somewhere else" is treated as a non-owned kitchen → `rent` (needs address
// proof), the conservative, food-safety-safe default. The typed free-text label
// is kept only for the in-wizard selection; it isn't persisted (no field for it).
const COOK_TO_PREMISES: Record<string, Premises> = {
  'own-home': 'own',
  'rented-home': 'rent',
  other: 'rent',
};

// Step-1 chips. Labels are what we persist to the draft (products[]) and feed the
// server-side category engine — kept identical to the previous fixed chip list so
// the hidden category mapping is unchanged. Custom entries add their own labels.
const MAKE_OPTIONS: MakeOption[] = [
  { id: 'cakes', label: 'Cakes' },
  { id: 'cookies', label: 'Cookies' },
  { id: 'brownies', label: 'Brownies' },
  { id: 'chocolates', label: 'Chocolates' },
  { id: 'tiffin', label: 'Tiffin / meals' },
  { id: 'pickles', label: 'Pickles' },
  { id: 'snacks', label: 'Snacks' },
];

export function Eligibility() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [makeSelection, setMakeSelection] = useState<MakeOption[]>([]);
  const [premises, setPremises] = useState<Premises | null>(null);
  const [cookChoiceId, setCookChoiceId] = useState<string | undefined>(undefined);
  const [turnoverBand, setTurnoverBand] = useState<TurnoverBand | null>(null);
  const [saving, setSaving] = useState(false);

  const result = turnoverBand ? evaluateEligibility(turnoverBand) : null;

  async function finish() {
    if (!premises || !turnoverBand) return;
    setSaving(true);
    try {
      await updateDraft({ products: makeSelection.map((o) => o.label), premises, turnoverBand });
      navigate('/describe');
    } finally {
      setSaving(false);
    }
  }

  // Step 1 (index 0) — premium "What do you make?". It's a self-contained screen
  // with its own header + progress, so it renders directly in the shell without
  // AppHeader (exactly like the Landing hero). Selection is lifted here so going
  // Back from step 2 restores the chips (customs included). Nothing is saved to
  // the draft until `finish()`, preserving the original single-write flow.
  if (step === 0) {
    const customOptions = makeSelection.filter((o) => o.custom);
    return (
      <AppShell>
        <QualifyMakeStep
          step={1}
          totalSteps={4}
          options={[...MAKE_OPTIONS, ...customOptions]}
          initialSelected={makeSelection.map((o) => o.id)}
          onBack={() => navigate('/')}
          onNext={(selected) => {
            setMakeSelection(selected);
            setStep(1);
          }}
        />
      </AppShell>
    );
  }

  // Step 2 (index 1) — premium "Where do you cook?". Like step 1 it's a
  // self-contained screen (own header + progress), so it renders directly in the
  // shell without AppHeader. Back returns to the make step (chips restored from
  // state); the cook choice is mapped to `premises` and saved only at finish().
  if (step === 1) {
    return (
      <AppShell>
        <CookLocationStep
          step={2}
          totalSteps={4}
          initialSelectedId={cookChoiceId}
          onBack={() => setStep(0)}
          onNext={(choice: CookOption) => {
            setCookChoiceId(choice.id);
            setPremises(COOK_TO_PREMISES[choice.id] ?? 'rent');
            setStep(2);
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <AppHeader title="Do you qualify?" onBack={() => setStep(step - 1)} />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6 flex gap-1.5" aria-label={`Step ${step + 1} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-action' : 'bg-line'}`} />
          ))}
        </div>

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Roughly, your yearly sales?</h2>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setTurnoverBand('basic')}
                className={`w-full rounded-2xl p-4 text-left ring-1 ${turnoverBand === 'basic' ? 'ring-action' : 'ring-line'}`}
              >
                <span className="font-medium">Under ₹1.5 crore a year</span>
                <p className="text-xs text-copy-muted">Almost every home baker</p>
              </button>
              <button
                type="button"
                onClick={() => setTurnoverBand('above')}
                className={`w-full rounded-2xl p-4 text-left ring-1 ${turnoverBand === 'above' ? 'ring-action' : 'ring-line'}`}
              >
                <span className="font-medium">More than ₹1.5 crore a year</span>
              </button>
            </div>
            <PrimaryAction type="button" disabled={!turnoverBand} onClick={() => setStep(3)}>
              See my result
            </PrimaryAction>
          </section>
        )}

        {step === 3 && result && (
          <section className="space-y-4">
            <Surface className={result.eligible ? 'ring-verified/40' : ''}>
              <h2 className="text-xl font-semibold">
                {result.eligible ? 'You qualify 🎉' : 'A quick heads-up'}
              </h2>
              <p className="mt-2 text-sm text-copy-muted">{result.message}</p>
              {result.eligible && (
                <p className="mt-3 text-sm">
                  FSSAI <span className="font-semibold">Basic Registration</span> —{' '}
                  <span className="text-action font-semibold">₹{result.total}</span> all-in (₹
                  {result.govFee} govt + ₹{result.serviceFee} our help).
                </p>
              )}
            </Surface>
            <PrimaryAction type="button" disabled={saving} onClick={finish}>
              {saving ? 'Saving…' : result.eligible ? 'Continue' : 'Continue anyway'}
            </PrimaryAction>
          </section>
        )}
      </div>
    </AppShell>
  );
}
