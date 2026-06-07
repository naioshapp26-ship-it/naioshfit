# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

NaioshFit is a **single-process** full-stack app: `npm run dev` runs Express (API) and Vite (React HMR) together on port **5000**. There is no separate frontend dev server.

### Required services

| Service | How to start |
|---------|--------------|
| PostgreSQL | `sudo service postgresql start` (may be needed after VM reboot; auto-start is often blocked in cloud containers) |
| App | `npm run dev` (see `package.json`) |

### Environment

Create `/workspace/.env` (gitignored) with at least:

```
DATABASE_URL=postgresql://naioshfit:naioshfit_dev@localhost:5432/naioshfit
SESSION_SECRET=dev-session-secret-change-in-production-very-long
NODE_ENV=development
PORT=5000
```

### Fresh database setup

Incremental SQL files in `migrations/` assume an existing schema. On a **new empty database**, bootstrap with Drizzle push before seeding:

```bash
export $(grep -v '^#' .env | xargs)
npx drizzle-kit push --force
npx tsx scripts/seed_demo_data.ts   # requires DATABASE_URL in env
```

The server also runs raw SQL migrations on startup, but they are not sufficient alone for a blank DB.

### Demo credentials

After seeding, log in via the **`email` field** (Passport `usernameField: 'email'`), not `username`:

- **Email/username:** `demo_client`
- **Password:** `password123`

The seed script's baked-in bcrypt hash may not match `password123`. If login returns "Incorrect password", rehash in SQL or use `/api/auth/rehash-password` with `ADMIN_REHASH_TOKEN`.

The login form's HTML5 email validation blocks bare usernames like `demo_client`; use quick-demo buttons, change the input type to `text`, or call `/api/auth/login` directly.

### Lint / typecheck / test

| Command | Notes |
|---------|-------|
| `npm test` | Vitest unit tests (`server/tests/`) — 6 tests, no DB required |
| `npm run check` | `tsc` — currently has many pre-existing type errors in the repo |
| ESLint | Not configured in this repo |

### Manual API smoke test

With the dev server running and demo data seeded:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo_client","password":"password123"}'
```

`scripts/manual-test.sh` uses `username` in the JSON body and will fail unless updated to use `email`.

### Optional integrations

Stripe, PayPal, Paymob, OpenAI, and SMTP are configured in the admin UI or DB — not required for core fitness flows in local dev. `ALLOW_LOCAL_AI_FALLBACK=true` enables offline AI stubs.
