import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Reduced-motion: every row, badge and note must render fully visible with no
// entrance animation (no opacity-0 / scale-0 starting state).
vi.mock('motion/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('motion/react')>();
  return { ...mod, useReducedMotion: () => true };
});

const { default: WhatYouNeedStepRented } = await import('./WhatYouNeedStepRented');
const { documentsFor, reasonFor } = await import('./whatYouNeedData');

describe('WhatYouNeedStepRented (reduced motion)', () => {
  afterEach(() => cleanup());

  it('renter: 4 rows + both notes render static and visible', () => {
    render(<WhatYouNeedStepRented reason={reasonFor('rent')} documents={documentsFor('rent')} />);
    const labels = screen.getAllByText(/^(Passport-size photo|Aadhaar|PAN|Address proof)$/).map((el) => el.textContent);
    expect(labels).toEqual(['Passport-size photo', 'Aadhaar', 'PAN', 'Address proof']);
    const notes = [
      screen.getByText(/PAN counts as your business identity/i),
      screen.getByText('A recent utility bill or your rent agreement works.'),
    ];
    for (const note of notes) {
      const box = note.closest('div.relative') as HTMLElement;
      expect(box.style.opacity === '' || box.style.opacity === '1').toBe(true);
      expect(box.style.transform).not.toMatch(/translateX\(-10px\)/);
    }
    const badges = screen.getAllByText(/^[1-4]$/);
    expect(badges).toHaveLength(4);
    for (const b of badges) expect(b.style.transform).not.toMatch(/scale\(0\)/);
  });

  it('owner: 3 rows, no address-proof note', () => {
    render(<WhatYouNeedStepRented reason={reasonFor('own')} documents={documentsFor('own')} />);
    expect(screen.getByText('3 documents')).toBeInTheDocument();
    expect(screen.queryByText('Address proof')).not.toBeInTheDocument();
    expect(screen.queryByText(/utility bill/i)).not.toBeInTheDocument();
  });
});
