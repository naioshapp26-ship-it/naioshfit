import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplementsUserPanel, SupplementsFollowupPanel } from "@/components/epics/EpicWidgets";
import { useLanguage } from "@/context/LanguageContext";

export default function SupplementsFeaturePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  if (!user || !["user", "coach", "admin", "super_admin"].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">{t("accessDeniedTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            {t("accessDeniedGeneric")}
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="p-4 lg:p-8 space-y-4 min-h-screen">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">{t("featureSupplementsTitle")}</h1>
        <p className="text-muted-foreground">{t("featureSupplementsSubtitle")}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SupplementsUserPanel />
        <SupplementsFollowupPanel />
      </div>
    </div>
  );
}
