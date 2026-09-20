export const NOM_DES_MOIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const nf = new Intl.NumberFormat('fr-FR');
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/**
 * L'ICU sépare les milliers par une espace fine insécable (U+202F) que
 * beaucoup de polices d'interface ne dessinent pas : on retombe sur l'espace
 * insécable ordinaire, qui reste typographiquement correcte en français.
 */
const espaces = (value: string) => value.replace(/ /g, ' ');

export const fmtInt = (value: number): string => espaces(nf.format(Math.round(value)));

export const fmtDec = (value: number): string => espaces(nf1.format(value));

export const fmtPct = (value: number, digits = 0): string =>
  `${espaces(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(value * 100))} %`;

/** Les montants sont en ariary : au-delà du million, l'unité courte suffit. */
export function fmtAr(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${fmtDec(value / 1_000_000)} M Ar`;
  if (Math.abs(value) >= 1_000) return `${fmtInt(value / 1_000)} k Ar`;
  return `${fmtInt(value)} Ar`;
}

export const fmtArFull = (value: number): string => `${fmtInt(value)} Ar`;

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function fmtKm(value: number): string {
  return `${fmtInt(value)} km`;
}

/** Initiales pour les pastilles d'agent. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /[A-Za-zÀ-ÿ]/.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
