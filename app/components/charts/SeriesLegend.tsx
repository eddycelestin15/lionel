/**
 * Légende rendue en HTML plutôt que par Recharts, qui réordonne ses entrées :
 * l'ordre affiché suit ainsi exactement l'ordre d'empilement des séries.
 */
export interface SeriesLegendItem {
  label: string;
  color: string;
}

export function SeriesLegend({ items }: { items: SeriesLegendItem[] }) {
  return (
    <ul className="text-muted-foreground mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
