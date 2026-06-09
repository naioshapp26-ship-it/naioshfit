import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import PublicHeader from "@/components/layout/PublicHeader";
import { SAAS_SUBDOMAIN_PATTERN } from "@/pages/saas/constants";
import {
  PLATFORM_TYPES,
  PAYMENT_METHODS,
  DOMAIN_MODES,
} from "@shared/enterpriseSaas";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building2,
  CreditCard,
  Globe,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import SaasSignupWithPaymentPage from "@/pages/saas/SignupWithPayment";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

interface OnboardingForm {
  platformType: string;
  companyName: string;
  ownerName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  plan: string;
  subdomain: string;
  domainMode: string;
  paymentMethod: string;
  adminPassword: string;
}

const STEP_LABELS_AR = [
  "نوع المنصة",
  "بيانات الشركة",
  "خطة الاشتراك",
  "النطاق",
  "الدفع",
  "المراجعة",
];

const defaultForm: OnboardingForm = {
  platformType: "gym",
  companyName: "",
  ownerName: "",
  email: "",
  phone: "",
  country: "SA",
  city: "",
  plan: "starter",
  subdomain: "",
  domainMode: "subdomain",
  paymentMethod: "visa",
  adminPassword: "",
};

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
              step === current
                ? "bg-[#8B0000] text-white border-[#8B0000] scale-110 shadow-lg"
                : step < current
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white text-zinc-500 border-zinc-200"
            }`}
          >
            {step < current ? <CheckCircle2 className="h-4 w-4" /> : step}
          </div>
          {step < total && (
            <div className={`h-0.5 w-6 md:w-10 ${step < current ? "bg-emerald-400" : "bg-zinc-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function TenantOnboardingWizard() {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<OnboardingForm>(defaultForm);
  const [plans, setPlans] = useState<any[]>([]);
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [launchPayment, setLaunchPayment] = useState(false);

  const mainDomain = useMemo(() => {
    if (typeof window === "undefined") return "naiosh.com";
    const host = window.location.hostname;
    const parts = host.split(".");
    return parts.length >= 2 ? parts.slice(-2).join(".") : host;
  }, []);

  useEffect(() => {
    fetch("/saas/enterprise-plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (!form.subdomain || !SAAS_SUBDOMAIN_PATTERN.test(form.subdomain)) {
      setSubdomainStatus("idle");
      return;
    }
    const timer = setTimeout(async () => {
      setSubdomainStatus("checking");
      try {
        const res = await fetch(`/saas/check-subdomain?subdomain=${encodeURIComponent(form.subdomain)}`);
        const data = await res.json();
        setSubdomainStatus(data.available ? "available" : "taken");
      } catch {
        setSubdomainStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.subdomain]);

  const update = (patch: Partial<OnboardingForm>) => setForm((f) => ({ ...f, ...patch }));

  const validateStep = useCallback((): boolean => {
    if (step === 1 && !form.platformType) return false;
    if (step === 2) {
      return Boolean(form.companyName && form.ownerName && form.email && form.phone);
    }
    if (step === 3 && !form.plan) return false;
    if (step === 4) {
      return Boolean(form.subdomain && SAAS_SUBDOMAIN_PATTERN.test(form.subdomain) && subdomainStatus === "available");
    }
    if (step === 5 && !form.paymentMethod) return false;
    return true;
  }, [step, form, subdomainStatus]);

  const next = () => {
    if (!validateStep()) {
      toast({ title: isRTL ? "يرجى إكمال الحقول المطلوبة" : "Please complete required fields", variant: "destructive" });
      return;
    }
    if (step === 6) {
      sessionStorage.setItem("naiosh-onboarding-form", JSON.stringify(form));
      setLaunchPayment(true);
      return;
    }
    setStep((s) => Math.min(6, s + 1) as WizardStep);
  };

  const back = () => setStep((s) => Math.max(1, s - 1) as WizardStep);

  if (launchPayment) {
    return <SaasSignupWithPaymentPage prefilledOnboarding={form} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-red-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" dir={isRTL ? "rtl" : "ltr"}>
      <PublicHeader
        title={isRTL ? "استأجر نظام NAIOSH" : "Rent NAIOSH Platform"}
        subtitle={isRTL ? "أنشئ منصتك المعزولة في دقائق" : "Launch your isolated workspace in minutes"}
      />

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6">
            <Sparkles className="h-8 w-8 mx-auto text-[#8B0000] mb-2" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {STEP_LABELS_AR[step - 1]}
            </h2>
          </div>
          <StepIndicator current={step} total={6} />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="border-zinc-200/80 shadow-xl backdrop-blur-sm bg-white/90 dark:bg-zinc-900/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {step === 1 && <Building2 className="h-5 w-5 text-[#8B0000]" />}
                  {step === 2 && <Building2 className="h-5 w-5 text-[#8B0000]" />}
                  {step === 3 && <CreditCard className="h-5 w-5 text-[#8B0000]" />}
                  {step === 4 && <Globe className="h-5 w-5 text-[#8B0000]" />}
                  {step === 5 && <CreditCard className="h-5 w-5 text-[#8B0000]" />}
                  {step === 6 && <ClipboardCheck className="h-5 w-5 text-[#8B0000]" />}
                  {STEP_LABELS_AR[step - 1]}
                </CardTitle>
                <CardDescription>
                  {isRTL ? `الخطوة ${step} من 6` : `Step ${step} of 6`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {step === 1 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PLATFORM_TYPES.map((type) => (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() => update({ platformType: type.key })}
                        className={`rounded-xl border p-4 text-right transition-all hover:scale-[1.02] ${
                          form.platformType === type.key
                            ? "border-[#8B0000] bg-red-50 ring-2 ring-[#8B0000]/30 dark:bg-red-950/30"
                            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        <div className="text-2xl mb-2">{type.icon}</div>
                        <div className="font-semibold text-sm">{type.labelAr}</div>
                      </button>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label>اسم الشركة</Label>
                      <Input value={form.companyName} onChange={(e) => update({ companyName: e.target.value })} placeholder="شركة NAIOSH" />
                    </div>
                    <div>
                      <Label>اسم المالك</Label>
                      <Input value={form.ownerName} onChange={(e) => update({ ownerName: e.target.value })} />
                    </div>
                    <div>
                      <Label>البريد الإلكتروني</Label>
                      <Input type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} />
                    </div>
                    <div>
                      <Label>الهاتف</Label>
                      <Input value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
                    </div>
                    <div>
                      <Label>الدولة</Label>
                      <Input value={form.country} onChange={(e) => update({ country: e.target.value })} />
                    </div>
                    <div>
                      <Label>المدينة</Label>
                      <Input value={form.city} onChange={(e) => update({ city: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>كلمة مرور المدير</Label>
                      <Input type="password" value={form.adminPassword} onChange={(e) => update({ adminPassword: e.target.value })} />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {(plans.length ? plans : [
                      { key: "starter", name: "Starter", name_ar: "المبتدئ", price_cents: 9900, features: ["50 مستخدم", "لوحة أساسية"] },
                      { key: "business", name: "Business", name_ar: "الأعمال", price_cents: 29900, features: ["200 مستخدم", "تقارير"] },
                      { key: "professional", name: "Professional", name_ar: "المحترف", price_cents: 49900, features: ["500 مستخدم", "API"] },
                      { key: "enterprise", name: "Enterprise", name_ar: "المؤسسات", price_cents: 99900, features: ["غير محدود", "SLA"] },
                    ]).map((plan: any) => (
                      <button
                        key={plan.key}
                        type="button"
                        onClick={() => update({ plan: plan.key })}
                        className={`rounded-xl border p-5 text-right transition-all ${
                          form.plan === plan.key ? "border-[#8B0000] bg-red-50 ring-2 ring-[#8B0000]/20" : "border-zinc-200"
                        }`}
                      >
                        <div className="font-bold text-lg">{plan.name_ar || plan.name}</div>
                        <div className="text-2xl font-black text-[#8B0000] my-2">
                          ${((plan.price_cents ?? 0) / 100).toFixed(0)}
                          <span className="text-sm font-normal text-zinc-500">/شهر</span>
                        </div>
                        <ul className="text-sm text-zinc-600 space-y-1">
                          {(Array.isArray(plan.features) ? plan.features : []).slice(0, 4).map((f: string, i: number) => (
                            <li key={i}>• {f}</li>
                          ))}
                        </ul>
                      </button>
                    ))}
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div className="flex gap-3 flex-wrap">
                      {DOMAIN_MODES.map((mode) => (
                        <button
                          key={mode.key}
                          type="button"
                          onClick={() => update({ domainMode: mode.key })}
                          className={`rounded-lg border px-4 py-2 text-sm ${
                            form.domainMode === mode.key ? "border-[#8B0000] bg-red-50" : "border-zinc-200"
                          }`}
                        >
                          {mode.labelAr}
                        </button>
                      ))}
                    </div>
                    <div>
                      <Label>النطاق الفرعي</Label>
                      <Input
                        value={form.subdomain}
                        onChange={(e) => update({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                        placeholder="company"
                      />
                      <p className="text-sm mt-2 text-zinc-500">
                        {form.domainMode === "path"
                          ? `${mainDomain}/${form.subdomain || "company"}`
                          : `${form.subdomain || "company"}.${mainDomain}`}
                      </p>
                      {subdomainStatus === "checking" && (
                        <p className="text-sm mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> جاري التحقق...</p>
                      )}
                      {subdomainStatus === "available" && <p className="text-sm mt-1 text-emerald-600">✓ متاح</p>}
                      {subdomainStatus === "taken" && <p className="text-sm mt-1 text-red-600">✗ مستخدم بالفعل</p>}
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => update({ paymentMethod: method.key })}
                        className={`rounded-xl border p-4 text-center transition-all ${
                          form.paymentMethod === method.key ? "border-[#8B0000] bg-red-50" : "border-zinc-200"
                        }`}
                      >
                        <div className="text-2xl mb-1">{method.icon}</div>
                        <div className="text-sm font-medium">{method.labelAr}</div>
                      </button>
                    ))}
                  </div>
                )}

                {step === 6 && (
                  <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-2 text-sm">
                    <p><strong>النوع:</strong> {PLATFORM_TYPES.find((p) => p.key === form.platformType)?.labelAr}</p>
                    <p><strong>الشركة:</strong> {form.companyName}</p>
                    <p><strong>المالك:</strong> {form.ownerName} — {form.email}</p>
                    <p><strong>الخطة:</strong> {form.plan}</p>
                    <p><strong>النطاق:</strong> {form.subdomain}.{mainDomain}</p>
                    <p><strong>الدفع:</strong> {PAYMENT_METHODS.find((p) => p.key === form.paymentMethod)?.labelAr}</p>
                  </div>
                )}

                <div className={`flex gap-3 pt-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={back} className="gap-1">
                      {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      {isRTL ? "السابق" : "Back"}
                    </Button>
                  )}
                  <Button type="button" onClick={next} className="flex-1 bg-[#8B0000] hover:bg-[#6d0000] gap-1">
                    {step === 6 ? (isRTL ? "تأكيد وإنشاء المنصة" : "Confirm & Create") : (isRTL ? "التالي" : "Next")}
                      {step < 6 && (isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
