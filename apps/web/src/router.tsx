import { createBrowserRouter, type RouteObject } from 'react-router';
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
import { Renewal } from './routes/Renewal';
import { OpsHome } from './routes/OpsHome';
import { OpsApplication } from './routes/OpsApplication';
import { Notification } from './routes/Notification';
import { RequireRole } from './components/RequireRole';
import { NotFound } from './components/NotFound';
import { RouteError } from './components/RouteError';

/** Client route table. Exported so tests can mount it in a memory router. */
export const routes: RouteObject[] = [
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
  { path: '/renewal', element: <Renewal /> },
  { path: '/notification', element: <Notification /> },
  {
    path: '/ops/:id/notification',
    element: (
      <RequireRole roles={['ops', 'admin']}>
        <Notification />
      </RequireRole>
    ),
  },
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
  // Branded catch-all for unknown client routes (never matches /verify/* or
  // /api/*, which the Express server owns and renders before the SPA).
  { path: '*', element: <NotFound /> },
];

export const router = createBrowserRouter([
  // A pathless root wraps every route with one branded error boundary, so a
  // thrown render error (or a no-match 404 that reaches the root) shows a
  // recoverable page instead of React Router's raw developer screen.
  { errorElement: <RouteError />, children: routes },
]);
