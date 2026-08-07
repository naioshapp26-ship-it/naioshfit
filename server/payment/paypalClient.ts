type PayPalMode = 'sandbox' | 'live';

const PAYPAL_BASE_URL: Record<PayPalMode, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

export interface PayPalAuthConfig {
  clientId: string;
  clientSecret: string;
  isLiveMode: boolean;
}

export interface PayPalOrderItem {
  name: string;
  description?: string;
  unitAmount: string;
  quantity: number;
}

export interface PayPalShippingAddress {
  addressLine1: string;
  addressLine2?: string;
  adminArea2: string;
  adminArea1?: string;
  postalCode?: string;
  countryCode: string;
}

export interface PayPalShipping {
  fullName?: string;
  address: PayPalShippingAddress;
}

export interface PayPalCreateOrderInput {
  auth: PayPalAuthConfig;
  amount: string;
  currency: string;
  customId?: string;
  invoiceId?: string;
  description?: string;
  items?: PayPalOrderItem[];
  shipping?: PayPalShipping;
  shippingPreference?: 'NO_SHIPPING' | 'SET_PROVIDED_ADDRESS' | 'GET_FROM_FILE';
}

export interface PayPalCreateSubscriptionInput {
  auth: PayPalAuthConfig;
  planId: string;
  customId?: string;
  subscriber?: {
    name?: {
      givenName?: string;
      surname?: string;
    };
    emailAddress?: string;
  };
  returnUrl: string;
  cancelUrl: string;
}

function getPayPalMode(isLiveMode: boolean): PayPalMode {
  return isLiveMode ? 'live' : 'sandbox';
}

function getPayPalBaseUrl(isLiveMode: boolean): string {
  return PAYPAL_BASE_URL[getPayPalMode(isLiveMode)];
}

async function getPayPalAccessToken(auth: PayPalAuthConfig): Promise<string> {
  const baseUrl = getPayPalBaseUrl(auth.isLiveMode);
  const credentials = Buffer.from(`${auth.clientId}:${auth.clientSecret}`).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal auth failed: ${error}`);
  }

  const payload = await response.json();
  return payload.access_token as string;
}

export async function testPayPalConnection(auth: PayPalAuthConfig): Promise<boolean> {
  try {
    await getPayPalAccessToken(auth);
    return true;
  } catch (error) {
    console.error('[PAYPAL] Connection test failed:', error);
    return false;
  }
}

async function paypalRequest<T>(auth: PayPalAuthConfig, path: string, init: RequestInit): Promise<T> {
  const baseUrl = getPayPalBaseUrl(auth.isLiveMode);
  const token = await getPayPalAccessToken(auth);

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal API error: ${error}`);
  }

  return response.json() as Promise<T>;
}

export async function createPayPalOrder(input: PayPalCreateOrderInput): Promise<{ id: string; status: string; links?: any[] }> {
  const body: Record<string, any> = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: input.currency,
          value: input.amount,
        },
        ...(input.customId ? { custom_id: input.customId } : {}),
        ...(input.invoiceId ? { invoice_id: input.invoiceId } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.items?.length
          ? {
              items: input.items.map((item) => ({
                name: item.name,
                description: item.description,
                unit_amount: {
                  currency_code: input.currency,
                  value: item.unitAmount,
                },
                quantity: String(item.quantity),
              })),
            }
          : {}),
        ...(input.shipping
          ? {
              shipping: {
                name: input.shipping.fullName ? { full_name: input.shipping.fullName } : undefined,
                address: {
                  address_line_1: input.shipping.address.addressLine1,
                  address_line_2: input.shipping.address.addressLine2,
                  admin_area_2: input.shipping.address.adminArea2,
                  admin_area_1: input.shipping.address.adminArea1,
                  postal_code: input.shipping.address.postalCode,
                  country_code: input.shipping.address.countryCode,
                },
              },
            }
          : {}),
      },
    ],
    application_context: {
      shipping_preference: input.shippingPreference || 'NO_SHIPPING',
      user_action: 'PAY_NOW',
    },
  };

  return paypalRequest(input.auth, '/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function capturePayPalOrder(auth: PayPalAuthConfig, orderId: string): Promise<any> {
  return paypalRequest(auth, `/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createPayPalSubscription(input: PayPalCreateSubscriptionInput): Promise<{ id: string; status: string; links?: any[] }> {
  const body: Record<string, any> = {
    plan_id: input.planId,
    ...(input.customId ? { custom_id: input.customId } : {}),
    application_context: {
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      user_action: 'SUBSCRIBE_NOW',
    },
  };

  if (input.subscriber) {
    const subscriber: Record<string, any> = {};
    if (input.subscriber.name?.givenName || input.subscriber.name?.surname) {
      subscriber.name = {
        given_name: input.subscriber.name?.givenName,
        surname: input.subscriber.name?.surname,
      };
    }
    if (input.subscriber.emailAddress) {
      subscriber.email_address = input.subscriber.emailAddress;
    }
    if (Object.keys(subscriber).length) {
      body.subscriber = subscriber;
    }
  }

  return paypalRequest(input.auth, '/v1/billing/subscriptions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPayPalSubscription(auth: PayPalAuthConfig, subscriptionId: string): Promise<any> {
  return paypalRequest(auth, `/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
  });
}

export async function verifyPayPalWebhookSignature(options: {
  auth: PayPalAuthConfig;
  webhookId: string;
  headers: Record<string, string | string[] | undefined>;
  event: Record<string, any>;
}): Promise<boolean> {
  const transmissionId = String(options.headers['paypal-transmission-id'] || '');
  const transmissionTime = String(options.headers['paypal-transmission-time'] || '');
  const transmissionSig = String(options.headers['paypal-transmission-sig'] || '');
  const certUrl = String(options.headers['paypal-cert-url'] || '');
  const authAlgo = String(options.headers['paypal-auth-algo'] || '');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const body = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: options.webhookId,
    webhook_event: options.event,
  };

  const response = await paypalRequest<{ verification_status: string }>(options.auth, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return response.verification_status === 'SUCCESS';
}

export function formatPayPalAmount(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0.00';
  }
  return amount.toFixed(2);
}
