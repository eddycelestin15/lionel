import { PageHeader } from '@/app/components/AppShell';
import { ThemeEffortChart } from '@/app/components/charts/ThemeEffortChart';
import { Heatmap } from '@/app/components/Heatmap';
import { StatTile } from '@/app/components/StatTile';
import { fmtDec, fmtInt, fmtPct } from '@/app/lib/format';
import { buildReport } from '@/app/lib/report';
import { FAMILLES } from '@/app/lib/themes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Les données changent à l'import : rien n'est pré-rendu au build.
export const dynamic = 'force-dynamic';

export default function ThematiquesPage() {
  const report = buildReport();
  const { themes, themeParPole } = report;

  const actifs = themes.filter((t) => t.jours > 0);
  const chartData = actifs.map((t) => ({ label: t.label, jours: t.jours, agents: t.agents }));

  const colonnes = themeParPole.map((p) => p.pole);
  const heatRows = actifs.map((t) => ({
    label: t.label,
    values: themeParPole.map((p) => p.valeurs[t.id] ?? 0),
  }));

  // Les deux colonnes sont pondérées : une journée partagée entre trois thèmes
  // compte pour un tiers dans chacun, de sorte que les parts somment à 100 %.
  const parFamille = FAMILLES.map((famille) => {
    const membres = themes.filter((t) => t.famille === famille);
    return {
      famille,
      jours: membres.reduce((s, t) => s + t.joursPonderes, 0),
      part: membres.reduce((s, t) => s + t.partEffort, 0),
    };
  }).sort((a, b) => b.jours - a.jours);

  const ecarts = [...themes].filter((t) => t.agentsManquants > 0).sort((a, b) => b.agentsManquants - a.agentsManquants);
  const dominant = actifs[0];

  return (
    <>
      <PageHeader
        title="Analyse thématique"
        description="Les activités sont saisies en texte libre : elles sont étiquetées par un lexique métier explicite (riz/PAPRIZ, GVEC, FEP, nutrition, infrastructures…). Une journée peut porter plusieurs thèmes ; les jours-agents cumulés dépassent donc le nombre de journées programmées, tandis que la part d'effort répartit chaque journée entre ses thèmes."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Thématiques actives" value={fmtInt(actifs.length)} hint={`sur ${themes.length} du référentiel`} />
        <StatTile
          label="Thème dominant"
          value={dominant?.label ?? '—'}
          hint={dominant ? `${fmtInt(dominant.jours)} jours-agents · ${fmtPct(dominant.partEffort)} de l'effort` : ''}
        />
        <StatTile
          label="Famille la plus mobilisée"
          value={parFamille[0]?.famille ?? '—'}
          hint={parFamille[0] ? `${fmtPct(parFamille[0].part)} de l'effort pondéré` : ''}
        />
        <StatTile
          label="Journées non classées"
          value={fmtPct(report.nonClassees.part, 1)}
          tone={report.nonClassees.part > 0.1 ? 'critical' : report.nonClassees.part > 0.05 ? 'warning' : 'good'}
          hint={`${fmtInt(report.nonClassees.jours)} journées hors lexique`}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Effort programmé par thématique</CardTitle>
            <CardDescription>Jours-agents dont l&apos;activité relève du thème, tous pôles confondus.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeEffortChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Part d&apos;effort par famille</CardTitle>
            <CardDescription>
              Effort pondéré : chaque journée est répartie entre ses thèmes, la somme vaut 100 %.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Famille</TableHead>
                  <TableHead className="text-right">Jours pondérés</TableHead>
                  <TableHead className="text-right">Part</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parFamille.map((f) => (
                  <TableRow key={f.famille}>
                    <TableCell className="font-medium">{f.famille}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtDec(f.jours)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(f.part, 1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Croisement thématique × pôle</CardTitle>
            <CardDescription>
              Jours-agents par thème et par pôle. Les cases vides signalent un thème absent de la programmation du
              pôle — à confronter au cadrage avant d&apos;en conclure à une lacune.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Heatmap columns={colonnes} rows={heatRows} unit="jours" />
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Activités que le lexique ne reconnaît pas</CardTitle>
            <CardDescription>
              {report.nonClassees.jours} journées sur {fmtInt(report.globals.joursOuvres)} ({fmtPct(report.nonClassees.part, 1)})
              ne déclenchent aucun thème. Un taux qui grimpe d&apos;un cycle à l&apos;autre signale un vocabulaire
              nouveau — une filière, un dispositif — qu&apos;il faut ajouter au lexique, faute de quoi cette activité
              disparaît des graphiques sans prévenir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.nonClassees.exemples.length ? (
              <ul className="space-y-2 text-sm">
                {report.nonClassees.exemples.map((e, i) => (
                  <li key={i} className="border-l-2 pl-3" style={{ borderColor: 'var(--viz-serious)' }}>
                    <span className="line-clamp-2">{e.activite}</span>
                    <span className="text-muted-foreground text-xs">{e.agent}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Toutes les journées programmées portent au moins un thème.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Couverture du cadrage par thème</CardTitle>
            <CardDescription>
              Pour chaque thème : agents qui l&apos;ont inscrit au cadrage, agents qui l&apos;ont effectivement
              programmé, et écart. Un taux de reprise faible signale un cadrage non opérationnalisé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thématique</TableHead>
                  <TableHead>Famille</TableHead>
                  <TableHead className="text-right">Jours planifiés</TableHead>
                  <TableHead className="text-right">Agents cadrés</TableHead>
                  <TableHead className="text-right">Non repris</TableHead>
                  <TableHead className="text-right">Taux de reprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {themes.map((t) => {
                  const reprise = t.agentsCadre ? (t.agentsCadre - t.agentsManquants) / t.agentsCadre : null;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.label}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{t.famille}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(t.jours)}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.agentsCadre}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.agentsManquants || '—'}</TableCell>
                      <TableCell className="text-right">
                        {reprise === null ? (
                          <span className="text-muted-foreground/60 text-xs">non cadré</span>
                        ) : (
                          <Badge variant={reprise >= 0.8 ? 'default' : reprise >= 0.5 ? 'secondary' : 'destructive'}>
                            {fmtPct(reprise)}
                          </Badge>
                        )}
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
