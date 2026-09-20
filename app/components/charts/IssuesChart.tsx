'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { SeriesLegend } from './SeriesLegend';

export interface IssueDatum {
  categorie: string;
  bloquant: number;
  aVerifier: number;
}

// Couleurs d'état, jamais réutilisées comme série : elles accompagnent ici un
// libellé de sévérité, la teinte ne porte donc jamais seule l'information.
const config = {
  bloquant: { label: 'Bloquant', color: 'var(--viz-critical)' },
  aVerifier: { label: 'À vérifier', color: 'var(--viz-serious)' },
} satisfies ChartConfig;

const LEGENDE = [
  { label: 'Bloquant', color: 'var(--viz-critical)' },
  { label: 'À vérifier', color: 'var(--viz-serious)' },
];

/** Volume d'anomalies par catégorie : désigne les règles de saisie à corriger. */
export function IssuesChart({ data }: { data: IssueDatum[] }) {
  const height = Math.max(220, data.length * 40 + 20);
  return (
    <>
      <ChartContainer config={config} className="w-full" style={{ height }}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="categorie"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent />} />
          <Bar
            dataKey="bloquant"
            stackId="i"
            fill="var(--color-bloquant)"
            maxBarSize={20}
            stroke="var(--background)"
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Bar
            dataKey="aVerifier"
            stackId="i"
            fill="var(--color-aVerifier)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            stroke="var(--background)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <SeriesLegend items={LEGENDE} />
    </>
  );
}
