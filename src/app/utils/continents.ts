export interface ContinentInfo {
  id: string;
  es: string;
  fr: string;
}

export const CONTINENTS: ContinentInfo[] = [
  { id: 'europe', es: 'Europa', fr: 'Europe' },
  { id: 'asia', es: 'Asia', fr: 'Asie' },
  { id: 'africa', es: 'África', fr: 'Afrique' },
  { id: 'america', es: 'América', fr: 'Amérique' },
  { id: 'oceania', es: 'Oceanía', fr: 'Océanie' },
];

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // Europe
  AL: 'europe', AD: 'europe', AT: 'europe', BY: 'europe', BE: 'europe',
  BA: 'europe', BG: 'europe', HR: 'europe', CY: 'europe', CZ: 'europe',
  DK: 'europe', EE: 'europe', FI: 'europe', FR: 'europe', DE: 'europe',
  GR: 'europe', HU: 'europe', IS: 'europe', IE: 'europe', IT: 'europe',
  XK: 'europe', LV: 'europe', LI: 'europe', LT: 'europe', LU: 'europe',
  MT: 'europe', MD: 'europe', MC: 'europe', ME: 'europe', NL: 'europe',
  MK: 'europe', NO: 'europe', PL: 'europe', PT: 'europe', RO: 'europe',
  RU: 'europe', SM: 'europe', RS: 'europe', SK: 'europe', SI: 'europe',
  ES: 'europe', SE: 'europe', CH: 'europe', UA: 'europe', GB: 'europe',
  VA: 'europe',
  // Asia
  AF: 'asia', AM: 'asia', AZ: 'asia', BH: 'asia', BD: 'asia',
  BT: 'asia', BN: 'asia', KH: 'asia', CN: 'asia', GE: 'asia',
  IN: 'asia', ID: 'asia', IR: 'asia', IQ: 'asia', IL: 'asia',
  JP: 'asia', JO: 'asia', KZ: 'asia', KW: 'asia', KG: 'asia',
  LA: 'asia', LB: 'asia', MY: 'asia', MV: 'asia', MN: 'asia',
  MM: 'asia', NP: 'asia', KP: 'asia', OM: 'asia', PK: 'asia',
  PS: 'asia', PH: 'asia', QA: 'asia', SA: 'asia', SG: 'asia',
  KR: 'asia', LK: 'asia', SY: 'asia', TW: 'asia', TJ: 'asia',
  TH: 'asia', TL: 'asia', TR: 'asia', TM: 'asia', AE: 'asia',
  UZ: 'asia', VN: 'asia', YE: 'asia',
  // Africa
  DZ: 'africa', AO: 'africa', BJ: 'africa', BW: 'africa', BF: 'africa',
  BI: 'africa', CV: 'africa', CM: 'africa', CF: 'africa', TD: 'africa',
  KM: 'africa', CG: 'africa', CD: 'africa', CI: 'africa', DJ: 'africa',
  EG: 'africa', GQ: 'africa', ER: 'africa', SZ: 'africa', ET: 'africa',
  GA: 'africa', GM: 'africa', GH: 'africa', GN: 'africa', GW: 'africa',
  KE: 'africa', LS: 'africa', LR: 'africa', LY: 'africa', MG: 'africa',
  MW: 'africa', ML: 'africa', MR: 'africa', MU: 'africa', MA: 'africa',
  MZ: 'africa', NA: 'africa', NE: 'africa', NG: 'africa', RW: 'africa',
  ST: 'africa', SN: 'africa', SC: 'africa', SL: 'africa', SO: 'africa',
  ZA: 'africa', SS: 'africa', SD: 'africa', TZ: 'africa', TG: 'africa',
  TN: 'africa', UG: 'africa', ZM: 'africa', ZW: 'africa',
  // America
  AG: 'america', AR: 'america', BS: 'america', BB: 'america', BZ: 'america',
  BO: 'america', BR: 'america', CA: 'america', CL: 'america', CO: 'america',
  CR: 'america', CU: 'america', DM: 'america', DO: 'america', EC: 'america',
  SV: 'america', GD: 'america', GT: 'america', GY: 'america', HT: 'america',
  HN: 'america', JM: 'america', MX: 'america', NI: 'america', PA: 'america',
  PY: 'america', PE: 'america', KN: 'america', LC: 'america', VC: 'america',
  SR: 'america', TT: 'america', US: 'america', UY: 'america', VE: 'america',
  PR: 'america', GF: 'america', GP: 'america', MQ: 'america',
  // Oceania
  AU: 'oceania', FJ: 'oceania', KI: 'oceania', MH: 'oceania', FM: 'oceania',
  NR: 'oceania', NZ: 'oceania', PW: 'oceania', PG: 'oceania', WS: 'oceania',
  SB: 'oceania', TO: 'oceania', TV: 'oceania', VU: 'oceania', NC: 'oceania',
  PF: 'oceania',
};

export function getContinent(countryCode: string): string | null {
  return COUNTRY_TO_CONTINENT[countryCode] || null;
}

export function getContinentName(id: string, lang: 'es' | 'fr'): string {
  return CONTINENTS.find(c => c.id === id)?.[lang] || id;
}

export function countryFlag(code: string): string {
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}
