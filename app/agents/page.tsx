import { AgentsTable, type AgentRow } from '@/app/components/AgentsTable';
import { PageHeader } from '@/app/components/AppShell';
import { StatTile } from '@/app/components/StatTile';
import { fmtInt, fmtPct } from '@/app/lib/format';
import { buildReport } from '@/app/lib/report';
import { Card, CardContent } from '@/components/ui/card';

// Les données changent à l'import : rien n'est pré-rendu au build.
export const dynamic = 'force-dynamic';

export default function AgentsPage() {
  const report = buildReport();

  const rows: AgentRow[] = report.agents.map((agent) => ({
    slug: agent.slug,
    nom: agent.nom,
    fonction: agent.fonction,
    pole: agent.pole,
    commune: agent.commune,
    joursTerrain: agent.stats.joursTerrain,
    joursBureau: agent.stats.joursBureau,
    tauxTerrain: agent.stats.tauxTerrain,
    km: agent.stats.km,
    budgetAr: agent.stats.budgetAr,
    themes: Object.keys(agent.themeDays).length,
    score: agent.concordance.total,
  }));

  const tauxMedian = [...rows].sort((a, b) => a.tauxTerrain - b.tauxTerrain)[Math.floor(rows.length / 2)]?.tauxTerrain ?? 0;
  const plusMobile = [...rows].sort((a, b) => b.km - a.km)[0];
  const plusSedentaire = [...rows].sort((a, b) => a.tauxTerrain - b.tauxTerrain)[0];

  return (
    <>
      <PageHeader
        title="Agents"
        description="Un agent = une feuille de planning confrontée à son bloc de cadrage. Le tableau est triable et filtrable ; chaque fiche détaille la programmation jour par jour, la répartition thématique et les écarts relevés."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Agents suivis" value={fmtInt(rows.length)} hint="plannings et cadrages confondus" />
        <StatTile label="Taux terrain médian" value={fmtPct(tauxMedian)} hint="hors week-ends" />
        <StatTile
          label="Plus grande itinérance"
          value={plusMobile?.nom.split(' ')[0] ?? '—'}
          hint={plusMobile ? `${fmtInt(plusMobile.km)} km programmés` : ''}
        />
        <StatTile
          label="Plus faible présence terrain"
          value={plusSedentaire?.nom.split(' ')[0] ?? '—'}
          hint={plusSedentaire ? `${fmtPct(plusSedentaire.tauxTerrain)} de jours de terrain` : ''}
          tone="warning"
        />
      </section>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <AgentsTable rows={rows} />
        </CardContent>
      </Card>
    </>
  );
}
