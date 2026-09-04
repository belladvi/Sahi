import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Landing } from './Landing';

function renderLanding() {
  const router = createMemoryRouter([{ path: '/', element: <Landing /> }], {
    initialEntries: ['/'],
  });
  return render(<RouterProvider router={router} />);
}

describe('Landing', () => {
  it('shows the promise, the ₹599 split and the CTA', () => {
    renderLanding();
    expect(screen.getByRole('heading', { name: /done for you/i })).toBeInTheDocument();
    expect(screen.getByText('₹599')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check if you qualify/i })).toBeInTheDocument();
  });
});
