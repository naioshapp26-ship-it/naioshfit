import crypto from 'crypto';

type PaymobMode = 'sandbox' | 'live';

const DEFAULT_PAYMOB_BASE_URL: Record<PaymobMode, string> = {
  sandbox: 'https://accept.paymob.com',
  live: 'https://accept.paymob.com',
};

export interface PaymobAuthConfig {
  secretKey: string;
  publicKey?: string;
  baseUrl?: string;
  isLiveMode?: boolean;
}

export interface PaymobIntentionItem {
  name: string;
  amount: number;
  quantity: number;
  description?: string;
}

export interface PaymobCreateIntentionInput {
  auth: PaymobAuthConfig;
  amount: number;
  currency: string;
  paymentMethods: string[];
  items?: PaymobIntentionItem[];
  billingData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  successUrl?: string;
  failureUrl?: string;
  callbackUrl?: string;
}

export interface PaymobIntentionResponse {
  id: string | null;
  clientSecret: string | null;
  paymentUrl: string | null;
  raw: Record<string, any>;
}

function getPaymobMode(isLiveMode?: boolean): PaymobMode {
  return isLiveMode ? 'live' : 'sandbox';
}

function normalizeBaseUrl(baseUrl?: string, isLiveMode?: boolean): string {
  const resolved = (baseUrl || DEFAULT_PAYMOB_BASE_URL[getPaymobMode(isLiveMode)]).trim();
  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved;
}

function buildPaymobHeaders(secretKey: string): Record<string, string> {
  return {
    Authorization: `Token ${secretKey}`,
    'Content-Type': 'application/json',
  };
}

export async function createPaymobIntention(input: PaymobCreateIntentionInput): Promise<PaymobIntentionResponse> {
  const baseUrl = normalizeBaseUrl(input.auth.baseUrl, input.auth.isLiveMode);

  const paymentMethods = (input.paymentMethods || []).map((method) => {
    if (typeof method === 'string') {
      const trimmed = method.trim();
      if (/^\d+$/.test(trimmed)) {
        return Number(trimmed);
      }
      return trimmed;
    }
    return method;
  });

  const payload: Record<string, any> = {
    amount: input.amount,
    currency: input.currency,
    payment_methods: paymentMethods,
  };

  if (input.items?.length) {
    payload.items = input.items.map((item) => ({
      name: item.name,
      amount: item.amount,
      quantity: item.quantity,
      ...(item.description ? { description: item.description } : {}),
    }));
  }

  if (input.billingData && Object.keys(input.billingData).length) {
    payload.billing_data = input.billingData;
  }

  if (input.metadata && Object.keys(input.metadata).length) {
    payload.metadata = input.metadata;
  }

  if (input.successUrl) {
    payload.success_url = input.successUrl;
  }

  if (input.failureUrl) {
    payload.failure_url = input.failureUrl;
  }

  if (input.callbackUrl) {
    payload.notification_url = input.callbackUrl;
  }

  const response = await fetch(`${baseUrl}/v1/intention`, {
    method: 'POST',
    headers: buildPaymobHeaders(input.auth.secretKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paymob API error: ${error}`);
  }

  const data = (await response.json()) as Record<string, any>;

  return {
    id: data.id || data.intention_id || data?.intention?.id || null,
    clientSecret: data.client_secret || data.clientSecret || data.secret || null,
    paymentUrl: data.payment_url || data.checkout_url || data.url || data.redirect_url || null,
    raw: data,
  };
}

export function resolvePaymobSignature(headers: Record<string, string | string[] | undefined>, body: Record<string, any>): string | null {
  const headerValue = headers['x-paymob-signature']
    || headers['x-paymob-hmac']
    || headers['x-paymob-signature-hmac'];

  if (Array.isArray(headerValue)) {
    return headerValue[0] || null;
  }

  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  const bodyHmac = body?.hmac || body?.signature || null;
  return typeof bodyHmac === 'string' && bodyHmac.trim() ? bodyHmac.trim() : null;
}

export function verifyPaymobWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
  const raw = typeof payload === 'string' ? payload : payload.toString('utf8');
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (error) {
    return false;
  }
}
