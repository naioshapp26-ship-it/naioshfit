import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import fs from 'fs';
import path from 'path';
import { registerRoutes } from "./routes";
import { db, pool } from './db';
import { setupVite, serveStatic, log } from "./vite";
import { runStartupCleanup } from "./lib/tokenCleanup";

// Force Node process timezone to GMT+3 (Asia/Riyadh is fixed-offset with no DST)
process.env.TZ = process.env.TZ || 'Asia/Riyadh';

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const app = express();

// Prevent rare Node inspect crashes when logging complex Error objects
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const safeArgs = args.map((arg) => {
    if (arg instanceof Error) {
      return arg.stack || `${arg.name}: ${arg.message}`;
    }
    return arg;
  });
  originalConsoleError(...safeArgs);
};

// Trust first proxy (Railway/other hosting) so secure cookies & protocol detection work
app.set('trust proxy', 1);

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Version endpoint for cache-busting and client update checks
app.get('/version.json', async (_req, res) => {
  try {
    // Attempt to read built version file (production)
    const versionPath = path.resolve(import.meta.dirname, 'public', 'version.json');
    if (fs.existsSync(versionPath)) {
      const raw = await fs.promises.readFile(versionPath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(raw);
    }
  } catch {}

  // Fallback for dev: compute from git/time
  let version = String(Math.floor(Date.now() / 1000));
  let commit: string | null = null;
  try {
    const { execSync } = await import('node:child_process');
    commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const short = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    version = short || version;
  } catch {}
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ version, commit, builtAt: new Date().toISOString() });
});

// Add middleware to ensure proper cookie handling
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  // Allowlist logic: comma-separated origins in ALLOWED_ORIGINS env var
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (origin) {
    const isAllowed =
      allowedOrigins.length === 0 ||
      allowedOrigins.includes(origin) ||
      // fallback: allow railway preview domains
      origin.includes('.up.railway.app');
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else if (process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5000');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cookie');

  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

type RawBodyVerifier = (req: Request, res: Response, buf: Buffer, encoding: BufferEncoding) => void;

const captureRawBody: RawBodyVerifier = (req, _res, buf) => {
  const rawBodyPaths = [
    "/api/admin/stripe/webhook",
    "/api/stripe/webhook",
    "/api/admin/paypal/webhook",
    "/api/paypal/webhook",
  ];

  if (req.originalUrl && rawBodyPaths.some((path) => req.originalUrl.startsWith(path))) {
    req.rawBody = Buffer.from(buf);
  }
};

app.use(express.json({ verify: captureRawBody }));
app.use(express.urlencoded({ extended: false, verify: captureRawBody }));

// Reduce log volume in production to avoid Railway rate limits
const ENABLE_API_LOGS = process.env.ENABLE_API_LOGS === '1';
const ENABLE_DEPLOY_LOGS = process.env.ENABLE_DEPLOY_LOGS === '1';
const deployLog = (...args: unknown[]) => {
  if (ENABLE_DEPLOY_LOGS) {
    console.log(...args);
  }
};

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    if (!ENABLE_API_LOGS) return;
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Simple probe to ensure DB module side-effects already ran
    try {
      await db.execute("select 1");
      deployLog('[INIT] DB probe success before route registration');
    } catch (e) {
      console.error('[INIT] DB probe failed prior to route registration:', e);
    }

    // Run database migrations
    try {
      deployLog('[INIT] Running database migrations...');
      // In production (bundled), migrations are copied to dist/migrations
      // In development, migrations are in project root
      const migrationsDirProd = path.join(import.meta.dirname, 'migrations');
      const migrationsDirDev = path.join(import.meta.dirname, '..', 'migrations');
      // Try production location first, then development
      const migrationsDir = fs.existsSync(migrationsDirProd) ? migrationsDirProd : migrationsDirDev;
      // Check if migrations directory exists
      if (fs.existsSync(migrationsDir)) {
        const migrationFiles = fs.readdirSync(migrationsDir)
          .filter(f => f.endsWith('.sql'))
          .sort(); // Run in alphabetical order (0001, 0002, etc.)
        if (migrationFiles.length > 0) {
          let successCount = 0;
          let errorCount = 0;
          for (const file of migrationFiles) {
            try {
              const filePath = path.join(migrationsDir, file);
              const sql = fs.readFileSync(filePath, 'utf-8').trim();
              if (sql) {
                await pool.query(sql);
                successCount++;
              }
            } catch (migrationError: any) {
              errorCount++;
              console.error(`[INIT] ✗ Failed to apply ${file}:`, migrationError.message);
              if (migrationError.code !== '42P07' && !migrationError.message?.includes('already exists')) {
                console.error(`[INIT]   → Error details:`, migrationError);
              }
            }
          }
          deployLog(`[INIT] Database migrations completed: ${successCount} applied, ${errorCount} skipped/failed`);
        } else {
          deployLog('[INIT] No migration files found');
        }
      } else {
        console.error('[INIT] ⚠️  CRITICAL: No migrations directory found at either location!');
        console.error('[INIT]   This means migrations will NOT run automatically.');
        console.error('[INIT]   Please run: npm run db:migrate-file migrations/0008_add_affiliate_products.sql');
        console.error('[INIT]   Or use the init script: tsx scripts/init-affiliate-products.ts');
      }
    } catch (e) {
      console.error('[INIT] Database migration failed:', e);
      // Don't throw - migrations might have already been applied
      deployLog('[INIT] Continuing despite migration error (migrations may already be applied)');
    }

    // Clean up expired password reset tokens on startup
    try {
      await runStartupCleanup();
    } catch (cleanupError) {
      console.error('[INIT] Token cleanup failed:', cleanupError);
      // Non-critical error, continue startup
    }

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Error occurred:", err);
      res.status(status).json({ message });
    });

    // Prefer production static assets when a client build exists (e.g. Railway without NODE_ENV set).
    const clientIndexPath = path.resolve(import.meta.dirname, 'public', 'index.html');
    const hasClientBuild = fs.existsSync(clientIndexPath);
    const nodeEnv = process.env.NODE_ENV;
    const isDev =
      nodeEnv === 'development' ||
      (nodeEnv !== 'production' && !hasClientBuild);
    if (ENABLE_DEPLOY_LOGS) {
      log(
        `environment detection: NODE_ENV='${nodeEnv ?? ''}' hasClientBuild=${hasClientBuild} -> isDev=${isDev}`,
      );
    }

    if (isDev) {
      if (ENABLE_DEPLOY_LOGS) {
        log('attaching Vite dev middleware (development mode)');
      }
      await setupVite(app, server);
    } else {
      if (ENABLE_DEPLOY_LOGS) {
        log('serving pre-built static assets (production mode)');
      }
      serveStatic(app);
    }

    // Use the port provided by the hosting platform (Railway sets PORT env var).
    // Fallback to 5000 locally if PORT is undefined.
    const rawEnvPort = process.env.PORT;
    const port = rawEnvPort ? Number(rawEnvPort) : 5000;
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on runtime port ${port} (process.env.PORT='${rawEnvPort || ""}')`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
