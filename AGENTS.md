# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

NaioshFit is a **single-process** full-stack app: `npm run dev` runs Express (API) and Vite (React HMR) together on port **5000**.

### Required services

| Service | How to start |
|---------|--------------|
| PostgreSQL | Local: `sudo service postgresql start`. Railway: Postgres service in Railway dashboard |
| App | `npm run dev` (local) or `npm run start:prod` (after build, Railway) |

### Local `.env`

Copy `.env.example` → `.env`. Minimum:

```
DATABASE_URL=postgresql://...
SESSION_SECRET=...
NODE_ENV=development
PORT=5000
```

Test DB: `export $(grep -v '^#' .env | xargs) && npm run db:test-connection`

### Railway (production)

Deploy config is in `railway.toml`:

- **Build:** `npm ci && npm run build`
- **Start:** `npm run start:prod` (does not rebuild — avoids double-build on Railway)
- **Health:** `/health`

**Required Railway variables on the `naioshfit` app service:**

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | From Postgres service → Connect (use Railway reference `${{Postgres.DATABASE_URL}}` or copy Public URL) |
| `SESSION_SECRET` | Long random string |
| `NODE_ENV` | `production` |
| `MAIN_DOMAIN` | `naioshfit.com` |

**SaaS (optional):** see `.env.example` for `CENTRAL_DATABASE_URL`, `TENANT_DB_ENCRYPTION_KEY`, etc.

**If deploy fails with Prisma / MODULE_NOT_FOUND:** the deployed commit may be outdated. This repo uses **Drizzle**, not Prisma. Redeploy from current `main` (no Prisma in `package.json`).

**Connect local dev to Railway Postgres:** paste the **Public** `DATABASE_URL` from Railway into local `.env`, then `npm run db:test-connection` and `npm run dev`.

The **internal** URL (`postgres.railway.internal`) only works from services running inside the same Railway project — it will fail from your laptop or Cursor Cloud with `ENOTFOUND`.

On the Railway **naioshfit app** service, set `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` (recommended) or the internal URL you copied from Postgres → Connect → Private Network.

### Wrong app on Railway URL (e.g. shows NAIS instead of Naiosh Fit)

If `*.up.railway.app` shows **NAIS** (educational platform, Next.js) instead of **Naiosh Fit** (fitness, Express+Vite):

1. The Railway **service is connected to the wrong GitHub repo** (or an old NAIS/Prisma project).
2. Confirm: Naiosh Fit responds with Express `/health` JSON; wrong deploys redirect to `/login` and send `x-powered-by: Next.js`.

**Fix in Railway dashboard:**

1. Open project **naioshfit** → select the **app service** (not Postgres).
2. **Settings → Source** → verify repo is `naioshapp26-ship-it/naioshfit` and branch `main`.
3. If wrong repo: **Disconnect** → **Connect Repo** → choose `naioshfit` → redeploy.
4. **Settings → Deploy:** Build `npm ci && npm run build`, Start `npm run start:prod` (see `railway.toml`).
5. **Variables:** `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SESSION_SECRET`, `NODE_ENV=production`, `MAIN_DOMAIN=naioshfit.com`.
6. Optional: **Settings → Networking** → regenerate domain or attach custom domain after correct deploy.

Do **not** reuse a service that was created for NAIS — create a **new service** from the correct repo if Source cannot be switched cleanly.

### 502 Bad Gateway after connecting correct repo

Common causes and fixes (now in `main`):

1. **Start command** must be `npm run start:prod` — not `npm start` (which rebuilds and can OOM).
2. **Build** must set `VITE_BASE_PATH=/` for Railway root URL (GitHub Pages uses `/naioshfit/`).
3. **Client assets** are copied `docs/` → `dist/public/` during build (`scripts/copy-client-build.js`).
4. **Variables:** `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `SESSION_SECRET`, `NODE_ENV=production`.

### Fresh local database

On an empty DB: `npx drizzle-kit push --force`, then `npx tsx scripts/seed_demo_data.ts`.

### Demo login

Use **`email`** field (not `username`): `demo_client` / `password123`.

### Tests

`npm test` — Vitest, no DB required. `npm run check` — tsc (many pre-existing errors).
