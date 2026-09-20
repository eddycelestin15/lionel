/** Contrat de données entre scripts/parse-excel.mjs et l'application. */

export type Fonction = 'RT' | 'Superviseur' | 'CGEAF' | 'RSE';
export type LieuType = 'Terrain' | 'Bureau' | 'Non précisé';

export interface PlanningDay {
  date: string | null;
  activite: string;
  resultat: string;
  lieuType: LieuType;
  lieu: string;
  itineraire: string;
  km: number;
  litres: number;
  carburantAr: number;
  perdiemJours: number;
  perdiemAr: number;
  totalAr: number;
  observation: string;
  isWeekend: boolean;
}

export interface PlanningTotals {
  km: number | null;
  litres: number | null;
  carburantAr: number | null;
  perdiemJours: number | null;
  perdiemAr: number | null;
  totalAr: number | null;
}

export interface PlanningSheet {
  slug: string;
  sheet: string;
  agent: string;
  agentMissing: boolean;
  fonction: Fonction;
  fonctionRaw: string;
  zone: string;
  commune: string;
  periodeRaw: string;
  periodeStart: string | null;
  periodeEnd: string | null;
  hasPerdiem: boolean;
  droppedRows: number;
  days: PlanningDay[];
  declaredTotals: PlanningTotals | null;
}

export interface CadrageActivity {
  numero: string;
  activite: string;
  etape: string;
  indicateur: string;
  commune: string;
}

export interface CadrageIndicator {
  label: string;
  unit: string;
  value: number | null;
}

/** Clés d'indicateurs normalisées du récapitulatif de cadrage. */
export type IndicatorKey =
  | 'fokontany_visites'
  | 'communes_visitees'
  | 'femmes_appuyees'
  | 'eaf_nouvelles'
  | 'eaf_appuyees'
  | 'op_appuyees'
  | 'cgeaf_appuyes'
  | 'jardins_potagers'
  | 'qte_riz'
  | 'qte_mais'
  | 'qte_miel'
  | 'mcv_taux'
  | 'qte_production'
  | 'jours_terrain'
  | 'jours_bureau'
  | 'jours_mission';

export interface CadrageBlock {
  slug: string;
  sheet: string;
  agent: string;
  agentMissing: boolean;
  poste: string;
  moisRaw: string;
  pole: string;
  commune: string;
  isTeamSheet: boolean;
  activities: CadrageActivity[];
  rawIndicators: CadrageIndicator[];
  indicators: Partial<Record<IndicatorKey, number | null>>;
}

/** Période du cycle, déduite des feuilles et non figée dans le code. */
export interface Periode {
  start: string;
  end: string;
  /** « Octobre 2026 » — nommé par le mois de fin du cycle. */
  libelle: string;
  mois?: number;
  annee?: number;
  joursAttendus: number;
  /** Nombre de feuilles portant cette période. */
  couverture: number;
  /** Nombre total de feuilles de planning. */
  sheets: number;
}

export interface Dataset {
  generatedAt: string;
  source: { cadrage: string; planning: string };
  periode: Periode;
  cadrage: CadrageBlock[];
  planning: PlanningSheet[];
}
