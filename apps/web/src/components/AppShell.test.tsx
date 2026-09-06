import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  afterEach(() => cleanup());

  it('exposes a main landmark around its content', () => {
    render(
      <AppShell>
        <p>hello</p>
      </AppShell>,
    );
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveTextContent('hello');
  });

  it('reserves top and bottom safe-area space on the scrolling content region', () => {
    render(
      <AppShell>
        <p>hello</p>
      </AppShell>,
    );
    const main = screen.getByRole('main');
    // Safe-area padding is applied via shared utility classes so the notch/home
    // indicator never overlaps the first header row or a sticky bottom action.
    expect(main.className).toMatch(/\bsafe-top\b/);
    expect(main.className).toMatch(/\bsafe-bottom\b/);
  });
});
