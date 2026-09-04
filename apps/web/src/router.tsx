import { createBrowserRouter } from 'react-router';
import { Home } from './routes/Home';
import { OpsHome } from './routes/OpsHome';
import { RequireRole } from './components/RequireRole';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
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
