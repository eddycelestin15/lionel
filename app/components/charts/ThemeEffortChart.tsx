'use client';

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

export interface ThemeEffortDatum {
  label: string;
  jours: number;
  /** Nombre d'agents portant le thème — absent sur une fiche individuelle. */
  agents?: number;
}

const config = {
  jours: { label: 'Jours-agents', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/**
 * Magnitude comparée sur une dimension nominale : barres horizontales triées.
 * Série unique, donc pas de légende — le titre nomme la mesure — et étiquettes
 * directes en bout de barre plutôt qu'un axe de valeurs chargé.
 */
export function ThemeEffortChart({ data }: { data: ThemeEffortDatum[] }) {
  const height = Math.max(240, data.length * 34 + 24);
  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 48, top: 4, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
        <XAxis type="number" dataKey="jours" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={190}
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const datum = item?.payload as ThemeEffortDatum | undefined;
                return (
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: 'var(--chart-1)' }}
                    />
                    <span className="text-foreground">
                      {value as number} jours
                      {datum?.agents ? ` · ${datum.agents} agent${datum.agents > 1 ? 's' : ''}` : ''}
                    </span>
                  </span>
                );
              }}
            />
          }
        />
        <Bar dataKey="jours" fill="var(--color-jours)" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList
            dataKey="jours"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
