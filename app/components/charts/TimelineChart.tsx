'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { SeriesLegend } from './SeriesLegend';
import { fmtDateShort } from '@/app/lib/format';

export interface TimelineDatum {
  date: string;
  terrain: number;
  bureau: number;
  weekend: number;
}

const config = {
  terrain: { label: 'Terrain', color: 'var(--chart-1)' },
  bureau: { label: 'Bureau', color: 'var(--chart-2)' },
  weekend: { label: 'Week-end', color: 'var(--chart-4)' },
} satisfies ChartConfig;

/**
 * Occupation quotidienne de l'équipe sur le cycle. Les journées étant des
 * unités discrètes, on empile des barres plutôt qu'une aire continue.
 */
const LEGENDE = [
  { label: 'Terrain', color: 'var(--chart-1)' },
  { label: 'Bureau', color: 'var(--chart-2)' },
  { label: 'Week-end', color: 'var(--chart-4)' },
];

export function TimelineChart({ data }: { data: TimelineDatum[] }) {
  return (
    <>
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          interval={1}
          tickFormatter={fmtDateShort}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={32} />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={<ChartTooltipContent labelFormatter={(label) => fmtDateShort(String(label))} />}
        />
        <Bar dataKey="terrain" stackId="j" fill="var(--color-terrain)" stroke="var(--background)" strokeWidth={1} isAnimationActive={false} />
        <Bar dataKey="bureau" stackId="j" fill="var(--color-bureau)" stroke="var(--background)" strokeWidth={1} isAnimationActive={false} />
        <Bar
          dataKey="weekend"
          stackId="j"
          fill="var(--color-weekend)"
          radius={[3, 3, 0, 0]}
          stroke="var(--background)"
          strokeWidth={1}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
    <SeriesLegend items={LEGENDE} />
    </>
  );
}
