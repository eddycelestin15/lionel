import 'server-only';

import { cache } from 'react';

import type { CadrageBlock, Fonction, IndicatorKey, Periode, PlanningSheet } from '@/types/report';
import { evaluateConcordance, type ConcordanceResult, type Gap } from './concordance';
import { loadDataset } from './dataset';
import { pairAgents, poleOf } from './matching';
import { classify, normalizeText, THEMES } from './themes';

export interface AgentStats {
  joursPlanifies: number;
  joursTerrain: number;
  joursBureau: number;
  joursNonPrecise: number;
  joursWeekend: number;
  joursOuvres: number;
  tauxTerrain: number;
  km: number;
  litres: number;
  carburantAr: number;
  perdiemAr: number;
  budgetAr: number;
  lieux: string[];
  nbActivitesCadrees: number;
}

export interface AgentReport {
  slug: string;
  nom: string;
  fonction: Fonction;
  pole: string;
  commune: string;
  planning: PlanningSheet | null;
  cadrage: CadrageBlock | null;
  method: 'nom' | 'commune' | 'aucun';
  stats: AgentStats;
  concordance: ConcordanceResult;
  /** Jours de planning portant le thème (un jour peut en porter plusieurs). */
  themeDays: Record<string, number>;
  /** Même chose, pondérée pour que la somme reste égale aux jours ouvrés. */
  themeWeight: Record<string, number>;
  /** Libellés d'activité qu'aucun thème du lexique ne reconnaît. */
  sansTheme: string[];
  indicateurs: Partial<Record<IndicatorKey, number | null>>;
}

export interface ThemeStat {
  id: string;
  label: string;
  famille: string;
  jours: number;
  joursPonderes: number;
  partEffort: number;
  agents: number;
  poles: number;
  /** Agents dont le cadrage porte ce thème. */
  agentsCadre: number;
  /** Agents qui l'ont cadré sans le planifier. */
  agentsManquants: number;
}

export interface PoleStat {
  pole: string;
  agents: number;
  joursTerrain: number;
  joursOuvres: number;
  tauxTerrain: number;
  km: number;
  budgetAr: number;
  scoreMoyen: number;
  eafCadrees: number;
  femmesCadrees: number;
}

export interface GlobalStats {
  agents: number;
  parFonction: Record<string, number>;
  joursPlanifies: number;
  joursTerrain: number;
  joursBureau: number;
  joursNonPrecise: number;
  joursWeekend: number;
  joursOuvres: number;
  tauxTerrain: number;
  km: number;
  litres: number;
  carburantAr: number;
  perdiemAr: number;
  budgetAr: number;
  coutParJourTerrain: number;
  communes: number;
  lieux: number;
  scoreMoyen: number;
  cadrage: {
    eaf: number;
    femmes: number;
    tauxFeminisation: number;
    op: number;
    fokontany: number;
    jardins: number;
    riz: number;
    mais: number;
    joursTerrain: number;
    blocs: number;
  };
}

export interface QualityIssue extends Gap {
  agent: string;
  slug: string;
  pole: string;
}

export interface NonClassees {
  jours: number;
  part: number;
  exemples: { agent: string; slug: string; activite: string }[];
}

export interface Report {
  generatedAt: string;
  cycleId: string;
  periode: Periode;
  source: { cadrage: string; planning: string };
  agents: AgentReport[];
  globals: GlobalStats;
  themes: ThemeStat[];
  themeParPole: { pole: string; valeurs: Record<string, number> }[];
  poles: PoleStat[];
  issues: QualityIssue[];
  timeline: { date: string; terrain: number; bureau: number; weekend: number }[];
  /** Journées dont aucune activité ne correspond au lexique thématique. */
  nonClassees: NonClassees;
}

const sum = (values: (number | null | undefined)[]) =>
  values.reduce<number>((acc, v) => acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0), 0);

/**
 * Bornes de plausibilité des indicateurs de cadrage, à l'échelle d'un agent.
 * Une valeur hors bornes est une erreur de saisie : elle est retirée des
 * agrégats et signalée, plutôt que de fausser silencieusement les totaux.
 */
