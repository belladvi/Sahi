import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { getDraft, updateDraft } from '../lib/draft';

export function Describe() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<string[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getDraft().then((d) => {
      if (!d) {
        navigate('/eligibility');
        return;
      }
      setProducts(d.products);
      setBusinessName(d.businessName ?? '');
      setDescription(d.description ?? '');
    });
  }, [navigate]);

  async function submit() {
    setSaving(true);
    try {
      // Server maps these words to a hidden FoSCoS category (never shown here).
      await updateDraft({ businessName: businessName.trim(), description: description.trim() });
      navigate('/checklist');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <AppHeader title="Tell us about your bake" onBack={() => navigate('/eligibility')} />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {products.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <span key={p} className="rounded-full bg-app-raised px-3 py-1 text-xs text-copy-muted ring-1 ring-line">
                {p}
              </span>
            ))}
          </div>
        )}

        <label className="space-y-1.5">
          <span className="text-sm text-copy-muted">Your brand / business name</span>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Riya’s Home Bakes"
            className="w-full rounded-xl bg-app-raised px-3 py-2.5 text-copy ring-1 ring-line outline-none placeholder:text-copy-muted"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm text-copy-muted">Describe what you sell, in your words</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="e.g. I bake custom cakes, cupcakes and brownies to order from my home kitchen."
            className="w-full resize-none rounded-xl bg-app-raised px-3 py-2.5 text-copy ring-1 ring-line outline-none placeholder:text-copy-muted"
          />
        </label>

        <p className="text-xs text-copy-muted">
          We’ll handle the official paperwork for you — you’ll never have to pick a category.
        </p>

        <div className="mt-auto">
          <PrimaryAction type="button" disabled={saving || businessName.trim().length === 0} onClick={submit}>
            {saving ? 'Saving…' : 'Continue'}
          </PrimaryAction>
        </div>
      </div>
    </AppShell>
  );
}
