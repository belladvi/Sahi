import { createBrowserRouter } from 'react-router';
import { Landing } from './routes/Landing';
import { Eligibility } from './routes/Eligibility';
import { Describe } from './routes/Describe';
import { Checklist } from './routes/Checklist';
import { Placeholder } from './routes/Placeholder';
import { OpsHome } from './routes/OpsHome';
import { RequireRole } from './components/RequireRole';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/eligibility', element: <Eligibility /> },
  { path: '/describe', element: <Describe /> },
  { path: '/checklist', element: <Checklist /> },
  {
    path: '/sign-in',
    element: <Placeholder title="Sign in" note="Phone OTP sign-in lands in ticket 11." />,
  },
  {
    path: '/create-account',
    element: <Placeholder title="Create account" note="Account creation + OTP lands in ticket 10." />,
  },
  {
    path: '/ops',
    element: (
      <RequireRole roles={['ops', 'admin']}>
        <OpsHome />
      </RequireRole>
    ),
  },
]);
