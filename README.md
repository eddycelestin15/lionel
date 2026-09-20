# Rapport TTMR Haute Matsiatra — Cadrage × Planning

Application Next.js qui confronte, pour un même cycle mensuel, les deux classeurs de l'équipe :

- un classeur de **cadrage** (`CADRAGE_*.xlsx`) — les grandes lignes du mois, par agent et par pôle ;
- un classeur de **planning** (`PL_*.xlsx`) — les plannings budgétisés, jour par jour.

L'analyse est qualitative : elle mesure la **concordance** entre ce qui a été cadré et ce qui est
effectivement programmé, puis décrit l'effort par thématique, par pôle, par agent et en budget.

## Démarrage

```bash
npm install
npm run parse     # détecte CADRAGE_*.xlsx et PL_*.xlsx dans le dossier parent
npm run dev       # http://localhost:3000
```

Chemins explicites : `npm run parse -- <cadrage.xlsx> <planning.xlsx>`.
Autre dossier source : variable `TTMR_SOURCE_DIR`.

En cours d'usage, la page **Import** fait la même chose depuis le navigateur : on y dépose la paire
de classeurs d'un mois, elle devient le cycle actif. Plusieurs cycles peuvent coexister ; le
sélecteur en haut de page bascule de l'un à l'autre.

## Rien n'est figé sur un mois

Un nouveau cycle ne demande aucune modification du code :

| Élément | Comment il est obtenu |
|---|---|
| Fichiers source | détectés par motif, ou passés en argument, ou déposés via la page Import |
| Période du cycle | période majoritaire parmi les feuilles de planning — les minoritaires sont signalées |
| Libellé du cycle | mois de la date de fin (« Octobre 2026 ») |
| Journées attendues | nombre de jours entre les deux bornes de la période |
| Mois attendu au cadrage | déduit de la même période |
| Pôle de chaque agent | colonne « Pôle de développement » du cadrage, puis zone du planning, puis nom d'onglet |
| Agent d'une feuille de cadrage d'équipe | recouvrement des communes citées avec les itinéraires du planning |

Les activités qu'aucun thème ne reconnaît sont comptées et affichées sur la page Thématiques
plutôt qu'ignorées : un taux qui grimpe signale un vocabulaire nouveau à ajouter au lexique.

## Architecture

```
app/
  page.tsx                Synthèse du cycle
  import/                 Dépôt d'une paire de classeurs, liste des cycles
  concordance/            Score cadrage × planning, règle par règle
  thematiques/            Effort par thème, croisement thème × pôle
  agents/                 Tableau filtrable + fiche par agent
  budget/                 Carburant, perdiem, contrôle arithmétique
  qualite/                Journal des anomalies de saisie
  api/report/route.ts     Sortie JSON de l'analyse complète
  api/import/route.ts     Import d'un cycle (route et non action serveur : celles-ci
                          plafonnent le corps de requête à 1 Mo)
  components/             Composants de présentation (un dossier par composant)
    charts/               Graphiques Recharts, côté client
  lib/
    parser/               Extraction Excel, partagée par le script et l'import
    dataset.ts            Registre des cycles, cycle actif, écriture (serveur)
    actions.ts            Bascule de cycle (action serveur)
    themes.ts             Taxonomie métier + classifieur par lexique
    matching.ts           Appariement agent cadrage ↔ planning, rattachement aux pôles
    concordance.ts        Les six règles de concordance et leur pondération
    report.ts             Agrégats globaux, thématiques, pôles, anomalies
    format.ts             Formatage fr-FR (nombres, ariary, dates)
components/ui/            Primitives shadcn/ui
scripts/parse-excel.ts    Extraction en ligne de commande (même parseur)
types/report.ts           Contrat de données entre le script et l'application
```

`app/lib/parser/` ne fait **que** de l'extraction structurelle, et sert aussi bien le script que la
route d'import. Toute l'interprétation métier (classification thématique, seuils, scores) vit dans
`app/lib/`, donc ajustable sans relire les classeurs.

