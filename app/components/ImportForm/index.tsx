'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { ImportResponse } from '@/app/api/import/route';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function ChampFichier({ name, label, aide }: { name: string; label: string; aide: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept=".xlsx"
        required
        className="border-input bg-background file:bg-muted file:text-foreground hover:border-ring block w-full cursor-pointer rounded-md border text-sm file:mr-3 file:cursor-pointer file:border-0 file:px-3 file:py-2 file:text-sm"
      />
      <p className="text-muted-foreground text-xs">{aide}</p>
    </div>
  );
}

export function ImportForm() {
  const router = useRouter();
  const [state, setState] = useState<ImportResponse | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setState(null);
    try {
      const response = await fetch('/api/import', { method: 'POST', body: new FormData(form) });
      const body = (await response.json()) as ImportResponse;
      setState(body);
      // Le cycle actif a changé côté serveur : forcer la relecture des pages.
      if (body.ok) router.refresh();
    } catch {
      setState({ ok: false, message: "Le serveur n'a pas répondu. Les classeurs sont-ils trop volumineux ?" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Importer un nouveau cycle</CardTitle>
          <CardDescription>
            Déposez la paire de classeurs d&apos;un même mois. La période, le nombre de journées attendues et les
            pôles sont déduits du contenu : aucun mois n&apos;est codé en dur. Un cycle déjà importé pour la même
            période est remplacé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ChampFichier
                name="cadrage"
                label="Classeur de cadrage"
                aide="Les grandes lignes du mois, une feuille par équipe ou par pôle."
              />
              <ChampFichier
                name="planning"
                label="Classeur de planning"
                aide="Les plannings budgétisés, une feuille par agent."
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Analyse des classeurs…' : 'Importer et analyser'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {state && !state.ok ? (
        <Card style={{ borderColor: 'var(--viz-critical)' }}>
          <CardHeader>
            <CardTitle className="text-base">Import refusé</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {state?.ok && state.resume ? (
        <Card style={{ borderColor: 'var(--viz-good)' }}>
          <CardHeader>
            <CardTitle className="text-base">{state.message}</CardTitle>
            <CardDescription>
              Période déduite : {state.resume.start} → {state.resume.end}, soit {state.resume.joursAttendus} journées
              attendues par agent. {state.resume.couverture} feuilles sur {state.resume.sheets} portent cette période
              — les autres sont signalées comme hors cycle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {state.resume.plannings} plannings et {state.resume.blocsCadrage} blocs de cadrage extraits. Le rapport
              affiche désormais ce cycle.
            </p>
            {state.avertissements?.length ? (
              <div>
                <p className="mb-1 font-medium">Feuilles non exploitées :</p>
                <ul className="text-muted-foreground list-inside list-disc space-y-0.5 text-xs">
                  {state.avertissements.map((a) => (
                    <li key={`${a.type}-${a.sheet}`}>
                      {a.sheet} ({a.type}) — {a.resultat}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
