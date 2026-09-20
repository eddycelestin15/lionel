import Link from 'next/link';

import { PageHeader } from '@/app/components/AppShell';
import { DayMixChart } from '@/app/components/charts/DayMixChart';
import { ThemeEffortChart } from '@/app/components/charts/ThemeEffortChart';
import { TimelineChart } from '@/app/components/charts/TimelineChart';
import { StatTile } from '@/app/components/StatTile';
import { fmtAr, fmtInt, fmtKm, fmtPct } from '@/app/lib/format';
import { buildReport } from '@/app/lib/report';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Les données changent à l'import : rien n'est pré-rendu au build.
export const dynamic = 'force-dynamic';

export default function SynthesePage() {
  const report = buildReport();
  const { globals, poles, themes, timeline } = report;

  const dayMix = poles.map((p) => {
    const membres = report.agents.filter((a) => a.pole === p.pole);
    return {
      pole: p.pole,
      terrain: membres.reduce((s, a) => s + a.stats.joursTerrain, 0),
      bureau: membres.reduce((s, a) => s + a.stats.joursBureau, 0),
      nonPrecise: membres.reduce((s, a) => s + a.stats.joursNonPrecise, 0),
    };
  });

  const topThemes = themes.slice(0, 8).map((t) => ({ label: t.label, jours: t.jours, agents: t.agents }));
  const alertes = report.issues.filter((i) => i.severity === 'ko').slice(0, 6);

  const scoreTone = globals.scoreMoyen >= 75 ? 'good' : globals.scoreMoyen >= 60 ? 'warning' : 'critical';

  return (
    <>
      <PageHeader
        title="Synthèse du cycle"
        description="Lecture croisée des grandes lignes du mois (cadrage) et des plannings budgétisés de chaque agent. L'analyse mesure d'abord la concordance entre ce qui a été cadré et ce qui est effectivement programmé, puis décrit l'effort par thématique, par pôle et par agent."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Agents planifiés"
          value={fmtInt(globals.agents)}
          hint={Object.entries(globals.parFonction)
            .map(([k, v]) => `${v} ${k}`)
            .join(' · ')}
        />
        <StatTile
          label="Jours-agents programmés"
          value={fmtInt(globals.joursOuvres)}
          hint={`hors ${fmtInt(globals.joursWeekend)} jours de week-end`}
        />
        <StatTile
          label="Taux de présence terrain"
          value={fmtPct(globals.tauxTerrain)}
          hint={`${fmtInt(globals.joursTerrain)} jours de terrain`}
        />
        <StatTile
          label="Concordance moyenne"
          value={`${Math.round(globals.scoreMoyen)}/100`}
          hint="cadrage vs planning"
          tone={scoreTone}
        />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Budget déplacement" value={fmtAr(globals.budgetAr)} hint="carburant + perdiem" />
        <StatTile label="Distance programmée" value={fmtKm(globals.km)} hint={`${fmtInt(globals.litres)} litres`} />
        <StatTile
          label="EAF à appuyer (cadrage)"
          value={fmtInt(globals.cadrage.eaf)}
          hint={`dont ${fmtPct(globals.cadrage.tauxFeminisation)} de femmes`}
        />
        <StatTile
          label="Lieux d'intervention"
          value={fmtInt(globals.lieux)}
          hint={`fokontany et communes distincts cités sur ${fmtInt(globals.communes)} zones`}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Répartition des journées par pôle</CardTitle>
            <CardDescription>
              Jours-agents programmés hors week-end. Les journées « non précisé » correspondent à une colonne
              bureau/terrain laissée vide dans le planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DayMixChart data={dayMix} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thématiques les plus mobilisatrices</CardTitle>
            <CardDescription>
              Nombre de jours-agents dont l&apos;activité relève du thème. Une journée peut porter plusieurs thèmes :
              le total dépasse donc le nombre de jours programmés.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeEffortChart data={topThemes} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Occupation quotidienne de l&apos;équipe</CardTitle>
            <CardDescription>
              Nombre d&apos;agents par type de journée, du {report.periode.start} au {report.periode.end}. Les creux
              correspondent aux week-ends et les pics aux réunions de coordination mensuelles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimelineChart data={timeline} />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Lecture par pôle de développement</CardTitle>
            <CardDescription>Effort, couverture et qualité de concordance, pôle par pôle.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pôle</TableHead>
                  <TableHead className="text-right">Agents</TableHead>
                  <TableHead className="text-right">Terrain</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead className="text-right">EAF cadrées</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poles.map((p) => (
                  <TableRow key={p.pole}>
                    <TableCell className="font-medium">{p.pole}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.agents}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(p.joursTerrain)} j</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(p.tauxTerrain)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(p.eafCadrees)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant={p.scoreMoyen >= 75 ? 'default' : p.scoreMoyen >= 60 ? 'secondary' : 'destructive'}>
                        {Math.round(p.scoreMoyen)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Points de rupture à traiter</CardTitle>
            <CardDescription>
              Écarts bloquants entre cadrage et planning. Le détail complet est sur la page{' '}
              <Link href="/qualite" className="underline underline-offset-2">
                qualité des données
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertes.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun écart bloquant détecté.</p>
            ) : (
              alertes.map((issue, i) => (
                <div key={`${issue.slug}-${i}`} className="border-l-2 pl-3" style={{ borderColor: 'var(--viz-critical)' }}>
                  <p className="text-sm font-medium">
                    <Link href={`/agents/${issue.slug}`} className="hover:underline">
                      {issue.agent}
                    </Link>{' '}
                    <span className="text-muted-foreground font-normal">— {issue.categorie}</span>
                  </p>
                  <p className="text-muted-foreground text-xs leading-snug">{issue.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-muted-foreground mt-6 text-xs">
        Sources : {report.source.cadrage} et {report.source.planning}. Extraction du{' '}
        {new Date(report.generatedAt).toLocaleString('fr-FR')}.
      </p>
    </>
  );
}
