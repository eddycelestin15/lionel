'use client';

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

export interface ScoreBucket {
  tranche: string;
  agents: number;
  tone: 'critical' | 'serious' | 'warning' | 'good';
}

const config = {
  agents: { label: 'Agents', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const TONE: Record<ScoreBucket['tone'], string> = {
  critical: 'var(--viz-critical)',
  serious: 'var(--viz-serious)',
  warning: 'var(--viz-warning)',
  good: 'var(--viz-good)',
};

/**
 * Distribution des scores de concordance. La couleur code un état (et non une
 * série) : elle double une information déjà portée par la position sur l'axe.
 */
export function ScoreHistogram({ data }: { data: ScoreBucket[] }) {
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 16, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="tranche" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={28} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} content={<ChartTooltipContent />} />
        <Bar dataKey="agents" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.tranche} fill={TONE[d.tone]} />
          ))}
          <LabelList dataKey="agents" position="top" className="fill-foreground" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
