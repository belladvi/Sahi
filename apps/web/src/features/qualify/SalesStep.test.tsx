import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SalesStep, { type SalesOption } from './SalesStep';

// motion's useReducedMotion reads window.matchMedia, which jsdom does not
// implement. Provide a controllable stub (reduce-motion off by default).
let reduceMotion = false;
beforeEach(() => {
  reduceMotion = false;
  // SideScrollbar (rendered as a child) instantiates a ResizeObserver, which
  // jsdom does not implement. Stub it; the rail returns null in jsdom anyway
  // (scrollHeight/clientHeight are 0, so it never registers as scrollable).
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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

describe('SalesStep', () => {
  it('offers the two label-only options with nothing selected and CTA disabled', () => {
    render(<SalesStep />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText("I'm just starting out")).toBeInTheDocument();
    expect(screen.getByText('Under ₹1.5 crore a year')).toBeInTheDocument();
    for (const r of radios) expect(r).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: /see my result/i })).toBeDisabled();
  });

  it('is single-select, enables the CTA, and submits the chosen option', () => {
    const onSubmit = vi.fn();
    render(<SalesStep onSubmit={onSubmit} />);
    const radios = screen.getAllByRole('radio');
    const starting = radios[0]!;
    const under = radios[1]!;

    fireEvent.click(starting);
    expect(starting).toHaveAttribute('aria-checked', 'true');
    expect(under).toHaveAttribute('aria-checked', 'false');

    // choosing the other row moves the single selection
    fireEvent.click(under);
    expect(starting).toHaveAttribute('aria-checked', 'false');
    expect(under).toHaveAttribute('aria-checked', 'true');

    const cta = screen.getByRole('button', { name: /see my result/i });
    expect(cta).toBeEnabled();
    fireEvent.click(cta);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const choice = onSubmit.mock.calls[0]![0] as SalesOption;
    expect(choice.id).toBe('under');
  });

  it('renders and selects with reduce-motion ON', () => {
    reduceMotion = true;
    const onSubmit = vi.fn();
    render(<SalesStep onSubmit={onSubmit} />);
    const starting = screen.getAllByRole('radio')[0]!;
    fireEvent.click(starting);
    expect(starting).toHaveAttribute('aria-checked', 'true');
    const cta = screen.getByRole('button', { name: /see my result/i });
    expect(cta).toBeEnabled();
    fireEvent.click(cta);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ id: 'starting' }));
  });
});
