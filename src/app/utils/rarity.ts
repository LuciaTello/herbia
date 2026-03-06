import { Translations } from '../i18n/translations';

export interface Rarity {
  label: string;
  color: string;
  multiplier: number;
}

export function getRarity(rarity: string, t: Translations): Rarity {
  switch (rarity) {
    case 'rare': return { label: t.rarity.rare, color: '#e17055', multiplier: 2 };
    case 'veryRare': return { label: t.rarity.veryRare, color: '#d63031', multiplier: 3 };
    default: return { label: t.rarity.common, color: '#2d7d46', multiplier: 1 };
  }
}
