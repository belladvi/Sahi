import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Home } from './Home';

describe('Home', () => {
  beforeEach(() => {
    // The component fetches /api/health on mount; stub it so the test is hermetic.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
    );
  });

  it('renders the app name', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'Sahi' })).toBeInTheDocument();
  });
});
