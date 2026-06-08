import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import compression from "compression";

const viteLogger = createLogger();

/**
 * Escapes a string for safe insertion as an HTML attribute or text node value.
 * Only escapes the characters needed to prevent XSS in that context.
 */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Replaces the default "Naiosh Fit" title / meta-tag values in the HTML shell
 * with the tenant's company name for subdomain requests.
 */
function injectTenantTitleIntoHtml(html: string, companyName: string): string {
  const safe = escapeHtmlAttr(companyName);
  // <title> tag
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${safe}</title>`);
  // og:title
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${safe}$2`,
  );
  // twitter:title
  html = html.replace(
    /(<meta\s+property="twitter:title"\s+content=")[^"]*(")/,
    `$1${safe}$2`,
  );
  // apple-mobile-web-app-title
  html = html.replace(
    /(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/,
    `$1${safe}$2`,
  );
  // application-name
  html = html.replace(
    /(<meta\s+name="application-name"\s+content=")[^"]*(")/,
    `$1${safe}$2`,
  );
  return html;
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      // Add cache-busting to manifest and icons in dev
      const v = nanoid();
      template = template
        .replace(/href="\/manifest\.json"/g, `href="/manifest.json?v=${v}"`)
        .replace(/href="(\/icons\/[^"\s]+)"/g, `href="$1?v=${v}"`);
      // Inject tenant company name into HTML title tags for subdomain requests
      const tenantCompanyName = (req as any).tenant?.company_name as string | undefined;
      if (tenantCompanyName) {
        template = injectTenantTitleIntoHtml(template, tenantCompanyName);
      }
      const page = await vite.transformIndexHtml(url, template);
      // Ensure HTML in dev is never cached by browsers
      res
        .status(200)
        .set({ "Content-Type": "text/html", "Cache-Control": "no-store" })
        .end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const indexPath = path.resolve(distPath, "index.html");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Could not find ${indexPath}. Run "CLIENT_OUT_DIR=dist/public npm run build" before starting the server.`,
    );
  }

  // Enable compression for all responses
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024, // Only compress files larger than 1KB
  }));

  // Static file serving with proper cache headers.
  // index: false prevents express.static from auto-serving index.html for
  // directory requests (e.g. GET /) so those always fall through to the
  // wildcard handler below where we inject tenant-specific title/meta tags.
  app.use(
    express.static(distPath, {
      maxAge: 0,
      index: false,
      setHeaders: (res, filePath) => {
        const relative = path.relative(distPath, filePath);
        const filename = path.basename(filePath);

        // Never cache HTML, service worker, or version metadata
        if (
          filename.endsWith('.html') ||
          filename === 'sw.js' ||
          filename === 'version.json'
        ) {
          res.setHeader('Cache-Control', 'no-store');
          return;
        }

        // Long-term cache for hashed assets (Vite outputs hashed names under assets/)
        const isHashed = /\.[a-f0-9]{8,}\./.test(filename) || relative.startsWith(`assets${path.sep}`);
        if (isHashed) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }

        // Icons are referenced with a version query in HTML; allow long-term immutable caching
        if (relative.startsWith(`icons${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }

        // Default: revalidate other assets (e.g., manifest, icons)
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      },
    })
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res) => {
    try {
      let html = await fs.promises.readFile(indexPath, 'utf-8');
      // Read version for cache-busting
      let v = '';
      try {
        const verRaw = await fs.promises.readFile(path.resolve(distPath, 'version.json'), 'utf-8');
        const obj = JSON.parse(verRaw);
        v = obj.version || '';
      } catch {}
      if (v) {
        html = html
          .replace(/href="\/manifest\.json"/g, `href="/manifest.json?v=${v}"`)
          .replace(/href="(\/icons\/[^"\s]+)"/g, `href="$1?v=${v}"`);
      }
      // Inject tenant company name into HTML title tags for subdomain requests
      const tenantCompanyName = (req as any).tenant?.company_name as string | undefined;
      if (tenantCompanyName) {
        html = injectTenantTitleIntoHtml(html, tenantCompanyName);
      }
      // Ensure HTML is never cached
      res.set('Cache-Control', 'no-store');
      res.set('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (e) {
      console.error('[static] Failed to serve index.html:', e);
      res.status(503).set('Content-Type', 'text/plain').send('Application is starting — client build missing. Redeploy with a successful build.');
    }
  });
}
