import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import compression from "compression";

/**
 * Escapes a string for safe insertion as an HTML attribute or text node value.
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
export function injectTenantTitleIntoHtml(html: string, companyName: string): string {
  const safe = escapeHtmlAttr(companyName);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${safe}</title>`);
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${safe}$2`,
  );
  html = html.replace(
    /(<meta\s+property="twitter:title"\s+content=")[^"]*(")/,
    `$1${safe}$2`,
  );
  html = html.replace(
    /(<meta\s+name="apple-mobile-web-app-title"\s+content=")[^"]*(")/,
    `$1${safe}$2`,
  );
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

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024,
  }));

  app.use(
    express.static(distPath, {
      maxAge: 0,
      index: false,
      setHeaders: (res, filePath) => {
        const relative = path.relative(distPath, filePath);
        const filename = path.basename(filePath);

        if (
          filename.endsWith('.html') ||
          filename === 'sw.js' ||
          filename === 'version.json'
        ) {
          res.setHeader('Cache-Control', 'no-store');
          return;
        }

        const isHashed = /\.[a-f0-9]{8,}\./.test(filename) || relative.startsWith(`assets${path.sep}`);
        if (isHashed) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }

        if (relative.startsWith(`icons${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }

        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      },
    })
  );

  app.use("*", async (req, res) => {
    const requestPath = req.path || req.originalUrl || '';
    // Never serve the SPA shell for API/SaaS backends — return JSON 404 instead.
    if (
      requestPath.startsWith('/api/') ||
      requestPath === '/api' ||
      requestPath.startsWith('/saas/') ||
      requestPath === '/saas'
    ) {
      res.set('Cache-Control', 'no-store');
      return res.status(404).json({ message: 'Not found', path: requestPath });
    }

    try {
      const indexPath = path.resolve(distPath, "index.html");
      let html = await fs.promises.readFile(indexPath, 'utf-8');
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
      const tenantCompanyName = (req as any).tenant?.company_name as string | undefined;
      if (tenantCompanyName) {
        html = injectTenantTitleIntoHtml(html, tenantCompanyName);
      }
      res.set('Cache-Control', 'no-store');
      res.set('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch {
      res.set('Cache-Control', 'no-store');
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
