import { createBrowserRouter } from 'react-router';
import { Landing } from './routes/Landing';
import { Eligibility } from './routes/Eligibility';
import { Describe } from './routes/Describe';
import { Checklist } from './routes/Checklist';
import { CreateAccount } from './routes/CreateAccount';
import { SignIn } from './routes/SignIn';
import { Pay } from './routes/Pay';
import { Upload } from './routes/Upload';
import { Confirm } from './routes/Confirm';
import { FilingStatus } from './routes/FilingStatus';
import { Dashboard } from './routes/Dashboard';
import { Badge } from './routes/Badge';
import { Qr } from './routes/Qr';
import { TrustScore } from './routes/TrustScore';
import { Placeholder } from './routes/Placeholder';
import { OpsHome } from './routes/OpsHome';
import { OpsApplication } from './routes/OpsApplication';
import { RequireRole } from './components/RequireRole';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/eligibility', element: <Eligibility /> },
  { path: '/describe', element: <Describe /> },
  { path: '/checklist', element: <Checklist /> },
  { path: '/sign-in', element: <SignIn /> },
  { path: '/create-account', element: <CreateAccount /> },
  { path: '/pay', element: <Pay /> },
  { path: '/upload', element: <Upload /> },
  { path: '/confirm', element: <Confirm /> },
  { path: '/status', element: <FilingStatus /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/badge', element: <Badge /> },
  { path: '/qr', element: <Qr /> },
  { path: '/trust-score', element: <TrustScore /> },
  { path: '/renewal', element: <Placeholder title="Stay active" note="Renewal (Screen 15) lands in ticket 25." /> },
  {
    path: '/ops',
    element: (
      <RequireRole roles={['ops', 'admin']}>
        <OpsHome />
      </RequireRole>
    ),
  },
  {
    path: '/ops/:id',
    element: (
      <RequireRole roles={['ops', 'admin']}>
        <OpsApplication />
      </RequireRole>
    ),
  },
]);