const PLAUSIBILITE: Partial<Record<IndicatorKey, { max: number; entier: boolean; libelle: string }>> = {
  eaf_appuyees: { max: 3000, entier: true, libelle: 'EAF à appuyer' },
  femmes_appuyees: { max: 2000, entier: true, libelle: 'femmes à appuyer' },
  eaf_nouvelles: { max: 2000, entier: true, libelle: 'EAF à identifier' },
  op_appuyees: { max: 120, entier: true, libelle: 'OP à appuyer' },
  fokontany_visites: { max: 60, entier: true, libelle: 'fokontany à visiter' },
  communes_visitees: { max: 60, entier: true, libelle: 'communes à visiter' },
  cgeaf_appuyes: { max: 60, entier: true, libelle: 'CGEAF à appuyer' },
  jours_terrain: { max: 31, entier: true, libelle: 'jours de terrain' },
  jours_bureau: { max: 31, entier: true, libelle: 'jours de bureau' },
  jours_mission: { max: 31, entier: true, libelle: 'jours de mission' },
  jardins_potagers: { max: 1000, entier: true, libelle: 'jardins potagers' },
  qte_riz: { max: 500_000, entier: false, libelle: 'production de riz (kg)' },
  qte_mais: { max: 500_000, entier: false, libelle: 'production de maïs (kg)' },
  qte_miel: { max: 50_000, entier: false, libelle: 'production de miel (kg)' },
  qte_production: { max: 500_000, entier: false, libelle: 'production agricole (kg)' },
};

interface IndicatorAudit {
  valides: Partial<Record<IndicatorKey, number | null>>;
  suspects: { key: IndicatorKey; value: number; libelle: string; raison: string }[];
}

function auditIndicateurs(indicators: Partial<Record<IndicatorKey, number | null>>): IndicatorAudit {
  const valides: Partial<Record<IndicatorKey, number | null>> = {};
  const suspects: IndicatorAudit['suspects'] = [];

  for (const [rawKey, value] of Object.entries(indicators)) {
    const key = rawKey as IndicatorKey;
    const regle = PLAUSIBILITE[key];
    if (value == null || !regle) {
      valides[key] = value ?? null;
      continue;
    }
    if (value < 0) suspects.push({ key, value, libelle: regle.libelle, raison: 'valeur négative' });
    else if (value > regle.max)
      suspects.push({ key, value, libelle: regle.libelle, raison: `au-delà du plafond plausible (${regle.max})` });
    else if (regle.entier && !Number.isInteger(value))
      suspects.push({ key, value, libelle: regle.libelle, raison: 'valeur non entière pour un décompte' });
    else {
      valides[key] = value;
      continue;
    }
    valides[key] = null;
  }
  return { valides, suspects };
}

function buildAgent(
  planning: PlanningSheet | null,
  cadrage: CadrageBlock | null,
  method: 'nom' | 'commune' | 'aucun',
  pole: string,
  periode: Periode,
): AgentReport {
  const days = planning?.days ?? [];
  const ouvres = days.filter((d) => !d.isWeekend);

  const themeDays: Record<string, number> = {};
  const themeWeight: Record<string, number> = {};
  const sansTheme: string[] = [];
  for (const day of ouvres) {
    const themes = classify(day.activite, day.resultat);
    if (!themes.length) {
      // Vocabulaire inconnu du lexique : conservé pour être signalé, jamais ignoré.
      sansTheme.push(day.activite);
      continue;
    }
    for (const theme of themes) {
      themeDays[theme] = (themeDays[theme] ?? 0) + 1;
      themeWeight[theme] = (themeWeight[theme] ?? 0) + 1 / themes.length;
    }
  }

  const lieux = [
    ...new Set(
      days
        .filter((d) => !d.isWeekend)
        .map((d) => d.lieu.trim())
        .filter((l) => l.length > 2),
    ),
  ];

  const joursTerrain = ouvres.filter((d) => d.lieuType === 'Terrain').length;
  const carburantAr = sum(days.map((d) => d.carburantAr));
  const perdiemAr = sum(days.map((d) => d.perdiemAr));

  const stats: AgentStats = {
    joursPlanifies: days.length,
    joursTerrain,
    joursBureau: ouvres.filter((d) => d.lieuType === 'Bureau').length,
    joursNonPrecise: ouvres.filter((d) => d.lieuType === 'Non précisé').length,
    joursWeekend: days.filter((d) => d.isWeekend).length,
    joursOuvres: ouvres.length,
    tauxTerrain: ouvres.length ? joursTerrain / ouvres.length : 0,
    km: sum(days.map((d) => d.km)),
    litres: sum(days.map((d) => d.litres)),
    carburantAr,
    perdiemAr,
    budgetAr: carburantAr + perdiemAr,
    lieux,
    nbActivitesCadrees: cadrage?.activities.length ?? 0,
  };

  const nom = planning?.agentMissing ? (cadrage?.agent ?? planning.agent) : (planning?.agent ?? cadrage?.agent ?? '—');

  const audit = auditIndicateurs(cadrage?.indicators ?? {});
  const concordance = evaluateConcordance(planning, cadrage, method, periode);
  for (const suspect of audit.suspects) {
    concordance.gaps.push({
      severity: 'warn',
      categorie: 'Indicateur',
      message: `Indicateur hors bornes à l'échelle d'un agent : ${suspect.libelle} = ${suspect.value} (${suspect.raison}). Soit une erreur de saisie, soit un total de pôle placé dans un récapitulatif individuel. Exclu des agrégats.`,
    });
  }

  return {
    slug: planning?.slug ?? cadrage?.slug ?? normalizeText(nom).replace(/\W+/g, '-'),
    nom,
    fonction: planning?.fonction ?? (cadrage?.isTeamSheet ? 'Superviseur' : 'CGEAF'),
    pole,
    commune: planning?.commune || cadrage?.commune || '',
    planning,
    cadrage,
    method,
    stats,
    concordance,
    themeDays,
    themeWeight,
    sansTheme,
    indicateurs: audit.valides,
  };
}

