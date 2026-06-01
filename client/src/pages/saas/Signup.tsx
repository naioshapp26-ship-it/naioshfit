import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SAAS_SUBDOMAIN_PATTERN } from "./constants";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import BackButton from "@/components/navigation/BackButton";

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

const SaasSignupPage = () => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    subdomain: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
    subscriptionPlan: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [logs, setLogs] = useState<ProvisioningLog[]>([]);

  const baseDomain = useMemo(() => {
    if (typeof window === "undefined") return null;
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length < 2) return host;
    return parts.slice(-2).join(".");
  }, []);

  const buildTenantUrl = (subdomain: string) => {
    if (typeof window === "undefined" || !baseDomain) return null;
    const protocol = window.location.protocol || "https:";
    return `${protocol}//${subdomain}.${baseDomain}`;
  };

  const tenantUrl = tenant ? buildTenantUrl(tenant.subdomain) : null;

  const redirectToTenant = (createdTenant: TenantSummary) => {
    const url = buildTenantUrl(createdTenant.subdomain);
    if (!url) return;
    window.location.assign(`${url}/auth`);
  };

  const handleChange = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const validate = () => {
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
    if (!form.adminPhone.trim()) errors.adminPhone = t("saasAdminPhoneRequired");
    if (form.adminPhone && form.adminPhone.replace(/\D/g, '').length < 10) {
      errors.adminPhone = t("saasAdminPhoneInvalid");
    }
    if (!form.adminPassword) errors.adminPassword = t("saasAdminPasswordRequired");
    if (form.adminPassword && form.adminPassword.length < 8) {
      errors.adminPassword = t("saasAdminPasswordInvalid");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/saas/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          subdomain: form.subdomain.trim().toLowerCase(),
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim(),
          adminPhone: form.adminPhone.trim(),
          adminPassword: form.adminPassword,
          subscriptionPlan: form.subscriptionPlan.trim() || undefined,
        }),
      });

      const payload = await response.json().catch((parseError) => {
        console.error("Failed to parse signup response:", parseError);
        return {};
      });
      if (!response.ok) {
        throw new Error(payload.message || "Tenant signup failed.");
      }

      const createdTenant = payload.tenant as TenantSummary;
      setTenant(createdTenant);
      setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      toast({
        title: t("saasTenantProvisioned"),
        description: t("saasTenantProvisionedDesc"),
      });
      setTimeout(() => {
        redirectToTenant(createdTenant);
      }, 800);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : t("saasTenantSignupFailed");
      toast({
        title: t("saasSignupError"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="w-full max-w-2xl space-y-6">
        <div className="w-full mb-4">
          <BackButton fallbackHref="/home" className="h-10 px-4 sticky top-[84px] z-30" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">{t("saasSignupTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("saasSignupDescription")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("saasOrgDetailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
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
                <Input
                  id="subdomain"
                  value={form.subdomain}
                  onChange={handleChange("subdomain")}
                  placeholder={t("saasSubdomainPlaceholder")}
                />
                {fieldErrors.subdomain && (
                  <p className="text-xs text-red-500">{fieldErrors.subdomain}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("saasSubdomainHelp")}
                </p>
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
                <Label htmlFor="adminPhone">{t("saasAdminPhoneLabel")}</Label>
                <Input
                  id="adminPhone"
                  type="tel"
                  value={form.adminPhone}
                  onChange={handleChange("adminPhone")}
                  placeholder={t("saasAdminPhonePlaceholder")}
                />
                {fieldErrors.adminPhone && (
                  <p className="text-xs text-red-500">{fieldErrors.adminPhone}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("saasAdminPhoneHelp")}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">{t("saasAdminPasswordLabel")}</Label>
                  <div className="relative">
                    <Input
                      id="adminPassword"
                      type={showPassword ? "text" : "password"}
                      value={form.adminPassword}
                      onChange={handleChange("adminPassword")}
                      placeholder={t("saasAdminPasswordPlaceholder")}
                      className={isRTL ? "pl-10" : "pr-10"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 ${isRTL ? "left-3" : "right-3"}`}
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
                  <Label htmlFor="subscriptionPlan">{t("saasSubscriptionPlan")}</Label>
                  <select
                    id="subscriptionPlan"
                    value={form.subscriptionPlan}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, subscriptionPlan: event.target.value }))
                    }
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t("saasSubscriptionPlanSelect")}</option>
                    <option value="starter">{t("saasSubscriptionPlanStarter")}</option>
                    <option value="growth">{t("saasSubscriptionPlanGrowth")}</option>
                    <option value="enterprise">{t("saasSubscriptionPlanEnterprise")}</option>
                  </select>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t("saasProvisioningTenant") : t("saasCreateTenantButton")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {tenant && (
          <Card>
            <CardHeader>
              <CardTitle>{t("saasTenantReady")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="font-semibold">{t("saasTenantId")}:</span> {tenant.id}</p>
              <p><span className="font-semibold">{t("saasCompany")}:</span> {tenant.companyName}</p>
              <p><span className="font-semibold">{t("saasSubdomain")}:</span> {tenant.subdomain}</p>
              <p><span className="font-semibold">{t("saasStatus")}:</span> {tenant.status}</p>
              {tenantUrl && (
                <p>
                  <span className="font-semibold">{t("saasTenantUrl")}:</span> {tenantUrl}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("saasProvisioningSteps")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {logs.map((log) => (
                <div key={`${log.step}-${log.started_at}`} className="rounded border p-3">
                  <p className="font-semibold">{log.step}</p>
                  <p>{t("saasStepStatus")}: {log.status}</p>
                  {log.error_message && (
                    <p className="text-red-500">{t("saasStepError")}: {log.error_message}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SaasSignupPage;
