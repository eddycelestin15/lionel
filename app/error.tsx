'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Filet unique pour l'absence de données comme pour un classeur illisible :
 * l'analyse dépend entièrement d'un import réussi.
 */
export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const sansDonnees = /aucun cycle|introuvable/i.test(error.message);

  return (
    <Card className="mx-auto mt-10 max-w-2xl">
      <CardHeader>
        <CardTitle>{sansDonnees ? 'Aucune analyse disponible' : "L'analyse n'a pas pu être produite"}</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link
          href="/import"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
        >
          Importer des classeurs
        </Link>
        <Button variant="outline" onClick={reset}>
          Réessayer
        </Button>
      </CardContent>
    </Card>
  );
}
