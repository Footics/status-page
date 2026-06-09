# Footics — Status

> **Live:** https://status.footics.app

A public, **independent** status page for [Footics](https://footics.app) — the
football-predictions app. It shows the real-time health of three services: the
site, the API & database, and *Le Veilleur* (the live-match poller).

*Version française plus bas — [aller à la version FR](#footics--status-fr).*

## Why independent?

A status page has to survive the very outage it reports. So this one is:

- **hosted separately** — its own Vercel project, decoupled from the main
  `footics.app` app;
- **fed by an external probe** — it never reads `footics.app` (that would be
  circular). It reads **BetterStack**, which probes `footics.app` from the
  outside and receives the heartbeat from the poller (*Le Veilleur*).

The BetterStack API token stays **server-side** (the `/api/status` route +
server rendering); it never reaches the browser.

## Architecture

```
browser ──▶ /api/status (server route, token)
                  │
                  ▼
          BetterStack API  ──probes──▶  footics.app + /api/health
                  ▲
                  └──heartbeat── poller "Le Veilleur"
```

- `lib/betterstack.ts` — reads `/monitors` + `/heartbeats` + `/incidents`, maps
  them to 3 services and builds a daily uptime heatmap from the incident windows.
- `app/api/status/route.ts` — public, read-only proxy.
- `app/page.tsx` + `components/status-view.tsx` — the page (initial SSR, then a
  60 s client-side refresh).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · a server-rendered token proxy.
Three runtime dependencies, ~250 LOC.

## Development

```bash
cp .env.example .env.local   # add your BETTERSTACK_API_TOKEN
npm install
npm run dev                  # http://localhost:3000
```

## Deployment (Vercel)

1. A Vercel project on this repo (separate from the main app).
2. Env var `BETTERSTACK_API_TOKEN` (Production).
3. Domain `status.footics.app` → add the `CNAME` Vercel gives you at your
   registrar.

## License

[MIT](LICENSE).

---

# Footics — Status (FR)

Page de statut publique et **indépendante** de [Footics](https://footics.app),
sur `status.footics.app`.

## Le principe

Une page de statut doit survivre à la panne qu'elle annonce. Elle est donc :

- **hébergée à part** — projet Vercel séparé de l'app principale `footics.app` ;
- **alimentée par une sonde externe** : elle ne lit pas `footics.app`
  (circulaire), elle lit **BetterStack**, qui sonde `footics.app` de l'extérieur
  et reçoit le heartbeat du poller (« Le Veilleur »).

Le token BetterStack reste **côté serveur** (route `/api/status` + rendu
serveur) ; il n'atteint jamais le navigateur.

## Architecture

```
navigateur ──▶ /api/status (route serveur, token)
                    │
                    ▼
            BetterStack API  ──sonde──▶  footics.app + /api/health
                    ▲
                    └──heartbeat── poller « Le Veilleur »
```

- `lib/betterstack.ts` — lit `/monitors` + `/heartbeats` + `/incidents`, mappe
  vers 3 services (Le site, API & base de données, Le Veilleur) et construit la
  heatmap d'uptime journalière à partir des fenêtres d'incident.
- `app/api/status/route.ts` — proxy public (lecture seule).
- `app/page.tsx` + `components/status-view.tsx` — la page (SSR initial + refresh 60 s).

## Développement

```bash
cp .env.example .env.local   # y mettre BETTERSTACK_API_TOKEN
npm install
npm run dev                  # http://localhost:3000
```

## Déploiement (Vercel)

1. Projet Vercel sur ce repo (séparé de l'app principale).
2. Variable d'env `BETTERSTACK_API_TOKEN` (Production).
3. Domaine `status.footics.app` → ajouter le `CNAME` fourni par Vercel chez ton
   registrar.

## Lien avec l'app principale

L'app `footics.app` garde sa **bannière d'incident** interne (rapide, via son
propre `/api/health`). Cette page-ci est la **vitrine publique indépendante** —
les deux sont complémentaires.

## Licence

[MIT](LICENSE).
