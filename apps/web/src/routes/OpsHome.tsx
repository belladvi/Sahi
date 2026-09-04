import { AppShell } from '../components/AppShell';
import { AppHeader } from '../components/AppHeader';
import { Surface } from '../components/ui/Surface';

/** Ops console landing (role-gated). Filing queue lands in ticket 17. */
export function OpsHome() {
  return (
    <AppShell>
      <AppHeader title="Ops Console" />
      <div className="flex-1 space-y-4 p-5">
        <Surface>
          <p className="text-sm text-copy-muted">
            Staff-only area. The filing queue and approval tools land in tickets 17–18.
          </p>
        </Surface>
      </div>
    </AppShell>
  );
}
