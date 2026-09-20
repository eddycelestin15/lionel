import 'server-only';

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { cache } from 'react';

import type { Dataset } from '@/types/report';

export const DATA_DIR = path.join(process.cwd(), 'data');
const POINTEUR = path.join(DATA_DIR, 'active.json');

/** Fiche d'un cycle stocké, sans charger tout le jeu de données. */
export interface CycleEntry {
  id: string;
  libelle: string;
  periodeStart: string;
  periodeEnd: string;
  generatedAt: string;
  agents: number;
  source: { cadrage: string; planning: string };
}

const fichierDe = (id: string) => path.join(DATA_DIR, `cycle-${id}.json`);

/** Identifiant d'un cycle : l'année-mois de sa date de fin. */
export function cycleId(dataset: Dataset): string {
  return dataset.periode.end.slice(0, 7);
}

function lire(file: string): Dataset | null {
  try {
    const dataset = JSON.parse(readFileSync(file, 'utf8')) as Dataset;
    return dataset.periode ? dataset : null;
  } catch {
    return null;
  }
}

/** Cycles disponibles, du plus récent au plus ancien. */
export const listCycles = cache((): CycleEntry[] => {
  if (!existsSync(DATA_DIR)) return [];
  const entries: CycleEntry[] = [];
  for (const nom of readdirSync(DATA_DIR)) {
    const found = nom.match(/^cycle-(.+)\.json$/);
    if (!found) continue;
    const dataset = lire(path.join(DATA_DIR, nom));
    if (!dataset) continue;
    entries.push({
      id: found[1],
      libelle: dataset.periode.libelle,
      periodeStart: dataset.periode.start,
      periodeEnd: dataset.periode.end,
      generatedAt: dataset.generatedAt,
      agents: dataset.planning.length,
      source: dataset.source,
    });
  }
  return entries.sort((a, b) => b.periodeEnd.localeCompare(a.periodeEnd));
});

/** Cycle sélectionné : le pointeur s'il est valide, sinon le plus récent. */
export const activeCycleId = cache((): string | null => {
  const cycles = listCycles();
  if (!cycles.length) return null;
  try {
    const { id } = JSON.parse(readFileSync(POINTEUR, 'utf8')) as { id: string };
    if (cycles.some((c) => c.id === id)) return id;
  } catch {
    // pointeur absent ou illisible : on retombe sur le cycle le plus récent
  }
  return cycles[0].id;
});

export const loadDataset = cache((id?: string): Dataset => {
  const cible = id ?? activeCycleId();
  if (!cible) {
    throw new Error(
      "Aucun cycle n'est disponible. Importez une paire de classeurs depuis la page Import, ou lancez `npm run parse`.",
    );
  }
  const dataset = lire(fichierDe(cible));
  if (!dataset) throw new Error(`Cycle « ${cible} » introuvable ou illisible.`);
  return dataset;
});

export const hasDataset = (): boolean => listCycles().length > 0;

/* --------------------------------------------------------------- écriture */

export function saveDataset(dataset: Dataset): string {
  mkdirSync(DATA_DIR, { recursive: true });
  const id = cycleId(dataset);
  writeFileSync(fichierDe(id), JSON.stringify(dataset), 'utf8');
  return id;
}

export function setActiveCycle(id: string): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(POINTEUR, JSON.stringify({ id }), 'utf8');
}
