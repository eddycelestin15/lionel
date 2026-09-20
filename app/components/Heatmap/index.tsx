import { cn } from '@/lib/utils';

export interface HeatmapProps {
  /** Intitulés de colonnes (pôles). */
  columns: string[];
  rows: { label: string; values: number[] }[];
  unit?: string;
}

/** Rampe séquentielle à teinte unique, du clair au foncé. */
const RAMP = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)', 'var(--seq-7)'];

function stepFor(value: number, max: number): number {
  if (!value) return -1;
  if (!max) return 0;
  // Racine carrée : les valeurs basses restent distinguables des cases vides.
  const ratio = Math.sqrt(value / max);
  return Math.min(RAMP.length - 1, Math.floor(ratio * RAMP.length));
}

/**
 * Magnitude croisée sur deux dimensions nominales. La valeur est écrite dans
 * chaque case : la couleur hiérarchise, le chiffre reste la source de vérité.
 */
export function Heatmap({ columns, rows, unit = 'jours' }: HeatmapProps) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-sm">
        <caption className="sr-only">Effort planifié par thématique et par pôle, en {unit}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-muted-foreground w-52 px-2 pb-2 text-left text-xs font-medium">
              Thématique
            </th>
            {columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="text-muted-foreground px-1 pb-2 text-center text-xs font-medium whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="text-foreground max-w-52 truncate px-2 py-1 text-left text-xs font-normal">
                {row.label}
              </th>
              {row.values.map((value, i) => {
                const step = stepFor(value, max);
                return (
                  <td
                    key={columns[i]}
                    title={`${row.label} — ${columns[i]} : ${value} ${unit}`}
                    className={cn(
                      'rounded-sm px-2 py-1.5 text-center text-xs tabular-nums',
                      step >= 4 ? 'text-white' : 'text-foreground',
                      step < 0 && 'text-muted-foreground/40',
                    )}
                    style={{ backgroundColor: step < 0 ? 'var(--muted)' : RAMP[step] }}
                  >
                    {value || '·'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
        <span>0</span>
        <div className="flex gap-0.5">
          {RAMP.map((color) => (
            <span key={color} className="h-3 w-6 rounded-xs" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
}
