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

**SaaS tenant env (Railway):** `TENANT_DB_ENCRYPTION_KEY` and `TENANT_DATABASE_URL_TEMPLATE` are **auto-derived** from `SESSION_SECRET` (16+ chars) and `DATABASE_URL` at startup. Set `SAAS_AUTO_TENANT_ENV=0` to disable. Verify `/api/setup/status` → `tenantProvisioning.ready: true`.

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

On an empty DB: `npx drizzle-kit push --force`, then `npm run db:seed-demo` (or `node scripts/bootstrap-production.mjs`).

Production Railway: schema + demo seed run **in the background after** the server listens (first deploy can take a few minutes). Check `/api/setup/status` — wait until `"bootstrap": "done"` and `"demoUsers": 4` before testing login. Manual one-off: `node scripts/bootstrap-production.mjs`.

### SaaS tenant signup (enterprise)

- **Wizard:** `/saas` — 6-step onboarding (platform type → company → plan → subdomain → payment → review)
- **API:** `/saas/check-subdomain`, `/saas/enterprise-plans`, `/saas/onboarding-session`
- **Tenant dashboard:** `/tenant-dashboard`
- **Super admin:** `/super-admin` (requires `super_admin` role)
- Central migration `023_enterprise_saas_tables.sql` adds plans, billing, domains, RBAC, audit logs

**Payment skip (default):** SaaS signup skips the payment step unless `SAAS_REQUIRE_PAYMENT=1` is set on Railway. The wizard goes straight to tenant provisioning. Set `SAAS_SKIP_PAYMENT=0` to force payment UI while keeping `SAAS_REQUIRE_PAYMENT` unset. Re-enable billing later with `SAAS_REQUIRE_PAYMENT=1`.

Central SaaS schema runs on startup (`bootstrapCentralSchemaIfNeeded`). Check `/api/setup/status` for `centralBootstrap: "done"`. If stuck on `"failed"`, see Railway logs for `[CENTRAL DB] Migration failed`.

Use **`email`** + password **`Demo123!`**:

| Role | Email |
|------|-------|
| Client | `demo_client@demo.naioshfit.com` |
| Coach | `demo_coach@demo.naioshfit.com` |
| Gym | `demo_gym@demo.naioshfit.com` |
| Admin | `demo_admin@demo.naioshfit.com` |

### Tests

`npm test` — Vitest, no DB required. `npm run check` — tsc (many pre-existing errors).
