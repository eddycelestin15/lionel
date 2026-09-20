'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SeriesLegend } from './SeriesLegend';
import { fmtAr } from '@/app/lib/format';

export interface BudgetDatum {
  pole: string;
  carburant: number;
  perdiem: number;
}

const config = {
  carburant: { label: 'Carburant', color: 'var(--chart-1)' },
  perdiem: { label: 'Perdiem', color: 'var(--chart-3)' },
} satisfies ChartConfig;

/**
 * Carburant et perdiem partagent l'unité (ariary) : l'empilement est licite et
 * donne à lire la dépense totale en même temps que sa composition.
 */
const LEGENDE = [
  { label: 'Carburant', color: 'var(--chart-1)' },
  { label: 'Perdiem', color: 'var(--chart-3)' },
];

export function BudgetChart({ data }: { data: BudgetDatum[] }) {
  const height = Math.max(200, data.length * 46 + 20);
  return (
    <>
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => fmtAr(Number(v))}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="pole"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={<ChartTooltipContent formatter={(value, name) => `${name} : ${fmtAr(Number(value))}`} />}
        />
        <Bar dataKey="carburant" stackId="b" fill="var(--color-carburant)" maxBarSize={22} stroke="var(--background)" strokeWidth={2} isAnimationActive={false} />
        <Bar
          dataKey="perdiem"
          stackId="b"
          fill="var(--color-perdiem)"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
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
