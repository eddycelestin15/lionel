import Link from 'next/link';

import { PageHeader } from '@/app/components/AppShell';
import { IssuesChart } from '@/app/components/charts/IssuesChart';
import { StatTile } from '@/app/components/StatTile';
import { fmtInt } from '@/app/lib/format';
import { buildReport } from '@/app/lib/report';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Les données changent à l'import : rien n'est pré-rendu au build.
export const dynamic = 'force-dynamic';

const SEVERITE: Record<string, { label: string; color: string; variant: 'destructive' | 'secondary' | 'default' }> = {
  ko: { label: 'Bloquant', color: 'var(--viz-critical)', variant: 'destructive' },
  warn: { label: 'À vérifier', color: 'var(--viz-serious)', variant: 'secondary' },
  ok: { label: 'Information', color: 'var(--viz-good)', variant: 'default' },
};

export default function QualitePage() {
  const report = buildReport();
  const { issues, agents } = report;

  const bloquants = issues.filter((i) => i.severity === 'ko');
  const aVerifier = issues.filter((i) => i.severity === 'warn');

  const parCategorie = [...new Set(issues.map((i) => i.categorie))]
    .map((categorie) => ({
      categorie,
      total: issues.filter((i) => i.categorie === categorie).length,
      bloquants: issues.filter((i) => i.categorie === categorie && i.severity === 'ko').length,
    }))
    .sort((a, b) => b.total - a.total);

  const agentsSains = agents.filter((a) => a.concordance.gaps.length === 0);

  return (
    <>
      <PageHeader
        title="Qualité des données"
        description="Les deux classeurs sont saisis à la main, feuille par feuille, avec des en-têtes et des libellés variables. Cette page recense les anomalies détectées automatiquement à l'extraction et au contrôle de concordance : ce sont autant de corrections à porter dans les fichiers source avant consolidation."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Anomalies bloquantes"
          value={fmtInt(bloquants.length)}
          tone={bloquants.length ? 'critical' : 'good'}
          hint="corrigent un score de concordance"
        />
        <StatTile label="Points à vérifier" value={fmtInt(aVerifier.length)} tone="warning" hint="sans blocage immédiat" />
        <StatTile
          label="Agents sans anomalie"
          value={`${agentsSains.length}/${agents.length}`}
          tone={agentsSains.length > agents.length / 2 ? 'good' : 'warning'}
        />
        <StatTile label="Catégories concernées" value={fmtInt(parCategorie.length)} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Anomalies par catégorie</CardTitle>
            <CardDescription>Une catégorie récurrente appelle une correction du modèle de saisie.</CardDescription>
          </CardHeader>
          <CardContent>
            <IssuesChart
              data={parCategorie.map((c) => ({
                categorie: c.categorie,
                bloquant: c.bloquants,
                aVerifier: c.total - c.bloquants,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recommandations de saisie</CardTitle>
            <CardDescription>Constats transversaux tirés de la structure des deux classeurs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              <span className="font-medium">Uniformiser l&apos;en-tête des plannings.</span> La période est saisie
              sous une dizaine de formes différentes («&nbsp;23/09/2026 au 22/10/2026&nbsp;», «&nbsp;Du 23 Septembre
              au 22 Octobre 2026&nbsp;», «&nbsp;23 SEPT AU 22 OCT 2026&nbsp;»). Un format unique supprimerait tout
              risque d&apos;interprétation.
            </p>
            <p>
              <span className="font-medium">Rendre obligatoires le nom de l&apos;agent et la commune.</span>{' '}
              Certaines feuilles n&apos;identifient leur agent que par le nom de l&apos;onglet, ce qui interdit tout
              rapprochement automatique avec le cadrage.
            </p>
            <p>
              <span className="font-medium">Fiabiliser la ligne TOTAL.</span> Plusieurs feuilles en sont dépourvues
              ou l&apos;ont saisie hors de la plage de somme : le budget consolidé ne peut alors être contrôlé.
            </p>
            <p>
              <span className="font-medium">Chiffrer systématiquement le récapitulatif de cadrage.</span> Les
              indicateurs laissés vides (jours de terrain, EAF, femmes) empêchent de mesurer l&apos;écart entre
              l&apos;engagement et la programmation.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Journal des anomalies</CardTitle>
            <CardDescription>{issues.length} constats, du plus bloquant au plus mineur.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Sévérité</TableHead>
                  <TableHead className="w-48">Agent</TableHead>
                  <TableHead className="w-32">Catégorie</TableHead>
                  <TableHead>Constat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue, i) => (
                  <TableRow key={`${issue.slug}-${i}`}>
                    <TableCell>
                      <Badge variant={SEVERITE[issue.severity].variant} className="font-normal">
                        {SEVERITE[issue.severity].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/agents/${issue.slug}`} className="font-medium hover:underline">
                        {issue.agent}
                      </Link>
                      <span className="text-muted-foreground block text-xs">{issue.pole}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{issue.categorie}</TableCell>
                    <TableCell className="text-sm whitespace-normal">{issue.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
