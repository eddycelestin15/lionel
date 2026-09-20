import Link from 'next/link';

import { CycleSwitcher } from '@/app/components/CycleSwitcher';
import type { CycleEntry } from '@/app/lib/dataset';
import { fmtDate } from '@/app/lib/format';
import { Badge } from '@/components/ui/badge';

const NAV = [
  { href: '/', label: 'Synthèse' },
  { href: '/concordance', label: 'Concordance' },
  { href: '/thematiques', label: 'Thématiques' },
  { href: '/agents', label: 'Agents' },
  { href: '/budget', label: 'Budget' },
  { href: '/qualite', label: 'Qualité des données' },
  { href: '/import', label: 'Import' },
];

interface AppShellProps {
  cycles: CycleEntry[];
  activeId: string | null;
  children: React.ReactNode;
}

export function AppShell({ cycles, activeId, children }: AppShellProps) {
  const actif = cycles.find((c) => c.id === activeId);

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                TTMR Haute Matsiatra
              </Link>
              <span className="text-muted-foreground text-xs">Cadrage × Planning</span>
            </div>
            <div className="flex items-center gap-2">
              {activeId ? <CycleSwitcher cycles={cycles} activeId={activeId} /> : null}
              {actif ? (
                <Badge variant="secondary" className="font-normal">
                  {actif.libelle} · {fmtDate(actif.periodeStart)} → {fmtDate(actif.periodeEnd)}
                </Badge>
              ) : (
                <Badge variant="destructive" className="font-normal">
                  Aucun cycle importé
                </Badge>
              )}
            </div>
          </div>
          <nav className="-mb-px flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{description}</p>
      </div>
      {children}
    </div>
  );
}
