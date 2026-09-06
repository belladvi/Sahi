import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';
import { RouteError } from './components/RouteError';

afterEach(() => cleanup());

describe('router reliability (R1)', () => {
  it('renders a branded Not Found (with Go home) for an unknown client route', async () => {
    const router = createMemoryRouter([{ errorElement: <RouteError />, children: routes }], {
      initialEntries: ['/definitely-not-a-real-route'],
    });
    render(<RouterProvider router={router} />);
    // AppHeader title of the NotFound page — proves the branded page, not the raw
    // React Router developer error.
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
  });

  it('renders the branded error boundary when a route element throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('kaboom');
    };
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteError /> }], {
      initialEntries: ['/'],
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    spy.mockRestore();
  });
});
