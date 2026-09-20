'use client';

import { useRef } from 'react';

import type { CycleEntry } from '@/app/lib/dataset';
import { selectCycle } from '@/app/lib/actions';

/**
 * Bascule entre les cycles importés. Le choix est envoyé au serveur, qui tient
 * le pointeur : l'application entière suit, sans propager de paramètre d'URL.
 */
export function CycleSwitcher({ cycles, activeId }: { cycles: CycleEntry[]; activeId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  if (cycles.length <= 1) return null;

  return (
    <form ref={formRef} action={selectCycle} className="flex items-center gap-2">
      <label htmlFor="cycle" className="sr-only">
        Cycle analysé
      </label>
      <select
        id="cycle"
        name="cycle"
        defaultValue={activeId}
        onChange={() => formRef.current?.requestSubmit()}
        className="border-input bg-background hover:bg-muted h-8 rounded-md border px-2 text-xs"
      >
        {cycles.map((cycle) => (
          <option key={cycle.id} value={cycle.id}>
            {cycle.libelle} · {cycle.agents} agents
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-xs underline">
          Changer
        </button>
      </noscript>
    </form>
  );
}
