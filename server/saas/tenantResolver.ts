import type { Request, Response, NextFunction } from 'express';
import { getCentralPool } from './centralDb';
import { getTenantPool } from './dbManager';
import type { TenantRecord } from './types';
import { normalizeSubdomain, isValidSubdomain } from './validation';
import { getRequestLanguage, getTenantPaymentRequiredMessage } from '../utils/i18n';

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'saas']);

const MAIN_DOMAIN = process.env.MAIN_DOMAIN;

function normalizeMainDomainHost(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  // Support either bare hosts (example.com) or full URLs (https://example.com).
  const urlCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const hostname = new URL(urlCandidate).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    const fallbackHost = trimmed
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .split(':')[0]
      .toLowerCase();
    if (!fallbackHost) {
      return null;
    }
    return fallbackHost.startsWith('www.') ? fallbackHost.slice(4) : fallbackHost;
  }
}

export function renderSuspendedHtml(contactPath: string) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>المنصة معلقة</title>
  <style>
    :root {
      --bg: #0b1221;
      --card: #0f172a;
      --accent: #06b6d4;
      --accent-2: #6366f1;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.12), transparent 30%),
                  radial-gradient(circle at 80% 30%, rgba(6, 182, 212, 0.14), transparent 28%),
                  radial-gradient(circle at 50% 80%, rgba(14, 165, 233, 0.12), transparent 32%),
                  var(--bg);
      font-family: "Inter", "Cairo", system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--text);
      padding: 24px;
    }
    .card {
      width: min(960px, 100%);
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.88));
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 28px;
      box-shadow: 0 20px 70px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      position: relative;
      isolation: isolate;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 25% 20%, rgba(99, 102, 241, 0.1), transparent 32%),
                  radial-gradient(circle at 75% 10%, rgba(6, 182, 212, 0.12), transparent 30%);
      opacity: 0.9;
      z-index: 0;
    }
    .content { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .left, .right { padding: 32px; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.25);
      color: #67e8f9;
      padding: 10px 16px;
      border-radius: 999px;
      font-weight: 600;
      letter-spacing: 0.4px;
    }
    h1 {
      margin: 18px 0 12px;
      font-size: clamp(24px, 3vw, 32px);
      color: #f8fafc;
      line-height: 1.3;
    }
    p { margin: 0; color: var(--muted); line-height: 1.7; font-size: 15px; }
    .highlight {
      margin-top: 18px;
      padding: 16px;
      border-radius: 16px;
      background: linear-gradient(90deg, rgba(6, 182, 212, 0.14), rgba(99, 102, 241, 0.12));
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #e0f2fe;
      font-weight: 600;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
    .primary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 18px;
      border-radius: 14px;
      background: linear-gradient(120deg, var(--accent), var(--accent-2));
      color: #0b1221;
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 14px 28px rgba(99, 102, 241, 0.26);
      transition: transform 120ms ease, box-shadow 120ms ease, translate 120ms ease;
    }
    .primary-btn:hover { transform: translateY(-1px); box-shadow: 0 18px 34px rgba(99, 102, 241, 0.32); }
    .secondary-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 13px 16px;
      border-radius: 14px;
      color: var(--text);
      text-decoration: none;
      border: 1px dashed rgba(255, 255, 255, 0.25);
      background: rgba(255, 255, 255, 0.03);
    }
    .right {
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.9));
      border-left: 1px solid rgba(255, 255, 255, 0.06);
    }
    .info-card {
      display: grid;
      gap: 14px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .info-label { color: var(--muted); font-size: 14px; }
    .info-value { color: #e2e8f0; font-weight: 700; }
    @media (max-width: 640px) { .actions { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="content">
      <div class="left">
        <div class="pill">تنبيه هام</div>
        <h1>تم تعليق المنصة الخاصة بكم مؤقتاً</h1>
        <p>
          تم تعليق استضافة منصتكم. نقدر تعاونكم ونسعد بمساعدتكم فور تواصلكم معنا.
        </p>
        <div class="highlight">الرجاء التواصل معنا لإعادة تفعيل المنصة واستئناف العمل.</div>
        <div class="actions">
          <a class="primary-btn" href="${contactPath}">انتقل إلى صفحة التواصل</a>
          <a class="secondary-btn" href="mailto:support@naioshfit.com">support@naioshfit.com</a>
        </div>
      </div>
      <div class="right">
        <div class="info-card">
          <div>
            <div class="info-label">حالة المنصة</div>
            <div class="info-value">معلقة مؤقتاً</div>
          </div>
          <div>
            <div class="info-label">خطوات مقترحة</div>
            <div class="info-value">التواصل معنا لإعادة التفعيل</div>
          </div>
          <div>
            <div class="info-label">قنوات الدعم</div>
            <div class="info-value">البريد الإلكتروني أو نموذج التواصل</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function renderContactHtml() {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>تواصل معنا</title>
  <style>
    :root {
      --bg: #0b1221;
      --card: #0f172a;
      --accent: #06b6d4;
      --accent-2: #6366f1;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.12), transparent 30%),
                  radial-gradient(circle at 80% 30%, rgba(6, 182, 212, 0.14), transparent 28%),
                  radial-gradient(circle at 50% 80%, rgba(14, 165, 233, 0.12), transparent 32%),
                  var(--bg);
      font-family: "Inter", "Cairo", system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--text);
      padding: 24px;
    }
    .card {
      width: min(980px, 100%);
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.86));
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 30px;
      box-shadow: 0 20px 70px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      position: relative;
      isolation: isolate;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.14), transparent 35%),
                  radial-gradient(circle at 80% 30%, rgba(6, 182, 212, 0.16), transparent 32%);
      opacity: 0.9;
      z-index: 0;
    }
    .content { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
    .left, .right { padding: 36px; }
    h1 { margin: 0 0 12px; font-size: clamp(26px, 3vw, 34px); color: #f8fafc; }
    p { margin: 0 0 16px; color: var(--muted); line-height: 1.8; font-size: 15px; }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.2);
      color: #67e8f9;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin-bottom: 14px;
    }
    .grid { display: grid; gap: 12px; margin-top: 12px; }
    .info {
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .info strong { display: block; color: #e2e8f0; margin-bottom: 6px; }
    .pill-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 16px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 800;
      background: linear-gradient(120deg, var(--accent), var(--accent-2));
      color: #0b1221;
      box-shadow: 0 14px 28px rgba(99, 102, 241, 0.26);
    }
    .ghost {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      border: 1px dashed rgba(255, 255, 255, 0.2);
    }
    form { display: grid; gap: 12px; }
    label { display: block; color: #e2e8f0; font-weight: 700; margin-bottom: 6px; }
    input, textarea {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.04);
      color: #f8fafc;
      font-size: 15px;
      resize: vertical;
    }
    input:focus, textarea:focus { outline: 2px solid rgba(99, 102, 241, 0.5); }
    .submit { cursor: pointer; border: none; }
    .status { margin-top: 8px; padding: 12px 14px; border-radius: 12px; font-weight: 700; }
    .status.success { background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.4); color: #bbf7d0; }
    .status.error { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: #fecdd3; }
    @media (max-width: 640px) { .pill-actions { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="content">
      <div class="left">
        <div class="tag">نحن هنا للمساعدة</div>
        <h1>تواصل معنا لأي استفسار</h1>
        <p>
          فريق الدعم جاهز لمساعدتك في إعادة تفعيل المنصة أو الإجابة عن أي أسئلة. أرسل لنا رسالة، وسنتواصل معك في أقرب وقت.
        </p>
        <div class="grid">
          <div class="info"><strong>البريد الإلكتروني</strong>support@naioshfit.com</div>
          <div class="info"><strong>ساعات العمل</strong>من الأحد إلى الخميس — 9 صباحاً حتى 6 مساءً</div>
          <div class="info"><strong>الأولوية</strong>طلبات إعادة التفعيل يتم معالجتها أولاً</div>
        </div>
        <div class="pill-actions">
          <a class="button" href="mailto:support@naioshfit.com">إرسال بريد الآن</a>
          <a class="button ghost" href="/">العودة للرئيسية</a>
        </div>
      </div>
      <div class="right">
        <form id="contactForm">
          <div>
            <label>الاسم الكامل</label>
            <input name="name" type="text" required placeholder="اكتب اسمك" />
          </div>
          <div>
            <label>البريد الإلكتروني</label>
            <input name="email" type="email" required placeholder="example@email.com" />
          </div>
          <div>
            <label>كيف يمكننا مساعدتك؟</label>
            <textarea name="message" rows="4" required placeholder="اشرح المشكلة أو الاستفسار"></textarea>
          </div>
          <button id="submitBtn" type="submit" class="button submit">إرسال الطلب</button>
          <div id="status" class="status" style="display:none"></div>
        </form>
      </div>
    </div>
  </div>
  <script>
    (function() {
      const form = document.getElementById('contactForm');
      const statusEl = document.getElementById('status');
      const submitBtn = document.getElementById('submitBtn');

      function setStatus(message, type) {
        statusEl.textContent = message || '';
        statusEl.style.display = message ? 'block' : 'none';
        statusEl.className = 'status ' + (type || '');
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setStatus('', '');
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الإرسال...';

        const formData = new FormData(form);
        const payload = {
          name: (formData.get('name') || '').toString().trim(),
          email: (formData.get('email') || '').toString().trim(),
          message: (formData.get('message') || '').toString().trim(),
        };

        try {
          const resp = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.message || 'فشل إرسال الرسالة');
          }

          setStatus('تم إرسال رسالتك بنجاح. سنعود إليك قريباً.', 'success');
          form.reset();
        } catch (err) {
          setStatus(err?.message || 'تعذر إرسال الرسالة. حاول لاحقاً.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'إرسال الطلب';
        }
      });
    })();
  </script>
</body>
</html>`;
}

function extractSubdomain(host: string): string | null {
  const normalizedMainDomain = normalizeMainDomainHost(MAIN_DOMAIN);
  if (!normalizedMainDomain) {
    return null;
  }

  const normalizedHost = host.split(':')[0].toLowerCase();
  if (!(normalizedHost === normalizedMainDomain || normalizedHost.endsWith(`.${normalizedMainDomain}`))) {
    return null;
  }

  const trimmed = normalizedHost.slice(0, -(normalizedMainDomain.length + 1));
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split('.');
  if (parts.length === 0) {
    return null;
  }

  return normalizeSubdomain(parts[parts.length - 1]);
}

export function requireTenantPool(req: Request, _res: Response, next: NextFunction) {
  if (!(req as any).tenant || !(req as any).tenantPool) {
    return next(new Error('Tenant context missing for tenant-scoped route.'));
  }
  return next();
}

export async function tenantResolver(req: Request, res: Response, next: NextFunction) {
  const normalizedMainDomain = normalizeMainDomainHost(MAIN_DOMAIN);
  if (!normalizedMainDomain) {
    return res.status(503).json({ message: 'Tenant routing is not configured.' });
  }

  const hostHeader = req.headers.host;
  if (!hostHeader) {
    return res.status(400).json({ message: 'Host header is required for tenant resolution.' });
  }

  const normalizedHost = hostHeader.split(':')[0].toLowerCase();
  const mainDomainHost = normalizedMainDomain;

  // Allow apex or www host to proceed to central app
  if (normalizedHost === mainDomainHost || normalizedHost === `www.${mainDomainHost}`) {
    return next();
  }

  const subdomain = extractSubdomain(hostHeader);
  if (!subdomain) {
    return res.status(400).json({ message: 'Tenant subdomain is required.' });
  }

  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    // Reserved hostnames should continue on the main domain
    return next();
  }

  if (!isValidSubdomain(subdomain)) {
    return res.status(400).json({ message: 'Invalid tenant subdomain.' });
  }

  try {
    const pool = getCentralPool();
    const result = await pool.query<TenantRecord>(
      'SELECT * FROM tenants WHERE subdomain = $1 AND status <> $2',
      [subdomain, 'deleted']
    );

    const tenant = result.rows[0];
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found.' });
    }

    const acceptsHtml = req.accepts?.(['html', 'json']) === 'html' || req.headers.accept?.includes('text/html');
    const isApiPath = req.path?.startsWith('/api');
    const isContactPath = req.path === '/contact' || req.path?.startsWith('/contact/');
    const contactHost = normalizedMainDomain
      ? `www.${normalizedMainDomain}`
      : null;
    const contactPath = contactHost ? `https://${contactHost}/contact` : '/contact';

    if (tenant.status === 'suspended') {
      if (acceptsHtml && !isApiPath) {
        if (isContactPath) {
          return res.redirect(302, contactPath);
        }
        const page = renderSuspendedHtml(contactPath);
        return res.status(403).send(page);
      }
      return res.status(403).json({ message: 'Tenant is suspended.' });
    }

    if (tenant.status === 'pending_payment') {
      const language = getRequestLanguage(req);
      return res.status(402).json({ message: getTenantPaymentRequiredMessage(language) });
    }

    const tenantPool = await getTenantPool(tenant);
    (req as any).tenant = tenant;
    (req as any).tenantPool = tenantPool;

    return next();
  } catch (error) {
    console.error('[TENANT RESOLVER] Failed to resolve tenant:', error);
    return res.status(500).json({ message: 'Failed to resolve tenant.' });
  }
}
