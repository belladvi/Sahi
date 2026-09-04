import { describe, it, expect } from 'vitest';
import { mapCategory } from './category-engine.js';

describe('category-translation engine', () => {
  it('maps common baker words to Bakery & Confectionery', () => {
    const m = mapCategory({ products: ['Cakes', 'Cookies'], description: 'I bake birthday cakes at home' });
    expect(m.category).toBe('Bakery & Confectionery');
    expect(m.kindOfBusiness).toBe('Manufacturer');
    expect(m.confident).toBe(true);
  });

  it('maps tiffin/cloud-kitchen words to Food Services', () => {
    const m = mapCategory({ description: 'home tiffin and catering service' });
    expect(m.kindOfBusiness).toBe('Food Services');
    expect(m.confident).toBe(true);
  });

  it('maps pickles/masala to Packaged & Processed Foods', () => {
    const m = mapCategory({ products: ['Mango pickle', 'masala'] });
    expect(m.category).toBe('Packaged & Processed Foods');
  });

  it('falls back to a safe default for ambiguous input (never blocks)', () => {
    const m = mapCategory({ description: 'homemade goodies' });
    expect(m.confident).toBe(false);
    expect(m.kindOfBusiness).toBe('Manufacturer');
    expect(m.subCategory).toBe('General food products');
  });
});
