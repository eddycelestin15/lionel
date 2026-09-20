import Link from 'next/link';

import { PageHeader } from '@/app/components/AppShell';
import { BudgetChart } from '@/app/components/charts/BudgetChart';
import { StatTile } from '@/app/components/StatTile';
import { fmtAr, fmtArFull, fmtDec, fmtInt, fmtKm } from '@/app/lib/format';
import { buildReport } from '@/app/lib/report';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Les données changent à l'import : rien n'est pré-rendu au build.
export const dynamic = 'force-dynamic';

export default function BudgetPage() {
  const report = buildReport();
  const { globals, poles, agents } = report;

  const budgetData = poles.map((p) => {
    const membres = agents.filter((a) => a.pole === p.pole);
    return {
      pole: p.pole,
      carburant: membres.reduce((s, a) => s + a.stats.carburantAr, 0),
      perdiem: membres.reduce((s, a) => s + a.stats.perdiemAr, 0),
    };
  });

  // Contrôle arithmétique : total recalculé face au total saisi dans la feuille.
  const ecarts = agents
    .filter((a) => a.planning?.declaredTotals?.km != null)
    .map((a) => ({
      slug: a.slug,
      nom: a.nom,
      pole: a.pole,
      kmCalcule: a.stats.km,
      kmDeclare: a.planning!.declaredTotals!.km ?? 0,
      carburantCalcule: a.stats.carburantAr,
      carburantDeclare: a.planning!.declaredTotals!.carburantAr ?? 0,
    }))
    .map((e) => ({ ...e, ecartKm: e.kmCalcule - e.kmDeclare, ecartCarburant: e.carburantCalcule - e.carburantDeclare }))
    .filter((e) => Math.abs(e.ecartKm) > 0.5 || Math.abs(e.ecartCarburant) > 50)
    .sort((a, b) => Math.abs(b.ecartCarburant) - Math.abs(a.ecartCarburant));

  const topBudget = [...agents].sort((a, b) => b.stats.budgetAr - a.stats.budgetAr).slice(0, 12);
  const prixLitre = globals.litres ? globals.carburantAr / globals.litres : 0;

  return (
    <>
      <PageHeader
        title="Budget de déplacement"
        description="Le planning est budgétisé : chaque journée porte un parcours, une consommation, un coût carburant et, pour les postes d'encadrement, un perdiem. Cette page agrège la dépense programmée et contrôle sa cohérence arithmétique avec les totaux saisis dans les feuilles."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Budget total programmé" value={fmtAr(globals.budgetAr)} hint={fmtArFull(globals.budgetAr)} />
        <StatTile
          label="Carburant"
          value={fmtAr(globals.carburantAr)}
          hint={`${fmtDec(globals.litres)} litres · ${fmtInt(prixLitre)} Ar/l`}
        />
        <StatTile label="Perdiem" value={fmtAr(globals.perdiemAr)} hint="postes d'encadrement uniquement" />
        <StatTile
          label="Coût par jour de terrain"
          value={fmtAr(globals.coutParJourTerrain)}
          hint={`${fmtInt(globals.joursTerrain)} jours de terrain`}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Dépense programmée par pôle</CardTitle>
            <CardDescription>
              Carburant et perdiem partagent la même unité : l&apos;empilement donne à lire le total et sa
              composition.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BudgetChart data={budgetData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Intensité de déplacement</CardTitle>
            <CardDescription>Distance et coût rapportés au terrain effectivement programmé.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pôle</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead className="text-right">Km / jour terrain</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poles.map((p) => (
                  <TableRow key={p.pole}>
                    <TableCell className="font-medium">{p.pole}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(p.km)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.joursTerrain ? fmtDec(p.km / p.joursTerrain) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtAr(p.budgetAr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Budgets individuels les plus élevés</CardTitle>
            <CardDescription>Carburant et perdiem cumulés sur le cycle.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBudget.map((a) => (
                  <TableRow key={a.slug}>
                    <TableCell>
                      <Link href={`/agents/${a.slug}`} className="font-medium hover:underline">
                        {a.nom}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        {a.fonction} · {a.pole}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtKm(a.stats.km)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtAr(a.stats.budgetAr)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contrôle arithmétique des totaux</CardTitle>
            <CardDescription>
              Écart entre la somme des lignes journalières et le total inscrit en bas de feuille. Un écart signale
              une ligne oubliée dans la plage de somme ou une valeur saisie à la main.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ecarts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun écart significatif : les totaux déclarés correspondent aux lignes journalières.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Écart km</TableHead>
                    <TableHead className="text-right">Écart carburant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ecarts.map((e) => (
                    <TableRow key={e.slug}>
                      <TableCell>
                        <Link href={`/agents/${e.slug}`} className="font-medium hover:underline">
                          {e.nom}
                        </Link>
                        <span className="text-muted-foreground block text-xs">{e.pole}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.ecartKm > 0 ? '+' : ''}
                        {fmtDec(e.ecartKm)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.ecartCarburant > 0 ? '+' : ''}
                        {fmtAr(e.ecartCarburant)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
