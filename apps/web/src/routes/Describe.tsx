import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import AboutKitchenStep from '../features/registration/AboutKitchenStep';
import { getDraft, getDraftToken, patchDraft } from '../lib/draft';

/**
 * "/describe" — the premium "Tell us about your kitchen" registration step.
 *
 * This route is a thin wrapper around the self-contained <AboutKitchenStep />
 * (its own header + sticky CTA), rendered directly in the shell like the
 * eligibility steps. The wrapper owns only the draft load + save wiring; the
 * screen owns all layout, copy, and micro-interactions.
 *
 * Save path: the draft was validated on mount, so Continue PATCHes through the
 * known token (`patchDraft`) instead of `updateDraft` (which re-GETs first —
 * ~1.5s extra on prod). The CTA goes busy the instant she taps (the PATCH alone
 * is ~3s on prod), extra taps are ignored, and a failed save releases the
 * button with an inline message instead of losing her words silently.
 *
 * The step also collects a `designation` (required to continue), but the draft
 * schema has no field for it, so only businessName + description are persisted.
 * Storing designation would need a shared-schema/DB change (out of scope here).
 */
export function Describe() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [products, setProducts] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getDraft().then((d) => {
      if (!d) {
        navigate('/eligibility');
        return;
      }
      setProducts(d.products);
      setBusinessName(d.businessName ?? '');
      setDescription(d.description ?? '');
      setLoaded(true);
    });
  }, [navigate]);

  // Hold until the draft is loaded so the step mounts with the right initial
  // values (it reads them once, at mount).
  if (!loaded) return <AppShell>{null}</AppShell>;

  return (
    <AppShell>
      <AboutKitchenStep
        makes={products}
        initialName={businessName}
        initialDescription={description}
        pending={pending}
        error={error}
        onBack={() => navigate('/eligibility')}
        onContinue={({ name, description: desc }) => {
          if (pending) return;
          const token = getDraftToken();
          if (!token) {
            navigate('/eligibility');
            return;
          }
          setPending(true);
          setError(null);
          // Server maps these words to a hidden FoSCoS category (never shown
          // here). `designation` is intentionally not persisted (no schema field).
          patchDraft(token, { businessName: name, description: desc }).then(
            () => navigate('/checklist'),
            () => {
              setPending(false);
              setError('Couldn’t save just now — check your connection and tap Continue again.');
            },
          );
        }}
      />
    </AppShell>
  );
}
