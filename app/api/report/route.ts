import { buildReport } from '@/app/lib/report';

/**
 * Sortie machine du rapport : agrégats globaux, thématiques, pôles et scores
 * par agent. Utile pour réinjecter l'analyse dans un autre outil sans repasser
 * par les classeurs.
 */
export function GET() {
  const report = buildReport();

  return Response.json({
    generatedAt: report.generatedAt,
    periode: report.periode,
    source: report.source,
    globals: report.globals,
    themes: report.themes,
    poles: report.poles,
    agents: report.agents.map((agent) => ({
      slug: agent.slug,
      nom: agent.nom,
      fonction: agent.fonction,
      pole: agent.pole,
      commune: agent.commune,
      stats: { ...agent.stats, lieux: agent.stats.lieux.length },
      score: agent.concordance.total,
      dimensions: agent.concordance.dimensions.map((d) => ({ id: d.id, score: d.score, detail: d.detail })),
      themesCadrage: agent.concordance.themesCadrage,
      themesPlanning: agent.concordance.themesPlanning,
      themesManquants: agent.concordance.themesManquants,
      indicateurs: agent.indicateurs,
    })),
    issues: report.issues,
  });
}