Les données changeant à l'import, les pages sont rendues à la demande (`dynamic = 'force-dynamic'`)
et `data/` contient un fichier par cycle plus un pointeur `active.json`.

## Déploiement (Docker + Traefik)

L'image est construite en trois étapes et n'embarque que la sortie `standalone` de Next : le
serveur, les dépendances tracées, `public/` et les assets statiques. Elle tourne sous un
utilisateur non privilégié.

```bash
docker compose up -d --build                     # local, http://localhost:3000
```

En production, la surcouche ajoute les étiquettes Traefik et retire toute exposition publique
directe — Traefik joint le conteneur par le réseau Docker partagé :

```bash
cp .env.example .env                             # ajuster TRAEFIK_NETWORK
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Le service répond alors sur **https://lionel.flycelest.com**, certificat Let's Encrypt délivré par
le résolveur `letsencrypt` du Traefik de l'hôte. Ce Traefik n'est pas déclaré ici : il est partagé
entre les projets. `TRAEFIK_NETWORK` désigne le réseau auquel il est attaché (`docker network ls`,
par défaut `flycelest-api_default`).

### État persistant

`npm run build` extrait d'abord les classeurs source ; l'image, elle, ne contient aucun classeur et
se contente de `next build`. Les cycles s'importent à chaud depuis la page **Import**, et sont
écrits dans `/app/data`, monté sur le volume `ttmr_data` : le remplacement du conteneur ne les perd
pas. Une instance vierge démarre donc sans données — `/import` est la première page à visiter.

## Méthode

### Classification thématique

Les activités sont saisies en texte libre, souvent bilingues et abrégées. Le classifieur de
`app/lib/themes.ts` étiquette chaque libellé par un lexique métier explicite — 16 thèmes regroupés
en 5 familles. Chaque règle est lisible et corrigeable : pas de boîte noire.

Une journée peut porter plusieurs thèmes. Deux mesures coexistent donc :

- **jours-agents** : nombre de journées où le thème apparaît (somme > nombre de journées) ;
- **effort pondéré** : chaque journée est répartie entre ses thèmes, les parts somment à 100 %.

### Score de concordance (sur 100)

| Règle | Poids | Ce qu'elle vérifie |
|---|---|---|
| Appariement | 10 | l'agent est identifiable dans les deux documents |
| Cohérence de période | 15 | le planning porte bien la période du cadrage |
| Couverture thématique | 30 | chaque thème cadré est repris au planning |
| Volumétrie terrain | 20 | écart entre jours de terrain cadrés et planifiés |
| Couverture géographique | 15 | les lieux cadrés apparaissent dans les itinéraires |
| Complétude | 10 | le nombre de journées attendues, la ligne TOTAL, les champs renseignés |

### Contrôles de plausibilité

Les indicateurs de cadrage hors bornes réalistes à l'échelle d'un agent (EAF, jours, quantités)
sont **exclus des agrégats** et signalés dans la page *Qualité des données*, plutôt que de fausser
silencieusement les totaux. Le budget fait l'objet d'un contrôle arithmétique : somme des lignes
journalières face au total inscrit en bas de feuille.

## Palette

Les graphiques utilisent une palette catégorielle de huit teintes en ordre fixe, validée sur la
bande de clarté, le plancher de chroma, la séparation daltonienne et le contraste ; une rampe
séquentielle bleue pour la carte de chaleur ; des couleurs d'état réservées (jamais utilisées comme
série). Tout est défini en variables CSS dans `app/globals.css`, en clair et en sombre — le thème
sombre suit le réglage du système, et la classe `.dark` reste disponible pour un sélecteur explicite.

Les légendes sont rendues en HTML plutôt que par Recharts, qui réordonne ses entrées : l'ordre
affiché suit ainsi l'ordre d'empilement des séries.
