/**
 * Extraction structurelle des classeurs « cadrage » et « planning ».
 *
 * Ce module ne fait QUE de l'extraction : aucune interprétation métier
 * (classification thématique, scores de concordance) n'est faite ici, elle vit
 * dans app/lib/ pour rester ajustable sans réexécuter l'extraction.
 *
 * Il est appelé des deux côtés : par le script `npm run parse` et par la route
 * d'import, qui reçoit les fichiers déposés par l'utilisateur.
 */
import ExcelJS from 'exceljs';

import { NOM_DES_MOIS } from '@/app/lib/format';

import type {
  CadrageBlock,
  Dataset,
  Fonction,
  IndicatorKey,
  LieuType,
  Periode,
  PlanningSheet,
} from '@/types/report';

type Cell = ExcelJS.CellValue;
type Row = Cell[];

/* ------------------------------------------------------------------ utils */

export function cellText(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const rich = value as { richText?: { text: string }[]; result?: Cell; text?: string };
    if (Array.isArray(rich.richText)) return rich.richText.map((r) => r.text).join('');
    if ('result' in rich) return cellText(rich.result ?? null);
    if ('text' in rich && rich.text !== undefined) return String(rich.text);
    return '';
  }
  return String(value);
}

/** Beaucoup d'en-têtes sont stockés en texte enrichi : passer par cellText. */
export const norm = (v: Cell): string =>
  cellText(v)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export function clean(value: Cell): string {
  return cellText(value).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

export function toNumber(value: Cell): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return toNumber((value as { result?: Cell }).result ?? null);
  }
  const txt = cellText(value)
    .replace(/ | /g, ' ')
    .replace(/[^\d,.-]/g, '');
  if (!txt) return null;
  const normalized =
    txt.includes(',') && !txt.includes('.') ? txt.replace(',', '.') : txt.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function toDate(value: Cell): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return toDate((value as { result?: Cell }).result ?? null);
  }
  const txt = clean(value);
  if (!txt) return null;
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const fr = txt.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (fr) {
    const year = +fr[3] < 100 ? 2000 + +fr[3] : +fr[3];
    return new Date(Date.UTC(year, +fr[2] - 1, +fr[1]));
  }
  return null;
}

const isoDay = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function slugify(value: string): string {
  return norm(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/** Lit une feuille en matrice de valeurs brutes (index 0 = colonne A). */
function sheetMatrix(ws: ExcelJS.Worksheet, maxCols: number): Row[] {
  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: Row = [];
    for (let c = 1; c <= maxCols; c += 1) values.push(row.getCell(c).value);
    rows[rowNumber - 1] = values;
  });
  for (let i = 0; i < rows.length; i += 1) if (!rows[i]) rows[i] = new Array(maxCols).fill(null);
  return rows;
}

const rowIsEmpty = (row: Row) => row.every((c) => clean(c) === '');

/** Première valeur non vide à droite de la colonne c. */
function valueAfter(row: Row, c: number): string {
  for (let k = c + 1; k < row.length; k += 1) {
    const v = clean(row[k]);
    if (v) return v;
  }
  return '';
}

/* -------------------------------------------------------------- périodes  */

const MOIS: [string, number][] = [
  ['janv', 0],
  ['fevr', 1],
  ['fev', 1],
  ['mars', 2],
  ['avr', 3],
  ['mai', 4],
  ['juin', 5],
  ['juil', 6],
  ['aout', 7],
  ['sept', 8],
  ['octo', 9],
  ['oct', 9],
  ['nov', 10],
  ['dec', 11],
];

/**
 * Les périodes sont saisies librement : « 23/09/2026 au 22/10/2026 »,
 * « Du 23 Septembre au 22 Octobre 2026 », « 23 SEPT AU 22 OCT 2026 »…
 */
