import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Building2, RefreshCw, Eye, EyeOff } from "lucide-react";
import { SAAS_SUBDOMAIN_REGEX } from "@shared/saasConstants";

export interface TenantSummary {
  id: string;
  subdomain: string;
  company_name: string;
  subscription_plan: string | null;
  status: string;
  created_at: string;
  admin_count: number;
}

interface ProvisioningLog {
  step: string;
  status: string;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

interface PaymentTransaction {
  id: string;
  amount: string;
  currency: string;
  status: string;
  payment_method?: string | null;
  transaction_id?: string | null;
  payment_type?: string | null;
  stripe_payment_id?: string | null;
  stripe_checkout_session_id?: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ["active", "pending_payment", "suspended", "deleted"];

export const TenantManagementPanel = () => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [limit] = useState(20);
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    companyName: "",
    subdomain: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    adminPassword: "",
    subscriptionPlan: "",
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [logs, setLogs] = useState<ProvisioningLog[]>([]);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantSummary | null>(null);
  const [editForm, setEditForm] = useState({
    companyName: "",
    subscriptionPlan: "",
    status: "active",
  });

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      limit: String(limit),
      offset: String(page * limit),
    };
    if (search.trim()) params.search = search.trim();
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [search, statusFilter, limit, page]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/saas/tenants", queryParams],
    queryFn: async () => {
      const searchParams = new URLSearchParams(queryParams);
      const url = searchParams.toString()
        ? `/api/admin/saas/tenants?${searchParams.toString()}`
        : "/api/admin/saas/tenants";
      const response = await apiRequest("GET", url);
      return response.json();
    },
  });

  const tenants: TenantSummary[] = data?.tenants ?? [];
  const total = data?.total ?? 0;

  const updateStatusMutation = useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/saas/tenants/${tenantId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/saas/tenants"] });
      toast({ title: t('tenantUpdatedTitle'), description: t('tenantStatusUpdatedDesc') });
    },
    onError: (error: any) => {
      toast({
        title: t('tenantUpdateFailedTitle'),
        description: error?.message || t('tenantUpdateFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async () => {
      if (!editTenant) {
        throw new Error(t('tenantNoSelection'));
      }
      const response = await apiRequest("PATCH", `/api/admin/saas/tenants/${editTenant.id}`, {
        companyName: editForm.companyName.trim(),
        subscriptionPlan: editForm.subscriptionPlan.trim(),
        status: editForm.status,
      });
      return response.json();
    },
    onSuccess: () => {
      setEditOpen(false);
      setEditTenant(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/saas/tenants"] });
      toast({ title: t('tenantUpdatedTitle'), description: t('tenantDetailsUpdatedDesc') });
    },
    onError: (error: any) => {
      toast({
        title: t('tenantUpdateFailedTitle'),
        description: error?.message || t('tenantUpdateFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/saas/tenants/${tenantId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/saas/tenants"] });
      toast({ title: t('tenantDeletedTitle'), description: t('tenantDeletedDesc') });
    },
    onError: (error: any) => {
      toast({
        title: t('tenantDeleteFailedTitle'),
        description: error?.message || t('tenantDeleteFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/saas/tenants", {
        companyName: createForm.companyName.trim(),
        subdomain: createForm.subdomain.trim().toLowerCase(),
        adminName: createForm.adminName.trim(),
        adminEmail: createForm.adminEmail.trim(),
        adminPhone: createForm.adminPhone.trim(),
        adminPassword: createForm.adminPassword,
        subscriptionPlan: createForm.subscriptionPlan.trim() || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm({
        companyName: "",
        subdomain: "",
        adminName: "",
        adminEmail: "",
        adminPhone: "",
        adminPassword: "",
        subscriptionPlan: "",
      });
      setCreateErrors({});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/saas/tenants"] });
      toast({ title: t('tenantCreatedTitle'), description: t('tenantCreatedDesc') });
    },
    onError: (error: any) => {
      toast({
        title: t('tenantCreateFailedTitle'),
        description: error?.message || t('tenantCreateFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const refundPaymentMutation = useMutation({
    mutationFn: async ({ tenantId, paymentId }: { tenantId: string; paymentId: string }) => {
      const response = await apiRequest("POST", `/api/admin/saas/tenants/${tenantId}/payments/${paymentId}/refund`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data?.payment) {
        setPayments((prev) => prev.map((payment) => payment.id === data.payment.id ? { ...payment, ...data.payment } : payment));
      }
      toast({ title: t('tenantManagementRefundSuccessTitle'), description: t('tenantManagementRefundSuccessDesc') });
    },
    onError: (error: any) => {
      toast({
        title: t('tenantManagementRefundFailedTitle'),
        description: error?.message || t('tenantManagementRefundFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const validateCreate = () => {
    const errors: Record<string, string> = {};
    const normalizedSubdomain = createForm.subdomain.trim().toLowerCase();

    if (!createForm.companyName.trim()) errors.companyName = t('tenantCompanyNameRequired');
    if (!normalizedSubdomain) errors.subdomain = t('tenantSubdomainRequired');
    if (normalizedSubdomain && !SAAS_SUBDOMAIN_REGEX.test(normalizedSubdomain)) {
      errors.subdomain = t('tenantSubdomainInvalid');
    }
    if (!createForm.adminName.trim()) errors.adminName = t('tenantAdminNameRequired');
    if (!createForm.adminEmail.trim()) errors.adminEmail = t('tenantAdminEmailRequired');
    if (createForm.adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(createForm.adminEmail)) {
      errors.adminEmail = t('tenantAdminEmailInvalid');
    }
    if (!createForm.adminPhone.trim()) errors.adminPhone = t('tenantAdminPhoneRequired');
    if (createForm.adminPhone && createForm.adminPhone.replace(/\D/g, '').length < 10) {
      errors.adminPhone = t('tenantAdminPhoneInvalid');
    }
    if (!createForm.adminPassword) errors.adminPassword = t('tenantAdminPasswordRequired');
    if (createForm.adminPassword && createForm.adminPassword.length < 8) {
      errors.adminPassword = t('tenantAdminPasswordInvalid');
    }

    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTenant = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateCreate()) return;
    createTenantMutation.mutate();
  };

  const handleStatusChange = (tenantId: string, value: string) => {
    updateStatusMutation.mutate({ tenantId, status: value });
  };

  const handleOpenLogs = async (tenant: TenantSummary) => {
    setSelectedTenant(tenant);
    setLogs([]);
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const response = await apiRequest("GET", `/api/admin/saas/tenants/${tenant.id}/provisioning-logs`);
      const payload = await response.json();
      setLogs(payload.logs || []);
    } catch (error: any) {
      toast({
        title: t('tenantLogsFailedTitle'),
        description: error?.message || t('tenantLogsFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setLogsLoading(false);
    }
  };

  const handleOpenPayments = async (tenant: TenantSummary) => {
    setSelectedTenant(tenant);
    setPayments([]);
    setPaymentsOpen(true);
    setPaymentsLoading(true);
    try {
      const response = await apiRequest("GET", `/api/admin/saas/tenants/${tenant.id}/payments`);
      const payload = await response.json();
      setPayments(payload.payments || []);
    } catch (error: any) {
      toast({
        title: t('tenantPaymentsFailedTitle'),
        description: error?.message || t('tenantPaymentsFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleRefundPayment = (payment: PaymentTransaction) => {
    if (!selectedTenant) return;
    const confirmed = window.confirm(`${t('tenantManagementRefundConfirmPrefix')} ${payment.amount} ${payment.currency}?`);
    if (!confirmed) return;
    refundPaymentMutation.mutate({ tenantId: selectedTenant.id, paymentId: payment.id });
  };

  const handleOpenEdit = (tenant: TenantSummary) => {
    setEditTenant(tenant);
    setEditForm({
      companyName: tenant.company_name,
      subscriptionPlan: tenant.subscription_plan || "",
      status: tenant.status,
    });
    setEditOpen(true);
  };

  const handleDeleteTenant = (tenant: TenantSummary) => {
    const confirmed = window.confirm(
      `${t('tenantDeleteConfirmPrefix')} ${tenant.company_name} (${tenant.subdomain})? ${t('tenantDeleteConfirmSuffix')}`
    );
    if (!confirmed) return;
    deleteTenantMutation.mutate(tenant.id);
  };

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString(language === "ar" ? "ar-EG" : "en-US");

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return t('tenantStatusActive');
      case "pending_payment":
        return t('tenantStatusPendingPayment');
      case "suspended":
        return t('tenantStatusSuspended');
      case "deleted":
        return t('tenantStatusDeleted');
      default:
        return status;
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t('paymentStatusCompleted');
      case "pending":
        return t('paymentStatusPending');
      case "failed":
        return t('paymentStatusFailed');
      case "refunded":
        return t('paymentStatusRefunded');
      default:
        return status;
    }
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Building2 className="w-5 h-5" /> {t('tenantManagement')}
            </CardTitle>
            <CardDescription className="text-gray-600">{t('tenantManagementDescription')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> {t('tenantManagementRefresh')}
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">{t('tenantManagementNewTenant')}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                <DialogHeader>
                  <DialogTitle>{t('tenantManagementCreateTenant')}</DialogTitle>
                  <DialogDescription>{t('tenantManagementCreateTenantDesc')}</DialogDescription>
                </DialogHeader>
                <form className="space-y-3" onSubmit={handleCreateTenant}>
                  <div className="space-y-1">
                    <Label>{t('tenantManagementCompanyName')}</Label>
                    <Input
                      value={createForm.companyName}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, companyName: e.target.value }))}
                    />
                    {createErrors.companyName && <p className="text-xs text-red-500">{createErrors.companyName}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>{t('tenantManagementSubdomain')}</Label>
                    <Input
                      value={createForm.subdomain}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, subdomain: e.target.value }))}
                    />
                    {createErrors.subdomain && <p className="text-xs text-red-500">{createErrors.subdomain}</p>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>{t('tenantManagementAdminName')}</Label>
                      <Input
                        value={createForm.adminName}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, adminName: e.target.value }))}
                      />
                      {createErrors.adminName && <p className="text-xs text-red-500">{createErrors.adminName}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label>{t('tenantManagementAdminEmail')}</Label>
                      <Input
                        type="email"
                        value={createForm.adminEmail}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
                      />
                      {createErrors.adminEmail && <p className="text-xs text-red-500">{createErrors.adminEmail}</p>}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>{t('tenantManagementAdminPhone')}</Label>
                      <Input
                        type="tel"
                        placeholder={t('tenantManagementAdminPhonePlaceholder')}
                        value={createForm.adminPhone}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, adminPhone: e.target.value }))}
                      />
                      {createErrors.adminPhone && <p className="text-xs text-red-500">{createErrors.adminPhone}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label>{t('tenantManagementAdminPassword')}</Label>
                      <div className="relative">
                        <Input
                          type={showCreatePassword ? "text" : "password"}
                          value={createForm.adminPassword}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, adminPassword: e.target.value }))}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCreatePassword(!showCreatePassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showCreatePassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {createErrors.adminPassword && <p className="text-xs text-red-500">{createErrors.adminPassword}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label>{t('tenantManagementSubscriptionPlanOptional')}</Label>
                      <Input
                        value={createForm.subscriptionPlan}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, subscriptionPlan: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={createTenantMutation.isPending}>
                      {createTenantMutation.isPending ? t('tenantManagementProvisioning') : t('tenantManagementCreate')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>{t('search')}</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tenantManagementSearchPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('status')}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {getStatusLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t('tenantManagementTotalTenants')}</Label>
            <div className="text-2xl font-semibold text-gray-900">{total}</div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t('tenantManagementLoadingTenants')}</div>
        ) : tenants.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t('tenantManagementNoTenants')}</div>
        ) : (
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-900">{tenant.company_name}</div>
                    <div className="text-sm text-gray-600">{tenant.subdomain}</div>
                    <div className="text-xs text-gray-500">
                      {t('tenantManagementAdminsLabel')}: {tenant.admin_count}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t('tenantManagementCreatedLabel')}: {formatDateTime(tenant.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={tenant.status === "active" ? "default" : tenant.status === "suspended" ? "destructive" : "secondary"}>
                      {getStatusLabel(tenant.status)}
                    </Badge>
                    {tenant.subscription_plan && <Badge variant="outline">{tenant.subscription_plan}</Badge>}
                    <Button size="sm" variant="outline" onClick={() => handleOpenLogs(tenant)}>
                      {t('tenantManagementViewLogs')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenPayments(tenant)}>
                      {t('tenantManagementPayments')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleOpenEdit(tenant)}>
                      {t('edit')}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteTenant(tenant)}>
                      {t('delete')}
                    </Button>
                    <Select value={tenant.status} onValueChange={(value) => handleStatusChange(tenant.id, value)}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder={t('tenantManagementSetStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {getStatusLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{t('page')} {page + 1}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))}>
              {t('previous')}
            </Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)}>
              {t('next')}
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-xl" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('tenantManagementProvisioningLogs')}</DialogTitle>
            <DialogDescription>{selectedTenant?.company_name || t('tenantLabel')}</DialogDescription>
          </DialogHeader>
          {logsLoading ? (
            <div className="text-sm text-muted-foreground">{t('tenantManagementLoadingLogs')}</div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('tenantManagementNoLogs')}</div>
          ) : (
            <div className="space-y-2 text-sm">
              {logs.map((log) => (
                <div key={`${log.step}-${log.started_at}`} className="rounded border p-2">
                  <div className="font-semibold">{log.step}</div>
                  <div>{t('status')}: {getStatusLabel(log.status)}</div>
                  {log.error_message && <div className="text-red-500">{log.error_message}</div>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('tenantManagementPaymentHistory')}</DialogTitle>
            <DialogDescription>{selectedTenant?.company_name || t('tenantLabel')}</DialogDescription>
          </DialogHeader>
          {paymentsLoading ? (
            <div className="text-sm text-muted-foreground">{t('tenantManagementLoadingPayments')}</div>
          ) : payments.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('tenantManagementNoPayments')}</div>
          ) : (
            <div className="space-y-2 text-sm">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded border p-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {payment.amount} {payment.currency}
                      </div>
                      <div>{t('status')}: {getPaymentStatusLabel(payment.status)}</div>
                      {payment.payment_method && <div>{t('tenantManagementMethodLabel')}: {payment.payment_method}</div>}
                      {payment.payment_type && <div>{t('tenantManagementPaymentTypeLabel')}: {payment.payment_type}</div>}
                      {payment.transaction_id && <div>{t('tenantManagementStripeReferenceLabel')}: {payment.transaction_id}</div>}
                      <div className="text-xs text-gray-500">{formatDateTime(payment.created_at)}</div>
                    </div>
                    {payment.status !== "refunded" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={refundPaymentMutation.isPending && refundPaymentMutation.variables?.paymentId === payment.id}
                        onClick={() => handleRefundPayment(payment)}
                      >
                        {refundPaymentMutation.isPending && refundPaymentMutation.variables?.paymentId === payment.id
                          ? t('tenantManagementRefunding')
                          : t('tenantManagementRefundAction')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('tenantManagementEditTenant')}</DialogTitle>
            <DialogDescription>{editTenant?.company_name || t('tenantLabel')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              updateTenantMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>{t('tenantManagementCompanyName')}</Label>
              <Input
                value={editForm.companyName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, companyName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('tenantManagementSubscriptionPlan')}</Label>
              <Input
                value={editForm.subscriptionPlan}
                onChange={(e) => setEditForm((prev) => ({ ...prev, subscriptionPlan: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('status')}</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('tenantManagementSetStatus')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {getStatusLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={updateTenantMutation.isPending}>
                {updateTenantMutation.isPending ? t('saving') : t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
