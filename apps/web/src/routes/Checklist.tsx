import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { documentChecklist, type DocItem, type Premises } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { Surface } from '../components/ui/Surface';
import { getDraft } from '../lib/draft';

export function Checklist() {
  const navigate = useNavigate();
  const [premises, setPremises] = useState<Premises | null>(null);
  const [items, setItems] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getDraft().then((d) => {
      if (!d) {
        navigate('/eligibility');
        return;
      }
      const p = d.premises ?? 'own';
      setPremises(p);
      setItems(documentChecklist(p));
      setLoading(false);
    });
  }, [navigate]);

  return (
    <AppShell>
      <AppHeader title="What you’ll need" onBack={() => navigate('/describe')} />
      <div className="flex flex-1 flex-col gap-5 p-6">
        {loading ? (
          <p className="text-copy-muted">Loading…</p>
        ) : (
          <>
            <p className="text-sm text-copy-muted">
              Because you <span className="text-copy">{premises === 'rent' ? 'rent' : 'own'}</span> your
              kitchen, you’ll need these <span className="text-copy">{items.length}</span> documents. Keep
              them handy — you’ll upload them after creating your account.
            </p>

            <Surface className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.key} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-action text-xs font-bold text-action-foreground">
                    {idx + 1}
                  </span>
                  <span className="text-sm">{it.label}</span>
                </div>
              ))}
            </Surface>

            <p className="text-xs text-copy-muted">
              This is the full official list for FSSAI Basic Registration. Next, create an account so
              we can save your progress before payment.
            </p>

            <div className="mt-auto">
              <PrimaryAction type="button" onClick={() => navigate('/create-account')}>
                Create an account
              </PrimaryAction>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