export function parsePeriode(raw: string): { start: string | null; end: string | null } {
  // « 22/10/ 2026 » : espaces parasites autour des séparateurs.
  const txt = clean(raw).replace(/\s*([/.])\s*/g, '$1');
  const nums = txt.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/g);
  if (nums && nums.length >= 2) {
    return { start: isoDay(toDate(nums[0])), end: isoDay(toDate(nums[1])) };
  }

  const n = norm(txt);
  const found: { day: number; month: number; year: number | null }[] = [];
  const re = /(\d{1,2})\s*(?:er)?\s+([a-z]+)\.?\s*(\d{4})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n)) !== null) {
    const month = MOIS.find(([prefix]) => m![2].startsWith(prefix));
    if (!month) continue;
    found.push({ day: +m[1], month: month[1], year: m[3] ? +m[3] : null });
  }
  if (found.length < 2) return { start: null, end: null };

  const [a, b] = found;
  // L'année n'est souvent portée que par la seconde borne.
  const year = a.year ?? b.year;
  if (!year) return { start: null, end: null };
  const endYear = b.year ?? (b.month < a.month ? year + 1 : year);
  return {
    start: isoDay(new Date(Date.UTC(year, a.month, a.day))),
    end: isoDay(new Date(Date.UTC(endYear, b.month, b.day))),
  };
}

const joursEntre = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;

/**
 * La période du cycle n'est pas une constante : elle est déduite des feuilles.
 * La période majoritaire fait référence, et ce sont les feuilles minoritaires
 * qui sont signalées — et non l'inverse, qui figerait l'outil sur un mois.
 */
