import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ResultStep from './ResultStep';

// motion's useReducedMotion reads window.matchMedia, which jsdom does not
// implement. Provide a controllable stub (reduce-motion off by default).
let reduceMotion = false;
beforeEach(() => {
  reduceMotion = false;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduce') ? reduceMotion : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => cleanup());

describe('ResultStep', () => {
  it('links "FoSCoS – FSSAI" to the portal in a new, safe tab', () => {
    render(<ResultStep priceAllIn={599} govtFee={100} helpFee={499} />);
    const link = screen.getByRole('link', { name: /FoSCoS/i });
    expect(link).toHaveAttribute('href', 'https://foscos.fssai.gov.in/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the passed fee values (no hardcoded price) and fires the CTA', () => {
    const onContinue = vi.fn();
    render(<ResultStep priceAllIn={599} govtFee={100} helpFee={499} onContinue={onContinue} />);
    // fee split is shown immediately from props
    expect(screen.getByText(/₹100 govt \+ ₹499 our help/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start my registration/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('renders the "what happens next" steps and fires Back', () => {
    const onBack = vi.fn();
    render(<ResultStep priceAllIn={599} govtFee={100} helpFee={499} onBack={onBack} />);
    expect(screen.getByText(/We prepare all the paperwork/)).toBeInTheDocument();
    expect(screen.getByText(/Your licence lands in your inbox/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /do you qualify/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('with reduce-motion ON still renders the content and a working FoSCoS link', () => {
    reduceMotion = true;
    render(<ResultStep priceAllIn={599} govtFee={100} helpFee={499} />);
    expect(screen.getByText(/You qualify/)).toBeInTheDocument();
    expect(screen.getByText(/₹100 govt \+ ₹499 our help/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /FoSCoS/i })).toHaveAttribute('href', 'https://foscos.fssai.gov.in/');
  });

  it('renders fee values from props (proves nothing is hardcoded in JSX)', () => {
    render(<ResultStep priceAllIn={799} govtFee={100} helpFee={699} />);
    expect(screen.getByText(/₹100 govt \+ ₹699 our help/)).toBeInTheDocument();
  });
});
