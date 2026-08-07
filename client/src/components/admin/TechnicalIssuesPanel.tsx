import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink, MessageSquareWarning } from "lucide-react";

type TechnicalIssue = {
  reportId: string;
  issueType: string;
  description: string;
  userEmail?: string;
  phoneNumber?: string;
  timestamp?: string;
  pageUrl?: string;
  screenshotPath?: string;
  reporterUserId?: number;
  reporterName?: string;
  reporterUsername?: string;
  reporterAccount?: string;
};

const ISSUE_TYPE_KEYS: Record<string, string> = {
  technical: "technicalProblem",
  bug: "bugReport",
  performance: "performanceIssue",
  ui: "userInterfaceProblem",
  feature: "featureRequest",
  coach_request: "coachAssignmentRequest",
  other: "issueTypeOther",
};

export function TechnicalIssuesPanel() {
  const { t, language } = useLanguage();

  const { data: issues = [], isLoading } = useQuery<TechnicalIssue[]>({
    queryKey: ["/api/admin/technical-issues"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/technical-issues");
      return res.json();
    },
  });

  const issueTypeLabel = (issueType: string) => {
    const key = ISSUE_TYPE_KEYS[issueType];
    return key ? t(key as any) : issueType;
  };

  // Build the "reported by" label from identity fields only (name / username).
  // Email is shown once on its own line, so it must not be repeated here.
  const resolveReporterLabel = (issue: TechnicalIssue) => {
    const name = issue.reporterName?.trim();
    const username = issue.reporterUsername?.trim();
    const parts: string[] = [];
    if (name) parts.push(name);
    if (username) parts.push(`@${username}`);
    if (parts.length) return parts.join(' ');
    // Fall back to email/phone only when no name or username is available.
    if (issue.userEmail) return issue.userEmail;
    if (issue.phoneNumber) return issue.phoneNumber;
    return '';
  };

  // The stored description is prefixed with a "[Account: ...]" line that duplicates
  // the reporter details already shown above; strip it for display.
  const cleanDescription = (description?: string) =>
    (description || '').replace(/^\[Account:.*?\]\r?\n?/, '');

  const openScreenshot = (reportId: string) => {
    window.open(`/api/admin/technical-issues/${encodeURIComponent(reportId)}/screenshot`, "_blank");
  };

  return (
    <Card dir={language === "ar" ? "rtl" : "ltr"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5" />
          {t("technicalIssuesTitle")}
        </CardTitle>
        <CardDescription>{t("technicalIssuesDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noTechnicalIssues")}</p>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => {
              const reporterLabel = resolveReporterLabel(issue);
              return (
              <div key={issue.reportId} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{issueTypeLabel(issue.issueType)}</Badge>
                    <span className="text-xs text-muted-foreground">{issue.reportId}</span>
                  </div>
                  {issue.timestamp && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(issue.timestamp).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}
                    </span>
                  )}
                </div>

                {(reporterLabel || issue.reporterUserId) && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">{t("reportedBy")}: </span>
                    <span>{reporterLabel || t("unknownUser")}</span>
                    {issue.reporterUserId ? (
                      <span className="text-xs text-muted-foreground"> ({t("userId")}: {issue.reporterUserId})</span>
                    ) : null}
                  </div>
                )}

                <p className="text-sm whitespace-pre-wrap">{cleanDescription(issue.description)}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {issue.userEmail && issue.userEmail !== reporterLabel && (
                    <span>{t("email")}: {issue.userEmail}</span>
                  )}
                  {issue.phoneNumber && (
                    <span>{t("phoneNumber")}: {issue.phoneNumber}</span>
                  )}
                  {issue.pageUrl && (
                    <span className="truncate max-w-full">{issue.pageUrl}</span>
                  )}
                </div>
                {issue.screenshotPath && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openScreenshot(issue.reportId)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {t("viewScreenshot")}
                  </Button>
                )}
              </div>
            );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