export const buildReport = cache((cycle?: string): Report => {
  const dataset = loadDataset(cycle);
  const { periode } = dataset;
  const pairings = pairAgents(dataset.planning, dataset.cadrage);

  const agents = pairings
    .map((p) => buildAgent(p.planning, p.cadrage, p.method, poleOf(p), periode))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  /* --------------------------------------------------------- agrégats --- */

  const parFonction: Record<string, number> = {};
  for (const agent of agents) parFonction[agent.fonction] = (parFonction[agent.fonction] ?? 0) + 1;

  const joursTerrain = sum(agents.map((a) => a.stats.joursTerrain));
  const carburantAr = sum(agents.map((a) => a.stats.carburantAr));
  const perdiemAr = sum(agents.map((a) => a.stats.perdiemAr));
  const budgetAr = carburantAr + perdiemAr;
  const joursOuvres = sum(agents.map((a) => a.stats.joursOuvres));

  const communes = new Set<string>();
  const lieux = new Set<string>();
  for (const agent of agents) {
    if (agent.commune) communes.add(normalizeText(agent.commune));
    for (const lieu of agent.stats.lieux) lieux.add(normalizeText(lieu));
  }

  const indicatorTotal = (key: IndicatorKey) =>
    sum(agents.filter((a) => !a.cadrage?.isTeamSheet).map((a) => a.indicateurs[key] ?? 0));

  const eaf = indicatorTotal('eaf_appuyees');
  const femmes = indicatorTotal('femmes_appuyees');

  const globals: GlobalStats = {
    agents: agents.length,
    parFonction,
    joursPlanifies: sum(agents.map((a) => a.stats.joursPlanifies)),
    joursTerrain,
    joursBureau: sum(agents.map((a) => a.stats.joursBureau)),
    joursNonPrecise: sum(agents.map((a) => a.stats.joursNonPrecise)),
    joursWeekend: sum(agents.map((a) => a.stats.joursWeekend)),
    joursOuvres,
    tauxTerrain: joursOuvres ? joursTerrain / joursOuvres : 0,
    km: sum(agents.map((a) => a.stats.km)),
    litres: sum(agents.map((a) => a.stats.litres)),
    carburantAr,
    perdiemAr,
    budgetAr,
    coutParJourTerrain: joursTerrain ? budgetAr / joursTerrain : 0,
    communes: communes.size,
    lieux: lieux.size,
    scoreMoyen: agents.length ? agents.reduce((s, a) => s + a.concordance.total, 0) / agents.length : 0,
    cadrage: {
      eaf,
      femmes,
      tauxFeminisation: eaf ? femmes / eaf : 0,
      op: indicatorTotal('op_appuyees'),
      fokontany: indicatorTotal('fokontany_visites'),
      jardins: indicatorTotal('jardins_potagers'),
      riz: indicatorTotal('qte_riz'),
      mais: indicatorTotal('qte_mais'),
      joursTerrain: indicatorTotal('jours_terrain'),
      blocs: agents.filter((a) => a.cadrage).length,
    },
  };

  /* ------------------------------------------------------ thématiques --- */

  const totalPondere = sum(agents.flatMap((a) => Object.values(a.themeWeight)));

  const themes: ThemeStat[] = THEMES.map((theme) => {
    const porteurs = agents.filter((a) => (a.themeDays[theme.id] ?? 0) > 0);
    const cadres = agents.filter((a) => a.concordance.themesCadrage.includes(theme.id));
    return {
      id: theme.id,
      label: theme.label,
      famille: theme.famille,
      jours: sum(agents.map((a) => a.themeDays[theme.id])),
      joursPonderes: sum(agents.map((a) => a.themeWeight[theme.id])),
      partEffort: totalPondere ? sum(agents.map((a) => a.themeWeight[theme.id])) / totalPondere : 0,
      agents: porteurs.length,
      poles: new Set(porteurs.map((a) => a.pole)).size,
      agentsCadre: cadres.length,
      agentsManquants: cadres.filter((a) => a.concordance.themesManquants.includes(theme.id)).length,
    };
  }).sort((a, b) => b.jours - a.jours);

  // Ordre stable, du pôle le plus fourni au plus léger, partagé par toutes les vues.
  const polesPresents = [...new Set(agents.map((a) => a.pole))].sort(
    (a, b) =>
      agents.filter((x) => x.pole === b).length - agents.filter((x) => x.pole === a).length ||
      a.localeCompare(b, 'fr'),
  );
  const themeParPole = polesPresents.map((pole) => {
    const membres = agents.filter((a) => a.pole === pole);
    const valeurs: Record<string, number> = {};
    for (const theme of THEMES) valeurs[theme.id] = sum(membres.map((a) => a.themeDays[theme.id]));
    return { pole, valeurs };
  });

  /* ------------------------------------------------------------ pôles --- */

  const poles: PoleStat[] = polesPresents
    .map((pole) => {
      const membres = agents.filter((a) => a.pole === pole);
      const ouvres = sum(membres.map((a) => a.stats.joursOuvres));
      const terrain = sum(membres.map((a) => a.stats.joursTerrain));
      return {
        pole,
        agents: membres.length,
        joursTerrain: terrain,
        joursOuvres: ouvres,
        tauxTerrain: ouvres ? terrain / ouvres : 0,
        km: sum(membres.map((a) => a.stats.km)),
        budgetAr: sum(membres.map((a) => a.stats.budgetAr)),
        scoreMoyen: membres.length ? membres.reduce((s, a) => s + a.concordance.total, 0) / membres.length : 0,
        eafCadrees: sum(membres.filter((a) => !a.cadrage?.isTeamSheet).map((a) => a.indicateurs.eaf_appuyees ?? 0)),
        femmesCadrees: sum(
          membres.filter((a) => !a.cadrage?.isTeamSheet).map((a) => a.indicateurs.femmes_appuyees ?? 0),
        ),
      };
    })
    .sort((a, b) => b.agents - a.agents);

  /* ---------------------------------------------------------- qualité --- */

  const issues: QualityIssue[] = agents.flatMap((agent) =>
    agent.concordance.gaps.map((gap) => ({ ...gap, agent: agent.nom, slug: agent.slug, pole: agent.pole })),
  );
  const severityRank: Record<string, number> = { ko: 0, warn: 1, ok: 2 };
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.agent.localeCompare(b.agent, 'fr'));

  /* --------------------------------------------------------- calendrier - */

  const byDate = new Map<string, { terrain: number; bureau: number; weekend: number }>();
  for (const agent of agents) {
    for (const day of agent.planning?.days ?? []) {
      if (!day.date) continue;
      const entry = byDate.get(day.date) ?? { terrain: 0, bureau: 0, weekend: 0 };
      if (day.isWeekend) entry.weekend += 1;
      else if (day.lieuType === 'Terrain') entry.terrain += 1;
      else entry.bureau += 1;
      byDate.set(day.date, entry);
    }
  }
  const timeline = [...byDate.entries()]
    .filter(([date]) => date >= periode.start && date <= periode.end)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const joursSansTheme = sum(agents.map((a) => a.sansTheme.length));
  const nonClassees: NonClassees = {
    jours: joursSansTheme,
    part: joursOuvres ? joursSansTheme / joursOuvres : 0,
    exemples: agents
      .flatMap((a) => a.sansTheme.map((activite) => ({ agent: a.nom, slug: a.slug, activite })))
      .filter((e) => e.activite.trim().length > 3)
      .slice(0, 12),
  };

  return {
    generatedAt: dataset.generatedAt,
    cycleId: periode.end.slice(0, 7),
    periode,
    source: dataset.source,
    agents,
    globals,
    themes,
    themeParPole,
    poles,
    issues,
    timeline,
    nonClassees,
  };
});

export const getAgent = cache((slug: string): AgentReport | undefined =>
  buildReport().agents.find((a) => a.slug === slug),
);
