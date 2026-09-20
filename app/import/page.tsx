import { PageHeader } from '@/app/components/AppShell';
import { ImportForm } from '@/app/components/ImportForm';
import { activeCycleId, listCycles } from '@/app/lib/dataset';
import { fmtDate } from '@/app/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default function ImportPage() {
  const cycles = listCycles();
  const actif = activeCycleId();

  return (
    <>
      <PageHeader
        title="Import de classeurs"
        description="Chaque cycle est un couple cadrage + planning portant sur la même période. L'extraction ne présume ni du mois, ni des noms de fichiers, ni des onglets : elle lit l'en-tête de chaque feuille et en déduit la période de référence, celle que porte la majorité des plannings."
      />

      <ImportForm />

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Cycles disponibles</CardTitle>
            <CardDescription>
              {cycles.length
                ? "Le cycle actif alimente l'ensemble des pages. Le sélecteur en haut de page permet d'en changer."
                : "Aucun cycle n'a encore été importé."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cycles.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Agents</TableHead>
                    <TableHead>Classeurs source</TableHead>
                    <TableHead>Importé le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cycles.map((cycle) => (
                    <TableRow key={cycle.id}>
                      <TableCell className="font-medium">
                        {cycle.libelle}
                        {cycle.id === actif ? (
                          <Badge variant="secondary" className="ml-2 font-normal">
                            actif
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {fmtDate(cycle.periodeStart)} → {fmtDate(cycle.periodeEnd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{cycle.agents}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                        {cycle.source.cadrage} · {cycle.source.planning}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(cycle.generatedAt).toLocaleString('fr-FR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">
                Importez une paire de classeurs ci-dessus, ou lancez <code>npm run parse</code> en ligne de commande.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
