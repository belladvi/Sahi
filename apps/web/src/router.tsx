import { createBrowserRouter } from 'react-router';
import { Landing } from './routes/Landing';
import { Eligibility } from './routes/Eligibility';
import { Describe } from './routes/Describe';
import { Checklist } from './routes/Checklist';
import { CreateAccount } from './routes/CreateAccount';
import { SignIn } from './routes/SignIn';
import { Pay } from './routes/Pay';
import { Placeholder } from './routes/Placeholder';
import { OpsHome } from './routes/OpsHome';
import { RequireRole } from './components/RequireRole';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/eligibility', element: <Eligibility /> },
  { path: '/describe', element: <Describe /> },
  { path: '/checklist', element: <Checklist /> },
  { path: '/sign-in', element: <SignIn /> },
  { path: '/create-account', element: <CreateAccount /> },
  { path: '/pay', element: <Pay /> },
  {
    path: '/upload',
    element: <Placeholder title="Upload documents" note="Document upload + preflight (Screen 6) lands in ticket 14." />,
  },
  {
    path: '/dashboard',
    element: <Placeholder title="Your dashboard" note="The baker dashboard (Screen 9) lands in ticket 19." />,
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
