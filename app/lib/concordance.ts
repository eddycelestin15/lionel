import type { CadrageBlock, Periode, PlanningSheet } from '@/types/report';
import { NOM_DES_MOIS } from './format';
import { lieuTokens } from './matching';
import { classify, normalizeText, themeLabel } from './themes';

export type Severity = 'ok' | 'warn' | 'ko';

export interface ConcordanceDimension {
  id: string;
  label: string;
  weight: number;
  /** Score normalisé 0 → 1. */
  score: number;
  status: Severity;
  detail: string;
}

export interface Gap {
  severity: Severity;
  categorie: string;
  message: string;
}

export interface ConcordanceResult {
  total: number;
  dimensions: ConcordanceDimension[];
  gaps: Gap[];
  themesCadrage: string[];
  themesPlanning: string[];
  themesManquants: string[];
  themesHorsCadrage: string[];
}

const statusOf = (score: number): Severity => (score >= 0.8 ? 'ok' : score >= 0.5 ? 'warn' : 'ko');

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Écart relatif ramené à un score : identique = 1, double ou nul = 0. */
function volumeScore(attendu: number, observe: number): number {
  if (!attendu) return observe ? 0.5 : 0;
  const ratio = Math.abs(observe - attendu) / attendu;
  return Math.max(0, 1 - ratio);
}

export function themesOfCadrage(cadrage: CadrageBlock | null): string[] {
  if (!cadrage) return [];
  const set = new Set<string>();
  for (const activity of cadrage.activities) {
    for (const theme of classify(activity.activite, activity.etape, activity.indicateur)) set.add(theme);
  }
  return [...set];
}

export function themesOfPlanning(planning: PlanningSheet | null): string[] {
  if (!planning) return [];
  const set = new Set<string>();
  for (const day of planning.days) {
    if (day.isWeekend) continue;
    for (const theme of classify(day.activite, day.resultat)) set.add(theme);
  }
  return [...set];
}

