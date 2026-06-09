import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SAAS_SUBDOMAIN_PATTERN } from "./constants";
import { CheckCircle, Circle, Loader2, CreditCard, Building2, Shield, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/context/LanguageContext";
import EmbeddedCheckout from "@/components/payments/EmbeddedCheckout";
import PayPalEmbeddedCheckout from "@/components/payments/PayPalEmbeddedCheckout";
import PaymobEmbeddedCheckout from "@/components/payments/PaymobEmbeddedCheckout";
import PublicHeader from "@/components/layout/PublicHeader";

interface SignupFormData {
  companyName: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  subscriptionPlan: string;
}

export interface SaasOnboardingPrefill {
  platformType?: string;
  companyName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  plan?: string;
  subdomain?: string;
  domainMode?: string;
  paymentMethod?: string;
  adminPassword?: string;
}

interface SaasSignupPageProps {
  prefilledOnboarding?: SaasOnboardingPrefill;
}

interface PaymentSession {
  sessionId: string;
  checkoutUrl: string | null;
  clientSecret: string | null;
  sessionReference: string;
  amount: number;
  currency: string;
  paymentProvider?: 'stripe' | 'paypal' | 'paymob' | 'direct';
  paypalSubscriptionId?: string | null;
  paymobIntentionId?: string | null;
}

interface PlanConfigResponse {
  trial_days: number;
  plans: Array<{
    key: string;
    name: string;
    price_id: string;
    paypal_plan_id?: string;
    amount: number | null;
    currency: string | null;
    interval: string | null;
  }>;
}

interface TenantSummary {
  id: string;
  subdomain: string;
  companyName: string;
  status: string;
  subscriptionPlan: string | null;
}

interface ProvisioningLog {
  step: string;
  status: string;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

type Step = 1 | 2 | 3 | 4;

const DEFAULT_PLANS: PlanConfigResponse['plans'] = [
  { key: 'starter', name: 'Starter Plan', price_id: 'price_test_starter', paypal_plan_id: '', amount: 9900, currency: 'usd', interval: 'month' },
  { key: 'growth', name: 'Growth Plan', price_id: 'price_test_growth', paypal_plan_id: '', amount: 29900, currency: 'usd', interval: 'month' },
  { key: 'enterprise', name: 'Enterprise Plan', price_id: 'price_test_enterprise', paypal_plan_id: '', amount: 99900, currency: 'usd', interval: 'month' },
];

const SaasSignupWithPaymentPage = ({ prefilledOnboarding }: SaasSignupPageProps = {}) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const [currentStep, setCurrentStep] = useState<Step>(prefilledOnboarding ? 2 : 1);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<SignupFormData>({
    companyName: prefilledOnboarding?.companyName ?? "",
    subdomain: prefilledOnboarding?.subdomain ?? "",
    adminName: prefilledOnboarding?.ownerName ?? "",
    adminEmail: prefilledOnboarding?.email ?? "",
    adminPhone: prefilledOnboarding?.phone ?? "",
    adminPassword: prefilledOnboarding?.adminPassword ?? "",
    subscriptionPlan: prefilledOnboarding?.plan ?? "starter",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [saasPublishableKey, setSaasPublishableKey] = useState<string | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [paymobPublicKey, setPaymobPublicKey] = useState<string | null>(null);
  const [paymobBaseUrl, setPaymobBaseUrl] = useState<string | null>(null);
  const [paymobCheckoutUrl, setPaymobCheckoutUrl] = useState<string | null>(null);
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [provisioningLogs, setProvisioningLogs] = useState<ProvisioningLog[]>([]);
  const [sessionReference, setSessionReference] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanConfigResponse | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypal' | 'paymob'>('stripe');
  const [stripeConfigured, setStripeConfigured] = useState(true);
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [paymobConfigured, setPaymobConfigured] = useState(false);
  const [isDirectSignup, setIsDirectSignup] = useState(false);
  const [paymentConfigured, setPaymentConfigured] = useState<boolean | null>(null);
  const [skipPayment, setSkipPayment] = useState<boolean | null>(null);
  const [mainDomain, setMainDomain] = useState<string>("naioshfit.com");
  const autoSkipAttempted = useRef(false);

  const baseDomain = useMemo(() => mainDomain.replace(/^www\./, ""), [mainDomain]);

  const plans = planConfig?.plans?.length ? planConfig.plans : DEFAULT_PLANS;
  const selectedPlan = plans.find((plan) => plan.key === form.subscriptionPlan) || plans[0];
  const selectedPrice = selectedPlan?.amount ? selectedPlan.amount / 100 : 0;

  useEffect(() => {
    fetch('/saas/public-config')
      .then((res) => res.json())
      .then((data) => {
        if (data?.mainDomain) {
          setMainDomain(String(data.mainDomain).replace(/^www\./, ""));
        }
        setSkipPayment(Boolean(data?.skipPayment));
      })
      .catch(() => setSkipPayment(true));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step");
    const session = params.get("session");
    const status = params.get("status");

    if (step === "3" && session) {
      setSessionReference(session);
      
      if (status === "success") {
        setCurrentStep(3);
        // Restore form data from session storage
        const savedForm = sessionStorage.getItem(`saas-signup-${session}`);
        if (savedForm) {
          setForm(JSON.parse(savedForm));
          provisionTenant(session, JSON.parse(savedForm));
        } else {
          setPaymentError(t("saasSessionDataMissing"));
        }
      } else if (status === "cancelled") {
        setCurrentStep(2);
        // Restore form data
        const savedForm = sessionStorage.getItem(`saas-signup-${session}`);
        if (savedForm) {
          setForm(JSON.parse(savedForm));
        }
        toast({
          title: t("saasPaymentCancelledTitle"),
          description: t("saasPaymentCancelledDesc"),
          variant: "default",
        });
      }
    } else if (status === "failed") {
      toast({
        title: t("saasPaymentFailedTitle"),
        description: t("saasPaymentFailedDesc"),
        variant: "destructive",
      });
      setCurrentStep(2);
    }
  }, []);

  useEffect(() => {
    const loadPaymentClient = async () => {
      if (!paymentSession) return;

      setSaasPublishableKey(null);
      setPaypalClientId(null);
      setPaymobPublicKey(null);
      setPaymobBaseUrl(null);
      setPaymobCheckoutUrl(null);

      if (paymentSession.paymentProvider === 'paypal') {
        try {
          const response = await fetch('/api/paypal/client-id', { credentials: 'include' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data?.message || t('saasPaymentSessionFailed'));
          }
          setPaypalClientId(data.clientId);
          setShowEmbeddedCheckout(true);
        } catch (error: any) {
          setPaymentError(error?.message || t('saasPaymentSessionFailed'));
        }
        return;
      }

      if (paymentSession.paymentProvider === 'paymob') {
        try {
          const response = await fetch('/api/paymob/config', { credentials: 'include' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(data?.message || t('saasPaymentSessionFailed'));
          }
          setPaymobPublicKey(data.publicKey);
          setPaymobBaseUrl(data.baseUrl || null);
          setPaymobCheckoutUrl(paymentSession.checkoutUrl || null);
          setShowEmbeddedCheckout(true);
        } catch (error: any) {
          setPaymentError(error?.message || t('saasPaymentSessionFailed'));
        }
        return;
      }

      if (!paymentSession.clientSecret) return;
      try {
        const response = await fetch('/api/stripe/saas-publishable-key');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || t('saasPaymentSessionFailed'));
        }
        setSaasPublishableKey(data.publishableKey);
        setShowEmbeddedCheckout(true);
      } catch (error: any) {
        setPaymentError(error?.message || t('saasPaymentSessionFailed'));
      }
    };

    loadPaymentClient();
  }, [paymentSession, t]);

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
        setStripeConfigured(true);
        setPaypalConfigured(false);
        setPaymobConfigured(false);
      }
    };

    loadGatewayStatus();
  }, []);

  useEffect(() => {
    const loadPlanConfig = async () => {
      try {
        const response = await fetch('/saas/plan-config');
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          if (
            response.status === 503 ||
            data.code === 'PLATFORM_PAYMENT_NOT_CONFIGURED'
          ) {
            setPaymentConfigured(false);
          }
          return;
        }
        const data = (await response.json()) as PlanConfigResponse;
        setPaymentConfigured(true);
        setPlanConfig(data);
        if (data?.plans?.length && !data.plans.find((plan) => plan.key === form.subscriptionPlan)) {
          setForm((prev) => ({ ...prev, subscriptionPlan: data.plans[0].key }));
        }
      } catch (error) {
        console.error('Failed to load plan configuration', error);
        setPaymentConfigured(false);
      }
    };

    loadPlanConfig();
  }, []);

  const persistFormToSession = (reference: string) => {
    sessionStorage.setItem(`saas-signup-${reference}`, JSON.stringify({
      ...form,
      subdomain: form.subdomain.trim().toLowerCase(),
      companyName: form.companyName.trim(),
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim(),
    }));
  };

  const resetCheckoutState = () => {
    setShowEmbeddedCheckout(false);
    setSaasPublishableKey(null);
    setPaypalClientId(null);
    setPaymobPublicKey(null);
    setPaymobBaseUrl(null);
    setPaymobCheckoutUrl(null);
  };

  const createDirectSignupSession = async () => {
    const response = await fetch("/saas/create-signup-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.companyName.trim(),
        subdomain: form.subdomain.trim().toLowerCase(),
        subscriptionPlan: form.subscriptionPlan,
        adminEmail: form.adminEmail.trim(),
        adminName: form.adminName.trim(),
        adminPhone: form.adminPhone.trim(),
        adminPassword: form.adminPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.code === 'CENTRAL_DB_NOT_INITIALIZED') {
        throw new Error(language === 'ar'
          ? 'قاعدة بيانات المنصة قيد التهيئة. انتظر دقيقة ثم أعد المحاولة.'
          : (error.message || 'Platform database is still initializing. Wait a moment and retry.'));
      }
      if (error.code === 'TENANT_DB_ENCRYPTION_KEY_INVALID') {
        throw new Error(language === 'ar'
          ? 'مفتاح التشفير غير مُعد. على Railway تأكد أن SESSION_SECRET نص عشوائي طويل (16+ حرف) ثم أعد النشر.'
          : 'Encryption key not configured. On Railway set SESSION_SECRET to a long random string (16+ chars) and redeploy.');
      }
      if (error.code === 'TENANT_DATABASE_TEMPLATE_MISSING') {
        throw new Error(language === 'ar'
          ? 'قالب قاعدة بيانات المستأجرين غير مُعد. تواصل مع المسؤول.'
          : 'Tenant database template is not configured. Contact administrator.');
      }
      throw new Error(error.message || t("saasPaymentSessionFailed"));
    }

    const data = await response.json();
    setPaymentSession(data.session);
    setIsDirectSignup(true);
    persistFormToSession(data.session.sessionReference);
    return data.session as PaymentSession;
  };

  const createPaymentSession = async (provider: 'stripe' | 'paypal' | 'paymob') => {
    const response = await fetch("/saas/create-payment-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.companyName.trim(),
        subdomain: form.subdomain.trim().toLowerCase(),
        subscriptionPlan: form.subscriptionPlan,
        adminEmail: form.adminEmail.trim(),
        adminName: form.adminName.trim(),
        adminPhone: form.adminPhone.trim(),
        adminPassword: form.adminPassword,
        paymentProvider: provider,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.message || t("saasPaymentSessionFailed")) as Error & { code?: string };
      err.code = error.code;
      if (error.code === 'PLATFORM_PAYMENT_NOT_CONFIGURED') {
        err.message = t("saasPaymentNotConfigured");
      }
      throw err;
    }

    const data = await response.json();
    setPaymentSession(data.session);
    if (data.session?.paymentProvider) {
      setPaymentProvider(data.session.paymentProvider);
    }
    persistFormToSession(data.session.sessionReference);
    return data.session as PaymentSession;
  };

  const handleChange = (field: keyof SignupFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    const trimmedSubdomain = form.subdomain.trim().toLowerCase();

    if (!form.companyName.trim()) errors.companyName = t("saasCompanyNameRequired");
    if (!trimmedSubdomain) errors.subdomain = t("saasSubdomainRequired");
    if (trimmedSubdomain && !SAAS_SUBDOMAIN_PATTERN.test(trimmedSubdomain)) {
      errors.subdomain = t("saasSubdomainInvalid");
    }
    if (!form.adminName.trim()) errors.adminName = t("saasAdminNameRequired");
    if (!form.adminEmail.trim()) errors.adminEmail = t("saasAdminEmailRequired");
    if (form.adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.adminEmail)) {
      errors.adminEmail = t("saasAdminEmailInvalid");
    }
    // Phone is optional, but if provided, validate format
    if (form.adminPhone && form.adminPhone.replace(/\D/g, '').length < 10) {
      errors.adminPhone = "Phone number must be at least 10 digits";
    }
    if (!form.adminPassword) errors.adminPassword = t("saasAdminPasswordRequired");
    if (form.adminPassword && form.adminPassword.length < 8) {
      errors.adminPassword = t("saasAdminPasswordMin");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStep1Next = async () => {
    if (!validateStep1()) {
      toast({
        title: t("saasErrorTitle"),
        description: language === 'ar'
          ? 'يرجى إكمال جميع الحقول المطلوبة (اسم المسؤول، البريد، كلمة المرور 8+ أحرف).'
          : 'Please complete all required fields (admin name, email, password 8+ chars).',
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);
    setIsDirectSignup(false);
    try {
      if (skipPayment) {
        const session = await createDirectSignupSession();
        setCurrentStep(3);
        await provisionTenant(session.sessionReference, form);
        return;
      }

      if (paymentConfigured === false) {
        await createDirectSignupSession();
      } else {
        try {
          await createPaymentSession(paymentProvider);
        } catch (paymentError: any) {
          const code = paymentError?.code;
          const message = paymentError?.message || '';
          const shouldUseDirectSignup =
            code === 'PLATFORM_PAYMENT_NOT_CONFIGURED' ||
            message.includes(t("saasPaymentNotConfigured")) ||
            message.toLowerCase().includes('payment gateway not configured') ||
            message.toLowerCase().includes('failed to create payment session');

          if (shouldUseDirectSignup) {
            await createDirectSignupSession();
          } else {
            throw paymentError;
          }
        }
      }
      setCurrentStep(2);
    } catch (error: any) {
      toast({
        title: t("saasErrorTitle"),
        description: error.message || t("saasProceedToPaymentFailed"),
        variant: "destructive",
      });
      setPaymentError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProviderChange = async (provider: 'stripe' | 'paypal' | 'paymob') => {
    if (provider === paymentProvider) return;
    const previousProvider = paymentProvider;
    setPaymentProvider(provider);

    if (!paymentSession || paymentSession.paymentProvider === provider) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);
    resetCheckoutState();

    try {
      await createPaymentSession(provider);
    } catch (error: any) {
      setPaymentProvider(previousProvider);
      toast({
        title: t("saasErrorTitle"),
        description: error.message || t("saasProceedToPaymentFailed"),
        variant: "destructive",
      });
      setPaymentError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectProvision = async () => {
    if (!paymentSession?.sessionReference) {
      toast({
        title: t("saasErrorTitle"),
        description: t("saasPaymentSessionUnavailable"),
        variant: "destructive",
      });
      return;
    }

    setCurrentStep(3);
    await provisionTenant(paymentSession.sessionReference, form);
  };

  const handlePayment = async () => {
    if (!paymentSession) {
      toast({
        title: t("saasErrorTitle"),
        description: t("saasPaymentSessionUnavailable"),
        variant: "destructive",
      });
      return;
    }

    let activeSession = paymentSession;
    if (paymentSession.paymentProvider !== paymentProvider) {
      setIsProcessing(true);
      setPaymentError(null);
      resetCheckoutState();
      try {
        activeSession = await createPaymentSession(paymentProvider);
      } catch (error: any) {
        toast({
          title: t("saasErrorTitle"),
          description: error.message || t("saasProceedToPaymentFailed"),
          variant: "destructive",
        });
        setPaymentError(error.message);
        setIsProcessing(false);
        return;
      }
      setIsProcessing(false);
    }

    if (activeSession.paymentProvider !== 'paypal' && !activeSession.clientSecret) {
      toast({
        title: t("saasErrorTitle"),
        description: t("saasPaymentSessionUnavailable"),
        variant: "destructive",
      });
      return;
    }

    setShowEmbeddedCheckout(true);
  };

  const provisionTenant = async (reference: string, formData?: SignupFormData) => {
    const data = formData || form;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const response = await fetch("/saas/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionReference: reference,
          subdomain: data.subdomain.trim().toLowerCase(),
          companyName: data.companyName.trim(),
          adminName: data.adminName.trim(),
          adminEmail: data.adminEmail.trim(),
          adminPhone: data.adminPhone.trim(),
          adminPassword: data.adminPassword,
          subscriptionPlan: data.subscriptionPlan,
          paymentProvider: paymentSession?.paymentProvider || paymentProvider,
          paypalSubscriptionId: paymentSession?.paypalSubscriptionId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (Array.isArray(errorData.logs)) {
          setProvisioningLogs(errorData.logs);
        }
        throw new Error(errorData.message || errorData.error || t("saasProvisioningFailed"));
      }

      const result = await response.json();
      setTenant(result.tenant);
      setProvisioningLogs(result.logs || []);
      
      // Clear session storage
      sessionStorage.removeItem(`saas-signup-${reference}`);

      toast({
        title: t("saasProvisioningSuccessTitle"),
        description: t("saasProvisioningSuccessDesc"),
      });
      setCurrentStep(4);
    } catch (error: any) {
      toast({
        title: t("saasProvisioningErrorTitle"),
        description: error.message || t("saasProvisioningFailed"),
        variant: "destructive",
      });
      setPaymentError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runAutoSkipPayment = useCallback(async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      toast({
        title: t("saasErrorTitle"),
        description: language === 'ar'
          ? 'يرجى إكمال جميع الحقول المطلوبة (بما فيها كلمة مرور المدير).'
          : 'Please complete all required fields (including admin password).',
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);
    setIsDirectSignup(true);
    try {
      const session = await createDirectSignupSession();
      setCurrentStep(3);
      await provisionTenant(session.sessionReference, form);
    } catch (error: any) {
      toast({
        title: t("saasErrorTitle"),
        description: error.message || t("saasProceedToPaymentFailed"),
        variant: "destructive",
      });
      setPaymentError(error.message);
      setCurrentStep(2);
    } finally {
      setIsProcessing(false);
    }
  }, [form, language, t, toast]);

  useEffect(() => {
    if (!skipPayment || autoSkipAttempted.current) return;
    if (!prefilledOnboarding || currentStep !== 2) return;

    autoSkipAttempted.current = true;
    void runAutoSkipPayment();
  }, [skipPayment, prefilledOnboarding, currentStep, runAutoSkipPayment]);

  const getStepStatus = (step: Step) => {
    if (currentStep > step) return "complete";
    if (currentStep === step) return "active";
    return "pending";
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8 space-x-4" dir={isRTL ? "rtl" : "ltr"}>
      {[1, 2, 3, 4].map((step) => {
        const status = getStepStatus(step as Step);
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  status === "complete"
                    ? "bg-green-500 border-green-500 text-white"
                    : status === "active"
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "bg-gray-200 border-gray-300 text-gray-500"
                }`}
              >
                {status === "complete" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{step}</span>
                )}
              </div>
              <span className="mt-2 text-xs font-medium">
                {step === 1
                  ? t("saasStepDetails")
                  : step === 2
                  ? t("saasStepPayment")
                  : step === 3
                  ? t("saasStepSetup")
                  : t("saasStepComplete")}
              </span>
            </div>
            {step < 4 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  currentStep > step ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {t("saasOrgDetailsTitle")}
        </CardTitle>
        <CardDescription>{t("saasOrgDetailsDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleStep1Next(); }}>
          <div className="space-y-2">
            <Label htmlFor="companyName">{t("saasCompanyNameLabel")}</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={handleChange("companyName")}
              placeholder={t("saasCompanyNamePlaceholder")}
            />
            {fieldErrors.companyName && (
              <p className="text-xs text-red-500">{fieldErrors.companyName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdomain">{t("saasSubdomainLabel")}</Label>
            <div className="flex items-center">
              <Input
                id="subdomain"
                value={form.subdomain}
                onChange={handleChange("subdomain")}
                placeholder={t("saasSubdomainPlaceholder")}
                className={isRTL ? "rounded-l-none" : "rounded-r-none"}
              />
              <span className={`px-3 py-2 bg-gray-100 border ${isRTL ? "border-r-0 rounded-l-md" : "border-l-0 rounded-r-md"} text-sm text-gray-600`}>
                .{baseDomain || "naioshfit.com"}
              </span>
            </div>
            {fieldErrors.subdomain && (
              <p className="text-xs text-red-500">{fieldErrors.subdomain}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adminName">{t("saasAdminNameLabel")}</Label>
              <Input
                id="adminName"
                value={form.adminName}
                onChange={handleChange("adminName")}
                placeholder={t("saasAdminNamePlaceholder")}
              />
              {fieldErrors.adminName && (
                <p className="text-xs text-red-500">{fieldErrors.adminName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">{t("saasAdminEmailLabel")}</Label>
              <Input
                id="adminEmail"
                type="email"
                value={form.adminEmail}
                onChange={handleChange("adminEmail")}
                placeholder={t("saasAdminEmailPlaceholder")}
              />
              {fieldErrors.adminEmail && (
                <p className="text-xs text-red-500">{fieldErrors.adminEmail}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminPhone">Admin Phone Number (Optional)</Label>
            <Input
              id="adminPhone"
              type="tel"
              value={form.adminPhone}
              onChange={handleChange("adminPhone")}
              placeholder="+966512345678"
            />
            {fieldErrors.adminPhone && (
              <p className="text-xs text-red-500">{fieldErrors.adminPhone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminPassword">{t("saasAdminPasswordLabel")}</Label>
            <div className="relative">
              <Input
                id="adminPassword"
                type={showPassword ? "text" : "password"}
                value={form.adminPassword}
                onChange={handleChange("adminPassword")}
                placeholder={t("saasAdminPasswordPlaceholder")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {fieldErrors.adminPassword && (
              <p className="text-xs text-red-500">{fieldErrors.adminPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscriptionPlan">{t("saasSubscriptionPlanLabel")}</Label>
            <select
              id="subscriptionPlan"
              value={form.subscriptionPlan}
              onChange={handleChange("subscriptionPlan")}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {plans.map((plan) => (
                <option key={plan.key} value={plan.key}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("saasProcessing")}
              </>
            ) : (
              t("saasContinueToPayment")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => {
    if (skipPayment) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {language === 'ar' ? 'جاري إعداد منصتك' : 'Setting up your platform'}
            </CardTitle>
            <CardDescription>
              {language === 'ar'
                ? 'يتم تخطي الدفع مؤقتاً وإنشاء حسابك مباشرة...'
                : 'Payment is skipped for now — creating your account directly...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{paymentError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          {t("saasPaymentTitle")}
        </CardTitle>
        <CardDescription>{t("saasPaymentDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isDirectSignup && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {language === 'ar'
                ? 'بوابة الدفع غير مُفعّلة حالياً. سيتم إنشاء حسابك مباشرة بدون دفع. يمكن تفعيل الفوترة لاحقاً من لوحة الإدارة.'
                : 'Payment gateway is not configured yet. Your account will be created without payment. Billing can be enabled later from the admin panel.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-gray-50 rounded-lg p-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t("saasCompanyInlineLabel")}</span>
            <span className="font-semibold">{form.companyName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t("saasSubdomainInlineLabel")}</span>
            <span className="font-mono text-sm">{form.subdomain}.{baseDomain}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t("saasPlanInlineLabel")}</span>
            <span className="font-semibold">{selectedPlan?.name || form.subscriptionPlan}</span>
          </div>
          <div className="border-t pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">{t("saasTotalAmountLabel")}</span>
              <span className="text-2xl font-bold text-blue-600">
                {isDirectSignup ? (language === 'ar' ? 'مجاني' : 'Free') : `$${selectedPrice}`}
              </span>
            </div>
            {!isDirectSignup && (
              <p className="text-xs text-gray-500 mt-1">
                {t("saasBilledMonthly")} • {t("saasFreeTrialDays").replace("{{days}}", String(planConfig?.trial_days ?? 14))}
              </p>
            )}
          </div>
        </div>

        {!isDirectSignup && (
          <>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Shield className="w-4 h-4" />
          <span>{t("saasSecurePayment")}</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'stripe' ? 'border-blue-600 text-blue-600 bg-white' : 'border-gray-200 text-gray-600 bg-white'}`}
            onClick={() => handleProviderChange('stripe')}
            disabled={!stripeConfigured}
          >
            {t('payWithStripe') || 'Pay with Stripe'}
          </button>
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'paypal' ? 'border-blue-600 text-blue-600 bg-white' : 'border-gray-200 text-gray-600 bg-white'}`}
            onClick={() => handleProviderChange('paypal')}
            disabled={!paypalConfigured}
          >
            {t('payWithPayPal') || 'Pay with PayPal'}
          </button>
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm ${paymentProvider === 'paymob' ? 'border-blue-600 text-blue-600 bg-white' : 'border-gray-200 text-gray-600 bg-white'}`}
            onClick={() => handleProviderChange('paymob')}
            disabled={!paymobConfigured}
          >
            {t('payWithPaymob') || 'Pay with Paymob'}
          </button>
        </div>
          </>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(1)}
            className="flex-1"
            disabled={isProcessing}
          >
            {t("saasBack")}
          </Button>
          <Button
            onClick={isDirectSignup ? handleDirectProvision : handlePayment}
            className="flex-1"
            disabled={
              isProcessing ||
              !paymentSession ||
              (!isDirectSignup && (
                (paymentProvider === 'stripe' && !stripeConfigured) ||
                (paymentProvider === 'paypal' && !paypalConfigured) ||
                (paymentProvider === 'paymob' && !paymobConfigured)
              ))
            }
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isDirectSignup ? t("saasProcessing") : t("saasRedirectingCheckout")}
              </>
            ) : (
              <>
                {isDirectSignup
                  ? (language === 'ar' ? 'متابعة الإعداد' : 'Continue to Setup')
                  : t("saasProceedToPayment")}
              </>
            )}
          </Button>
        </div>

        {showEmbeddedCheckout && paymentSession?.paymentProvider === 'stripe' && paymentSession?.clientSecret && saasPublishableKey && (
          <div className="border rounded-lg p-4 bg-white">
            <EmbeddedCheckout
              clientSecret={paymentSession.clientSecret}
              publishableKey={saasPublishableKey}
              onComplete={() => {
                setCurrentStep(3);
                provisionTenant(paymentSession.sessionReference, form);
              }}
            />
          </div>
        )}

        {showEmbeddedCheckout && paymentSession?.paymentProvider === 'paypal' && paypalClientId && (
          <div className="border rounded-lg p-4 bg-white">
            <PayPalEmbeddedCheckout
              clientId={paypalClientId}
              currency={paymentSession.currency || 'USD'}
              mode="subscription"
              subscriptionId={paymentSession.paypalSubscriptionId || paymentSession.sessionId}
              onApprove={async () => {
                setCurrentStep(3);
                await provisionTenant(paymentSession.sessionReference, form);
              }}
            />
          </div>
        )}

        {showEmbeddedCheckout && paymentSession?.paymentProvider === 'paymob' && paymentSession?.clientSecret && paymobPublicKey && (
          <div className="border rounded-lg p-4 bg-white">
            <PaymobEmbeddedCheckout
              clientSecret={paymentSession.clientSecret}
              publicKey={paymobPublicKey}
              baseUrl={paymobBaseUrl}
              checkoutUrl={paymobCheckoutUrl}
            />
          </div>
        )}
      </CardContent>
    </Card>
    );
  };

  const renderStep3 = () => {
    const steps = [
      { key: "CREATE_TENANT_RECORD", label: t("saasProvisionCreateTenantLabel"), description: t("saasProvisionCreateTenantDesc") },
      { key: "CREATE_TENANT_DATABASE", label: t("saasProvisionCreateDbLabel"), description: t("saasProvisionCreateDbDesc") },
      { key: "STORE_DATABASE_SECRET", label: t("saasProvisionStoreSecretLabel"), description: t("saasProvisionStoreSecretDesc") },
      { key: "RUN_MIGRATIONS", label: t("saasProvisionRunMigrationsLabel"), description: t("saasProvisionRunMigrationsDesc") },
      { key: "CREATE_ADMIN", label: t("saasProvisionCreateAdminLabel"), description: t("saasProvisionCreateAdminDesc") },
      { key: "CREATE_SUBSCRIPTION", label: t("saasProvisionSeedDefaultsLabel"), description: t("saasProvisionSeedDefaultsDesc") },
      { key: "SEND_WELCOME_EMAIL", label: t("saasProvisionSendWelcomeLabel"), description: t("saasProvisionSendWelcomeDesc") },
    ];

    const latestLogsByStep = provisioningLogs.reduce<Record<string, ProvisioningLog>>((acc, entry) => {
      acc[entry.step] = entry;
      return acc;
    }, {});

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("saasProvisioningTitle")}</CardTitle>
          <CardDescription>{t("saasProvisioningDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentError && (
            <Alert variant="destructive">
              <AlertDescription>{paymentError}</AlertDescription>
            </Alert>
          )}
          {steps.map((step) => {
            const log = latestLogsByStep[step.key];
            const status = log?.status || "pending";
            
            return (
              <div key={step.key} className="flex items-start gap-3">
                <div className="mt-1">
                  {status === "success" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : status === "failed" ? (
                    <Circle className="w-5 h-5 text-red-500" />
                  ) : status === "pending" ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-gray-600">{step.description}</p>
                  {log?.error_message && (
                    <p className="text-sm text-red-500 mt-1">{log.error_message}</p>
                  )}
                </div>
              </div>
            );
          })}


        </CardContent>
      </Card>
    );
  };

  const renderStep4 = () => {
    const tenantUrl = tenant ? `https://${tenant.subdomain}.${baseDomain}` : null;

    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("saasCompletionTitle")}</CardTitle>
          <CardDescription>{t("saasCompletionDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tenant && (
            <Alert variant="destructive">
              <AlertDescription>{t("saasCompletionMissingTenant")}</AlertDescription>
            </Alert>
          )}

          {tenant && (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-green-900">{t("saasTenantIdLabel")}</span>
                <span className="font-mono text-sm text-green-900">{tenant.id}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-green-900">{t("saasTenantUrlLabel")}</span>
                <a
                  href={tenantUrl ?? undefined}
                  className="font-mono text-sm text-green-900 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tenant.subdomain}.{baseDomain}
                </a>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!tenantUrl}
            onClick={() => {
              if (tenantUrl) {
                window.location.href = tenantUrl;
              }
            }}
          >
            {t("saasCompletionDone")}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex flex-col items-center justify-center p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <PublicHeader title={t("saasCreateWorkspaceTitle")} subtitle={t("saasCreateWorkspaceSubtitle")} />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("saasCreateWorkspaceTitle")}</h1>
          <p className="text-gray-600">{t("saasCreateWorkspaceSubtitle")}</p>
        </div>

        {renderStepIndicator()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default SaasSignupWithPaymentPage;
