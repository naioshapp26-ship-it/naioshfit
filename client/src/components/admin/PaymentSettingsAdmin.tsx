import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Shield,
  Info,
} from 'lucide-react';

interface PaymentSettings {
  id?: number;
  stripe_publishable_key: string;
  is_live_mode: boolean;
  has_secret_key: boolean;
  has_webhook_secret: boolean;
  paypal_client_id?: string | null;
  paypal_merchant_id?: string | null;
  paypal_is_live_mode?: boolean | null;
  has_paypal_client_secret?: boolean;
  has_paypal_webhook_id?: boolean;
  paymob_public_key?: string | null;
  paymob_base_url?: string | null;
  paymob_is_live_mode?: boolean | null;
  paymob_integration_ids?: string[] | null;
  has_paymob_secret_key?: boolean;
  has_paymob_hmac_secret?: boolean;
  saas_plan_config?: Array<{ key: string; name: string; price_id: string; paypal_plan_id?: string }>;
  saas_trial_days?: number;
  created_at?: string;
  updated_at?: string;
  configured?: boolean;
}

interface PaymentTransaction {
  id: number;
  stripe_payment_id: string;
  amount: number | string | null;
  currency: string;
  status: string;
  payment_type: string;
  created_at: string;
  tenant_subdomain?: string;
  tenant_company_name?: string;
  customer_email?: string;
  first_name?: string;
  last_name?: string;
}

