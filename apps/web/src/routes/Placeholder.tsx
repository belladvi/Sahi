import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';

/** Temporary screen for routes built in a later ticket — keeps the flow linked. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  const navigate = useNavigate();
  return (
    <AppShell>
      <AppHeader title={title} onBack={() => navigate(-1)} />
      <div className="flex-1 p-6">
        <Surface>
          <p className="text-sm text-copy-muted">{note}</p>
        </Surface>
      </div>
    </AppShell>
  );
}
