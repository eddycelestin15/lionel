/**
 * Taxonomie thématique du programme et classifieur par lexique.
 *
 * Les activités sont saisies en texte libre, souvent bilingues et abrégées.
 * Une classification multi-étiquette par mots-clés reste la plus lisible et la
 * plus auditable : chaque règle est visible et corrigeable ici, sans boîte noire.
 */

export interface ThemeDef {
  id: string;
  label: string;
  /** Regroupement de haut niveau, pour les vues synthétiques. */
  famille: 'Filières' | 'Économie rurale' | 'Structuration' | 'Transversal' | 'Pilotage';
  patterns: RegExp[];
}

export const THEMES: ThemeDef[] = [
  {
    id: 'riz',
    label: 'Riz / PAPRIZ',
    famille: 'Filières',
    patterns: [
      /\briz\b/,
      /papriz/,
      /rizicol/,
      /riziculture/,
      /repiquage/,
      /pepiniere/,
      /\bsri\b/,
      /grande saison/,
    ],
  },
  {
    id: 'mais',
    label: 'Maïs',
    famille: 'Filières',
    patterns: [/\bmais\b/, /\bmaiz/],
  },
  {
    id: 'autres_filieres',
    label: 'Autres cultures',
    famille: 'Filières',
    patterns: [/manioc/, /haricot/, /arachide/, /pomme de terre/, /\bsoja\b/, /patate/, /legumineuse/],
  },
  {
    id: 'elevage',
    label: 'Élevage / pisciculture',
    famille: 'Filières',
    patterns: [/elevage/, /poulet/, /volaille/, /\bporc/, /\bzebu/, /pisciculture/, /poisson/],
  },
  {
    id: 'fep',
    label: 'FEP / apiculture',
    famille: 'Filières',
    patterns: [/\bfep\b/, /apicult/, /ruche/, /rucher/, /\bmiel\b/, /abeille/],
  },
  {
    id: 'cep',
    label: 'CEP (champ-école)',
    famille: 'Structuration',
    patterns: [/\bcep\b/, /champ ?-? ?ecole/],
  },
  {
    id: 'gvec',
    label: 'GVEC / épargne-crédit',
    famille: 'Économie rurale',
    patterns: [/\bgvec\b/, /epargne/, /\bcredit\b/, /education financiere/, /\bagr\b/],
  },
  {
    id: 'op',
    label: 'Structuration OP / coopératives',
    famille: 'Structuration',
    patterns: [
      /\bopb?\b/,
      /organisation paysanne/,
      /cooperative/,
      /redressement/,
      /\bdip\b/,
      /\bpta\b/,
      /structuration/,
      /ttmk/,
      /\bkmm\b/,
      /\baue\b/,
      /groupement/,
    ],
  },
  {
    id: 'semences',
    label: 'Semences / MCV / revolving',
    famille: 'Économie rurale',
    patterns: [/semence/, /\bmcv\b/, /revolving/, /recouvr/, /post ?-? ?catastrophe/, /intrant/],
  },
  {
    id: 'infrastructures',
    label: 'Infrastructures / PI',
    famille: 'Transversal',
    patterns: [
      /\bpi\b/,
      /perimetre/,
      /barrage/,
      /\bcanal\b/,
      /canaux/,
      /curage/,
      /irrigation/,
      /rehabilit/,
      /chantier/,
      /infrastructure/,
      /construction/,
    ],
  },
  {
    id: 'nutrition',
    label: 'Nutrition / jardins potagers',
    famille: 'Transversal',
    patterns: [/nutrition/, /jardin/, /potager/, /\basn\b/, /\born\b/, /alimentaire/, /malnutrition/],
  },
  {
    id: 'environnement',
    label: 'Environnement / agroécologie',
    famille: 'Transversal',
    patterns: [/environnement/, /reboisement/, /compost/, /agroecolog/, /erosion/, /\bfumure\b/, /fertilisation/],
  },
  {
    id: 'commercialisation',
    label: 'Commercialisation / partenariats',
    famille: 'Économie rurale',
    patterns: [/commercialis/, /couplage/, /\blfl\b/, /\bmarche\b/, /contractualis/, /achat groupe/, /partenaire/],
  },
  {
    id: 'formation',
    label: 'Formation / renforcement',
    famille: 'Structuration',
    patterns: [/formation/, /\bformer\b/, /\bformes?\b/, /renforcement de capacit/, /demonstration/, /leaders? paysan/],
  },
  {
    id: 'coordination',
    label: 'Coordination / réunions',
    famille: 'Pilotage',
    patterns: [/reunion/, /coordination/, /\bstaff\b/, /atelier/, /supervision/],
  },
  {
    id: 'bureau',
    label: 'Bureau / rapportage',
    famille: 'Pilotage',
    patterns: [
      /travail de bureau/,
      /travaux de bureau/,
      /activites? de bureau/,
      /rapport/,
      /planning/,
      /\bbdd\b/,
      /base de donnee/,
      /redaction/,
      /compilation/,
      /saisie/,
    ],
  },
];

export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export const FAMILLES = ['Filières', 'Économie rurale', 'Structuration', 'Transversal', 'Pilotage'] as const;

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Étiquettes thématiques d'un texte libre (multi-étiquette, sans doublon). */
export function classify(...parts: string[]): string[] {
  const text = normalizeText(parts.filter(Boolean).join(' \n '));
  if (!text.trim()) return [];
  const found: string[] = [];
  for (const theme of THEMES) {
    if (theme.patterns.some((p) => p.test(text))) found.push(theme.id);
  }
  return found;
}

export function themeLabel(id: string): string {
  return THEME_BY_ID.get(id)?.label ?? id;
}

export function themeFamille(id: string): string {
  return THEME_BY_ID.get(id)?.famille ?? 'Transversal';
}
