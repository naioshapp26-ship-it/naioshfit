import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/context/LanguageContext";
import AdsManagementPanel from "@/components/ads/AdsManagementPanel";

export default function AdsCoursesFeaturePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
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
        <h1 className="text-2xl font-semibold text-gray-900">{t("featureAdsTitle")}</h1>
        <p className="text-muted-foreground">{t("featureAdsSubtitle")}</p>
      </div>
      <AdsManagementPanel />
    </div>
  );
}
