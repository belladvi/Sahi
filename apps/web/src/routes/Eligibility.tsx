import { useState } from 'react';
import { useNavigate } from 'react-router';
import { evaluateEligibility, type Premises, type TurnoverBand } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { Surface } from '../components/ui/Surface';
import { updateDraft } from '../lib/draft';

const PRODUCT_CHIPS = ['Cakes', 'Cookies', 'Brownies', 'Chocolates', 'Tiffin / meals', 'Pickles', 'Snacks'];

export function Eligibility() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<string[]>([]);
  const [premises, setPremises] = useState<Premises | null>(null);
  const [turnoverBand, setTurnoverBand] = useState<TurnoverBand | null>(null);
  const [saving, setSaving] = useState(false);

  const result = turnoverBand ? evaluateEligibility(turnoverBand) : null;

  function toggleProduct(p: string) {
    setProducts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function finish() {
    if (!premises || !turnoverBand) return;
    setSaving(true);
    try {
      await updateDraft({ products, premises, turnoverBand });
      navigate('/describe');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Do you qualify?" onBack={() => (step === 0 ? navigate('/') : setStep(step - 1))} />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6 flex gap-1.5" aria-label={`Step ${step + 1} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-action' : 'bg-line'}`} />
          ))}
        </div>

        {step === 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">What do you make?</h2>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_CHIPS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProduct(p)}
                  className={`rounded-full px-4 py-2 text-sm ring-1 ${
                    products.includes(p)
                      ? 'bg-action text-action-foreground ring-action'
                      : 'text-copy-muted ring-line'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <PrimaryAction type="button" disabled={products.length === 0} onClick={() => setStep(1)}>
              Next
            </PrimaryAction>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Where do you cook?</h2>
            <div className="space-y-3">
              {(['own', 'rent'] as Premises[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPremises(p)}
                  className={`w-full rounded-2xl p-4 text-left ring-1 ${
                    premises === p ? 'ring-action' : 'ring-line'
                  }`}
                >
                  <span className="font-medium capitalize">
                    {p === 'own' ? 'I own my home / kitchen' : 'I rent my home / kitchen'}
                  </span>
                </button>
              ))}
            </div>
            <PrimaryAction type="button" disabled={!premises} onClick={() => setStep(2)}>
              Next
            </PrimaryAction>
          </section>
        )}

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
