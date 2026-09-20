'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { fmtAr, fmtInt, fmtKm, fmtPct } from '@/app/lib/format';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface AgentRow {
  slug: string;
  nom: string;
  fonction: string;
  pole: string;
  commune: string;
  joursTerrain: number;
  joursBureau: number;
  tauxTerrain: number;
  km: number;
  budgetAr: number;
  themes: number;
  score: number;
}

type SortKey = 'nom' | 'joursTerrain' | 'tauxTerrain' | 'km' | 'budgetAr' | 'score';

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'nom', label: 'Agent', numeric: false },
  { key: 'joursTerrain', label: 'Terrain', numeric: true },
  { key: 'tauxTerrain', label: 'Taux terrain', numeric: true },
  { key: 'km', label: 'Distance', numeric: true },
  { key: 'budgetAr', label: 'Budget', numeric: true },
  { key: 'score', label: 'Concordance', numeric: true },
];

const ALL = '__all__';

export function AgentsTable({ rows }: { rows: AgentRow[] }) {
  const [query, setQuery] = useState('');
  const [fonction, setFonction] = useState(ALL);
  const [pole, setPole] = useState(ALL);
  const [sort, setSort] = useState<SortKey>('score');
  const [asc, setAsc] = useState(true);

  const fonctions = useMemo(() => [...new Set(rows.map((r) => r.fonction))].sort(), [rows]);
  const poles = useMemo(() => [...new Set(rows.map((r) => r.pole))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (fonction === ALL || r.fonction === fonction) &&
        (pole === ALL || r.pole === pole) &&
        (!q || `${r.nom} ${r.commune} ${r.pole}`.toLowerCase().includes(q)),
    );
    return out.sort((a, b) => {
      const dir = asc ? 1 : -1;
      if (sort === 'nom') return a.nom.localeCompare(b.nom, 'fr') * dir;
      return (a[sort] - b[sort]) * dir;
    });
  }, [rows, query, fonction, pole, sort, asc]);

  const toggle = (key: SortKey) => {
    if (key === sort) setAsc((v) => !v);
    else {
      setSort(key);
      setAsc(key === 'nom');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rechercher un agent, une commune…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select value={fonction} onValueChange={(v) => setFonction(v ?? ALL)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Fonction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes fonctions</SelectItem>
            {fonctions.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pole} onValueChange={(v) => setPole(v ?? ALL)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Pôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les pôles</SelectItem>
            {poles.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-sm tabular-nums">
          {filtered.length} / {rows.length} agents
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead key={col.key} className={col.numeric ? 'text-right' : undefined}>
                <button
                  type="button"
                  onClick={() => toggle(col.key)}
                  className="hover:text-foreground inline-flex items-center gap-1"
                >
                  {col.label}
                  {sort === col.key ? <span aria-hidden>{asc ? '↑' : '↓'}</span> : null}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((row) => (
            <TableRow key={row.slug}>
              <TableCell>
                <Link href={`/agents/${row.slug}`} className="font-medium hover:underline">
                  {row.nom}
                </Link>
                <span className="text-muted-foreground block text-xs">
                  {row.fonction} · {row.pole}
                  {row.commune ? ` · ${row.commune}` : ''}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.joursTerrain} j
                <span className="text-muted-foreground block text-xs">{row.joursBureau} j bureau</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtPct(row.tauxTerrain)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtKm(row.km)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtAr(row.budgetAr)}</TableCell>
              <TableCell className="text-right">
                <Badge variant={row.score >= 75 ? 'default' : row.score >= 60 ? 'secondary' : 'destructive'}>
                  {row.score}
                </Badge>
                <span className="text-muted-foreground block text-xs">{fmtInt(row.themes)} thèmes</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
