import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  /** Comparaison secondaire affichée sous la valeur. */
  footnote?: string;
  tone?: 'default' | 'good' | 'warning' | 'critical';
}

const TONE: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'text-foreground',
  good: 'text-[var(--viz-good)]',
  warning: 'text-[var(--viz-serious)]',
  critical: 'text-[var(--viz-critical)]',
};

export function StatTile({ label, value, hint, footnote, tone = 'default' }: StatTileProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className={cn('mt-2 text-3xl font-semibold tracking-tight', TONE[tone])}>{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      {footnote ? <p className="text-muted-foreground mt-2 text-xs leading-snug">{footnote}</p> : null}
    </div>
  );
}

interface MeterProps {
  label: string;
  value: number;
  max?: number;
  caption?: string;
  tone?: 'good' | 'warning' | 'critical';
}

/** Barre de progression sobre, avec valeur toujours lisible en clair. */
export function Meter({ label, value, max = 100, caption, tone }: MeterProps) {
  const ratio = max ? Math.max(0, Math.min(1, value / max)) : 0;
  const color =
    tone === 'good'
      ? 'var(--viz-good)'
      : tone === 'warning'
        ? 'var(--viz-serious)'
        : tone === 'critical'
          ? 'var(--viz-critical)'
          : 'var(--chart-1)';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {Math.round(value)}
          <span className="text-muted-foreground/70">/{max}</span>
        </span>
      </div>
      <div className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
          role="meter"
          aria-valuenow={Math.round(value)}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
      {caption ? <p className="text-muted-foreground mt-1 text-xs">{caption}</p> : null}
    </div>
  );
}
