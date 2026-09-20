/**
 * Extraction en ligne de commande.
 *
 *   npm run parse                          # détecte CADRAGE_*.xlsx / PL_*.xlsx
 *   npm run parse -- cadrage.xlsx pl.xlsx  # chemins explicites
 *
 * Le dossier source est le parent du projet, ou TTMR_SOURCE_DIR.
 * Le résultat est écrit dans data/cycle-<AAAA-MM>.json, nommé d'après la
 * période déduite des feuilles : rien n'est figé sur un mois donné.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

import { parseWorkbooks } from '../app/lib/parser/index.ts';

const SOURCE_DIR = process.env.TTMR_SOURCE_DIR || path.resolve(process.cwd(), '..');
const DATA_DIR = path.resolve(process.cwd(), 'data');

/** Retrouve un classeur par motif, pour ne pas coder son nom en dur. */
function trouver(motif: RegExp, role: string): string {
  if (!existsSync(SOURCE_DIR)) throw new Error(`Dossier source introuvable : ${SOURCE_DIR}`);
  const candidats = readdirSync(SOURCE_DIR)
    .filter((f) => motif.test(f) && /\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .sort();
  if (!candidats.length) {
    throw new Error(
      `Aucun classeur ${role} trouvé dans ${SOURCE_DIR} (motif ${motif}). ` +
        `Passez les chemins en arguments : npm run parse -- <cadrage.xlsx> <planning.xlsx>`,
    );
  }
  if (candidats.length > 1) {
    console.warn(`  ! plusieurs classeurs ${role} : ${candidats.join(', ')} — le dernier est retenu`);
  }
  return path.join(SOURCE_DIR, candidats[candidats.length - 1]);
}

async function main() {
  const [argCadrage, argPlanning] = process.argv.slice(2);

  const cadragePath = argCadrage ? path.resolve(argCadrage) : trouver(/^CADRAGE/i, 'de cadrage');
  const planningPath = argPlanning ? path.resolve(argPlanning) : trouver(/^PL[_ -]/i, 'de planning');

  console.log(`Cadrage  : ${cadragePath}`);
  console.log(`Planning : ${planningPath}\n`);

  const { dataset, logs } = await parseWorkbooks({
    cadrage: readFileSync(cadragePath),
    planning: readFileSync(planningPath),
    noms: { cadrage: path.basename(cadragePath), planning: path.basename(planningPath) },
  });

  for (const log of logs) {
    const prefixe = log.ok ? '  ' : '  ! ';
    console.log(`${prefixe}${log.type.padEnd(8)} ${log.sheet.padEnd(32)} ${log.resultat}`);
  }

  const { periode } = dataset;
  const id = periode.end.slice(0, 7);
  mkdirSync(DATA_DIR, { recursive: true });
  const out = path.join(DATA_DIR, `cycle-${id}.json`);
  writeFileSync(out, JSON.stringify(dataset), 'utf8');
  writeFileSync(path.join(DATA_DIR, 'active.json'), JSON.stringify({ id }), 'utf8');

  console.log(
    `\nPériode déduite : ${periode.libelle} (${periode.start} → ${periode.end}), ` +
      `${periode.joursAttendus} jours attendus, ${periode.couverture}/${periode.sheets} feuilles concordantes.`,
  );
  console.log(`${dataset.cadrage.length} blocs de cadrage, ${dataset.planning.length} plannings -> ${path.relative(process.cwd(), out)}`);
}

main().catch((error) => {
  console.error(`\nÉchec : ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
