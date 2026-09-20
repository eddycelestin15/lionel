import { revalidatePath } from 'next/cache';

import { saveDataset, setActiveCycle } from '@/app/lib/dataset';
import { parseWorkbooks, type ParseLog } from '@/app/lib/parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_OCTETS = 40 * 1024 * 1024;

export interface ImportResponse {
  ok: boolean;
  message: string;
  resume?: {
    cycleId: string;
    libelle: string;
    start: string;
    end: string;
    couverture: number;
    sheets: number;
    joursAttendus: number;
    plannings: number;
    blocsCadrage: number;
  };
  avertissements?: ParseLog[];
}

function lireFichier(form: FormData, champ: string, role: string): File {
  const fichier = form.get(champ);
  if (!(fichier instanceof File) || fichier.size === 0) {
    throw new Error(`Le classeur ${role} est manquant.`);
  }
  if (!/\.xlsx$/i.test(fichier.name)) {
    throw new Error(`Le classeur ${role} doit être un fichier .xlsx (reçu : ${fichier.name}).`);
  }
  if (fichier.size > MAX_OCTETS) {
    throw new Error(`Le classeur ${role} dépasse 40 Mo.`);
  }
  return fichier;
}

/**
 * Import d'une paire de classeurs.
 *
 * Volontairement une route et non une action serveur : celles-ci plafonnent le
 * corps de requête à 1 Mo, quand un classeur de planning en pèse plusieurs.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const cadrage = lireFichier(form, 'cadrage', 'de cadrage');
    const planning = lireFichier(form, 'planning', 'de planning');

    const { dataset, logs } = await parseWorkbooks({
      cadrage: await cadrage.arrayBuffer(),
      planning: await planning.arrayBuffer(),
      noms: { cadrage: cadrage.name, planning: planning.name },
    });

    const cycleId = saveDataset(dataset);
    setActiveCycle(cycleId);
    revalidatePath('/', 'layout');

    const { periode } = dataset;
    const body: ImportResponse = {
      ok: true,
      message: `Cycle « ${periode.libelle} » importé et sélectionné.`,
      resume: {
        cycleId,
        libelle: periode.libelle,
        start: periode.start,
        end: periode.end,
        couverture: periode.couverture,
        sheets: periode.sheets,
        joursAttendus: periode.joursAttendus,
        plannings: dataset.planning.length,
        blocsCadrage: dataset.cadrage.length,
      },
      avertissements: logs.filter((l) => !l.ok),
    };
    return Response.json(body);
  } catch (error) {
    const body: ImportResponse = {
      ok: false,
      message: error instanceof Error ? error.message : "L'import a échoué.",
    };
    return Response.json(body, { status: 400 });
  }
}
