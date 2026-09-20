'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SeriesLegend } from './SeriesLegend';

export interface DayMixDatum {
  pole: string;
  terrain: number;
  bureau: number;
  nonPrecise: number;
}

const config = {
  terrain: { label: 'Terrain', color: 'var(--chart-1)' },
  bureau: { label: 'Bureau', color: 'var(--chart-2)' },
  nonPrecise: { label: 'Non précisé', color: 'var(--chart-4)' },
} satisfies ChartConfig;

/**
 * Composition d'un total par catégorie : barres empilées horizontales, avec un
 * filet de surface de 2 px entre segments pour que les limites restent lisibles.
 */
const LEGENDE = [
  { label: 'Terrain', color: 'var(--chart-1)' },
  { label: 'Bureau', color: 'var(--chart-2)' },
  { label: 'Non précisé', color: 'var(--chart-4)' },
];

export function DayMixChart({ data }: { data: DayMixDatum[] }) {
  const height = Math.max(200, data.length * 46 + 20);
  return (
    <>
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="pole"
          width={150}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent />} />
        <Bar dataKey="terrain" stackId="j" fill="var(--color-terrain)" maxBarSize={22} stroke="var(--background)" strokeWidth={2} isAnimationActive={false} />
        <Bar dataKey="bureau" stackId="j" fill="var(--color-bureau)" maxBarSize={22} stroke="var(--background)" strokeWidth={2} isAnimationActive={false} />
        <Bar
          dataKey="nonPrecise"
          stackId="j"
          fill="var(--color-nonPrecise)"
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
