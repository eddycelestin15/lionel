import type { CadrageBlock, PlanningSheet } from '@/types/report';
import { normalizeText } from './themes';

/** Pôles de développement, déduits de la feuille de cadrage d'origine. */
/**
 * Formes rencontrées dans la colonne « Pôle de développement », ramenées à un
 * libellé unique. C'est la source primaire : la table par feuille ci-dessous
 * n'est qu'un repli pour les feuilles qui ne portent pas la colonne.
 */
const POLES_CANONIQUES: [RegExp, string][] = [
  [/andrefana/, 'Matsiatra Andrefana'],
  [/antsinanana|vohibato/, 'Matsiatra Antsinanana'],
  [/avaratra/, 'Matsiatra Avaratra'],
  [/ambalavao/, 'Ambalavao'],
];

export function canonicalPole(valeur: string): string | null {
  const n = normalizeText(valeur);
  if (!n.trim()) return null;
  for (const [re, label] of POLES_CANONIQUES) if (re.test(n)) return label;
  return null;
}

export const POLE_PAR_FEUILLE: Record<string, string> = {
  RT: 'Coordination régionale',
  SUPERVISEUR: 'Ambalavao',
  'CGEAF AMBALAVAO': 'Ambalavao',
  'SUP M. ANDREFANA': 'Matsiatra Andrefana',
  'CGEAF M.ANDREFANA': 'Matsiatra Andrefana',
  'SUP ANTSINANANA': 'Matsiatra Antsinanana',
  'CGEAF MATSIATRA ANTSINANANA': 'Matsiatra Antsinanana',
  'CADRAGE SUP': 'Matsiatra Avaratra',
  'CGEAF Avaratra': 'Matsiatra Avaratra',
};

export const POLES = [
  'Coordination régionale',
  'Ambalavao',
  'Matsiatra Andrefana',
  'Matsiatra Antsinanana',
  'Matsiatra Avaratra',
  'Non rattaché',
] as const;

/** Mots vides des noms de lieux, pour comparer des libellés saisis librement. */
const LIEU_STOPWORDS = new Set(['cr', 'commune', 'rurale', 'fkt', 'fokontany', 'et', 'de', 'la', 'le', 'du']);

export function nameTokens(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Similarité de noms de personnes : recouvrement de jetons rapporté au plus
 * court des deux noms, les prénoms d'usage variant d'un document à l'autre.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  let sharedLong = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      shared += 1;
      if (t.length >= 5) sharedLong += 1;
    }
  }
  // Un patronyme long en commun évite les faux positifs sur « Jean », « Marie »…
  if (!sharedLong) return 0;
  return shared / Math.min(ta.size, tb.size);
}

export function lieuTokens(value: string): Set<string> {
  const out = new Set<string>();
  for (const token of normalizeText(value).split(/[^a-z0-9]+/)) {
    if (token.length >= 4 && !LIEU_STOPWORDS.has(token)) out.add(token);
  }
  return out;
}

export interface Pairing {
  planning: PlanningSheet | null;
  cadrage: CadrageBlock | null;
  /** Qualité de l'appariement : 1 = nom, 0.6 = commune, 0 = aucun. */
  confidence: number;
  method: 'nom' | 'commune' | 'aucun';
}

/**
 * Apparie chaque planning à son bloc de cadrage : par nom d'agent d'abord,
 * puis par commune d'intervention pour les feuilles au nom manquant.
 */
export function pairAgents(planning: PlanningSheet[], cadrage: CadrageBlock[]): Pairing[] {
  const usedCadrage = new Set<number>();
  const pairings: Pairing[] = [];

  const byName = planning.map((p) => {
    let best = -1;
    let bestScore = 0;
    // Un nom absent porte un libellé de remplacement : l'apparier ferait
    // correspondre deux « (non renseigné) … » par leurs mots de remplissage.
    if (p.agentMissing) return { planning: p, cadrage: null, confidence: 0, method: 'aucun' as const };
    cadrage.forEach((c, i) => {
      if (usedCadrage.has(i) || c.agentMissing) return;
      const score = nameSimilarity(p.agent, c.agent);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (bestScore >= 0.5 && best >= 0) {
      usedCadrage.add(best);
      return { planning: p, cadrage: cadrage[best], confidence: 1, method: 'nom' as const };
    }
    return { planning: p, cadrage: null, confidence: 0, method: 'aucun' as const };
  });

  // Repêchage géographique pour les plannings restés orphelins : un bloc de
  // cadrage sans nom exploitable se reconnaît au recouvrement entre les
  // communes qu'il cite et les lieux parcourus par le planning. Cela couvre
  // notamment les feuilles de cadrage d'équipe, qui n'identifient pas leur
  // titulaire, sans avoir à inscrire son nom en dur.
  for (const pairing of byName) {
    if (pairing.cadrage || !pairing.planning) {
      pairings.push(pairing);
      continue;
    }
    const planning = pairing.planning;
    const target = lieuTokens(
      [
        planning.commune,
        planning.zone,
        planning.sheet,
        ...planning.days.map((d) => `${d.lieu} ${d.itineraire}`),
      ].join(' '),
    );
    let best = -1;
    let bestScore = 0;
    cadrage.forEach((c, i) => {
      if (usedCadrage.has(i)) return;
      // Une feuille d'équipe ne peut appartenir qu'à un poste d'encadrement.
      if (c.isTeamSheet && planning.fonction === 'CGEAF') return;
      const tokens = lieuTokens([c.commune, ...c.activities.map((a) => a.commune)].join(' '));
      if (!tokens.size) return;
      let shared = 0;
      for (const t of tokens) if (target.has(t)) shared += 1;
      const score = shared / tokens.size;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (bestScore >= 0.5 && best >= 0) {
      usedCadrage.add(best);
      pairings.push({ planning: pairing.planning, cadrage: cadrage[best], confidence: 0.6, method: 'commune' });
    } else {
      pairings.push(pairing);
    }
  }

  // Blocs de cadrage sans planning correspondant.
  cadrage.forEach((c, i) => {
    if (!usedCadrage.has(i)) {
      pairings.push({ planning: null, cadrage: c, confidence: 0, method: 'aucun' });
    }
  });

  return pairings;
}

/**
 * Rattachement au pôle, par ordre de fiabilité décroissante : la colonne du
 * cadrage, puis la zone déclarée au planning, puis le nom de feuille, enfin la
 * fonction. Aucun de ces niveaux n'est obligatoire.
 */
export function poleOf(pairing: Pairing): string {
  const depuisCadrage = canonicalPole(pairing.cadrage?.pole ?? '');
  if (depuisCadrage) return depuisCadrage;

  const depuisZone = canonicalPole(`${pairing.planning?.zone ?? ''} ${pairing.planning?.commune ?? ''}`);
  if (depuisZone) return depuisZone;

  const sheet = pairing.cadrage?.sheet.trim();
  if (sheet && POLE_PAR_FEUILLE[sheet]) return POLE_PAR_FEUILLE[sheet];

  if (/ambohimahasoa/.test(normalizeText(pairing.planning?.zone ?? ''))) return 'Matsiatra Avaratra';
  if (pairing.planning?.fonction === 'RT') return 'Coordination régionale';
  return 'Non rattaché';
}