export function evaluateConcordance(
  planning: PlanningSheet | null,
  cadrage: CadrageBlock | null,
  method: 'nom' | 'commune' | 'aucun',
  periode: Periode,
): ConcordanceResult {
  const gaps: Gap[] = [];
  const dimensions: ConcordanceDimension[] = [];

  const themesCadrage = themesOfCadrage(cadrage);
  const themesPlanning = themesOfPlanning(planning);
  const themesManquants = themesCadrage.filter((t) => !themesPlanning.includes(t));
  const themesHorsCadrage = themesPlanning.filter((t) => !themesCadrage.includes(t));

  /* 1. Appariement des deux documents ------------------------------------ */
  const appariementScore = method === 'nom' ? 1 : method === 'commune' ? 0.6 : 0;
  dimensions.push({
    id: 'appariement',
    label: 'Appariement cadrage / planning',
    weight: 10,
    score: appariementScore,
    status: statusOf(appariementScore),
    detail:
      method === 'nom'
        ? 'Agent identifié dans les deux documents'
        : method === 'commune'
          ? 'Rapproché par commune (nom absent ou divergent)'
          : planning
            ? 'Aucun bloc de cadrage correspondant'
            : 'Cadrage sans planning associé',
  });
  if (method !== 'nom') {
    gaps.push({
      severity: method === 'commune' ? 'warn' : 'ko',
      categorie: 'Appariement',
      message:
        method === 'commune'
          ? 'Rapprochement effectué par commune faute de nom exploitable.'
          : planning
            ? 'Planning sans cadrage : activités non couvertes par les grandes lignes du mois.'
            : 'Cadrage sans planning : aucune traduction opérationnelle du cadrage.',
    });
  }

  /* 2. Cohérence de période ---------------------------------------------- */
  let periodeScore = 0;
  let periodeDetail = 'Période absente du planning';
  if (planning?.periodeStart) {
    if (planning.periodeStart === periode.start) {
      periodeScore = 1;
      periodeDetail = `Période conforme (${periode.start} → ${periode.end})`;
    } else {
      periodeScore = 0;
      periodeDetail = `Période déclarée ${planning.periodeStart} au lieu de ${periode.start}`;
      gaps.push({
        severity: 'ko',
        categorie: 'Période',
        message: `Le planning porte la période ${planning.periodeStart} → ${planning.periodeEnd ?? '?'}, hors du cycle majoritaire de l'équipe.`,
      });
    }
  } else if (planning) {
    gaps.push({ severity: 'warn', categorie: 'Période', message: 'Période non renseignée dans le planning.' });
  }
  // Le mois du cadrage doit lui aussi désigner le mois du cycle.
  const moisAttendu = periode.mois !== undefined ? NOM_DES_MOIS[periode.mois] : null;
  if (cadrage && cadrage.moisRaw && moisAttendu) {
    const attendu = normalizeText(moisAttendu);
    const iso = `${periode.annee}-${String(periode.mois! + 1).padStart(2, '0')}`;
    const declare = normalizeText(cadrage.moisRaw);
    if (!declare.includes(attendu) && !declare.includes(iso)) {
      periodeScore = Math.min(periodeScore, 0.5);
      gaps.push({
        severity: 'warn',
        categorie: 'Période',
        message: `Le cadrage mentionne « ${cadrage.moisRaw} » et non ${moisAttendu} ${periode.annee}.`,
      });
    }
  }
  dimensions.push({
    id: 'periode',
    label: 'Cohérence de période',
    weight: 15,
    score: periodeScore,
    status: statusOf(periodeScore),
    detail: periodeDetail,
  });

  /* 3. Couverture thématique --------------------------------------------- */
  const themeScore = themesCadrage.length
    ? (themesCadrage.length - themesManquants.length) / themesCadrage.length
    : planning
      ? 0
      : 0;
  dimensions.push({
    id: 'themes',
    label: 'Couverture thématique du cadrage',
    weight: 30,
    score: themeScore,
    status: statusOf(themeScore),
    detail: themesCadrage.length
      ? `${themesCadrage.length - themesManquants.length}/${themesCadrage.length} thèmes cadrés repris au planning`
      : 'Aucun thème identifiable dans le cadrage',
  });
  if (themesManquants.length) {
    gaps.push({
      severity: themeScore < 0.5 ? 'ko' : 'warn',
      categorie: 'Thématique',
      message: `Cadré mais absent du planning : ${themesManquants.map(themeLabel).join(', ')}.`,
    });
  }
  if (themesHorsCadrage.length >= 3) {
    gaps.push({
      severity: 'warn',
      categorie: 'Thématique',
      message: `Planifié hors cadrage : ${themesHorsCadrage.map(themeLabel).join(', ')}.`,
    });
  }

  /* 4. Volumétrie terrain ------------------------------------------------- */
  const joursTerrain = planning ? planning.days.filter((d) => !d.isWeekend && d.lieuType === 'Terrain').length : 0;
  const attenduTerrain = cadrage?.indicators.jours_terrain ?? cadrage?.indicators.jours_mission ?? null;
  const volScore = attenduTerrain ? volumeScore(attenduTerrain, joursTerrain) : 0.5;
  dimensions.push({
    id: 'volumetrie',
    label: 'Volumétrie des jours de terrain',
    weight: 20,
    score: volScore,
    status: attenduTerrain ? statusOf(volScore) : 'warn',
    detail: attenduTerrain
      ? `${joursTerrain} jours planifiés pour ${attenduTerrain} jours cadrés`
      : `${joursTerrain} jours planifiés, aucun engagement chiffré au cadrage`,
  });
  if (attenduTerrain && Math.abs(joursTerrain - attenduTerrain) >= 5) {
    gaps.push({
      severity: volScore < 0.5 ? 'ko' : 'warn',
      categorie: 'Volumétrie',
      message: `Écart de ${joursTerrain - attenduTerrain > 0 ? '+' : ''}${joursTerrain - attenduTerrain} jours de terrain entre cadrage (${attenduTerrain}) et planning (${joursTerrain}).`,
    });
  }
  if (!attenduTerrain && cadrage) {
    gaps.push({
      severity: 'warn',
      categorie: 'Volumétrie',
      message: 'Le récapitulatif de cadrage ne chiffre pas les jours de terrain.',
    });
  }

  /* 5. Couverture géographique -------------------------------------------- */
  let geoScore = 0.5;
  let geoDetail = 'Aucun lieu exploitable';
  if (cadrage && planning) {
    const cibles = new Set<string>();
    for (const activity of cadrage.activities) {
      for (const token of lieuTokens(activity.commune || cadrage.commune)) cibles.add(token);
    }
    for (const token of lieuTokens(cadrage.commune)) cibles.add(token);

    const couverts = new Set<string>();
    for (const day of planning.days) {
      for (const token of lieuTokens(`${day.lieu} ${day.itineraire}`)) couverts.add(token);
    }
    for (const token of lieuTokens(planning.commune)) couverts.add(token);

    if (cibles.size) {
      let hits = 0;
      const manquants: string[] = [];
      for (const token of cibles) {
        if (couverts.has(token)) hits += 1;
        else manquants.push(token);
      }
      geoScore = hits / cibles.size;
      geoDetail = `${hits}/${cibles.size} lieux cadrés retrouvés dans les itinéraires`;
      if (geoScore < 0.5 && manquants.length) {
        gaps.push({
          severity: 'warn',
          categorie: 'Géographie',
          message: `Lieux cadrés sans trace dans les itinéraires : ${manquants.slice(0, 6).join(', ')}.`,
        });
      }
    }
  }
  dimensions.push({
    id: 'geographie',
    label: 'Couverture géographique',
    weight: 15,
    score: geoScore,
    status: statusOf(geoScore),
    detail: geoDetail,
  });

  /* 6. Complétude du planning --------------------------------------------- */
  let completude = 1;
  const completudeNotes: string[] = [];
  if (!planning) {
    completude = 0;
    completudeNotes.push('planning absent');
  } else {
    if (planning.days.length !== periode.joursAttendus) {
      completude -= 0.3;
      completudeNotes.push(`${planning.days.length} jours au lieu de ${periode.joursAttendus}`);
      gaps.push({
        severity: 'warn',
        categorie: 'Complétude',
        message: `${planning.days.length} lignes datées au lieu des ${periode.joursAttendus} attendues.`,
      });
    }
    if (!planning.declaredTotals) {
      completude -= 0.2;
      completudeNotes.push('ligne TOTAL absente');
      gaps.push({ severity: 'warn', categorie: 'Complétude', message: 'Ligne TOTAL absente du planning.' });
    }
    const sansType = planning.days.filter((d) => d.lieuType === 'Non précisé').length;
    if (sansType) {
      completude -= Math.min(0.2, sansType * 0.05);
      completudeNotes.push(`${sansType} jour(s) sans bureau/terrain`);
    }
    const sansActivite = planning.days.filter((d) => !d.activite).length;
    if (sansActivite) {
      completude -= Math.min(0.3, sansActivite * 0.05);
      completudeNotes.push(`${sansActivite} jour(s) sans activité`);
      gaps.push({
        severity: 'warn',
        categorie: 'Complétude',
        message: `${sansActivite} journée(s) planifiée(s) sans activité décrite.`,
      });
    }
    if (planning.agentMissing) {
      completude -= 0.2;
      completudeNotes.push('nom de l’agent absent');
      gaps.push({ severity: 'ko', categorie: 'Complétude', message: 'Nom de l’agent absent du planning.' });
    }
  }
  completude = Math.max(0, completude);
  dimensions.push({
    id: 'completude',
    label: 'Complétude du planning',
    weight: 10,
    score: completude,
    status: statusOf(completude),
    detail: completudeNotes.length ? completudeNotes.join(' · ') : 'Planning complet',
  });

  const total = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) /
      dimensions.reduce((sum, d) => sum + d.weight, 0) *
      100,
  );

  return { total, dimensions, gaps, themesCadrage, themesPlanning, themesManquants, themesHorsCadrage };
}

export const formatScoreDetail = pct;
