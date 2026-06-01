import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantOpsPanel } from "@/components/epics/EpicWidgets";
import { useLanguage } from "@/context/LanguageContext";
import { isTenantManagerRole } from "@shared/roleAccess";

export default function TenantOpsFeaturePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isTenantSubdomain = (() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length > 2 && parts[0] !== "www") {
      return true;
    }
    return false;
  })();
  if (isTenantSubdomain) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">{t("accessDeniedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            {t("accessDeniedAdmin")}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!user || !isTenantManagerRole(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">{t("accessDeniedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            {t("accessDeniedAdmin")}
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="p-4 lg:p-8 space-y-4 min-h-screen">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">{t("featureTenantTitle")}</h1>
        <p className="text-muted-foreground">{t("featureTenantSubtitle")}</p>
      </div>
      <TenantOpsPanel />
    </div>
  );
}
