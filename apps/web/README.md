# Crochet PeakZ web

Next.js 16 frontend for Crochet PeakZ. See the [root README](../../README.md) and [deployment guide](../../docs/deployment.md) for the full picture.

## Development

Run the whole monorepo from the repository root:

```bash
npm run dev
```

Or run only the web app (from `apps/web`):

```bash
npm run dev
```

If `packages/shared/dist` does not exist yet, run `npm run build:shared` from
the repository root first. The app is available at http://localhost:3000. It
expects the API at the URL in `NEXT_PUBLIC_API_URL`, which defaults to
`http://localhost:4000/api`.

## Build and run

From the repository root:

```bash
npm run build
npm run start:web
```

The build emits a standalone server in `.next/standalone`, which the root
`Dockerfile` copies into the `web` image. `npm run start:web` runs `next start`
from a full checkout. For a standalone-only artifact, copy `.next/static` and
`public` into the standalone folder and run
`node apps/web/.next/standalone/apps/web/server.js`, as the `Dockerfile` does.
The container listens on `PORT` (default 3000) and `HOSTNAME` (default
`0.0.0.0`).

`NEXT_PUBLIC_*` values are inlined at build time. Set `NEXT_PUBLIC_API_URL`
before building; use `/api` when a reverse proxy serves web and API on one
origin.

## Health check

`GET /health` returns JSON while the Next.js server is running, for Docker and
load balancer probes.

## Deployment

- Self-hosted or Docker host: see [docs/deployment.md](../../docs/deployment.md).
- Vercel: repository root as Root Directory, build command
  `npm run build:shared && npm run build --workspace=@crochet-peakz/web`,
  output `apps/web/.next`, and `NEXT_PUBLIC_API_URL` set in the project
  environment.
