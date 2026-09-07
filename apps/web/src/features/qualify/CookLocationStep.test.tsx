import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CookLocationStep, { type CookOption } from './CookLocationStep';

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

describe('CookLocationStep', () => {
  it('starts with nothing selected and Next disabled', () => {
    render(<CookLocationStep />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    for (const r of screen.getAllByRole('radio')) {
      expect(r).toHaveAttribute('aria-checked', 'false');
    }
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('is single-select, enables Next, and passes the chosen option to onNext', () => {
    const onNext = vi.fn();
    render(<CookLocationStep onNext={onNext} />);
    const radios = screen.getAllByRole('radio');
    const own = radios[0]!;
    const rented = radios[1]!;

    fireEvent.click(own);
    expect(own).toHaveAttribute('aria-checked', 'true');
    expect(rented).toHaveAttribute('aria-checked', 'false');

    // choosing another row moves the single selection
    fireEvent.click(rented);
    expect(own).toHaveAttribute('aria-checked', 'false');
    expect(rented).toHaveAttribute('aria-checked', 'true');

    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    const choice = onNext.mock.calls[0]![0] as CookOption;
    expect(choice.id).toBe('rented-home');
  });

  it('"Somewhere else" reveals a text input and gates Next on typed text', async () => {
    const onNext = vi.fn();
    render(<CookLocationStep onNext={onNext} />);
    const other = screen.getAllByRole('radio')[2]!;

    fireEvent.click(other);
    expect(other).toHaveAttribute('aria-checked', 'true');
    // Next stays disabled until free text is entered
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    const input = await screen.findByPlaceholderText(/relative's kitchen/i);
    fireEvent.change(input, { target: { value: "  a friend's kitchen  " } });

    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
    const choice = onNext.mock.calls[0]![0] as CookOption;
    expect(choice.id).toBe('other');
    expect(choice.label).toBe("a friend's kitchen"); // typed text, trimmed
  });

  it('renders and selects with reduce-motion ON', () => {
    reduceMotion = true;
    const onNext = vi.fn();
    render(<CookLocationStep onNext={onNext} />);
    const own = screen.getAllByRole('radio')[0]!;
    fireEvent.click(own);
    expect(own).toHaveAttribute('aria-checked', 'true');
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ id: 'own-home' }));
  });
});
