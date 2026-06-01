import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalEmbeddedCheckoutProps {
  clientId: string;
  currency: string;
  mode: 'order' | 'subscription';
  orderId?: string | null;
  subscriptionId?: string | null;
  createOrder?: () => Promise<string>;
  createSubscription?: () => Promise<string>;
  onApprove?: (data: any) => Promise<void> | void;
  onCancel?: () => void;
}

const PAYPAL_SCRIPT_ID = 'paypal-js-sdk';

const loadPayPalScript = (options: {
  clientId: string;
  currency: string;
  mode: 'order' | 'subscription';
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    const desiredIntent = options.mode === 'subscription' ? 'subscription' : 'capture';
    const desiredVault = options.mode === 'subscription' ? 'true' : 'false';

    const existing = document.getElementById(PAYPAL_SCRIPT_ID) as HTMLScriptElement | null;
    const existingIntent = existing?.dataset?.intent;
    const existingVault = existing?.dataset?.vault;
    const existingClientId = existing?.dataset?.clientId;
    const existingCurrency = existing?.dataset?.currency;

    const needsReload = Boolean(existing) && (
      existingIntent !== desiredIntent
      || existingVault !== desiredVault
      || existingClientId !== options.clientId
      || existingCurrency !== options.currency
    );

    if (needsReload) {
      existing?.remove();
      if (window.paypal) {
        delete window.paypal;
      }
    } else if (existing) {
      if (window.paypal) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('PayPal SDK failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.id = PAYPAL_SCRIPT_ID;
    const params = new URLSearchParams({
      'client-id': options.clientId,
      currency: options.currency,
      intent: desiredIntent,
      vault: desiredVault,
      components: 'buttons',
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.dataset.intent = desiredIntent;
    script.dataset.vault = desiredVault;
    script.dataset.clientId = options.clientId;
    script.dataset.currency = options.currency;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.body.appendChild(script);
  });
};

export const PayPalEmbeddedCheckout = ({
  clientId,
  currency,
  mode,
  orderId,
  subscriptionId,
  createOrder,
  createSubscription,
  onApprove,
  onCancel,
}: PayPalEmbeddedCheckoutProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const renderButtons = async () => {
      try {
        await loadPayPalScript({ clientId, currency, mode });
        if (!mounted || !containerRef.current || !window.paypal) {
          return;
        }

        containerRef.current.innerHTML = '';

        const buttons = window.paypal.Buttons({
          style: {
            layout: 'vertical',
            shape: 'rect',
            label: mode === 'subscription' ? 'subscribe' : 'paypal',
          },
          createOrder: mode === 'order'
            ? async () => {
                if (orderId) return orderId;
                if (createOrder) return createOrder();
                throw new Error('Missing PayPal order id');
              }
            : undefined,
          createSubscription: mode === 'subscription'
            ? async () => {
                if (subscriptionId) return subscriptionId;
                if (createSubscription) return createSubscription();
                throw new Error('Missing PayPal subscription id');
              }
            : undefined,
          onApprove: async (data: any) => {
            if (onApprove) {
              await onApprove(data);
            }
          },
          onCancel: () => {
            if (onCancel) onCancel();
          },
          onError: () => {
            if (mounted) {
              setError('Unable to load PayPal checkout. Please try again.');
            }
          },
        });

        if (buttons.isEligible()) {
          await buttons.render(containerRef.current);
        } else if (mounted) {
          setError('PayPal is not available for this transaction.');
        }
      } catch (err) {
        if (mounted) {
          setError('Unable to load PayPal checkout. Please try again.');
        }
      }
    };

    renderButtons();

    return () => {
      mounted = false;
    };
  }, [clientId, currency, mode, orderId, subscriptionId, createOrder, createSubscription, onApprove, onCancel]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return <div ref={containerRef} />;
};

export default PayPalEmbeddedCheckout;