export function detectPeriode(sheets: PlanningSheet[]): Periode {
  const votes = new Map<string, number>();
  for (const sheet of sheets) {
    if (!sheet.periodeStart || !sheet.periodeEnd) continue;
    const key = `${sheet.periodeStart}|${sheet.periodeEnd}`;
    votes.set(key, (votes.get(key) ?? 0) + 1);
  }

  let start: string | null = null;
  let end: string | null = null;
  let couverture = 0;

  if (votes.size) {
    const [key, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    [start, end] = key.split('|');
    couverture = count;
  } else {
    // Aucune période exploitable en en-tête : on retombe sur les dates saisies.
    const dates = sheets.flatMap((s) => s.days.map((d) => d.date).filter(Boolean) as string[]).sort();
    start = dates[0] ?? null;
    end = dates[dates.length - 1] ?? null;
  }

  if (!start || !end) {
    const today = new Date().toISOString().slice(0, 10);
    return { start: today, end: today, libelle: 'Période inconnue', joursAttendus: 30, couverture: 0, sheets: sheets.length };
  }

  // Un cycle court du 23 d'un mois au 22 du suivant : c'est le mois de fin qui le nomme.
  const fin = new Date(end);
  return {
    start,
    end,
    libelle: `${NOM_DES_MOIS[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`,
    mois: fin.getUTCMonth(),
    annee: fin.getUTCFullYear(),
    joursAttendus: joursEntre(start, end),
    couverture,
    sheets: sheets.length,
  };
}

/* -------------------------------------------------------------- planning  */

const FONCTIONS: [RegExp, Fonction][] = [
  [/responsable technique|^rt$/, 'RT'],
  [/superviseur|^sup/, 'Superviseur'],
  [/rse/, 'RSE'],
  [/cgeaf/, 'CGEAF'],
];

function detectFonction(raw: string, sheetName: string): Fonction {
  const n = norm(raw);
  for (const [re, value] of FONCTIONS) if (n && re.test(n)) return value;
  const s = norm(sheetName);
  for (const [re, value] of FONCTIONS) if (re.test(s)) return value;
  return 'CGEAF';
}

/** Libellés combinés en-tête + sous-en-tête, pour retrouver chaque colonne. */
function buildPlanningColumns(rows: Row[], headerIdx: number) {
  const header = rows[headerIdx] ?? [];
  const sub = rows[headerIdx + 1] ?? [];
  const labels = header.map((h, i) => `${norm(h)} ${norm(sub[i])}`.trim());

  const find = (...tests: RegExp[]) => {
    for (const test of tests) {
      const idx = labels.findIndex((l) => l && test.test(l));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  return {
    activite: find(/^activit/, /activit/),
    resultat: find(/resultat/),
    lieuType: find(/bureau ?\/? ?terrain/, /^bureau/),
    date: find(/^date/, /\bdate\b/),
    lieu: find(/fokontany|fokotany|fonkotany|\bfkt\b/, /^commune/),
    itineraire: find(/itiner/),
    km: find(/parcours/),
    litres: find(/consommation/),
    carburant: find(/carburant/),
    perdiemJours: find(/perdiem nombre du jour/, /^nombre du jour$/),
    perdiemPU: find(/perdiem pu/, /(^| )pu$/),
    perdiemMontant: find(/perdiem montant/, /^montant \(ar\)/),
    total: find(/^total$/, /^total /),
    observation: find(/observation/),
  };
}

type PlanningColumns = ReturnType<typeof buildPlanningColumns>;

function parsePlanningSheet(ws: ExcelJS.Worksheet): PlanningSheet | null {
  const maxCols = Math.min(Math.max(ws.columnCount || 20, 20), 30);
  const rows = sheetMatrix(ws, maxCols);

  const meta = { periodeRaw: '', agent: '', fonctionRaw: '', zone: '', commune: '' };
  let headerIdx = -1;

  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const row = rows[i];
    for (let c = 0; c < row.length; c += 1) {
      const label = norm(row[c]);
      if (!label) continue;
      if (/^periode/.test(label) && !meta.periodeRaw) meta.periodeRaw = valueAfter(row, c);
      else if (/^agent/.test(label) && !meta.agent) meta.agent = valueAfter(row, c);
      else if (/^fonction/.test(label) && !meta.fonctionRaw) meta.fonctionRaw = valueAfter(row, c);
      else if (/^zone d/.test(label) && !meta.zone) meta.zone = valueAfter(row, c);
      else if (/^commune d/.test(label) && !meta.commune) meta.commune = valueAfter(row, c);
    }
    if (headerIdx === -1 && /^activit/.test(norm(row[0]))) headerIdx = i;
  }

  // Certaines feuilles décalent le tableau d'une colonne : recherche élargie.
  if (headerIdx === -1) {
    for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
      if (rows[i].some((c) => /^activit/.test(norm(c)))) {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx === -1) return null;

  const cols = buildPlanningColumns(rows, headerIdx);
  const at = (row: Row, key: keyof PlanningColumns) => (cols[key] >= 0 ? row[cols[key]] : null);

  const days: PlanningSheet['days'] = [];
  let dropped = 0;
  let declaredTotals: PlanningSheet['declaredTotals'] = null;

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (rowIsEmpty(row)) continue;

    if (norm(row[0]) === 'total' || norm(row[0]) === 'totaux') {
      declaredTotals = {
        km: toNumber(at(row, 'km')),
        litres: toNumber(at(row, 'litres')),
        carburantAr: toNumber(at(row, 'carburant')),
        perdiemJours: toNumber(at(row, 'perdiemJours')),
        perdiemAr: toNumber(at(row, 'perdiemMontant')),
        totalAr: toNumber(at(row, 'total')),
      };
      break;
    }

    const date = toDate(at(row, 'date'));
    const activite = clean(at(row, 'activite'));
    if (!date) {
      // Lignes de visa / signature sous le tableau : comptées pour le contrôle qualité.
      if (activite && days.length) dropped += 1;
      continue;
    }

    const lieuTypeRaw = norm(at(row, 'lieuType'));
    const lieuType: LieuType = /terrain/.test(lieuTypeRaw)
      ? 'Terrain'
      : /bureau/.test(lieuTypeRaw)
        ? 'Bureau'
        : 'Non précisé';

    days.push({
      date: isoDay(date),
      activite,
      resultat: clean(at(row, 'resultat')),
      lieuType,
      lieu: clean(at(row, 'lieu')),
      itineraire: clean(at(row, 'itineraire')),
      km: toNumber(at(row, 'km')) ?? 0,
      litres: toNumber(at(row, 'litres')) ?? 0,
      carburantAr: toNumber(at(row, 'carburant')) ?? 0,
      perdiemJours: toNumber(at(row, 'perdiemJours')) ?? 0,
      perdiemAr: toNumber(at(row, 'perdiemMontant')) ?? 0,
      totalAr: toNumber(at(row, 'total')) ?? 0,
      observation: clean(at(row, 'observation')),
      isWeekend: /week[\s-]*end/i.test(activite),
    });
  }

  const periode = parsePeriode(meta.periodeRaw);

  return {
    slug: slugify(ws.name),
    sheet: ws.name.trim(),
    agent: meta.agent || `(non renseigné) ${ws.name.trim()}`,
    agentMissing: !meta.agent,
    fonction: detectFonction(meta.fonctionRaw, ws.name),
    fonctionRaw: meta.fonctionRaw,
    zone: meta.zone,
    commune: meta.commune || meta.zone,
    periodeRaw: meta.periodeRaw,
    periodeStart: periode.start,
    periodeEnd: periode.end,
    hasPerdiem: cols.perdiemMontant >= 0,
    droppedRows: dropped,
    days,
    declaredTotals,
  };
}

/* --------------------------------------------------------------- cadrage  */

const INDICATOR_UNITS = /^(nombres?|nbres?|nbre|nbr|nb|kg|kgs|%|ar|ariary)$/;
const INDICATOR_LABEL =
  /(nombres?|nbres?|nbre|\bnb\b|quantite|taux|effectif|\beaf\b|\bfkt\b|\bop\b|\bopb\b|fokontany|jours?|jardin)/;

/**
 * Une ligne de récapitulatif porte un libellé court + une unité + une valeur.
 * Certaines feuilles omettent l'unité et décalent la valeur dans sa colonne :
 * ce décalage est rattrapé ici.
 */
function asIndicatorRow(label: string, unit: Cell, value: Cell) {
  const nLabel = norm(label);
  if (!nLabel || nLabel.length > 70) return null;
  if (/\n\s*\S/.test(label)) return null; // les vraies activités sont multi-lignes
  if (!INDICATOR_LABEL.test(nLabel)) return null;

  let unitCell = unit;
  let valueCell = value;
  if (clean(value) === '' && toNumber(unit) !== null && !/[a-z]/.test(norm(unit))) {
    valueCell = unit;
    unitCell = null;
  }
  const nUnit = norm(unitCell);
  if (nUnit && !INDICATOR_UNITS.test(nUnit)) return null;

  const parsed = toNumber(valueCell);
  if (parsed === null && clean(valueCell) !== '') return null;
  return { label: clean(label), unit: clean(unitCell), value: parsed };
}

const INDICATOR_KEYS: [IndicatorKey, RegExp][] = [
  ['fokontany_visites', /fkt|fokontany|fonkotany/],
  ['communes_visitees', /\bcr\b|commune/],
  ['femmes_appuyees', /femmes?/],
  ['eaf_nouvelles', /nouvellement|nouvelles?|a identifier/],
  ['eaf_appuyees', /eaf/],
  ['op_appuyees', /\bop\b|\bopb\b|groupement|organisation/],
  ['cgeaf_appuyes', /cgeaf/],
  ['jardins_potagers', /jardin/],
  ['qte_riz', /riz/],
  ['qte_mais', /mais/],
  ['qte_miel', /miel/],
  ['mcv_taux', /mcv|remboursement|recouvr/],
  ['qte_production', /production|produite/],
  ['jours_terrain', /terrain/],
  ['jours_bureau', /bureau/],
  ['jours_mission', /mission|jours?/],
];

function indicatorKey(label: string): IndicatorKey | null {
  const n = norm(label);
  for (const [key, re] of INDICATOR_KEYS) if (re.test(n)) return key;
  return null;
}

function findCadrageHeader(row: Row) {
  const cells = row.map((c) => norm(c));
  const has = (re: RegExp) => cells.findIndex((c) => c && re.test(c));
  const activite = has(/^activites? ?(et|\/)? ?(themes?|theme|prevues)?$/);
  if (activite === -1) return null;
  // Un en-tête porte toujours au moins une autre colonne repère.
  if (has(/^indicateur/) === -1 && has(/^nom et pre/) === -1 && has(/^etape/) === -1) return null;
  return {
    numero: has(/^n°$|^n$|^no$/),
    pole: has(/^pole/),
    cr: has(/^cr$|^commune/),
    nom: has(/^nom et pre|^nom$/),
    tel: has(/^tel/),
    activite,
    etape: has(/^etape/),
    indicateur: has(/^indicateur/),
  };
}

type CadrageColumns = NonNullable<ReturnType<typeof findCadrageHeader>>;

const NOT_A_NAME =
  /^(recapitulation|recapitulatif|total|superviseur|pole de developpement|nom et pre|nom$|activites?|indicateur|etape|n°)/;

interface CadrageDraft {
  agent: string;
  pole: string;
  commune: string;
  activities: CadrageBlock['activities'];
  rawIndicators: CadrageBlock['rawIndicators'];
}

function parseCadrageSheet(ws: ExcelJS.Worksheet): CadrageBlock[] {
  const maxCols = Math.min(Math.max(ws.columnCount || 12, 12), 20);
  const rows = sheetMatrix(ws, maxCols);

  const meta = { mois: '', agent: '', poste: '' };
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const row = rows[i];
    for (let c = 0; c < row.length; c += 1) {
      const label = norm(row[c]);
      if (!label) continue;
      if (/^mois/.test(label) && !meta.mois) meta.mois = valueAfter(row, c) || clean(row[c]);
      else if (/^nom et pre/.test(label) && !meta.agent) meta.agent = valueAfter(row, c);
      else if (/^poste/.test(label) && !meta.poste) meta.poste = valueAfter(row, c) || clean(row[c]);
    }
  }

  let blocks: CadrageDraft[] = [];
  let cols: CadrageColumns | null = null;
  let current: CadrageDraft | null = null;

  const pushCurrent = () => {
    if (current && (current.activities.length || current.rawIndicators.length)) blocks.push(current);
    current = null;
  };

  const newBlock = (nom: string, pole: string, cr: string): CadrageDraft => ({
    agent: nom,
    pole,
    commune: cr,
    activities: [],
    rawIndicators: [],
  });

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (rowIsEmpty(row)) continue;

    const header = findCadrageHeader(row);
    if (header) {
      cols = header;
      pushCurrent();
      continue;
    }
    if (!cols) continue;

    const get = (key: keyof CadrageColumns) => (cols![key] >= 0 ? row[cols![key]] : null);
    const activite = clean(get('activite'));
    const etape = clean(get('etape'));
    const indicateur = clean(get('indicateur'));
    // Un nom tient sur une ligne ; une commune n'est jamais un libellé de tableau.
    const nom = clean(get('nom')).replace(/\s*\n\s*/g, ' ');
    const pole = clean(get('pole'));
    const crBrut = clean(get('cr'));
    const cr = NOT_A_NAME.test(norm(crBrut)) ? '' : crBrut;

    if (nom && !NOT_A_NAME.test(norm(nom))) {
      if (!current || norm(current.agent) !== norm(nom)) {
        pushCurrent();
        current = newBlock(nom, pole, cr);
      }
    }

    if (!current) current = newBlock(meta.agent || '', pole, cr);
    if (pole && !current.pole) current.pole = pole;
    if (cr && !current.commune) current.commune = cr;

    const indicator = asIndicatorRow(activite, etape, indicateur);
    if (indicator) {
      current.rawIndicators.push(indicator);
      continue;
    }

    if (activite || indicateur) {
      current.activities.push({
        numero: clean(get('numero')),
        activite,
        etape,
        indicateur,
        commune: cr || current.commune,
      });
    }
  }
  pushCurrent();

  // Un en-tête réintercalé peut scinder un même agent en deux blocs.
  const merged: CadrageDraft[] = [];
  for (const block of blocks) {
    const twin = block.agent ? merged.find((b) => norm(b.agent) === norm(block.agent)) : undefined;
    if (twin) {
      twin.activities.push(...block.activities);
      twin.rawIndicators.push(...block.rawIndicators);
      twin.pole = twin.pole || block.pole;
      twin.commune = twin.commune || block.commune;
    } else {
      merged.push(block);
    }
  }
  blocks = merged;

  const isTeamSheet = blocks.length <= 1;

  return blocks.map((block, idx) => {
    const indicators: CadrageBlock['indicators'] = {};
    for (const raw of block.rawIndicators) {
      const key = indicatorKey(raw.label);
      if (!key) continue;
      if (indicators[key] === undefined || indicators[key] === null) indicators[key] = raw.value;
    }
    const agent = block.agent || meta.agent;
    return {
      slug: slugify(`${ws.name}-${agent || idx}`),
      sheet: ws.name.trim(),
      agent: agent || `(non renseigné) ${ws.name.trim()}`,
      agentMissing: !agent,
      poste: meta.poste,
      moisRaw: meta.mois,
      pole: block.pole,
      commune: block.commune,
      isTeamSheet,
      activities: block.activities,
      rawIndicators: block.rawIndicators,
      indicators,
    };
  });
}

