'use client';

import { Bar, BarChart, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { SeriesLegend } from './SeriesLegend';

export interface EcartDatum {
  agent: string;
  cadre: number;
  planifie: number;
  ecart: number;
}

const config = {
  ecart: { label: 'Écart de jours de terrain', color: 'var(--chart-1)' },
} satisfies ChartConfig;

// Encodage divergent : deux teintes opposées de part et d'autre d'un zéro neutre.
const DEFICIT = 'var(--chart-8)';
const SURPLUS = 'var(--chart-1)';

const LEGENDE = [
  { label: 'Moins de terrain que cadré', color: DEFICIT },
  { label: 'Plus de terrain que cadré', color: SURPLUS },
];

/** Étiquette posée à l'extérieur de la barre, du côté où elle pointe. */
function EcartLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number | string }) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  const negatif = v < 0;
  return (
    <text
      x={negatif ? x - 6 : x + width + 6}
      y={y + height / 2}
      dy={4}
      textAnchor={negatif ? 'end' : 'start'}
      className="fill-foreground"
      fontSize={11}
    >
      {v > 0 ? `+${v}` : v}
    </text>
  );
}

/**
 * Écart signé entre les jours de terrain engagés au cadrage et ceux réellement
 * programmés. C'est la règle qui pèse le plus lourd dans le score : la voir
 * agent par agent dit immédiatement où porter la discussion.
 *
 * Le domaine englobe toujours le zéro, avec une marge de chaque côté : sans
 * cela une série entièrement négative colle ses barres au bord de l'axe et se
 * lit comme des barres pleine largeur. Il n'est pas forcé symétrique, ce qui
 * réserverait la moitié du cadre à un surplus inexistant.
 */
export function EcartTerrainChart({ data }: { data: EcartDatum[] }) {
  const valeurs = data.map((d) => d.ecart);
  const marge = Math.max(2, Math.ceil(Math.max(...valeurs.map(Math.abs)) * 0.12));
  const min = Math.min(0, ...valeurs) - marge;
  const max = Math.max(0, ...valeurs) + marge;
  const height = Math.max(240, data.length * 24 + 28);

  return (
    <>
      <ChartContainer config={config} className="w-full" style={{ height }}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }} barCategoryGap={3}>
          <XAxis
            type="number"
            domain={[min, max]}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="agent"
            width={180}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke="var(--viz-axis)" strokeWidth={1} />
          <ChartTooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const d = item?.payload as EcartDatum | undefined;
                  const ecart = Number(value);
                  return (
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: ecart < 0 ? DEFICIT : SURPLUS }}
                      />
                      <span className="text-foreground">
                        {ecart > 0 ? '+' : ''}
                        {ecart} j — {d?.planifie} planifiés pour {d?.cadre} cadrés
                      </span>
                    </span>
                  );
                }}
              />
            }
          />
          <Bar dataKey="ecart" maxBarSize={13} radius={2} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.agent} fill={d.ecart < 0 ? DEFICIT : SURPLUS} />
            ))}
            <LabelList dataKey="ecart" content={<EcartLabel />} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <SeriesLegend items={LEGENDE} />
    </>
  );
}
