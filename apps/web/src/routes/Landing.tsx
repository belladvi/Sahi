import { useNavigate } from 'react-router';
import { GOV_FEE_RUPEES, SERVICE_FEE_RUPEES, TOTAL_FEE_RUPEES } from '@sahi/shared';
import { AppShell } from '../components/AppShell';
import { PrimaryAction } from '../components/ui/PrimaryAction';
import { Surface } from '../components/ui/Surface';

export function Landing() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold">Sahi</span>
          <button
            type="button"
            onClick={() => navigate('/sign-in')}
            className="text-sm text-copy-muted hover:text-copy"
          >
            Sign in
          </button>
        </div>

        <div className="mt-10 space-y-3">
          <h1 className="text-3xl font-bold leading-tight">
            Your FSSAI licence,
            <br />
            <span className="text-action">done for you.</span>
          </h1>
          <p className="text-copy-muted">
            Home baker in Bangalore? Get the government food licence you legally need — without the
            confusing portal or an overpriced agent.
          </p>
        </div>

        <Surface className="mt-8">
          <p className="text-sm font-semibold">The honest price</p>
          <div className="mt-3 space-y-2 text-sm text-copy-muted">
            <div className="flex justify-between">
              <span>Government fee</span>
              <span className="text-copy">₹{GOV_FEE_RUPEES}</span>
            </div>
            <div className="flex justify-between">
              <span>Our help (done-for-you)</span>
              <span className="text-copy">₹{SERVICE_FEE_RUPEES}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-semibold text-copy">
              <span>You pay</span>
              <span className="text-action">₹{TOTAL_FEE_RUPEES}</span>
            </div>
          </div>
        </Surface>

        <div className="mt-auto pt-8">
          <PrimaryAction type="button" onClick={() => navigate('/eligibility')}>
            Check if you qualify — free
          </PrimaryAction>
          <p className="mt-3 text-center text-xs text-copy-muted">
            No signup needed to check. Takes about a minute.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
