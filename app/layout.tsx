import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { AppShell } from '@/app/components/AppShell';
import { activeCycleId, listCycles } from '@/app/lib/dataset';
import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Rapport TTMR Haute Matsiatra — Cadrage × Planning',
  description:
    "Analyse qualitative de la concordance entre le cadrage mensuel et les plannings budgétisés de l'équipe TTMR Haute Matsiatra.",
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const cycles = listCycles();
  const activeId = activeCycleId();

  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AppShell cycles={cycles} activeId={activeId}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
