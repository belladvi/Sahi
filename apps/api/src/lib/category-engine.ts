/**
 * The invisible category-translation engine.
 * Maps a baker's own words (products + free-text description) to the FoSCoS
 * Kind-of-Business / category / sub-category she would otherwise have to guess.
 * The output is stored on the draft and NEVER shown to her (build-spec §3).
 */

export interface CategoryMapping {
  kindOfBusiness: string;
  category: string;
  subCategory: string;
  confident: boolean;
}

interface Rule {
  keywords: string[];
  mapping: Omit<CategoryMapping, 'confident'>;
}

const RULES: Rule[] = [
  {
    keywords: ['cake', 'cookie', 'biscuit', 'brownie', 'bread', 'bake', 'baker', 'pastry', 'muffin', 'cupcake', 'dessert', 'chocolate', 'confection'],
    mapping: { kindOfBusiness: 'Manufacturer', category: 'Bakery & Confectionery', subCategory: 'Bakery products' },
  },
  {
    keywords: ['pickle', 'achaar', 'masala', 'spice', 'papad', 'chutney', 'jam', 'sauce', 'condiment'],
    mapping: { kindOfBusiness: 'Manufacturer', category: 'Packaged & Processed Foods', subCategory: 'Pickles & condiments' },
  },
  {
    keywords: ['tiffin', 'meal', 'lunch', 'thali', 'catering', 'cloud kitchen', 'restaurant', 'curry', 'biryani', 'snack'],
    mapping: { kindOfBusiness: 'Food Services', category: 'Restaurant / Cloud Kitchen', subCategory: 'Prepared meals' },
  },
  {
    keywords: ['chips', 'namkeen', 'sweets', 'mithai', 'ladoo', 'barfi', 'dairy', 'ghee', 'paneer'],
    mapping: { kindOfBusiness: 'Manufacturer', category: 'Packaged & Processed Foods', subCategory: 'Ready-to-eat foods' },
  },
];

/** Safe default when nothing matches — never blocks the baker. */
const SAFE_DEFAULT: Omit<CategoryMapping, 'confident'> = {
  kindOfBusiness: 'Manufacturer',
  category: 'Bakery & Confectionery',
  subCategory: 'General food products',
};

export function mapCategory(input: { products?: string[]; description?: string }): CategoryMapping {
  const haystack = [...(input.products ?? []), input.description ?? '']
    .join(' ')
    .toLowerCase();

  for (const rule of RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) {
      return { ...rule.mapping, confident: true };
    }
  }
  return { ...SAFE_DEFAULT, confident: false };
}
