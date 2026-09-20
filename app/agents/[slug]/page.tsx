import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/app/components/AppShell';
import { ThemeEffortChart } from '@/app/components/charts/ThemeEffortChart';
import { Meter, StatTile } from '@/app/components/StatTile';
import { fmtAr, fmtDate, fmtInt, fmtKm, fmtPct } from '@/app/lib/format';
import { buildReport, getAgent } from '@/app/lib/report';
import { classify, themeLabel } from '@/app/lib/themes';
import type { IndicatorKey } from '@/types/report';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Les données changent à l'import : rien n'est pré-rendu au build.
export const dynamic = 'force-dynamic';

const INDICATEURS: { key: IndicatorKey; label: string; unit: string }[] = [
  { key: 'eaf_appuyees', label: 'EAF à appuyer', unit: '' },
  { key: 'femmes_appuyees', label: 'dont femmes', unit: '' },
  { key: 'eaf_nouvelles', label: 'EAF à identifier', unit: '' },
  { key: 'op_appuyees', label: 'OP / OPB à appuyer', unit: '' },
  { key: 'fokontany_visites', label: 'Fokontany à visiter', unit: '' },
  { key: 'jours_terrain', label: 'Jours de terrain cadrés', unit: 'j' },
  { key: 'jardins_potagers', label: 'Jardins potagers', unit: '' },
  { key: 'qte_riz', label: 'Production riz', unit: 'kg' },
  { key: 'qte_mais', label: 'Production maïs', unit: 'kg' },
  { key: 'mcv_taux', label: 'Recouvrement MCV', unit: '%' },
];