export default function PaymentSettingsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  const resolvePaymentSettingsError = (message: string) => {
    const normalized = (message || '').trim();
    if (!normalized) return t('failedToSavePaymentSettings');

    if (normalized.includes('Stripe publishable key and secret key are required')) {
      return t('publishableAndSecretRequired');
    }
    if (normalized.includes('Invalid publishable key format')) {
      return t('invalidPublishableKeyPrefix');
    }
    if (normalized.includes('Invalid secret key format')) {
      return t('invalidSecretKeyPrefix');
    }
    if (normalized.includes('PayPal client id and secret are required')) {
      return t('paypalClientAndSecretRequired');
    }
    if (normalized.includes('Paymob public key and secret key are required')) {
      return t('paymobPublicAndSecretRequired');
    }
    if (normalized.includes('Each plan must include a key and name')) {
      return t('saasPlanFieldsRequired');
    }
    if (normalized.includes('Plan keys must be unique')) {
      return t('saasPlanKeysUnique');
    }
    if (normalized.includes('Stripe price IDs must start with price_')) {
      return t('saasPlanPriceInvalid');
    }
    if (normalized.includes('Invalid Stripe keys')) {
      return t('invalidStripeKeys');
    }
    if (normalized.includes('Invalid PayPal keys')) {
      return t('invalidPayPalKeys');
    }

    return normalized;
  };
  
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalWebhookId, setPaypalWebhookId] = useState('');
  const [paypalMerchantId, setPaypalMerchantId] = useState('');
  const [paypalIsLiveMode, setPaypalIsLiveMode] = useState(false);
  const [showPaypalSecret, setShowPaypalSecret] = useState(false);
  const [showPaypalWebhook, setShowPaypalWebhook] = useState(false);
  const [isTestingPaypal, setIsTestingPaypal] = useState(false);
  const [paymobPublicKey, setPaymobPublicKey] = useState('');
  const [paymobSecretKey, setPaymobSecretKey] = useState('');
  const [paymobHmacSecret, setPaymobHmacSecret] = useState('');
  const [paymobIntegrationIds, setPaymobIntegrationIds] = useState('');
  const [paymobBaseUrl, setPaymobBaseUrl] = useState('');
  const [paymobIsLiveMode, setPaymobIsLiveMode] = useState(false);
  const [showPaymobSecret, setShowPaymobSecret] = useState(false);
  const [showPaymobHmac, setShowPaymobHmac] = useState(false);
  const [saasPlans, setSaasPlans] = useState<Array<{ key: string; name: string; price_id: string; paypal_plan_id?: string }>>([]);
  const [trialDays, setTrialDays] = useState(14);
  const [showAllTransactionsDialog, setShowAllTransactionsDialog] = useState(false);
  const [allTransactionsPage, setAllTransactionsPage] = useState(1);

  // Fetch current settings
  const { data: settings, isLoading: loadingSettings, error: settingsError } = useQuery<PaymentSettings>({
    queryKey: ['payment-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/payment-settings', {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 403) throw new Error(t('adminAccessRequired'));
        throw new Error(t('failedToFetchPaymentSettings'));
      }
      return response.json();
    },
  });

  // Fetch recent transactions
  const { data: transactionsData, isLoading: loadingTransactions } = useQuery({
    queryKey: ['payment-transactions'],
    queryFn: async () => {
      const response = await fetch('/api/admin/payment-transactions?limit=5', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(t('failedToFetchPaymentTransactions'));
      return response.json();
    },
  });

  // Fetch all transactions for dialog
  const { data: allTransactionsData, isLoading: loadingAllTransactions } = useQuery({
    queryKey: ['payment-transactions-all', allTransactionsPage],
    queryFn: async () => {
      const response = await fetch(`/api/admin/payment-transactions?limit=50&page=${allTransactionsPage}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(t('failedToFetchPaymentTransactions'));
      return response.json();
    },
    enabled: showAllTransactionsDialog,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      stripe_publishable_key: string;
      stripe_secret_key?: string;
      stripe_webhook_secret?: string;
      is_live_mode: boolean;
      paypal_client_id?: string;
      paypal_client_secret?: string;
      paypal_webhook_id?: string;
      paypal_merchant_id?: string;
      paypal_is_live_mode?: boolean;
      paymob_public_key?: string;
      paymob_secret_key?: string;
      paymob_hmac_secret?: string;
      paymob_integration_ids?: string[] | string;
      paymob_base_url?: string;
      paymob_is_live_mode?: boolean;
      saas_plan_config: Array<{ key: string; name: string; price_id: string; paypal_plan_id?: string }>;
      saas_trial_days: number;
    }) => {
      const response = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('failedToSavePaymentSettings'));
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      toast({
        title: t('settingsSaved'),
        description: t('paymentSettingsUpdated'),
      });
      // Clear sensitive fields after save
      setSecretKey('');
      setWebhookSecret('');
      setPaypalClientSecret('');
      setPaypalWebhookId('');
      setPaymobSecretKey('');
      setPaymobHmacSecret('');
    },
    onError: (error: Error) => {
      toast({
        title: t('error'),
        description: resolvePaymentSettingsError(error.message),
        variant: 'destructive',
      });
    },
  });

  // Test connection
  const testConnection = async () => {
    if (!secretKey) {
      toast({
        title: t('error'),
        description: t('enterSecretKeyToTest'),
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/admin/payment-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stripe_secret_key: secretKey }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: t('connectionSuccessful'),
          description: t('stripeConnectionTestPassed'),
        });
      } else {
        toast({
          title: t('connectionFailed'),
          description: t('invalidStripeKeys'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToTestConnection'),
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testPaypalConnection = async () => {
    if (!paypalClientId || (!paypalClientSecret && !settings?.has_paypal_client_secret)) {
      toast({
        title: t('error'),
        description: t('enterPayPalCredentialsToTest'),
        variant: 'destructive',
      });
      return;
    }

    setIsTestingPaypal(true);
    try {
      const response = await fetch('/api/admin/payment-settings/paypal-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paypal_client_id: paypalClientId,
          paypal_client_secret: paypalClientSecret || undefined,
          paypal_is_live_mode: paypalIsLiveMode,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: t('connectionSuccessful'),
          description: t('paypalConnectionTestPassed'),
        });
      } else {
        toast({
          title: t('connectionFailed'),
          description: t('invalidPayPalKeys'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('error'),
        description: t('failedToTestPayPalConnection'),
        variant: 'destructive',
      });
    } finally {
      setIsTestingPaypal(false);
    }
  };

  // Populate form when settings load
  useEffect(() => {
    if (settings && settings.stripe_publishable_key) {
      setPublishableKey(settings.stripe_publishable_key);
      setIsLiveMode(settings.is_live_mode);
    }
    if (settings?.paypal_client_id) {
      setPaypalClientId(settings.paypal_client_id);
    }
    if (settings?.paypal_merchant_id) {
      setPaypalMerchantId(settings.paypal_merchant_id);
    }
    if (typeof settings?.paypal_is_live_mode === 'boolean') {
      setPaypalIsLiveMode(settings.paypal_is_live_mode);
    }
    if (settings?.paymob_public_key) {
      setPaymobPublicKey(settings.paymob_public_key);
    }
    if (settings?.paymob_base_url) {
      setPaymobBaseUrl(settings.paymob_base_url);
    }
    if (typeof settings?.paymob_is_live_mode === 'boolean') {
      setPaymobIsLiveMode(settings.paymob_is_live_mode);
    }
    if (Array.isArray(settings?.paymob_integration_ids)) {
      setPaymobIntegrationIds(settings.paymob_integration_ids.join('\n'));
    } else if (typeof settings?.paymob_integration_ids === 'string') {
      setPaymobIntegrationIds(settings.paymob_integration_ids);
    }
    if (settings?.saas_plan_config?.length) {
      setSaasPlans(settings.saas_plan_config);
    }
    if (typeof settings?.saas_trial_days === 'number') {
      setTrialDays(settings.saas_trial_days);
    }
  }, [settings]);

  const updatePlan = (index: number, field: 'key' | 'name' | 'price_id' | 'paypal_plan_id', value: string) => {
    setSaasPlans((prev) => prev.map((plan, idx) => (idx === index ? { ...plan, [field]: value } : plan)));
  };

  const addPlan = () => {
    setSaasPlans((prev) => [...prev, { key: '', name: '', price_id: '', paypal_plan_id: '' }]);
  };

  const removePlan = (index: number) => {
    setSaasPlans((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    // Only validate format if keys are provided (non-empty)
    // Allow saving with empty keys to disable payment methods
    if (publishableKey && !publishableKey.startsWith('pk_')) {
      toast({
        title: t('error'),
        description: t('invalidPublishableKeyPrefix'),
        variant: 'destructive',
      });
      return;
    }

    if (secretKey && !secretKey.startsWith('sk_')) {
      toast({
        title: t('error'),
        description: t('invalidSecretKeyPrefix'),
        variant: 'destructive',
      });
      return;
    }

    // Only validate Stripe if at least one key is provided
    // Allow clearing both keys to disable Stripe
    const hasAnyStripeKey = publishableKey || secretKey;
    if (hasAnyStripeKey) {
      // If providing Stripe config, require both keys
      if ((publishableKey && !secretKey && !settings?.has_secret_key) || (secretKey && !publishableKey)) {
        toast({
          title: t('error'),
          description: t('publishableAndSecretRequired'),
          variant: 'destructive',
        });
        return;
      }
    }

    // Only validate PayPal if at least one key is provided
    // Allow clearing both keys to disable PayPal
    const hasAnyPaypalKey = paypalClientId || paypalClientSecret;
    if (hasAnyPaypalKey) {
      if (paypalClientId && !paypalClientSecret && !settings?.has_paypal_client_secret) {
        toast({
          title: t('error'),
          description: t('paypalClientAndSecretRequired'),
          variant: 'destructive',
        });
        return;
      }

      if (paypalClientSecret && !paypalClientId) {
        toast({
          title: t('error'),
          description: t('paypalClientAndSecretRequired'),
          variant: 'destructive',
        });
        return;
      }
    }

    // Only validate Paymob if at least one key is provided
    // Allow clearing all keys to disable Paymob
    const hasAnyPaymobKey = paymobPublicKey || paymobSecretKey || paymobHmacSecret;
    if (hasAnyPaymobKey) {
      if ((paymobPublicKey && !paymobSecretKey && !settings?.has_paymob_secret_key)
        || (paymobSecretKey && !paymobPublicKey)) {
        toast({
          title: t('error'),
          description: t('paymobPublicAndSecretRequired'),
          variant: 'destructive',
        });
        return;
      }
    }

    const normalizedPaymobIntegrationIds = paymobIntegrationIds
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const normalizedPlans = saasPlans
      .map((plan) => ({
        key: plan.key.trim(),
        name: plan.name.trim(),
        price_id: plan.price_id.trim(),
        paypal_plan_id: plan.paypal_plan_id?.trim() || undefined,
      }))
      .filter((plan) => plan.key || plan.name || plan.price_id);

    if (normalizedPlans.length) {
      if (normalizedPlans.some((plan) => !plan.key || !plan.name)) {
        toast({
          title: t('error'),
          description: t('saasPlanFieldsRequired'),
          variant: 'destructive',
        });
        return;
      }

      const planKeys = normalizedPlans.map((plan) => plan.key.toLowerCase());
      if (new Set(planKeys).size !== planKeys.length) {
        toast({
          title: t('error'),
          description: t('saasPlanKeysUnique'),
          variant: 'destructive',
        });
        return;
      }

      const plansWithPrice = normalizedPlans.filter((plan) => plan.price_id);
      if (plansWithPrice.some((plan) => !plan.price_id.startsWith('price_'))) {
        toast({
          title: t('error'),
          description: t('saasPlanPriceInvalid'),
          variant: 'destructive',
        });
        return;
      }
    }

    updateSettingsMutation.mutate({
      stripe_publishable_key: publishableKey || undefined,
      stripe_secret_key: secretKey || undefined,
      stripe_webhook_secret: webhookSecret || undefined,
      is_live_mode: isLiveMode,
      paypal_client_id: paypalClientId || undefined,
      paypal_client_secret: paypalClientSecret || undefined,
      paypal_webhook_id: paypalWebhookId || undefined,
      paypal_merchant_id: paypalMerchantId || undefined,
      paypal_is_live_mode: paypalIsLiveMode,
      paymob_public_key: paymobPublicKey || undefined,
      paymob_secret_key: paymobSecretKey || undefined,
      paymob_hmac_secret: paymobHmacSecret || undefined,
      paymob_integration_ids: normalizedPaymobIntegrationIds.length ? normalizedPaymobIntegrationIds : undefined,
      paymob_base_url: paymobBaseUrl || undefined,
      paymob_is_live_mode: paymobIsLiveMode,
      saas_plan_config: normalizedPlans,
      saas_trial_days: trialDays,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">{t('paymentStatusCompleted')}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">{t('paymentStatusPending')}</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">{t('paymentStatusFailed')}</Badge>;
      case 'refunded':
        return <Badge className="bg-gray-100 text-gray-800">{t('paymentStatusRefunded')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Detect if we're on a tenant subdomain
  const isTenantSubdomain = typeof window !== 'undefined' 
    ? (() => {
        const host = window.location.hostname;
        const parts = host.split('.');
        // If we have a subdomain (more than 2 parts), and it's not 'www', it's a tenant
        return parts.length > 2 && parts[0] !== 'www';
      })()
    : false;

  // Determine current subdomain for webhook URL
  // For tenant subdomains, don't include /admin in the path
  // For central domain, include /admin in the path
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/${isTenantSubdomain ? '' : 'admin/'}stripe/webhook`
    : 'https://www.naioshfit.com/api/admin/stripe/webhook';
  const paypalWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/${isTenantSubdomain ? '' : 'admin/'}paypal/webhook`
    : 'https://www.naioshfit.com/api/admin/paypal/webhook';
  const paymobWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/${isTenantSubdomain ? '' : 'admin/'}paymob/webhook`
    : 'https://www.naioshfit.com/api/admin/paymob/webhook';

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (settingsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('failedToLoadPaymentSettings')}
        </AlertDescription>
      </Alert>
    );
  }

  const isConfigured = settings?.has_secret_key;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('paymentSettings')}</h2>
          <p className="text-muted-foreground">
            {t('configureStripeGateway')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-800 gap-1">
              <CheckCircle className="h-3 w-3" />
              {t('connected')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-yellow-600 gap-1">
              <AlertCircle className="h-3 w-3" />
              {t('notConfigured')}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('stripeConfiguration')}
          </CardTitle>
          <CardDescription>
            {t('enterStripeApiKeys')}
            <a 
              href="https://dashboard.stripe.com/apikeys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
            >
              {t('getKeysFromStripeDashboard')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-base">{t('liveMode')}</Label>
              <p className="text-sm text-muted-foreground">
                {isLiveMode 
                  ? t('liveModePayments')
                  : t('testModePayments')
                }
              </p>
            </div>
            <Switch
              checked={isLiveMode}
              onCheckedChange={setIsLiveMode}
            />
          </div>

          {/* Alert for mode */}
          {isLiveMode && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('liveModeActive')}</strong> {t('liveModeWarning')}
              </AlertDescription>
            </Alert>
          )}

          {/* Publishable Key */}
          <div className="space-y-2">
            <Label htmlFor="publishable-key">
              {t('publishableKey')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="publishable-key"
              placeholder={isLiveMode ? "pk_live_..." : "pk_test_..."}
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('publishableKeyDescription')}
            </p>
          </div>

          {/* Secret Key */}
          <div className="space-y-2">
            <Label htmlFor="secret-key">
              {t('secretKey')} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="secret-key"
                type={showSecretKey ? "text" : "password"}
                placeholder={settings?.has_secret_key ? "••••••••••••••••" : (isLiveMode ? "sk_live_..." : "sk_test_...")}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {t('secretKeyEncrypted')}
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label htmlFor="webhook-secret">
              {t('webhookSecret')} <span className="text-muted-foreground">({t('optional')})</span>
            </Label>
            <div className="relative">
              <Input
                id="webhook-secret"
                type={showWebhookSecret ? "text" : "password"}
                placeholder={settings?.has_webhook_secret ? "••••••••••••••••" : "whsec_..."}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                {t('configureWebhooksInStripe')}
              </p>
              <p>
                {t('webhookUrl')} <code className="bg-muted px-1 py-0.5 rounded text-xs">{webhookUrl}</code>
              </p>
            </div>
          </div>

          {/* SaaS Plan Configuration */}
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-base">{t('saasPlanConfigTitle')}</Label>
              <p className="text-sm text-muted-foreground">{t('saasPlanConfigDesc')}</p>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="trial-days">{t('saasTrialDaysLabel')}</Label>
                <Input
                  id="trial-days"
                  type="number"
                  min={0}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">{t('saasTrialDaysHelp')}</p>
              </div>

              <div className="space-y-3">
                {saasPlans.map((plan, index) => (
                  <div key={`${plan.key}-${index}`} className="grid gap-3 md:grid-cols-[1fr_2fr_2fr_2fr_auto] items-end">
                    <div className="space-y-1">
                      <Label>{t('saasPlanKey')}</Label>
                      <Input
                        value={plan.key}
                        onChange={(e) => updatePlan(index, 'key', e.target.value)}
                        placeholder="starter"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('saasPlanName')}</Label>
                      <Input
                        value={plan.name}
                        onChange={(e) => updatePlan(index, 'name', e.target.value)}
                        placeholder={t('saasPlanNamePlaceholder')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('saasPlanPriceId')}</Label>
                      <Input
                        value={plan.price_id}
                        onChange={(e) => updatePlan(index, 'price_id', e.target.value)}
                        placeholder="price_..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t('saasPlanPayPalId')}</Label>
                      <Input
                        value={plan.paypal_plan_id || ''}
                        onChange={(e) => updatePlan(index, 'paypal_plan_id', e.target.value)}
                        placeholder="P-..."
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removePlan(index)}
                        disabled={saasPlans.length === 0}
                      >
                        {t('remove')}
                      </Button>
                    </div>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="secondary" size="sm" onClick={addPlan}>
                    {t('addPlan')}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={isTesting || !secretKey}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('testConnection')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              {t('saveSettings')}
            </Button>
          </div>

          {/* Last Updated */}
          {settings?.updated_at && (
            <p className="text-sm text-muted-foreground">
              {t('lastUpdated')}: {formatDate(settings.updated_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* PayPal Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('paypalConfiguration') || 'PayPal Configuration'}
          </CardTitle>
          <CardDescription>
            {t('enterPayPalApiKeys') || 'Enter your PayPal client credentials.'}
            <a
              href="https://developer.paypal.com/api/rest/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
            >
              {t('getKeysFromPayPalDashboard') || 'Get keys from PayPal'}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-base">{t('liveMode') || 'Live mode'}</Label>
              <p className="text-sm text-muted-foreground">
                {paypalIsLiveMode
                  ? (t('liveModePayments') || 'Processing live payments')
                  : (t('testModePayments') || 'Processing test payments')
                }
              </p>
            </div>
            <Switch
              checked={paypalIsLiveMode}
              onCheckedChange={setPaypalIsLiveMode}
            />
          </div>

          {paypalIsLiveMode && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('liveModeActive') || 'Live mode active'}</strong> {t('liveModeWarning') || 'Payments will be processed in live mode.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="paypal-client-id">
              {t('paypalClientId') || 'PayPal Client ID'}
            </Label>
            <Input
              id="paypal-client-id"
              placeholder="AQM..."
              value={paypalClientId}
              onChange={(e) => setPaypalClientId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paypal-client-secret">
              {t('paypalClientSecret') || 'PayPal Client Secret'}
            </Label>
            <div className="relative">
              <Input
                id="paypal-client-secret"
                type={showPaypalSecret ? "text" : "password"}
                placeholder={settings?.has_paypal_client_secret ? "••••••••••••••••" : ""}
                value={paypalClientSecret}
                onChange={(e) => setPaypalClientSecret(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPaypalSecret(!showPaypalSecret)}
              >
                {showPaypalSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paypal-webhook-id">
              {t('paypalWebhookId') || 'PayPal Webhook ID'} <span className="text-muted-foreground">({t('optional')})</span>
            </Label>
            <div className="relative">
              <Input
                id="paypal-webhook-id"
                type={showPaypalWebhook ? "text" : "password"}
                placeholder={settings?.has_paypal_webhook_id ? "••••••••••••••••" : ""}
                value={paypalWebhookId}
                onChange={(e) => setPaypalWebhookId(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPaypalWebhook(!showPaypalWebhook)}
              >
                {showPaypalWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                {t('configureWebhooksInPayPal') || 'Configure webhooks in your PayPal dashboard.'}
              </p>
              <p>
                {t('webhookUrl') || 'Webhook URL'} <code className="bg-muted px-1 py-0.5 rounded text-xs">{paypalWebhookUrl}</code>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paypal-merchant-id">
              {t('paypalMerchantId') || 'PayPal Merchant ID'} <span className="text-muted-foreground">({t('optional')})</span>
            </Label>
            <Input
              id="paypal-merchant-id"
              placeholder="" 
              value={paypalMerchantId}
              onChange={(e) => setPaypalMerchantId(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={testPaypalConnection}
              disabled={isTestingPaypal || !paypalClientId}
            >
              {isTestingPaypal ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('testConnection')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Paymob Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('paymobConfiguration') || 'Paymob Configuration'}
          </CardTitle>
          <CardDescription>
            {t('enterPaymobApiKeys') || 'Enter your Paymob API credentials.'}
            <a
              href="https://accept.paymob.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
            >
              {t('getKeysFromPaymobDashboard') || 'Get keys from Paymob'}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-base">{t('liveMode') || 'Live mode'}</Label>
              <p className="text-sm text-muted-foreground">
                {paymobIsLiveMode
                  ? (t('liveModePayments') || 'Processing live payments')
                  : (t('testModePayments') || 'Processing test payments')
                }
              </p>
            </div>
            <Switch
              checked={paymobIsLiveMode}
              onCheckedChange={setPaymobIsLiveMode}
            />
          </div>

          {paymobIsLiveMode && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('liveModeActive') || 'Live mode active'}</strong> {t('liveModeWarning') || 'Payments will be processed in live mode.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="paymob-public-key">
              {t('paymobPublicKey') || 'Paymob Public Key'}
            </Label>
            <Input
              id="paymob-public-key"
              placeholder="pk_..."
              value={paymobPublicKey}
              onChange={(e) => setPaymobPublicKey(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob-secret-key">
              {t('paymobSecretKey') || 'Paymob Secret Key'}
            </Label>
            <div className="relative">
              <Input
                id="paymob-secret-key"
                type={showPaymobSecret ? "text" : "password"}
                placeholder={settings?.has_paymob_secret_key ? "••••••••••••••••" : ""}
                value={paymobSecretKey}
                onChange={(e) => setPaymobSecretKey(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPaymobSecret(!showPaymobSecret)}
              >
                {showPaymobSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob-hmac-secret">
              {t('paymobHmacSecret') || 'Paymob HMAC Secret'} <span className="text-muted-foreground">({t('optional')})</span>
            </Label>
            <div className="relative">
              <Input
                id="paymob-hmac-secret"
                type={showPaymobHmac ? "text" : "password"}
                placeholder={settings?.has_paymob_hmac_secret ? "••••••••••••••••" : ""}
                value={paymobHmacSecret}
                onChange={(e) => setPaymobHmacSecret(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPaymobHmac(!showPaymobHmac)}
              >
                {showPaymobHmac ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                {t('configureWebhooksInPaymob') || 'Configure webhooks in your Paymob dashboard.'}
              </p>
              <p>
                {t('webhookUrl') || 'Webhook URL'} <code className="bg-muted px-1 py-0.5 rounded text-xs">{paymobWebhookUrl}</code>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob-integration-ids">
              {t('paymobIntegrationIds') || 'Paymob Integration IDs'}
            </Label>
            <Textarea
              id="paymob-integration-ids"
              value={paymobIntegrationIds}
              onChange={(e) => setPaymobIntegrationIds(e.target.value)}
              placeholder="123456\n654321"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {t('paymobIntegrationIdsHelp') || 'Enter one integration ID per line or separate with commas.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymob-base-url">
              {t('paymobBaseUrl') || 'Paymob Base URL'} <span className="text-muted-foreground">({t('optional')})</span>
            </Label>
            <Input
              id="paymob-base-url"
              placeholder="https://accept.paymob.com"
              value={paymobBaseUrl}
              onChange={(e) => setPaymobBaseUrl(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recentTransactions')}</CardTitle>
          <CardDescription>
            {t('recentPlatformTransactions')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactionsData?.transactions?.length > 0 ? (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">{t('paymentDate')}</th>
                      <th className="text-left py-2 px-2">{t('paymentType')}</th>
                      <th className="text-left py-2 px-2">{t('paymentTenant')}</th>
                      <th className="text-right py-2 px-2">{t('paymentAmount')}</th>
                      <th className="text-center py-2 px-2">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsData.transactions.map((tx: PaymentTransaction) => {
                      const amountValue = Number(tx.amount);
                      const formattedAmount = Number.isFinite(amountValue) ? amountValue.toFixed(2) : '0.00';
                      const paymentTypeLabel = tx.payment_type === 'saas_subscription'
                        ? t('paymentTypeSaasSubscription')
                        : (tx.payment_type || '-');

                      return (
                        <tr key={tx.id} className="border-b last:border-0">
                          <td className="py-2 px-2 text-muted-foreground">
                            {formatDate(tx.created_at)}
                          </td>
                          <td className="py-2 px-2">
                            {paymentTypeLabel}
                          </td>
                          <td className="py-2 px-2">
                            {tx.tenant_subdomain || tx.tenant_company_name || '-'}
                          </td>
                          <td className="py-2 px-2 text-right font-medium">
                            ${formattedAmount} {tx.currency}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {getStatusBadge(tx.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {transactionsData.total > 5 && (
                <div className="text-center pt-2">
                  <Button variant="link" size="sm" onClick={() => setShowAllTransactionsDialog(true)}>
                    {t('viewAllTransactions')} ({transactionsData.total})
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              {t('noTransactionsYet')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* All Transactions Dialog */}
      <Dialog open={showAllTransactionsDialog} onOpenChange={setShowAllTransactionsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('viewAllTransactions')}</DialogTitle>
            <DialogDescription>
              {t('recentPlatformTransactions')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAllTransactions ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : allTransactionsData?.transactions?.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">{t('paymentDate')}</th>
                        <th className="text-left py-2 px-2">{t('paymentType')}</th>
                        <th className="text-left py-2 px-2">{t('paymentTenant')}</th>
                        <th className="text-right py-2 px-2">{t('paymentAmount')}</th>
                        <th className="text-center py-2 px-2">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactionsData.transactions.map((tx: PaymentTransaction) => {
                        const amountValue = Number(tx.amount);
                        const formattedAmount = Number.isFinite(amountValue) ? amountValue.toFixed(2) : '0.00';
                        const paymentTypeLabel = tx.payment_type === 'saas_subscription'
                          ? t('paymentTypeSaasSubscription')
                          : (tx.payment_type || '-');

                        return (
                          <tr key={tx.id} className="border-b last:border-0">
                            <td className="py-2 px-2 text-muted-foreground">
                              {formatDate(tx.created_at)}
                            </td>
                            <td className="py-2 px-2">
                              {paymentTypeLabel}
                            </td>
                            <td className="py-2 px-2">
                              {tx.tenant_subdomain || tx.tenant_company_name || '-'}
                            </td>
                            <td className="py-2 px-2 text-right font-medium">
                              ${formattedAmount} {tx.currency}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {getStatusBadge(tx.status)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {allTransactionsData.total > 50 && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAllTransactionsPage(Math.max(1, allTransactionsPage - 1))}
                      disabled={allTransactionsPage === 1}
                    >
                      {t('previous') || 'Previous'}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t('page') || 'Page'} {allTransactionsPage} {t('of') || 'of'} {Math.ceil(allTransactionsData.total / 50)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAllTransactionsPage(allTransactionsPage + 1)}
                      disabled={allTransactionsPage >= Math.ceil(allTransactionsData.total / 50)}
                    >
                      {t('next') || 'Next'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t('noTransactionsYet')}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
