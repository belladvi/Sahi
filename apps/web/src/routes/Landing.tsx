import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import SahiHero from '../components/hero/SahiHero';

export function Landing() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <SahiHero
        onCheckEligibility={() => navigate('/eligibility')}
        onSignIn={() => navigate('/sign-in')}
      />
    </AppShell>
  );
}