/* ------------------------------------------------------------------ API   */

export interface ParseInput {
  cadrage: ArrayBuffer | Buffer;
  planning: ArrayBuffer | Buffer;
  noms: { cadrage: string; planning: string };
}

export interface ParseLog {
  sheet: string;
  type: 'cadrage' | 'planning';
  resultat: string;
  ok: boolean;
}

export interface ParseResult {
  dataset: Dataset;
  logs: ParseLog[];
}

async function readWorkbook(data: ArrayBuffer | Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

export async function parseWorkbooks({ cadrage, planning, noms }: ParseInput): Promise<ParseResult> {
  const logs: ParseLog[] = [];

  const cadrageWb = await readWorkbook(cadrage);
  const blocs: CadrageBlock[] = [];
  for (const ws of cadrageWb.worksheets) {
    const parsed = parseCadrageSheet(ws);
    blocs.push(...parsed);
    logs.push({
      sheet: ws.name.trim(),
      type: 'cadrage',
      resultat: `${parsed.length} bloc(s) d'agent`,
      ok: parsed.length > 0,
    });
  }

  const planningWb = await readWorkbook(planning);
  const feuilles: PlanningSheet[] = [];
  for (const ws of planningWb.worksheets) {
    const parsed = parsePlanningSheet(ws);
    if (!parsed) {
      logs.push({ sheet: ws.name.trim(), type: 'planning', resultat: 'en-tête introuvable, feuille ignorée', ok: false });
      continue;
    }
    feuilles.push(parsed);
    logs.push({ sheet: ws.name.trim(), type: 'planning', resultat: `${parsed.days.length} journée(s)`, ok: true });
  }

  if (!feuilles.length) {
    throw new Error(
      "Aucune feuille de planning exploitable : vérifiez que le classeur contient bien un tableau avec une colonne « Activités ».",
    );
  }
  if (!blocs.length) {
    throw new Error(
      "Aucun bloc de cadrage exploitable : vérifiez que le classeur contient bien un tableau « Activités et thèmes ».",
    );
  }

  const periode = detectPeriode(feuilles);

  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    source: { cadrage: noms.cadrage, planning: noms.planning },
    periode,
    cadrage: blocs,
    planning: feuilles,
  };

  return { dataset, logs };
}