export default async function AgentPage({ params }: PageProps<'/agents/[slug]'>) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) notFound();

  const themeData = Object.entries(agent.themeDays)
    .map(([id, jours]) => ({ label: themeLabel(id), jours }))
    .sort((a, b) => b.jours - a.jours);

  const indicateurs = INDICATEURS.filter((i) => agent.indicateurs[i.key] != null);
  const scoreTone = agent.concordance.total >= 75 ? 'good' : agent.concordance.total >= 60 ? 'warning' : 'critical';

  return (
    <>
      <PageHeader
        title={agent.nom}
        description={`${agent.fonction} · Pôle ${agent.pole}${agent.commune ? ` · ${agent.commune}` : ''}. Confrontation du bloc de cadrage et du planning budgétisé du cycle.`}
      >
        <Link href="/agents" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
          ← Tous les agents
        </Link>
      </PageHeader>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Concordance" value={`${agent.concordance.total}/100`} tone={scoreTone} />
        <StatTile
          label="Jours de terrain"
          value={fmtInt(agent.stats.joursTerrain)}
          hint={`${fmtPct(agent.stats.tauxTerrain)} des jours ouvrés`}
        />
        <StatTile label="Jours de bureau" value={fmtInt(agent.stats.joursBureau)} hint={`${agent.stats.joursWeekend} week-end`} />
        <StatTile label="Distance" value={fmtKm(agent.stats.km)} hint={`${fmtInt(agent.stats.litres)} litres`} />
        <StatTile label="Budget" value={fmtAr(agent.stats.budgetAr)} hint="carburant + perdiem" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Score de concordance, règle par règle</CardTitle>
            <CardDescription>
              Période déclarée : {agent.planning?.periodeRaw || 'non renseignée'} · Feuille de planning «{' '}
              {agent.planning?.sheet ?? '—'} » · Cadrage « {agent.cadrage?.sheet ?? 'absent'} ».
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agent.concordance.dimensions.map((dim) => (
              <Meter
                key={dim.id}
                label={`${dim.label} (${dim.weight} pts)`}
                value={dim.score * 100}
                caption={dim.detail}
                tone={dim.status === 'ok' ? 'good' : dim.status === 'warn' ? 'warning' : 'critical'}
              />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagements chiffrés du cadrage</CardTitle>
              <CardDescription>Récapitulatif tel que saisi dans la feuille de cadrage.</CardDescription>
            </CardHeader>
            <CardContent>
              {indicateurs.length ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {indicateurs.map((i) => (
                    <div key={i.key} className="flex items-baseline justify-between gap-2 border-b py-1.5">
                      <dt className="text-muted-foreground">{i.label}</dt>
                      <dd className="font-medium tabular-nums">
                        {fmtInt(agent.indicateurs[i.key] as number)} {i.unit}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">Aucun indicateur chiffré n&apos;a été relevé.</p>
              )}
            </CardContent>
          </Card>

          {agent.concordance.gaps.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Écarts relevés</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {agent.concordance.gaps.map((gap, i) => (
                  <div
                    key={i}
                    className="border-l-2 pl-3"
                    style={{ borderColor: gap.severity === 'ko' ? 'var(--viz-critical)' : 'var(--viz-serious)' }}
                  >
                    <p className="text-xs font-medium">{gap.categorie}</p>
                    <p className="text-muted-foreground text-xs leading-snug">{gap.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>

      {themeData.length ? (
        <section className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Répartition thématique du planning</CardTitle>
              <CardDescription>
                Jours de programmation portant chaque thème.
                {agent.concordance.themesManquants.length
                  ? ` Thèmes cadrés sans traduction au planning : ${agent.concordance.themesManquants.map(themeLabel).join(', ')}.`
                  : ' Tous les thèmes cadrés sont repris au planning.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeEffortChart data={themeData} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {agent.cadrage?.activities.length ? (
        <section className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Activités cadrées</CardTitle>
              <CardDescription>
                {agent.cadrage.activities.length} lignes de cadrage, avec l&apos;étape de la logique
                d&apos;intervention et les indicateurs de résultats attendus.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion className="w-full">
                {agent.cadrage.activities.map((activity, i) => {
                  const themes = classify(activity.activite, activity.etape, activity.indicateur);
                  return (
                    <AccordionItem key={i} value={`a-${i}`}>
                      <AccordionTrigger className="text-left text-sm">
                        <span className="flex flex-1 flex-wrap items-center gap-2 pr-4">
                          <span className="line-clamp-1 flex-1">{activity.activite.split('\n')[0] || `Activité ${i + 1}`}</span>
                          {themes.slice(0, 3).map((t) => (
                            <Badge key={t} variant="outline" className="font-normal">
                              {themeLabel(t)}
                            </Badge>
                          ))}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 text-sm md:grid-cols-3">
                          <div>
                            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">Activité</p>
                            <p className="whitespace-pre-line">{activity.activite || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                              Étape d&apos;intervention
                            </p>
                            <p className="whitespace-pre-line">{activity.etape || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                              Indicateurs attendus
                            </p>
                            <p className="whitespace-pre-line">{activity.indicateur || '—'}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {agent.planning ? (
        <section className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Planning jour par jour</CardTitle>
              <CardDescription>
                {agent.planning.days.length} journées programmées
                {agent.planning.declaredTotals
                  ? ` · total déclaré ${fmtAr(agent.planning.declaredTotals.totalAr ?? agent.stats.budgetAr)}`
                  : ' · ligne TOTAL absente de la feuille'}
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead className="w-24">Lieu type</TableHead>
                    <TableHead>Activité</TableHead>
                    <TableHead>Lieu / itinéraire</TableHead>
                    <TableHead className="text-right">Km</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agent.planning.days.map((day, i) => (
                    <TableRow key={`${day.date}-${i}`} className={day.isWeekend ? 'text-muted-foreground/60' : undefined}>
                      <TableCell className="tabular-nums">{fmtDate(day.date)}</TableCell>
                      <TableCell>
                        {day.isWeekend ? (
                          <span className="text-xs">Week-end</span>
                        ) : (
                          <Badge variant={day.lieuType === 'Terrain' ? 'default' : 'secondary'} className="font-normal">
                            {day.lieuType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        <span className="line-clamp-2 text-sm">{day.activite || '—'}</span>
                        {day.resultat && !day.isWeekend ? (
                          <span className="text-muted-foreground line-clamp-1 text-xs">{day.resultat}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        <span className="line-clamp-1 text-sm">{day.lieu || '—'}</span>
                        <span className="text-muted-foreground line-clamp-1 text-xs">{day.itineraire}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{day.km || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card className="mt-4">
          <CardContent className="py-6">
            <p className="text-sm">
              Cet agent dispose d&apos;un bloc de cadrage mais d&apos;aucune feuille de planning : le cadrage
              n&apos;a pas été traduit en programme opérationnel.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
