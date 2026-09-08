import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TenantManagementPanel } from "@/components/admin/TenantManagementPanel";
import {
  Activity,
  AlertTriangle,
  Building2,
  Ban,
  CheckCircle2,
  PauseCircle,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";

type LifecycleAction = "suspend" | "reactivate" | "disable";

interface PlatformRow {
  id: string;
  subdomain: string;
  company_name: string;
  subscription_plan: string | null;
  status: string;
  created_at: string;
  admin_count?: number;
  product_type?: string | null;
  suspension_reason?: string | null;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "suspended" || status === "disabled") return "destructive";
  if (status === "pending_payment") return "secondary";
  return "outline";
}

export function SuperAdminControlCenter() {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const [section, setSection] = useState("dashboard");
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditAction, setAuditAction] = useState("all");
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction>("suspend");
  const [lifecyclePlatform, setLifecyclePlatform] = useState<PlatformRow | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleNotes, setLifecycleNotes] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ["/api/admin/saas/dashboard"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/saas/dashboard")).json(),
  });

  const { data: platformsData, refetch: refetchPlatforms } = useQuery({
    queryKey: ["/api/admin/saas/tenants", { limit: "50", offset: "0" }],
    queryFn: async () => (await apiRequest("GET", "/api/admin/saas/tenants?limit=50&offset=0")).json(),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/saas/users", userSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (userSearch.trim()) params.set("search", userSearch.trim());
      return (await apiRequest("GET", `/api/admin/saas/users?${params}`)).json();
    },
  });

  const auditParams = useMemo(() => {
    const params = new URLSearchParams({ limit: "40", offset: "0" });
    if (auditSearch.trim()) params.set("search", auditSearch.trim());
    if (auditAction !== "all") params.set("action", auditAction);
    return params.toString();
  }, [auditSearch, auditAction]);

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["/api/admin/saas/audit-logs", auditParams],
    queryFn: async () => (await apiRequest("GET", `/api/admin/saas/audit-logs?${auditParams}`)).json(),
  });

  const { data: detailsData, isLoading: detailsLoading } = useQuery({
    queryKey: ["/api/admin/saas/tenants", detailsId, "details"],
    enabled: Boolean(detailsId && detailsOpen),
    queryFn: async () => (await apiRequest("GET", `/api/admin/saas/tenants/${detailsId}`)).json(),
  });

  const lifecycleMutation = useMutation({
    mutationFn: async () => {
      if (!lifecyclePlatform) throw new Error("No platform selected");
      const path =
        lifecycleAction === "suspend"
          ? "suspend"
          : lifecycleAction === "disable"
            ? "disable"
            : "reactivate";
      const body =
        lifecycleAction === "reactivate"
          ? { reason: lifecycleReason.trim() || undefined, internalNotes: lifecycleNotes.trim() || undefined }
          : { reason: lifecycleReason.trim(), internalNotes: lifecycleNotes.trim() || undefined };
      const response = await apiRequest("POST", `/api/admin/saas/tenants/${lifecyclePlatform.id}/${path}`, body);
      return response.json();
    },
    onSuccess: () => {
      setLifecycleOpen(false);
      setLifecycleReason("");
      setLifecycleNotes("");
      setLifecyclePlatform(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/saas/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/saas/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/saas/audit-logs"] });
      toast({
        title: t("superAdminActionSuccessTitle"),
        description: t("superAdminActionSuccessDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("superAdminActionFailedTitle"),
        description: error?.message || t("superAdminActionFailedDesc"),
        variant: "destructive",
      });
    },
  });

  const openLifecycle = (platform: PlatformRow, action: LifecycleAction) => {
    setLifecyclePlatform(platform);
    setLifecycleAction(action);
    setLifecycleReason("");
    setLifecycleNotes("");
    setLifecycleOpen(true);
  };

  const totals = dashboard?.totals || {};
  const platforms: PlatformRow[] = platformsData?.tenants || [];

  const unsupportedCards = [
    { key: "incubators", label: t("superAdminIncubators") },
    { key: "branches", label: t("superAdminBranches") },
    { key: "offices", label: t("superAdminOffices") },
    { key: "freelancers", label: t("superAdminFreelancers") },
    { key: "visitors", label: t("superAdminVisitors") },
    { key: "authorities", label: t("superAdminAuthorities") },
  ];

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("superAdminControlCenterTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("superAdminControlCenterDesc")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetchDashboard();
            refetchPlatforms();
            refetchAudit();
          }}
        >
          <RefreshCw className="h-4 w-4 me-2" />
          {t("refresh")}
        </Button>
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="dashboard">{t("superAdminDashboard")}</TabsTrigger>
          <TabsTrigger value="platforms">{t("superAdminPlatforms")}</TabsTrigger>
          <TabsTrigger value="users">{t("superAdminUsers")}</TabsTrigger>
          <TabsTrigger value="entities">{t("superAdminEntities")}</TabsTrigger>
          <TabsTrigger value="audit">{t("superAdminAuditLogs")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboardLoading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={<Building2 className="h-4 w-4" />} label={t("superAdminTotalPlatforms")} value={totals.platforms || 0} />
                <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label={t("superAdminActivePlatforms")} value={totals.activePlatforms || 0} />
                <StatCard icon={<PauseCircle className="h-4 w-4" />} label={t("superAdminSuspendedPlatforms")} value={totals.suspendedPlatforms || 0} />
                <StatCard icon={<Ban className="h-4 w-4" />} label={t("superAdminDisabledPlatforms")} value={totals.disabledPlatforms || 0} />
                <StatCard icon={<Users className="h-4 w-4" />} label={t("superAdminTenantAdmins")} value={totals.tenantAdmins || 0} />
                <StatCard icon={<Activity className="h-4 w-4" />} label={t("superAdminPendingPayment")} value={totals.pendingPaymentPlatforms || 0} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("superAdminRecentPlatforms")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(dashboard?.recentPlatforms || []).map((platform: any) => (
                      <div key={platform.id} className="flex items-center justify-between rounded border p-2 text-sm">
                        <div>
                          <p className="font-medium">{platform.company_name}</p>
                          <p className="text-muted-foreground">{platform.subdomain}</p>
                        </div>
                        <Badge variant={statusBadgeVariant(platform.status)}>{platform.status}</Badge>
                      </div>
                    ))}
                    {!dashboard?.recentPlatforms?.length && (
                      <p className="text-sm text-muted-foreground">{t("superAdminNoData")}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("superAdminRecentActions")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(dashboard?.recentActions || []).map((log: any) => (
                      <div key={log.id} className="rounded border p-2 text-sm">
                        <p className="font-medium">{log.action}</p>
                        <p className="text-muted-foreground">
                          {log.entity_name || log.entity_id} · {log.actor_name || "—"}
                        </p>
                      </div>
                    ))}
                    {!dashboard?.recentActions?.length && (
                      <p className="text-sm text-muted-foreground">{t("superAdminNoData")}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("superAdminQuickActions")}</CardTitle>
              <CardDescription>{t("superAdminQuickActionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {platforms.slice(0, 12).map((platform) => (
                <div key={platform.id} className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{platform.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {platform.subdomain}
                      {platform.product_type ? ` · ${platform.product_type}` : ""}
                    </p>
                    <Badge variant={statusBadgeVariant(platform.status)} className="mt-1">{platform.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setDetailsId(platform.id); setDetailsOpen(true); }}>
                      {t("superAdminViewDetails")}
                    </Button>
                    {platform.status !== "suspended" && platform.status !== "deleted" && (
                      <Button size="sm" variant="destructive" onClick={() => openLifecycle(platform, "suspend")}>
                        {t("superAdminSuspend")}
                      </Button>
                    )}
                    {(platform.status === "suspended" || platform.status === "disabled") && (
                      <Button size="sm" onClick={() => openLifecycle(platform, "reactivate")}>
                        {t("superAdminReactivate")}
                      </Button>
                    )}
                    {platform.status !== "disabled" && platform.status !== "deleted" && (
                      <Button size="sm" variant="secondary" onClick={() => openLifecycle(platform, "disable")}>
                        {t("superAdminDisable")}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!platforms.length && <p className="text-sm text-muted-foreground">{t("superAdminNoData")}</p>}
            </CardContent>
          </Card>

          <TenantManagementPanel />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("superAdminUsers")}</CardTitle>
              <CardDescription>{t("superAdminUsersDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={t("superAdminSearchUsers")}
              />
              {usersLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : (
                <div className="space-y-2">
                  {(usersData?.users || []).map((user: any) => (
                    <div key={user.id} className="rounded border p-3 text-sm">
                      <p className="font-medium">{user.email}</p>
                      <p className="text-muted-foreground">
                        {user.company_name || "—"} · {user.subdomain || "—"}
                      </p>
                      <Badge variant={statusBadgeVariant(user.platform_status || "active")} className="mt-1">
                        {user.platform_status || "unknown"}
                      </Badge>
                    </div>
                  ))}
                  {!usersData?.users?.length && (
                    <p className="text-sm text-muted-foreground">{t("superAdminNoData")}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("superAdminEntities")}
              </CardTitle>
              <CardDescription>{t("superAdminEntitiesUnsupportedDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {unsupportedCards.map((item) => (
                <div key={item.key} className="rounded border p-4">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t("superAdminEntityNotModeled")}</p>
                  <Badge variant="outline" className="mt-2">0</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("superAdminAuditLogs")}</CardTitle>
              <CardDescription>{t("superAdminAuditLogsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder={t("superAdminSearchAudit")}
                />
                <Select value={auditAction} onValueChange={setAuditAction}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("superAdminFilterAction")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all")}</SelectItem>
                    <SelectItem value="platform.suspended">platform.suspended</SelectItem>
                    <SelectItem value="platform.reactivated">platform.reactivated</SelectItem>
                    <SelectItem value="platform.disabled">platform.disabled</SelectItem>
                    <SelectItem value="platform.created">platform.created</SelectItem>
                    <SelectItem value="platform.updated">platform.updated</SelectItem>
                    <SelectItem value="platform.soft_deleted">platform.soft_deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {auditLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : (
                <div className="space-y-2">
                  {(auditData?.logs || []).map((log: any) => (
                    <div key={log.id} className="rounded border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{log.action}</p>
                        <span className="text-xs text-muted-foreground">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {log.entity_name || log.entity_id} · {log.actor_name || "—"}
                      </p>
                      {log.reason && <p className="mt-1">{t("superAdminReason")}: {log.reason}</p>}
                    </div>
                  ))}
                  {!auditData?.logs?.length && (
                    <p className="text-sm text-muted-foreground">{t("superAdminNoData")}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={lifecycleOpen} onOpenChange={setLifecycleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lifecycleAction === "suspend"
                ? t("superAdminSuspendTitle")
                : lifecycleAction === "disable"
                  ? t("superAdminDisableTitle")
                  : t("superAdminReactivateTitle")}
            </DialogTitle>
            <DialogDescription>
              {lifecyclePlatform?.company_name} ({lifecyclePlatform?.subdomain}) · {lifecyclePlatform?.status}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {lifecycleAction === "reactivate"
                ? t("superAdminReactivateWarning")
                : t("superAdminSuspendWarning")}
            </p>
            {lifecycleAction !== "reactivate" && (
              <div className="space-y-1">
                <Label>{t("superAdminReason")} *</Label>
                <Textarea
                  value={lifecycleReason}
                  onChange={(e) => setLifecycleReason(e.target.value)}
                  placeholder={t("superAdminReasonPlaceholder")}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>{t("superAdminInternalNotes")}</Label>
              <Textarea
                value={lifecycleNotes}
                onChange={(e) => setLifecycleNotes(e.target.value)}
                placeholder={t("superAdminInternalNotesPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLifecycleOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant={lifecycleAction === "reactivate" ? "default" : "destructive"}
              disabled={lifecycleMutation.isPending || (lifecycleAction !== "reactivate" && lifecycleReason.trim().length < 3)}
              onClick={() => lifecycleMutation.mutate()}
            >
              {lifecycleMutation.isPending ? t("loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("superAdminPlatformDetails")}</DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : detailsData?.tenant ? (
            <div className="space-y-3 text-sm">
              <p><strong>{t("superAdminPlatformName")}:</strong> {detailsData.tenant.company_name}</p>
              <p><strong>{t("superAdminPlatformSubdomain")}:</strong> {detailsData.tenant.subdomain}</p>
              <p><strong>{t("status")}:</strong> {detailsData.tenant.status}</p>
              {detailsData.tenant.product_type && (
                <p><strong>{t("superAdminProductType")}:</strong> {detailsData.tenant.product_type}</p>
              )}
              {detailsData.tenant.suspension_reason && (
                <p><strong>{t("superAdminReason")}:</strong> {detailsData.tenant.suspension_reason}</p>
              )}
              {detailsData.tenant.admin_notes && (
                <p><strong>{t("superAdminInternalNotes")}:</strong> {detailsData.tenant.admin_notes}</p>
              )}
              <div>
                <p className="font-medium mb-1">{t("superAdminRelatedEntities")}</p>
                <p className="text-muted-foreground">{detailsData.relatedEntities?.note}</p>
              </div>
              <div>
                <p className="font-medium mb-1">{t("superAdminAuditLogs")}</p>
                <div className="space-y-1">
                  {(detailsData.auditLogs || []).slice(0, 8).map((log: any) => (
                    <div key={log.id} className="rounded border p-2">
                      {log.action} · {log.actor_name || "—"}
                    </div>
                  ))}
                  {!detailsData.auditLogs?.length && (
                    <p className="text-muted-foreground">{t("superAdminNoData")}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("superAdminNoData")}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-full bg-muted p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}
