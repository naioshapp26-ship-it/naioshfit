import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CreditCard, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import EmbeddedCheckout from '@/components/payments/EmbeddedCheckout';
import PayPalEmbeddedCheckout from '@/components/payments/PayPalEmbeddedCheckout';
import PaymobEmbeddedCheckout from '@/components/payments/PaymobEmbeddedCheckout';

interface CreditBundle {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  is_active: boolean;
  sort_order: number | null;
}

interface CreditSummaryResponse {
  balance: number;
  lowBalanceThreshold: number;
  isLow: boolean;
  exhausted: boolean;
  bundles: CreditBundle[];
}

interface PurchaseSessionResponse {
  sessionId: string;
  checkoutUrl: string | null;
  clientSecret: string | null;
  paymentProvider?: 'stripe' | 'paypal' | 'paymob' | 'free';
  completed?: boolean;
  balance?: number | null;
}

interface BillingPanelProps {
  standalone?: boolean;
}

export const BillingPanel = ({ standalone = false }: BillingPanelProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal' | 'paymob'>('stripe');
  const [stripeConfigured, setStripeConfigured] = useState(true);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paymobConfigured, setPaymobConfigured] = useState(false);
  const [paymobPublicKey, setPaymobPublicKey] = useState<string | null>(null);
  const [paymobBaseUrl, setPaymobBaseUrl] = useState<string | null>(null);
  const [paymobCheckoutUrl, setPaymobCheckoutUrl] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<CreditSummaryResponse>({
    queryKey: ['payments', 'credits'],
    queryFn: async () => {
      const response = await fetch('/api/credits/summary', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to load credit summary');
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (data && !selectedPackage && data.bundles.length > 0) {
      setSelectedPackage(data.bundles[0].id);
    }
  }, [data, selectedPackage]);

  useEffect(() => {
    setCheckoutClientSecret(null);
    setCheckoutSessionId(null);
    setIsCheckoutVisible(false);
    setPaypalClientId(null);
    setPaypalOrderId(null);
    setPaymobPublicKey(null);
    setPaymobBaseUrl(null);
    setPaymobCheckoutUrl(null);
  }, [selectedPackage]);

  useEffect(() => {
    const loadGatewayStatus = async () => {
      try {
        const [stripeStatus, paypalStatus, paymobStatus] = await Promise.all([
          fetch('/api/stripe/status', { credentials: 'include' }).then((res) => res.json()),
          fetch('/api/paypal/status', { credentials: 'include' }).then((res) => res.json()),
          fetch('/api/paymob/status', { credentials: 'include' }).then((res) => res.json()),
        ]);
        setStripeConfigured(Boolean(stripeStatus?.configured));
        setPaypalConfigured(Boolean(paypalStatus?.configured));
        setPaymobConfigured(Boolean(paymobStatus?.configured));
        if (!stripeStatus?.configured && paypalStatus?.configured) {
          setPaymentProvider('paypal');
        } else if (!stripeStatus?.configured && !paypalStatus?.configured && paymobStatus?.configured) {
          setPaymentProvider('paymob');
        }
      } catch (error) {
        setStripeConfigured(false);
        setPaypalConfigured(false);
        setPaymobConfigured(false);
      }
    };

    loadGatewayStatus();
  }, []);

  const selectedPackageData = useMemo(() => {
    if (!data) return undefined;
    return data.bundles.find((bundle) => bundle.id === selectedPackage);
  }, [data, selectedPackage]);

  const isFreeBundle = selectedPackageData ? selectedPackageData.price_cents <= 0 : false;
  const anyPaymentProviderConfigured = stripeConfigured || paypalConfigured || paymobConfigured;
  const canStartCheckout = Boolean(
    selectedPackageData
    && (isFreeBundle || (
      (paymentProvider === 'stripe' && stripeConfigured)
      || (paymentProvider === 'paypal' && paypalConfigured)
      || (paymentProvider === 'paymob' && paymobConfigured)
    )),
  );

  const isStripeCheckoutActive = Boolean(isCheckoutVisible && checkoutClientSecret && publishableKey);
  const isPayPalCheckoutActive = Boolean(isCheckoutVisible && paypalClientId && paypalOrderId);
  const isPaymobCheckoutActive = Boolean(isCheckoutVisible && checkoutClientSecret && paymobPublicKey);

  const createOrderMutation = useMutation({
    mutationFn: async (): Promise<PurchaseSessionResponse> => {
      if (!selectedPackageData) {
        throw new Error(t('selectPackageFirst'));
      }
      const response = await fetch('/api/credits/purchase-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bundleId: selectedPackageData.id,
          paymentProvider,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to create payment session');
      }
      return payload;
    },
    onError: (error: any) => {
      toast({
        title: t('paymentInitFailed'),
        description: error?.message || t('pleaseTryAgain'),
        variant: 'destructive',
      });
    },
    onSuccess: (session) => {
      if (session?.completed) {
        toast({ title: t('paymentSuccess') });
        refetch();
        return;
      }
      toast({ title: t('processingPayment') });
    },
  });

  const fetchPublishableKey = async () => {
    const response = await fetch('/api/stripe/publishable-key', { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Failed to load Stripe configuration');
    }
    return payload.publishableKey as string;
  };

  const fetchPayPalClientId = async () => {
    const response = await fetch('/api/paypal/client-id', { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Failed to load PayPal configuration');
    }
    return payload.clientId as string;
  };

  const fetchPaymobConfig = async () => {
    const response = await fetch('/api/paymob/config', { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || 'Failed to load Paymob configuration');
    }
    return {
      publicKey: payload.publicKey as string,
      baseUrl: payload.baseUrl as string | null,
    };
  };

  const startCheckout = async () => {
    if (!data) return;
    if (!selectedPackageData) {
      toast({ title: t('selectPackageFirst'), variant: 'destructive' });
      return;
    }

    const providerReady =
      isFreeBundle
      || (paymentProvider === 'stripe' && stripeConfigured)
      || (paymentProvider === 'paypal' && paypalConfigured)
      || (paymentProvider === 'paymob' && paymobConfigured);

    if (!providerReady) {
      toast({
        title: t('paymentInitFailed'),
        description: t('saasPaymentNotConfigured'),
        variant: 'destructive',
      });
      return;
    }

    const session = await createOrderMutation.mutateAsync();
    const resolvedProvider = session?.paymentProvider || paymentProvider;

    if (session?.completed) {
      setIsCheckoutVisible(false);
      return;
    }

    if (resolvedProvider === 'stripe') {
      if (!session?.clientSecret) {
        toast({
          title: t('paymentInitFailed'),
          description: t('pleaseTryAgain'),
          variant: 'destructive',
        });
        return;
      }

      let stripeKey = publishableKey;
      if (!stripeKey) {
        try {
          stripeKey = await fetchPublishableKey();
          setPublishableKey(stripeKey);
        } catch (error: any) {
          toast({
            title: t('paymentInitFailed'),
            description: error?.message || t('pleaseTryAgain'),
            variant: 'destructive',
          });
          return;
        }
      }

      setCheckoutSessionId(session.sessionId);
      setCheckoutClientSecret(session.clientSecret);
      setIsCheckoutVisible(true);
      return;
    }

    if (resolvedProvider === 'paypal' && session?.sessionId) {
      try {
        const paypalId = await fetchPayPalClientId();
        setPaypalClientId(paypalId);
        setPaypalOrderId(session.sessionId);
        setCheckoutSessionId(session.sessionId);
        setIsCheckoutVisible(true);
      } catch (error: any) {
        toast({
          title: t('paymentInitFailed'),
          description: error?.message || t('pleaseTryAgain'),
          variant: 'destructive',
        });
      }
    }

    if (resolvedProvider === 'paymob' && session?.clientSecret) {
      try {
        const paymobConfig = await fetchPaymobConfig();
        setPaymobPublicKey(paymobConfig.publicKey);
        setPaymobBaseUrl(paymobConfig.baseUrl);
        setPaymobCheckoutUrl(session.checkoutUrl);
        setCheckoutSessionId(session.sessionId);
        setCheckoutClientSecret(session.clientSecret);
        setIsCheckoutVisible(true);
      } catch (error: any) {
        toast({
          title: t('paymentInitFailed'),
          description: error?.message || t('pleaseTryAgain'),
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            {t('billingAndSubscription')}
          </CardTitle>
          <CardDescription>{t('manageBillingInfo')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 ltr:mr-2 rtl:ml-2" />
              {t('creditBalance')}
            </CardTitle>
            <CardDescription>{t('billingOverview')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4 ltr:mr-2 rtl:ml-2', isFetching && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="border rounded-xl p-5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <div className="text-sm uppercase tracking-wider text-white/80">{t('availableCredits')}</div>
            <div className="text-4xl font-semibold mt-2">{data.balance.toLocaleString()}</div>
          </div>
          <div className="border rounded-xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600">{t('creditStatus')}</p>
              <p className="text-2xl font-bold mt-1">
                {data.isLow ? t('lowBalance') : t('balanceOk')}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t('lowBalanceThresholdLabel')}: {data.lowBalanceThreshold.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center text-sm text-gray-500 mt-3">
              <ShieldCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-emerald-500" />
              {paymentProvider === 'paypal'
                ? (t('poweredByPayPal') || 'Powered by PayPal')
                : (paymentProvider === 'paymob'
                    ? (t('poweredByPaymob') || 'Powered by Paymob')
                    : t('poweredByStripe'))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('topUpCredits')}</CardTitle>
              <CardDescription>{t('chooseCreditPackage')}</CardDescription>
            </div>
            {selectedPackageData && (
              <Badge variant="outline">
                {t('selectedCredits').replace('{credits}', selectedPackageData.credits.toLocaleString())}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.bundles.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('noPackagesAvailable')}</AlertTitle>
              <AlertDescription>{t('contactSupportForPackages')}</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {data.bundles.map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => setSelectedPackage(bundle.id)}
                  className={cn(
                    'border rounded-xl p-4 ltr:text-left rtl:text-right transition-all hover:shadow-md focus-visible:outline-none',
                    selectedPackage === bundle.id
                      ? 'border-primary shadow-lg bg-primary/5'
                      : 'border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-semibold">{bundle.credits.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">{t('creditsLabel')}</p>
                    </div>
                    <Badge variant="outline">{bundle.name}</Badge>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">{t('youPay')}</p>
                    <p className="text-xl font-bold">
                      {bundle.currency.toUpperCase()} {(bundle.price_cents / 100).toFixed(2)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isFreeBundle && !anyPaymentProviderConfigured && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('paymentInitFailed')}</AlertTitle>
              <AlertDescription>{t('saasPaymentNotConfigured')}</AlertDescription>
            </Alert>
          )}

          {!isFreeBundle && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'stripe' ? 'border-primary bg-white text-primary' : 'border-gray-200 bg-white text-gray-600'}`}
              onClick={() => setPaymentProvider('stripe')}
              disabled={!stripeConfigured}
            >
              {t('payWithStripe') || 'Pay with Stripe'}
            </button>
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'paypal' ? 'border-primary bg-white text-primary' : 'border-gray-200 bg-white text-gray-600'}`}
              onClick={() => setPaymentProvider('paypal')}
              disabled={!paypalConfigured}
            >
              {t('payWithPayPal') || 'Pay with PayPal'}
            </button>
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'paymob' ? 'border-primary bg-white text-primary' : 'border-gray-200 bg-white text-gray-600'}`}
              onClick={() => setPaymentProvider('paymob')}
              disabled={!paymobConfigured}
            >
              {t('payWithPaymob') || 'Pay with Paymob'}
            </button>
          </div>
          )}

          <Button
            className="w-full md:w-auto"
            size="lg"
            disabled={!canStartCheckout || createOrderMutation.isPending}
            onClick={startCheckout}
          >
            {createOrderMutation.isPending
              ? t('processingPayment')
              : (isFreeBundle ? t('claimFreeCredits') || t('startCheckout') : t('startCheckout'))}
          </Button>
        </CardContent>
      </Card>

      {isStripeCheckoutActive && (
        <Card>
          <CardHeader>
            <CardTitle>{t('billingAndSubscription')}</CardTitle>
            <CardDescription>{t('poweredByStripe')}</CardDescription>
          </CardHeader>
          <CardContent>
            <EmbeddedCheckout
              clientSecret={checkoutClientSecret}
              publishableKey={publishableKey}
              onComplete={async () => {
                toast({ title: t('paymentSuccess') });
                if (checkoutSessionId) {
                  try {
                    await fetch(`/api/stripe/verify-session/${checkoutSessionId}`, {
                      credentials: 'include',
                    });
                  } catch (error) {
                    console.warn('Failed to verify Stripe session:', error);
                  }
                }
                setTimeout(() => {
                  refetch();
                }, 1500);
                setIsCheckoutVisible(false);
              }}
            />
            {checkoutSessionId && (
              <p className="mt-4 text-xs text-gray-500">
                {t('paymentReference') || 'Payment reference'}: {checkoutSessionId}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isPayPalCheckoutActive && (
        <Card>
          <CardHeader>
            <CardTitle>{t('billingAndSubscription')}</CardTitle>
            <CardDescription>{t('poweredByPayPal') || 'Powered by PayPal'}</CardDescription>
          </CardHeader>
          <CardContent>
            <PayPalEmbeddedCheckout
              clientId={paypalClientId as string}
              currency={selectedPackageData?.currency?.toUpperCase() || 'USD'}
              mode="order"
              orderId={paypalOrderId}
              onApprove={async () => {
                if (!paypalOrderId) return;
                await fetch(`/api/paypal/orders/${paypalOrderId}/capture`, {
                  method: 'POST',
                  credentials: 'include',
                });
                toast({ title: t('paymentSuccess') });
                setTimeout(() => {
                  refetch();
                }, 1500);
                setIsCheckoutVisible(false);
              }}
            />
            {checkoutSessionId && (
              <p className="mt-4 text-xs text-gray-500">
                {t('paymentReference') || 'Payment reference'}: {checkoutSessionId}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isPaymobCheckoutActive && (
        <Card>
          <CardHeader>
            <CardTitle>{t('billingAndSubscription')}</CardTitle>
            <CardDescription>{t('poweredByPaymob') || 'Powered by Paymob'}</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymobEmbeddedCheckout
              clientSecret={checkoutClientSecret as string}
              publicKey={paymobPublicKey as string}
              baseUrl={paymobBaseUrl}
              checkoutUrl={paymobCheckoutUrl}
            />
            {checkoutSessionId && (
              <p className="mt-4 text-xs text-gray-500">
                {t('paymentReference') || 'Payment reference'}: {checkoutSessionId}
              </p>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default BillingPanel;
