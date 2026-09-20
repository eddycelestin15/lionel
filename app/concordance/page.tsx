import Link from 'next/link';

import { PageHeader } from '@/app/components/AppShell';
import { EcartTerrainChart, type EcartDatum } from '@/app/components/charts/EcartTerrainChart';
import { ScoreHistogram } from '@/app/components/charts/ScoreHistogram';
import { Meter, StatTile } from '@/app/components/StatTile';
import { fmtInt, fmtPct } from '@/app/lib/format';
import { buildReport } from '@/app/lib/report';
import { themeLabel } from '@/app/lib/themes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Les données changent à l'import : rien n'est pré-rendu au build.
export const dynamic = 'force-dynamic';

const BUCKETS: { tranche: string; min: number; max: number; tone: 'critical' | 'serious' | 'warning' | 'good' }[] = [
  { tranche: '0–39', min: 0, max: 40, tone: 'critical' },
  { tranche: '40–59', min: 40, max: 60, tone: 'serious' },
  { tranche: '60–74', min: 60, max: 75, tone: 'warning' },
  { tranche: '75–89', min: 75, max: 90, tone: 'good' },
  { tranche: '90–100', min: 90, max: 101, tone: 'good' },
];

const scoreVariant = (score: number) => (score >= 75 ? 'default' : score >= 60 ? 'secondary' : 'destructive');

/** Patronyme + premier prénom : les noms complets débordent de l'axe. */
function nomCompact(nom: string): string {
  const mots = nom.split(/\s+/).filter(Boolean);
  return mots.length <= 2 ? nom : `${mots[0]} ${mots[1]}`;
}

export default function ConcordancePage() {
  const report = buildReport();
  const agents = [...report.agents].sort((a, b) => a.concordance.total - b.concordance.total);

  const buckets = BUCKETS.map((b) => ({
    tranche: b.tranche,
    agents: agents.filter((a) => a.concordance.total >= b.min && a.concordance.total < b.max).length,
    tone: b.tone,
  }));

  // Moyenne par dimension : montre quelle règle fait chuter le score d'ensemble.
  const dimensionIds = report.agents[0]?.concordance.dimensions.map((d) => d.id) ?? [];
  const dimensions = dimensionIds.map((id) => {
    const items = report.agents.map((a) => a.concordance.dimensions.find((d) => d.id === id)!);
    return {
      id,
      label: items[0].label,
      weight: items[0].weight,
      moyenne: items.reduce((s, d) => s + d.score, 0) / items.length,
      enEchec: items.filter((d) => d.status === 'ko').length,
    };
  });

  // Écart signé entre terrain cadré et terrain planifié, agents concernés seulement.
  const ecarts: EcartDatum[] = report.agents
    .map((a) => {
      const cadre = a.indicateurs.jours_terrain ?? a.indicateurs.jours_mission ?? null;
      if (cadre == null) return null;
      return { agent: a.nom, cadre, planifie: a.stats.joursTerrain, ecart: a.stats.joursTerrain - cadre };
    })
    .filter((e): e is EcartDatum => e !== null && e.ecart !== 0)
    // Les vingt écarts les plus marqués, puis remis dans l'ordre du déficit au surplus.
    .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
    .slice(0, 20)
    .sort((a, b) => a.ecart - b.ecart)
    .map((e) => ({ ...e, agent: nomCompact(e.agent) }));

  const sansCadrage = report.agents.filter((a) => !a.cadrage);
  const sansPlanning = report.agents.filter((a) => !a.planning);
  const themeGapCount = report.agents.reduce((s, a) => s + a.concordance.themesManquants.length, 0);

  return (
    <>
      <PageHeader
        title="Concordance cadrage × planning"
        description="Chaque planning est confronté au bloc de cadrage du même agent selon six règles vérifiables : appariement des documents, cohérence de période, reprise des thèmes cadrés, volumétrie des jours de terrain, couverture géographique et complétude du planning. Le score agrège ces règles pondérées sur 100."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Score moyen"
          value={`${Math.round(report.globals.scoreMoyen)}/100`}
          tone={report.globals.scoreMoyen >= 75 ? 'good' : report.globals.scoreMoyen >= 60 ? 'warning' : 'critical'}
          hint={`${agents.filter((a) => a.concordance.total >= 75).length} agents au-dessus de 75`}
        />
        <StatTile
          label="Plannings sans cadrage"
          value={fmtInt(sansCadrage.length)}
          tone={sansCadrage.length ? 'warning' : 'good'}
          hint="activités hors grandes lignes du mois"
        />
        <StatTile
          label="Cadrages sans planning"
          value={fmtInt(sansPlanning.length)}
          tone={sansPlanning.length ? 'warning' : 'good'}
          hint="cadrage non traduit en programme"
        />
        <StatTile
          label="Thèmes cadrés non planifiés"
          value={fmtInt(themeGapCount)}
          tone={themeGapCount > 20 ? 'critical' : 'warning'}
          hint="cumulés sur l'ensemble des agents"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribution des scores</CardTitle>
            <CardDescription>Nombre d&apos;agents par tranche de concordance.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreHistogram data={buckets} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Où le score se perd</CardTitle>
            <CardDescription>
              Taux de satisfaction moyen de chaque règle. Une règle basse désigne un problème systémique, pas
              individuel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dimensions.map((d) => (
              <Meter
                key={d.id}
                label={`${d.label} (${d.weight} pts)`}
                value={d.moyenne * 100}
                caption={`${fmtPct(d.moyenne)} en moyenne · ${d.enEchec} agent(s) en échec`}
                tone={d.moyenne >= 0.8 ? 'good' : d.moyenne >= 0.5 ? 'warning' : 'critical'}
              />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Écart de volumétrie terrain, agent par agent</CardTitle>
            <CardDescription>
              Jours de terrain programmés moins jours de terrain engagés au cadrage. C&apos;est la règle qui pèse le
              plus lourd dans le score : à gauche, les agents qui programment moins de terrain qu&apos;ils n&apos;en
              ont cadré. Les vingt écarts les plus marqués sont représentés ; les autres agents sont à
              l&apos;équilibre, proches de l&apos;équilibre, ou sans engagement chiffré au cadrage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EcartTerrainChart data={ecarts} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Détail par agent</CardTitle>
            <CardDescription>
              Trié du score le plus faible au plus élevé. Les thèmes listés sont cadrés mais absents du planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Pôle</TableHead>
                  <TableHead className="text-right">Terrain cadré</TableHead>
                  <TableHead className="text-right">Terrain planifié</TableHead>
                  <TableHead>Thèmes cadrés non planifiés</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => {
                  const cadre = agent.indicateurs.jours_terrain ?? agent.indicateurs.jours_mission ?? null;
                  return (
                    <TableRow key={agent.slug}>
                      <TableCell className="font-medium">
                        <Link href={`/agents/${agent.slug}`} className="hover:underline">
                          {agent.nom}
                        </Link>
                        <span className="text-muted-foreground block text-xs">{agent.fonction}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{agent.pole}</TableCell>
                      <TableCell className="text-right tabular-nums">{cadre ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{agent.stats.joursTerrain}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        {agent.concordance.themesManquants.length ? (
                          <span className="text-muted-foreground text-xs">
                            {agent.concordance.themesManquants.map(themeLabel).join(', ')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={scoreVariant(agent.concordance.total)}>{agent.concordance.total}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
