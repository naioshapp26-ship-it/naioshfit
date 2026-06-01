import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  FileText,
  Gauge,
  Globe,
  Hash,
  HeartPulse,
  LaptopMinimal,
  Layers,
  LineChart,
  Link2,
  Lock,
  Medal,
  Search,
  Microscope,
  MonitorCog,
  Shield,
  Sparkles,
  Stars,
  Stethoscope,
  Target,
  Timer,
  Users,
  Wallet,
  Download,
  Eye,
  Trash2,
  Upload,
  Plus,
  X,
  Edit,
  MoreVertical,
  Calendar,
  Clock,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MediaUpload } from "@/components/ui/media-upload";

type Props = {
  compact?: boolean;
  hideEpicBadge?: boolean;
};

type MediaItem = {
  url: string;
  type: "image" | "video";
};

type GroupChallenge = {
  id: number;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  mediaUrls?: MediaItem[] | null;
  challengeType: string;
  metricName: string;
  targetValue?: number | null;
  startDate: string;
  endDate: string;
  createdBy: number;
  groupId?: number | null;
  isPublic?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
  userParticipation?: {
    id: number;
    challengeId: number;
    userId: number;
    currentValue: number;
    joinedAt: string;
  } | null;
};

type CreateChallengePayload = {
  name: string;
  description?: string;
  mediaUrls?: MediaItem[];
  challengeType: string;
  metricName: string;
  targetValue?: number;
  startDate: string;
  endDate: string;
  isPublic?: boolean;
};

type ChallengeLeaderboardEntry = {
  userId: number;
  currentValue: number;
  rank?: number | null;
  firstName: string;
  lastName: string;
};

type ChallengeLeaderboard = {
  challenge: {
    id: number;
    name: string;
    metricName: string;
  } | null;
  leaders: ChallengeLeaderboardEntry[];
  userRank: {
    rank: number;
    currentValue: number;
  } | null;
  totalParticipants: number;
};

type ChallengeTypePreset = {
  value: string;
  labelKey: string;
  metricSuggestion: string;
};

const CHALLENGE_TYPE_PRESETS: ChallengeTypePreset[] = [
  { value: "step_count", labelKey: "challengeTypeSteps", metricSuggestion: "steps" },
  { value: "workout_count", labelKey: "challengeTypeWorkouts", metricSuggestion: "sessions" },
  { value: "nutrition_adherence", labelKey: "challengeTypeNutrition", metricSuggestion: "meals" },
  { value: "weight_loss", labelKey: "challengeTypeWeight", metricSuggestion: "kg" },
  { value: "custom", labelKey: "challengeTypeCustom", metricSuggestion: "points" },
];

const formatInputDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const addDays = (date: Date, days: number) => {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
};

const addHours = (date: Date, hours: number) => {
  const clone = new Date(date);
  clone.setHours(clone.getHours() + hours);
  return clone;
};

const toUTCISOString = (value: string) => {
  if (!value) {
    return new Date().toISOString();
  }
  // If the string already contains a time component, rely on Date parsing.
  if (value.includes("T")) {
    return new Date(value).toISOString();
  }
  // Date-only fallback
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return new Date(value).toISOString();
  }
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toDateTimeLocalUtcIso = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatChallengeDateRange = (startDate: string, endDate: string, locale: string) => {
  try {
    const formatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
    return `${formatter.format(new Date(startDate))} – ${formatter.format(new Date(endDate))}`;
  } catch {
    return `${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}`;
  }
};

const detectMediaTypeFromUrl = (url: string): "image" | "video" => {
  const normalized = url.toLowerCase();
  if (/(\.mp4|\.webm|\.ogg|\.mov|\.m4v)(\?.*)?$/.test(normalized)) {
    return "video";
  }
  return "image";
};

const normalizeMediaItems = (value: unknown): MediaItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const rawUrl = typeof (entry as any).url === "string" ? (entry as any).url.trim() : "";
      if (!rawUrl) return null;
      const type = (entry as any).type === "video" ? "video" : detectMediaTypeFromUrl(rawUrl);
      return { url: rawUrl, type } as MediaItem;
    })
    .filter((entry): entry is MediaItem => Boolean(entry));
};

const sanitizeMediaItems = (items: MediaItem[]): MediaItem[] => {
  return items
    .map((item) => ({
      url: item.url.trim(),
      type: item.type === "video" ? "video" : detectMediaTypeFromUrl(item.url),
    }))
    .filter((item) => Boolean(item.url));
};

const MediaCollectionField: React.FC<{
  label: string;
  description?: string;
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  maxItems?: number;
  addLabel?: string;
  removeLabel?: string;
  typeLabel?: string;
  imageLabel?: string;
  videoLabel?: string;
}> = ({
  label,
  description,
  items,
  onChange,
  maxItems = 4,
  addLabel = "Add media item",
  removeLabel = "Remove",
  typeLabel = "Type",
  imageLabel = "Image",
  videoLabel = "Video",
}) => {
  const addItem = () => {
    if (items.length >= maxItems) return;
    onChange([...items, { url: "", type: "image" }]);
  };

  const updateItem = (index: number, next: Partial<MediaItem>) => {
    const cloned = [...items];
    cloned[index] = { ...cloned[index], ...next };
    onChange(cloned);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="rounded-lg border bg-slate-50/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{label} #{index + 1}</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(index)}>
                <X className="h-4 w-4 mr-1" />
                {removeLabel}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-2 md:col-span-1">
                <Label>{typeLabel}</Label>
                <Select
                  value={item.type}
                  onValueChange={(value) => updateItem(index, { type: value === "video" ? "video" : "image" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="image">{imageLabel}</SelectItem>
                      <SelectItem value="video">{videoLabel}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <MediaUpload
                  value={item.url}
                  onChange={(url) => updateItem(index, { url })}
                  accept={item.type === "video" ? "video/*" : "image/*"}
                  mediaType={item.type}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addItem} disabled={items.length >= maxItems}>
        <Plus className="h-4 w-4 mr-2" />
        {addLabel}
      </Button>
    </div>
  );
};

const getFileTypeOptions = (t: (key: string) => string) => [
  { value: "progress_photo", label: t("progressPhoto") },
  { value: "medical_report", label: t("medicalReport") },
  { value: "pdf", label: t("pdfDocument") },
  { value: "excel", label: t("spreadsheet") },
  { value: "video", label: t("videoFile") },
  { value: "other", label: t("otherFile") },
];

const getVisibilityOptions = (t: (key: string) => string) => [
  { value: "private", label: t("onlyMe") },
  { value: "coach_visible", label: t("coachVisible") },
  { value: "admin_visible", label: t("adminVisible") },
];

const useActionToast = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  return (action: string) =>
    toast({
      title: action,
      description: t("actionTriggered"),
    });
};

const SectionHeader = ({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) => (
  <div className="flex items-start justify-between gap-2 flex-wrap">
    <div>
      <div className="flex items-center gap-2">
        {badge && <Badge variant="outline">{badge}</Badge>}
        <CardTitle>{title}</CardTitle>
      </div>
      {subtitle && <CardDescription>{subtitle}</CardDescription>}
    </div>
  </div>
);

export const SupplementsUserPanel: React.FC<Props> = ({ compact }) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showCatalog, setShowCatalog] = useState(false);
  const [supplements, setSupplements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedSupplementId, setSelectedSupplementId] = useState<string>("");
  const [dosageAmount, setDosageAmount] = useState("");
  const [dosageUnit, setDosageUnit] = useState("");
  const [timingType, setTimingType] = useState("");
  const [timingTime, setTimingTime] = useState("");

  const fetchSupplements = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/supplements', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSupplements(data.supplements || data);
      } else {
        throw new Error('Failed to fetch');
      }
    } catch (error) {
      console.error('Error fetching supplements:', error);
      toast({
        title: t("supplementCatalogUnavailableTitle"),
        description: t("supplementCatalogUnavailableDescription"),
        variant: "default",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`/api/supplement-recommendations/user/${user.id}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || data || []);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  React.useEffect(() => {
    fetchRecommendations();
    fetchSupplements();
  }, [user?.id]);

  const requestCoachUpdate = async () => {
    if (!user?.coachId) {
      toast({
        title: t("supplementNoCoachTitle"),
        description: t("supplementNoCoachDescription"),
        variant: "default",
      });
      return;
    }

    try {
      // Since users can't create recommendations directly, we'll create a note/message
      // Or we can use the notifications system
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.coachId, // Send to coach
          type: 'supplement_update_request',
          title: 'Supplement Plan Update Request',
          message: `${user.username || 'User'} has requested an update to their supplement plan`,
          priority: 'medium',
          category: 'supplements',
          relatedEntityType: 'user',
          relatedEntityId: user.id,
        }),
      });

      if (response.ok) {
        toast({
          title: t("supplementRequestCoachTitle"),
          description: t("supplementRequestCoachDescription"),
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send request');
      }
    } catch (error: any) {
      console.error('Error requesting update:', error);
      toast({
        title: t("supplementRequestSavedTitle"),
        description: t("supplementRequestSavedDescription"),
        variant: "default",
      });
    }
  };

  const handleBrowseCatalog = () => {
    fetchSupplements();
    setShowCatalog(true);
  };

  const timingOptions = [
    { value: "morning", label: t("supplementTimingMorning") },
    { value: "with_meals", label: t("supplementTimingWithMeals") },
    { value: "post_workout", label: t("supplementTimingPostWorkout") },
    { value: "before_sleep", label: t("supplementTimingBeforeSleep") },
    { value: "specific_time", label: t("supplementTimingSpecificTime") },
  ];

  const dosageUnitOptions = [
    { value: "mg", label: t("supplementUnitMg") },
    { value: "g", label: t("supplementUnitG") },
    { value: "IU", label: t("supplementUnitIu") },
    { value: "caps", label: t("supplementUnitCaps") },
    { value: "ml", label: t("supplementUnitMl") },
  ];

  const formatTiming = (rec: any) => {
    if (rec?.timing) {
      return rec.timing;
    }
    if (rec?.timingType === "specific_time" && rec?.timingDetails?.specificTime) {
      return `${t("supplementTimingSpecificTimePrefix")} ${rec.timingDetails.specificTime}`;
    }
    const match = timingOptions.find((option) => option.value === rec?.timingType);
    return match?.label || t("supplementTimingWithMeals");
  };

  const formatDosage = (rec: any) => {
    if (rec?.dosageAmount && rec?.dosageUnit) {
      return `${rec.dosageAmount} ${rec.dosageUnit}`;
    }
    if (rec?.dosage) {
      return rec.dosage;
    }
    if (rec?.dosageAmount) {
      return `${rec.dosageAmount}`;
    }
    return t("supplementDosageFallback");
  };

  const handleAddSupplement = async () => {
    const selectedSupplement = supplements.find(
      (supplement) => String(supplement.id) === selectedSupplementId
    );
    if (!selectedSupplement || !dosageAmount.trim() || !dosageUnit || !timingType) {
      toast({
        title: t("supplementAddMissingTitle"),
        description: t("supplementAddMissingDescription"),
        variant: "destructive",
      });
      return;
    }
    if (timingType === "specific_time" && !timingTime) {
      toast({
        title: t("supplementAddMissingTitle"),
        description: t("supplementAddMissingDescription"),
        variant: "destructive",
      });
      return;
    }

    try {
      // Create supplement recommendation via API
      const response = await fetch('/api/supplement-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id,
          supplementId: selectedSupplement.id,
          dosageAmount: parseFloat(dosageAmount.trim()),
          dosageUnit,
          dosageFrequency: 'daily',
          timingType,
          timingDetails: timingType === "specific_time" ? { specificTime: timingTime } : undefined,
          status: 'active',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add supplement');
      }

      // Clear form
      setSelectedSupplementId("");
      setDosageAmount("");
      setDosageUnit("");
      setTimingType("");
      setTimingTime("");

      // Refresh recommendations from server
      await fetchRecommendations();

      toast({
        title: t("supplementAddSuccessTitle"),
        description: t("supplementAddSuccessDescription"),
      });
    } catch (error: any) {
      console.error('Error adding supplement:', error);
      toast({
        title: t("supplementAddErrorTitle"),
        description: error.message || t("supplementAddErrorDescription"),
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <SectionHeader
          title={t("supplementsTitle")}
          subtitle={t("supplementsCatalogSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 space-y-3">
          <p className="font-semibold">{t("supplementPlanTitle")}</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{t("supplementSelectLabel")}</Label>
              <Select value={selectedSupplementId} onValueChange={setSelectedSupplementId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("supplementSelectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {supplements.length > 0 ? (
                    supplements.map((supplement) => (
                      <SelectItem key={supplement.id} value={String(supplement.id)}>
                        {supplement.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      {t("supplementSelectEmpty")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("supplementDosageLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  value={dosageAmount}
                  onChange={(event) => setDosageAmount(event.target.value)}
                  placeholder={t("supplementDosageAmountPlaceholder")}
                />
                <Select value={dosageUnit} onValueChange={setDosageUnit}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder={t("supplementDosageUnitPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {dosageUnitOptions.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t("supplementTimingLabel")}</Label>
              <Select value={timingType} onValueChange={setTimingType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("supplementTimingPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {timingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {timingType === "specific_time" && (
                <Input
                  type="time"
                  value={timingTime}
                  onChange={(event) => setTimingTime(event.target.value)}
                  className="mt-2"
                  aria-label={t("supplementTimingTimeLabel")}
                />
              )}
            </div>
          </div>
          <Button size="sm" onClick={handleAddSupplement}>
            {t("supplementAddButton")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendations.length > 0 ? (
            recommendations.slice(0, 6).map((rec: any) => (
              <div
                key={rec.id}
                className="rounded-lg border p-3 flex items-start justify-between"
              >
                <div>
                  <p className="font-semibold">{rec.supplement?.name || t("supplementFallbackName")}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDosage(rec)} · {formatTiming(rec)}
                  </p>
                  {rec.reason && (
                    <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                  )}
                </div>
                <Badge variant={rec.status === "active" ? "default" : "secondary"}>
                  {t(rec.status === "active" ? "activeStatus" : "pausedStatus")}
                </Badge>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t("supplementPlanEmptyTitle")}</p>
              <p>{t("supplementPlanEmptyDescription")}</p>
            </div>
          )}
        </div>
        <Separator />
        <div className="rounded-lg border p-3 bg-amber-50 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">{t("allergyInteractionGuard")}</p>
            <p className="text-sm text-amber-800">
              {t("noConflictsDetected")}
            </p>
          </div>
        </div>
        {!compact && (
          <div className="flex gap-2 flex-wrap">
            <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" onClick={handleBrowseCatalog}>
                  {t("browseCatalog")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("supplementCatalogTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("supplementCatalogDescription")}
                  </DialogDescription>
                </DialogHeader>
                {loading ? (
                  <div className="text-center py-8">{t("supplementCatalogLoading")}</div>
                ) : (
                  <div className="space-y-3">
                    {supplements.length > 0 ? (
                      supplements.map((supp: any) => (
                        <div key={supp.id} className="border rounded-lg p-3">
                          <h3 className="font-semibold">{supp.name}</h3>
                          <p className="text-sm text-muted-foreground">{supp.description}</p>
                          {supp.dosage && (
                            <p className="text-sm mt-1">
                              {t("supplementCatalogDosageLabel")}: {supp.dosage}
                            </p>
                          )}
                          {supp.category && (
                            <Badge variant="secondary" className="mt-2">
                              {t("supplementCatalogCategoryLabel")}: {supp.category}
                            </Badge>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 space-y-3">
                        <p className="text-muted-foreground">
                          {t("supplementCatalogEmptyTitle")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("supplementCatalogEmptyDescription")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={requestCoachUpdate}>
              {t("requestCoachUpdate")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const SupplementsFollowupPanel: React.FC<Props> = ({ compact }) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [sideEffects, setSideEffects] = useState("");
  const [morningReminder, setMorningReminder] = useState(true);
  const [eveningReminder, setEveningReminder] = useState(true);
  const [smsBackup, setSmsBackup] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchRecommendations = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`/api/supplement-recommendations/user/${user.id}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || data || []);
        }
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      }
    };
    fetchRecommendations();
  }, [user?.id]);

  const handleReminderToggle = async (timeOfDay: string, enabled: boolean) => {
    if (!recommendations[0]?.id) {
      toast({
        title: t("supplementNoActiveSupplementsTitle"),
        description: t("supplementNoActiveSupplementsDescription"),
        variant: "default",
      });
      return;
    }
    try {
      const response = await fetch('/api/supplement-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id,
          recommendationId: recommendations[0].id,
          enabled,
          reminderTimes: [timeOfDay === 'morning' ? '08:00' : '20:00'],
        }),
      });

      if (response.ok) {
        toast({
          title: t("supplementReminderUpdatedTitle"),
          description:
            timeOfDay === 'morning'
              ? t(enabled ? "supplementReminderMorningEnabled" : "supplementReminderMorningDisabled")
              : t(enabled ? "supplementReminderEveningEnabled" : "supplementReminderEveningDisabled"),
        });
      }
    } catch (error) {
      toast({
        title: t("supplementReminderSavedTitle"),
        description:
          timeOfDay === 'morning'
            ? t("supplementReminderMorningSaved")
            : t("supplementReminderEveningSaved"),
      });
    }
  };

  const handleMarkDoseTaken = () => {
    if (recommendations.length === 0) {
      toast({
        title: t("supplementNoActiveSupplementsTitle"),
        description: t("supplementNoActiveSupplementsDescription"),
        variant: "default",
      });
      return;
    }
    toast({
      title: t("supplementDoseTakenTitle"),
      description: t("supplementDoseTakenDescription"),
    });
  };

  const handleSnoozeReminder = () => {
    if (recommendations.length === 0) {
      toast({
        title: t("supplementNoActiveSupplementsTitle"),
        description: t("supplementNoActiveSupplementsDescription"),
        variant: "default",
      });
      return;
    }
    toast({
      title: t("supplementReminderSnoozedTitle"),
      description: t("supplementReminderSnoozedDescription"),
    });
  };

  const notifyCoach = async () => {
    if (!sideEffects.trim()) {
      toast({
        title: t("supplementSideEffectsMissingTitle"),
        description: t("supplementSideEffectsMissingDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!user?.coachId) {
      toast({
        title: t("supplementSideEffectsNoCoachTitle"),
        description: t("supplementSideEffectsNoCoachDescription"),
        variant: "default",
      });
      return;
    }

    // Get first active recommendation or create a general note
    const activeRec = recommendations.find((r: any) => r.status === 'active');
    
    if (!activeRec) {
      // If no active recommendations, send via notification system instead
      try {
        const response = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: user.coachId,
            type: 'supplement_side_effect',
            title: 'Side Effects Reported',
            message: `${user.username || 'User'} reported side effects: ${sideEffects}`,
            priority: 'high',
            category: 'supplements',
            relatedEntityType: 'user',
            relatedEntityId: user.id,
          }),
        });

        if (response.ok) {
          toast({
            title: t("supplementSideEffectsNotifiedTitle"),
            description: t("supplementSideEffectsNotifiedDescription"),
          });
          setSideEffects("");
        } else {
          throw new Error('Notification failed');
        }
      } catch (error) {
        toast({
          title: t("supplementSideEffectsSavedTitle"),
          description: t("supplementSideEffectsSavedDescription"),
        });
        setSideEffects("");
      }
      return;
    }

    try {
      const response = await fetch('/api/supplement-side-effects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          recommendationId: activeRec.id,
          supplementId: activeRec.supplementId,
          symptoms: sideEffects,
          severity: 'medium',
          occurredAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        toast({
          title: t("supplementSideEffectsNotifiedTitle"),
          description: t("supplementSideEffectsNotifiedDescription"),
        });
        setSideEffects("");
      } else {
        // Fallback to notification system
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: user.coachId,
            type: 'supplement_side_effect',
            title: 'Side Effects Reported',
            message: `${user.username || 'User'} reported side effects: ${sideEffects}`,
            priority: 'high',
            category: 'supplements',
          }),
        });
        toast({
          title: t("supplementSideEffectsNotifiedTitle"),
          description: t("supplementSideEffectsReportSentDescription"),
        });
        setSideEffects("");
      }
    } catch (error) {
      console.error('Error reporting side effects:', error);
      toast({
        title: t("supplementSideEffectsSavedTitle"),
        description: t("supplementSideEffectsSavedReviewDescription"),
      });
      setSideEffects("");
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <SectionHeader
          title={t("supplementFollowupTitle")}
          subtitle={t("supplementFollowupSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3">
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {t("supplementDoseActionsTitle")}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" onClick={handleMarkDoseTaken}>
              {t("supplementMarkDoseTaken")}
            </Button>
            <Button size="sm" variant="outline" onClick={handleSnoozeReminder}>
              {t("supplementSnoozeReminder")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="font-semibold flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              {t("reminderCadence")}
            </p>
            <div className="space-y-2 mt-2 text-sm">
              <div className="flex items-center justify-between">
                <span>{t("morningTime")}</span>
                <Switch
                  checked={morningReminder}
                  onCheckedChange={(checked) => {
                    setMorningReminder(checked);
                    handleReminderToggle('morning', checked);
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>{t("eveningTime")}</span>
                <Switch
                  checked={eveningReminder}
                  onCheckedChange={(checked) => {
                    setEveningReminder(checked);
                    handleReminderToggle('evening', checked);
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>{t("smsBackup")}</span>
                <Switch
                  checked={smsBackup}
                  onCheckedChange={(checked) => {
                    setSmsBackup(checked);
                    toast({
                      title: checked
                        ? t("supplementSmsEnabledTitle")
                        : t("supplementSmsDisabledTitle"),
                      description: checked
                        ? t("supplementSmsEnabledDescription")
                        : t("supplementSmsDisabledDescription"),
                    });
                  }}
                />
              </div>
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-semibold flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-rose-500" />
              {t("sideEffects")}
            </p>
            <Textarea
              placeholder={t("logSymptoms")}
              className="mt-2"
              rows={3}
              value={sideEffects}
              onChange={(e) => setSideEffects(e.target.value)}
            />
            <Button size="sm" className="mt-2" onClick={notifyCoach}>
              {t("supplementLogSideEffects")}
            </Button>
          </div>
        </div>
        {!compact && (
          <div className="rounded-lg border p-3 bg-slate-50">
            <p className="text-sm text-muted-foreground">
              {t("effectivenessRating")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const AlertsCenter: React.FC<Props> = ({ compact, hideEpicBadge }) => {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  return (
    <Card className={`h-full ${isRTL ? "text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      <CardHeader className={isRTL ? "text-right" : ""}>
        <SectionHeader
          title={t("smartAlertsTitle")}
          subtitle={t("channelMatrixSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: t("pushAlerts"), defaultChecked: true },
            { label: t("smsReminders"), defaultChecked: true },
            { label: t("emailDigests"), defaultChecked: false },
            { label: t("criticalHealthFlags"), defaultChecked: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded border p-3">
              <span className="text-sm font-medium">{row.label}</span>
              <Switch defaultChecked={row.defaultChecked} />
            </div>
          ))}
        </div>
        {!compact && (
          <div className="rounded-lg border p-3 bg-blue-50 flex items-start gap-2">
            <Bell className="h-4 w-4 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              {t("templatesReady")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const FilesReportsPanel: React.FC<Props> = ({ compact }) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const [deleteFileId, setDeleteFileId] = useState<number | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [fileInputResetKey, setFileInputResetKey] = useState(0);
  const [uploadForm, setUploadForm] = useState({
    fileType: 'progress_photo',
    visibility: 'private',
    description: '',
    descriptionAr: '',
    tags: '',
    targetUserId: '',
  });
  const [reportLanguageDialogOpen, setReportLanguageDialogOpen] = useState(false);
  const [reportLanguage, setReportLanguage] = useState<'en' | 'ar'>('en');
  const canAssignUser = user?.role === 'coach' || user?.role === 'admin' || user?.role === 'super_admin';
  
  const FILE_TYPE_OPTIONS = getFileTypeOptions(t);
  const VISIBILITY_OPTIONS = getVisibilityOptions(t);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files', {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('Failed to fetch files:', response.status);
        setFiles([]);
        return;
      }
      const data = await response.json();
      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch (error: any) {
      console.error('Error fetching files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports', {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('Failed to fetch reports:', response.status);
        setReports([]);
        return;
      }
      const data = await response.json();
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      setReports([]);
    }
  };

  const resetUploadState = () => {
    setSelectedUploadFile(null);
    setUploadForm({
      fileType: 'progress_photo',
      visibility: 'private',
      description: '',
      descriptionAr: '',
      tags: '',
      targetUserId: '',
    });
    setFileInputResetKey((prev) => prev + 1);
    setUploading(false);
  };

  const handleUploadDialogChange = (open: boolean) => {
    setUploadDialogOpen(open);
    if (!open) {
      resetUploadState();
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedUploadFile) {
      toast({
        title: t("error") || "Error",
        description: t("selectFileToUpload"),
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedUploadFile);
      formData.append('fileType', uploadForm.fileType);
      formData.append('visibility', uploadForm.visibility);
      if (uploadForm.description.trim()) {
        formData.append('description', uploadForm.description.trim());
      }
      if (uploadForm.descriptionAr.trim()) {
        formData.append('descriptionAr', uploadForm.descriptionAr.trim());
      }
      if (uploadForm.tags.trim()) {
        formData.append('tags', uploadForm.tags.trim());
      }
      if (canAssignUser && uploadForm.targetUserId.trim()) {
        formData.append('userId', uploadForm.targetUserId.trim());
      }

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to upload file');
      }

      toast({
        title: t("success") || "Success",
        description: t("fileUploadedSuccess") || "File uploaded successfully",
      });
      handleUploadDialogChange(false);
      await fetchFiles();
    } catch (error: any) {
      toast({
        title: t("error") || "Error",
        description: error.message || t("failedToUploadFile") || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFiles();
      fetchReports();
    }
  }, [user]);

  const handleGenerateReport = async (periodDays: number = 30, language: 'en' | 'ar' = 'en') => {
    try {
      setGeneratingReport(true);
      setReportLanguageDialogOpen(false);
      toast({
        title: t("generatingReport") || "Generating Report",
        description: t("generatingReportDesc") || "Please wait while we compile your comprehensive report...",
      });

      const response = await fetch('/api/reports/generate-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id,
          periodDays,
          language,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate report');
      }

      const newReport = await response.json();
      
      toast({
        title: t("success") || "Success",
        description: t("reportGeneratedSuccess") || "Report generated successfully!",
      });

      // Refresh reports list
      await fetchReports();
      
      // Show the new report
      setSelectedReport(newReport);
    } catch (error: any) {
      toast({
        title: t("error") || "Error",
        description: error.message || t("failedToGenerateReport") || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handlePreview = (file: any) => {
    setPreviewFile(file);
  };

  const handleDelete = async (fileId: number) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to delete file');
      
      toast({
        title: t("success") || "Success",
        description: t("fileDeletedSuccess") || "File deleted successfully",
      });
      
      // Refresh the file list
      await fetchFiles();
      setDeleteFileId(null);
    } catch (error: any) {
      toast({
        title: t("error") || "Error",
        description: error.message || t("failedToDeleteFile") || "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType: string, mimeType: string) => {
    if (mimeType?.startsWith('image/')) {
      return <Microscope className="h-4 w-4" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    }
    if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) {
      return <FileText className="h-4 w-4" />;
    }
    if (mimeType?.startsWith('video/')) {
      return <FileText className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const getFileStatus = (file: any) => {
    if (file.virusScanStatus === 'clean') {
      return t("virusScanPassed") || "Virus scan passed";
    }
    if (file.virusScanStatus === 'infected') {
      return "Infected";
    }
    if (file.virusScanStatus === 'pending') {
      return "Scanning...";
    }
    return t("ready") || "Ready";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImageFile = (mimeType: string) => {
    return mimeType?.startsWith('image/');
  };

  const isPdfFile = (mimeType: string) => {
    return mimeType === 'application/pdf';
  };

  const formatWeightChange = (value?: number | null) => {
    return typeof value === 'number' ? `${value.toFixed(2)} kg` : 'No data';
  };

  const formatAverageRating = (value?: number | null) => {
    return typeof value === 'number' ? `${value.toFixed(1)}/5` : 'N/A';
  };

  const downloadReport = (report: any) => {
    const reportContent = `
# Comprehensive Progress Report
**Generated:** ${new Date(report.createdAt).toLocaleString()}
**Period:** ${new Date(report.periodStart).toLocaleDateString()} - ${new Date(report.periodEnd).toLocaleDateString()}

---

${report.reportData?.aiAnalysis || 'Report data not available'}

---

## Raw Data Summary

### Progress Metrics
- Weight Change: ${formatWeightChange(report.reportData?.progress?.weightChange)}
- Measurements Taken: ${report.reportData?.progress?.totalMeasurements || 0}

### Activity Summary
- Workouts Completed: ${report.reportData?.workouts?.count || 0}
- Meals Logged: ${report.reportData?.nutrition?.mealsLogged || 0}
- Average Daily Calories: ${report.reportData?.stats?.totals?.averageCalories?.toFixed(0) || 0} kcal
- Average Daily Protein: ${report.reportData?.stats?.totals?.averageProtein?.toFixed(0) || 0}g

### Supplements
- Ratings Submitted: ${report.reportData?.supplements?.ratingsCount || 0}
- Average Effectiveness: ${formatAverageRating(report.reportData?.supplements?.averageRating)}
- Side Effects Reported: ${report.reportData?.sideEffects?.count || 0}
`;

    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress-report-${new Date(report.createdAt).toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <SectionHeader
            title={t("filesReportsTitle")}
            subtitle={t("secureVaultSubtitle")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("noFiles") || "No files uploaded yet"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.map((file) => (
                <div key={file.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {getFileIcon(file.fileType, file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        {file.uploaderName && (user?.role === 'coach' || user?.role === 'admin' || user?.role === 'super_admin') && (
                          <p className="text-xs text-muted-foreground font-semibold">
                            {t("uploadedBy") || "Uploaded by"}: {file.uploaderName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{getFileStatus(file)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)} • {new Date(file.uploadDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handlePreview(file)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => window.open(file.fileUrl, '_blank')}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => setDeleteFileId(file.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!compact && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("uploadFile")}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setReportLanguageDialogOpen(true)}
                  disabled={generatingReport}
                >
                  {generatingReport ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      {t("generating") || "Generating..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t("createReport") || "Generate AI Report"}
                    </>
                  )}
                </Button>
              </div>
              
              {reports.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold">{t("recentReports")}</h3>
                  <div className="space-y-2">
                    {Array.isArray(reports) && reports.slice(0, 5).map((report) => {
                      if (!report || !report.id) return null;
                      return (
                        <div key={report.id} className="rounded border p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {report.reportType === 'weekly' ? t("weeklyReport") || 'Weekly Report' : 
                                 report.reportType === 'monthly' ? t("monthlyReport") || 'Monthly Report' : 
                                 t("progressReport")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {report.periodStart ? new Date(report.periodStart).toLocaleDateString() : 'N/A'} - {report.periodEnd ? new Date(report.periodEnd).toLocaleDateString() : 'N/A'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("generated")}: {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => setSelectedReport(report)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {t("preview")}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => downloadReport(report)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              {t("download")}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={handleUploadDialogChange}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("uploadFileTitle")}</DialogTitle>
              <DialogDescription>
                {t("uploadFileDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="upload-file">{t("selectFile")}</Label>
                <Input
                  key={fileInputResetKey}
                  id="upload-file"
                  type="file"
                  onChange={(event) => setSelectedUploadFile(event.target.files?.[0] || null)}
                />
                {selectedUploadFile && (
                  <p className="text-xs text-muted-foreground">
                    {selectedUploadFile.name} • {formatFileSize(selectedUploadFile.size)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("fileType")}</Label>
                  <Select
                    value={uploadForm.fileType}
                    onValueChange={(value) => setUploadForm((prev) => ({ ...prev, fileType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {FILE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("visibility")}</Label>
                  <Select
                    value={uploadForm.visibility}
                    onValueChange={(value) => setUploadForm((prev) => ({ ...prev, visibility: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("chooseVisibility")} />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {canAssignUser && (
                <div className="space-y-2">
                  <Label htmlFor="upload-user">{t("targetUserId")}</Label>
                  <Input
                    id="upload-user"
                    type="number"
                    inputMode="numeric"
                    value={uploadForm.targetUserId}
                    onChange={(event) => setUploadForm((prev) => ({ ...prev, targetUserId: event.target.value }))}
                    placeholder={t("enterTraineeId")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("coachUploadNote")}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="upload-description">{t("description")}</Label>
                <Textarea
                  id="upload-description"
                  rows={3}
                  value={uploadForm.description}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder={t("descriptionPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="upload-description-ar">{t("descriptionAr")}</Label>
                <Textarea
                  id="upload-description-ar"
                  rows={2}
                  value={uploadForm.descriptionAr}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, descriptionAr: event.target.value }))}
                  placeholder={t("descriptionArPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="upload-tags">{t("tags")}</Label>
                <Input
                  id="upload-tags"
                  value={uploadForm.tags}
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder={t("tagsPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("tagsNote")}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleUploadDialogChange(false)} disabled={uploading}>
                  {t("cancel")}
                </Button>
                <Button onClick={handleUploadSubmit} disabled={uploading}>
                  {uploading ? t("uploading") : t("uploadFile")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Report Preview Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{t("progressReport")}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedReport && downloadReport(selectedReport)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("download")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedReport(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              {selectedReport && (
                <span>
                  Period: {new Date(selectedReport.periodStart).toLocaleDateString()} - {new Date(selectedReport.periodEnd).toLocaleDateString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {selectedReport?.reportData?.aiAnalysis ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm">
                  {selectedReport.reportData.aiAnalysis}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Progress Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-sm text-muted-foreground">Weight Change</p>
                      <p className="text-xl font-semibold">
                        {formatWeightChange(selectedReport?.reportData?.progress?.weightChange)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-sm text-muted-foreground">Workouts</p>
                      <p className="text-xl font-semibold">
                        {selectedReport?.reportData?.workouts?.count || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-sm text-muted-foreground">Meals Logged</p>
                      <p className="text-xl font-semibold">
                        {selectedReport?.reportData?.nutrition?.mealsLogged || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-sm text-muted-foreground">Avg Calories</p>
                      <p className="text-xl font-semibold">
                        {selectedReport?.reportData?.stats?.totals?.averageCalories?.toFixed(0) || 0} kcal
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewFile?.fileName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {previewFile?.description || previewFile?.descriptionAr || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {previewFile && isImageFile(previewFile.mimeType) && (
              <img 
                src={previewFile.fileUrl} 
                alt={previewFile.fileName}
                className="w-full h-auto rounded-lg"
              />
            )}
            {previewFile && isPdfFile(previewFile.mimeType) && (
              <iframe
                src={previewFile.fileUrl}
                className="w-full h-[600px] rounded-lg border"
                title={previewFile.fileName}
              />
            )}
            {previewFile && !isImageFile(previewFile.mimeType) && !isPdfFile(previewFile.mimeType) && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Preview not available for this file type.</p>
                <Button
                  className="mt-4"
                  onClick={() => window.open(previewFile.fileUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download to view
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Language Selection Dialog for Report Generation */}
      <Dialog open={reportLanguageDialogOpen} onOpenChange={setReportLanguageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("selectReportLanguage") || "Select Report Language"}</DialogTitle>
            <DialogDescription>
              {t("selectReportLanguageDesc") || "Choose the language for your AI-generated progress report"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup value={reportLanguage} onValueChange={(value: 'en' | 'ar') => setReportLanguage(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="en" id="lang-en" />
                <Label htmlFor="lang-en" className="cursor-pointer font-normal">
                  {t("english") || "English"}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ar" id="lang-ar" />
                <Label htmlFor="lang-ar" className="cursor-pointer font-normal">
                  {t("arabic") || "العربية (Arabic)"}
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReportLanguageDialogOpen(false)}>
              {t("cancel") || "Cancel"}
            </Button>
            <Button onClick={() => handleGenerateReport(30, reportLanguage)}>
              <Sparkles className="h-4 w-4 mr-2" />
              {t("generateReport") || "Generate Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteFileId} onOpenChange={() => setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteFileConfirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFileId && handleDelete(deleteFileId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const AiAssistantPanel: React.FC<Props> = ({ compact }) => {
  const fire = useActionToast();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  
  return (
    <Card className="h-full">
      <CardHeader>
        <SectionHeader
          title={t("aiAssistantTitle")}
          badge={t("epicELabel")}
          subtitle={t("coachInLoopSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border p-3">
            <p className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {language === 'ar' ? 'منشئ الخطة' : 'Plan builder'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'ar' ? 'إنشاء التغذية والتمارين بمساعدة الذكاء الاصطناعي.' : 'Generate nutrition + workouts with AI assistance.'}
            </p>
            <Button 
              size="sm" 
              className="mt-2" 
              disabled={generating}
              onClick={async () => {
                if (!user) {
                  toast({ title: 'Error', description: 'User not found', variant: 'destructive' });
                  return;
                }
                
                try {
                  setGenerating(true);
                  
                  // Create AbortController with 90 second timeout (longer than server timeout)
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 90000);
                  
                  const res = await fetch('/api/coach/ai/generate-both', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id }),
                    signal: controller.signal
                  }).finally(() => clearTimeout(timeoutId));
                  const out = await res.json().catch(() => null);
                  if (!res.ok) {
                    const msgParts: string[] = [];
                    const nErr = out?.errors?.nutrition; const wErr = out?.errors?.workout;
                    if (nErr) msgParts.push(`Nutrition: ${String(nErr)}`);
                    if (wErr) msgParts.push(`Workout: ${String(wErr)}`);
                    const msg = msgParts.length ? msgParts.join(' | ') : (out?.message || 'Failed to generate plans');
                    throw new Error(msg);
                  }
                  let n = out?.nutrition; let w = out?.workout;
                  // If one side missing but API returned 201, try a quick one-off recovery by calling single endpoint
                  if (!w) {
                    try {
                      const wr = await fetch('/api/coach/ai/generate-plan', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id, planType: 'workout' })
                      });
                      if (wr.ok) { w = await wr.json(); }
                    } catch {}
                  }
                  if (!n) {
                    try {
                      const nr = await fetch('/api/coach/ai/generate-plan', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id, planType: 'nutrition' })
                      });
                      if (nr.ok) { const body = await nr.json(); n = body?.plan || body; }
                    } catch {}
                  }

                  // Invalidate all user-plans queries to update views
                  await queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
                  await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', user.id] });
                  
                  // Also invalidate the specific queries used by /nutrition and /workouts pages
                  // This ensures the plans automatically appear there without manual refresh
                  await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
                  await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }, user.id] });

                  const parts: string[] = [];
                  if (n) parts.push(n?.title || 'Nutrition plan saved');
                  if (w) parts.push(w?.title || 'Workout plan saved');
                  const description = parts.length ? parts.join(' + ') : 'Plans created';
                  toast({ title: 'Plans created', description });

                  // Inform user if partial errors existed in original response
                  const nErr = out?.errors?.nutrition; const wErr = out?.errors?.workout;
                  if (nErr || wErr) {
                    toast({
                      title: 'Note',
                      description: `Partial AI error: ${[nErr && 'Nutrition', wErr && 'Workout'].filter(Boolean).join(' & ')} retried automatically.`,
                    });
                  }
                } catch (e: any) {
                  // Provide more specific error messages for different failure types
                  let errorMessage = e?.message || 'Please try again';
                  if (e?.name === 'AbortError') {
                    errorMessage = 'Request took too long. The AI is working on it - please check back in a moment.';
                  } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
                    errorMessage = 'AI generation is taking longer than expected. Please try again or check back shortly.';
                  }
                  toast({ title: 'AI generation failed', description: errorMessage, variant: 'destructive' });
                } finally {
                  setGenerating(false);
                }
              }}
            >
              <Sparkles className={generating ? "w-4 h-4 mr-1 animate-spin" : "w-4 h-4 mr-1"} />
              {generating ? (language === 'ar' ? 'جاري الإنشاء...' : 'Generating…') : (language === 'ar' ? 'إنشاء الخطة' : 'Generate plan')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const CommunityPanel: React.FC<Props> = ({ compact }) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createChallengeOpen, setCreateChallengeOpen] = useState(false);
  const [editChallengeOpen, setEditChallengeOpen] = useState(false);
  const [editingChallengeId, setEditingChallengeId] = useState<number | null>(null);
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeType, setChallengeType] = useState(CHALLENGE_TYPE_PRESETS[0].value);
  const [challengeMetricName, setChallengeMetricName] = useState(CHALLENGE_TYPE_PRESETS[0].metricSuggestion);
  const [challengeTargetValue, setChallengeTargetValue] = useState("");
  const [challengeStartDate, setChallengeStartDate] = useState(() => formatInputDateTime(new Date()));
  const [challengeEndDate, setChallengeEndDate] = useState(() => formatInputDateTime(addHours(new Date(), 4)));
  const [challengeIsPublic, setChallengeIsPublic] = useState(true);
  const [challengeMediaItems, setChallengeMediaItems] = useState<MediaItem[]>([]);
  const [metricTouched, setMetricTouched] = useState(false);
  const [editChallengeTitle, setEditChallengeTitle] = useState("");
  const [editChallengeDescription, setEditChallengeDescription] = useState("");
  const [editChallengeType, setEditChallengeType] = useState(CHALLENGE_TYPE_PRESETS[0].value);
  const [editChallengeMetricName, setEditChallengeMetricName] = useState(CHALLENGE_TYPE_PRESETS[0].metricSuggestion);
  const [editChallengeTargetValue, setEditChallengeTargetValue] = useState("");
  const [editChallengeStartDate, setEditChallengeStartDate] = useState(() => formatInputDateTime(new Date()));
  const [editChallengeEndDate, setEditChallengeEndDate] = useState(() => formatInputDateTime(addHours(new Date(), 4)));
  const [editChallengeIsPublic, setEditChallengeIsPublic] = useState(true);
  const [editChallengeMediaItems, setEditChallengeMediaItems] = useState<MediaItem[]>([]);
  const [editMetricTouched, setEditMetricTouched] = useState(false);
  const [joiningChallengeId, setJoiningChallengeId] = useState<number | null>(null);
  const [updatingChallengeId, setUpdatingChallengeId] = useState<number | null>(null);
  const [deleteChallengeId, setDeleteChallengeId] = useState<number | null>(null);
  const [progressInputs, setProgressInputs] = useState<Record<number, string>>({});
  const locale = language === "ar" ? "ar-EG" : "en-US";

  const challengeTypeOptions = useMemo(
    () =>
      CHALLENGE_TYPE_PRESETS.map((preset) => ({
        ...preset,
        label: t(preset.labelKey),
      })),
    [t]
  );

  const challengeTypeLabels = useMemo(() => {
    return challengeTypeOptions.reduce<Record<string, string>>((acc, option) => {
      acc[option.value] = option.label;
      return acc;
    }, {});
  }, [challengeTypeOptions]);

  const {
    data: challenges = [],
    isPending: challengesLoading,
    error: challengesError,
  } = useQuery<GroupChallenge[]>({
    queryKey: ["/api/group-challenges"],
  });

  const { data: leaderboard, isPending: leaderboardLoading } = useQuery<ChallengeLeaderboard>({
    queryKey: ["/api/group-challenges/leaderboard"],
  });

  const joinedChallenges = useMemo(
    () => challenges.filter((challenge) => Boolean(challenge.userParticipation)),
    [challenges]
  );

  useEffect(() => {
    if (joinedChallenges.length === 0) return;
    setProgressInputs((prev) => {
      const next = { ...prev };
      joinedChallenges.forEach((challenge) => {
        if (next[challenge.id] === undefined && challenge.userParticipation) {
          next[challenge.id] = String(challenge.userParticipation.currentValue ?? 0);
        }
      });
      return next;
    });
  }, [joinedChallenges]);

  const resetForm = () => {
    setChallengeTitle("");
    setChallengeDescription("");
    setChallengeType(CHALLENGE_TYPE_PRESETS[0].value);
    setChallengeMetricName(CHALLENGE_TYPE_PRESETS[0].metricSuggestion);
    setChallengeTargetValue("");
    setChallengeStartDate(formatInputDateTime(new Date()));
    setChallengeEndDate(formatInputDateTime(addHours(new Date(), 4)));
    setChallengeIsPublic(true);
    setChallengeMediaItems([]);
    setMetricTouched(false);
  };

  const resetEditForm = () => {
    setEditChallengeTitle("");
    setEditChallengeDescription("");
    setEditChallengeType(CHALLENGE_TYPE_PRESETS[0].value);
    setEditChallengeMetricName(CHALLENGE_TYPE_PRESETS[0].metricSuggestion);
    setEditChallengeTargetValue("");
    setEditChallengeStartDate(formatInputDateTime(new Date()));
    setEditChallengeEndDate(formatInputDateTime(addHours(new Date(), 4)));
    setEditChallengeIsPublic(true);
    setEditChallengeMediaItems([]);
    setEditMetricTouched(false);
    setEditingChallengeId(null);
  };

  const handleDialogChange = (open: boolean) => {
    setCreateChallengeOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleEditDialogChange = (open: boolean) => {
    setEditChallengeOpen(open);
    if (!open) {
      resetEditForm();
    }
  };

  const createChallengeMutation = useMutation({
    mutationFn: async (payload: CreateChallengePayload) => {
      const response = await apiRequest("POST", "/api/group-challenges", payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("createChallengeSuccess"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges/leaderboard"] });
      resetForm();
      setCreateChallengeOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("createChallengeError"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
  });

  const updateChallengeMutation = useMutation({
    mutationFn: async ({ challengeId, payload }: { challengeId: number; payload: CreateChallengePayload }) => {
      const response = await apiRequest("PUT", `/api/group-challenges/${challengeId}`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("updateChallengeSuccess"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges/leaderboard"] });
      resetEditForm();
      setEditChallengeOpen(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("updateChallengeError"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
  });

  const deleteChallengeMutation = useMutation({
    mutationFn: async (challengeId: number) => {
      const response = await apiRequest("DELETE", `/api/group-challenges/${challengeId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("deleteChallengeSuccess"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges/leaderboard"] });
    },
    onError: (error: unknown) => {
      toast({
        title: t("deleteChallengeError"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeleteChallengeId(null);
    },
  });

  const joinChallengeMutation = useMutation({
    mutationFn: async (challengeId: number) => {
      const response = await apiRequest("POST", `/api/group-challenges/${challengeId}/join`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("joinChallengeSuccess"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges/leaderboard"] });
    },
    onError: (error: unknown) => {
      toast({
        title: t("joinChallengeError"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setJoiningChallengeId(null);
    },
  });

  const leaveChallengeMutation = useMutation({
    mutationFn: async (challengeId: number) => {
      const response = await apiRequest("DELETE", `/api/group-challenges/${challengeId}/leave`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("leaveChallengeSuccess") || "Left challenge successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges/leaderboard"] });
    },
    onError: (error: unknown) => {
      toast({
        title: t("leaveChallengeError") || "Failed to leave challenge",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setJoiningChallengeId(null);
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (payload: { challengeId: number; currentValue: number }) => {
      const response = await apiRequest("PUT", `/api/group-challenges/${payload.challengeId}/progress`, {
        currentValue: payload.currentValue,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("progressUpdatedSuccess"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-challenges/leaderboard"] });
    },
    onError: (error: unknown) => {
      toast({
        title: t("progressUpdatedError"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    },
    onSettled: () => {
      setUpdatingChallengeId(null);
    },
  });

  const handleChallengeTypeChange = (value: string) => {
    setChallengeType(value);
    if (!metricTouched) {
      const preset = CHALLENGE_TYPE_PRESETS.find((option) => option.value === value);
      if (preset) {
        setChallengeMetricName(preset.metricSuggestion);
      }
    }
  };

  const handleEditChallengeTypeChange = (value: string) => {
    setEditChallengeType(value);
    if (!editMetricTouched) {
      const preset = CHALLENGE_TYPE_PRESETS.find((option) => option.value === value);
      if (preset) {
        setEditChallengeMetricName(preset.metricSuggestion);
      }
    }
  };

  const handleOpenEditChallenge = (challenge: GroupChallenge) => {
    setEditingChallengeId(challenge.id);
    setEditChallengeTitle(challenge.name);
    setEditChallengeDescription(challenge.description ?? "");
    setEditChallengeType(challenge.challengeType);
    setEditChallengeMetricName(challenge.metricName);
    setEditChallengeTargetValue(
      typeof challenge.targetValue === "number" ? String(challenge.targetValue) : ""
    );
    setEditChallengeStartDate(formatInputDateTime(new Date(challenge.startDate)));
    setEditChallengeEndDate(formatInputDateTime(new Date(challenge.endDate)));
    setEditChallengeIsPublic(Boolean(challenge.isPublic));
    setEditChallengeMediaItems(normalizeMediaItems(challenge.mediaUrls));
    setEditMetricTouched(true);
    setEditChallengeOpen(true);
  };

  const handleCreateChallenge = () => {
    if (
      !challengeTitle.trim() ||
      !challengeType ||
      !challengeMetricName.trim() ||
      !challengeStartDate ||
      !challengeEndDate
    ) {
      toast({
        title: t("error"),
        description: t("challengeFormIncomplete"),
        variant: "destructive",
      });
      return;
    }

    const start = new Date(challengeStartDate);
    const end = new Date(challengeEndDate);

    if (end <= start) {
      toast({
        title: t("error"),
        description: t("challengeDatesInvalid"),
        variant: "destructive",
      });
      return;
    }

    const parsedTarget = challengeTargetValue ? Number(challengeTargetValue) : undefined;
    if (challengeTargetValue && Number.isNaN(parsedTarget)) {
      toast({
        title: t("error"),
        description: t("challengeTargetInvalid"),
        variant: "destructive",
      });
      return;
    }

    const payload: CreateChallengePayload = {
      name: challengeTitle.trim(),
      description: challengeDescription.trim() || undefined,
      mediaUrls: sanitizeMediaItems(challengeMediaItems),
      challengeType,
      metricName: challengeMetricName.trim(),
      targetValue: parsedTarget,
      startDate: toUTCISOString(challengeStartDate),
      endDate: toUTCISOString(challengeEndDate),
      isPublic: challengeIsPublic,
    };

    createChallengeMutation.mutate(payload);
  };

  const handleUpdateChallenge = () => {
    if (!editingChallengeId) {
      return;
    }

    if (
      !editChallengeTitle.trim() ||
      !editChallengeType ||
      !editChallengeMetricName.trim() ||
      !editChallengeStartDate ||
      !editChallengeEndDate
    ) {
      toast({
        title: t("error"),
        description: t("challengeFormIncomplete"),
        variant: "destructive",
      });
      return;
    }

    const start = new Date(editChallengeStartDate);
    const end = new Date(editChallengeEndDate);

    if (end <= start) {
      toast({
        title: t("error"),
        description: t("challengeDatesInvalid"),
        variant: "destructive",
      });
      return;
    }

    const parsedTarget = editChallengeTargetValue ? Number(editChallengeTargetValue) : undefined;
    if (editChallengeTargetValue && Number.isNaN(parsedTarget)) {
      toast({
        title: t("error"),
        description: t("challengeTargetInvalid"),
        variant: "destructive",
      });
      return;
    }

    const payload: CreateChallengePayload = {
      name: editChallengeTitle.trim(),
      description: editChallengeDescription.trim() || undefined,
      mediaUrls: sanitizeMediaItems(editChallengeMediaItems),
      challengeType: editChallengeType,
      metricName: editChallengeMetricName.trim(),
      targetValue: parsedTarget,
      startDate: toUTCISOString(editChallengeStartDate),
      endDate: toUTCISOString(editChallengeEndDate),
      isPublic: editChallengeIsPublic,
    };

    updateChallengeMutation.mutate({ challengeId: editingChallengeId, payload });
  };

  const handleToggleChallenge = (challenge: GroupChallenge) => {
    if (joinChallengeMutation.isPending || leaveChallengeMutation.isPending) {
      return;
    }
    setJoiningChallengeId(challenge.id);
    
    if (challenge.userParticipation) {
      leaveChallengeMutation.mutate(challenge.id);
    } else {
      joinChallengeMutation.mutate(challenge.id);
    }
  };

  const invalidateChallenges = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/group-challenges"] });
  };

  const canCreateChallenge = user?.role === "admin" || user?.role === "coach" || user?.role === "super_admin" || user?.role === "tenant_admin";
  const canManageAllChallenges = user?.role === "admin" || user?.role === "super_admin" || user?.role === "tenant_admin";
  const canManageOwnChallenges = user?.role === "coach";
  const canManageChallenge = (challenge: GroupChallenge) =>
    Boolean(canManageAllChallenges || (canManageOwnChallenges && challenge.createdBy === user?.id));

  const getProgressTarget = (challenge: GroupChallenge) => {
    if (typeof challenge.targetValue === "number" && challenge.targetValue > 0) {
      return challenge.targetValue;
    }
    return 100;
  };

  const getProgressValue = (challenge: GroupChallenge) => {
    const currentValue = challenge.userParticipation?.currentValue ?? 0;
    const target = getProgressTarget(challenge);
    if (target <= 0) return 0;
    return Math.min((currentValue / target) * 100, 100);
  };

  const handleProgressChange = (challengeId: number, value: string) => {
    setProgressInputs((prev) => ({
      ...prev,
      [challengeId]: value,
    }));
  };

  const handleUpdateProgress = (challenge: GroupChallenge, mode: "update" | "complete") => {
    if (!challenge.userParticipation) return;
    const fallbackTarget = getProgressTarget(challenge);
    const nextValue = mode === "complete"
      ? fallbackTarget
      : Number(progressInputs[challenge.id]);

    if (Number.isNaN(nextValue)) {
      toast({
        title: t("error"),
        description: t("progressValueInvalid"),
        variant: "destructive",
      });
      return;
    }

    setUpdatingChallengeId(challenge.id);
    updateProgressMutation.mutate({ challengeId: challenge.id, currentValue: nextValue });
  };

  const getChallengeStatus = (
    challenge: GroupChallenge
  ): { label: string; variant: "default" | "secondary" | "outline" } => {
    const now = new Date();
    const start = new Date(challenge.startDate);
    const end = new Date(challenge.endDate);

    if (now < start) {
      return { label: t("challengeStatusUpcoming"), variant: "secondary" };
    }
    if (now > end) {
      return { label: t("challengeStatusCompleted"), variant: "outline" };
    }
    return { label: t("challengeStatusActive"), variant: "default" };
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <SectionHeader
          title={t("communityTitle")}
          subtitle={t("socialFeedSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded border p-3">
            <p className="font-semibold flex items-center gap-2">
              <Medal className="h-4 w-4 text-amber-500" />
              {t("challengeLeaderboard")}
            </p>
            {leaderboardLoading ? (
              <p className="text-sm text-muted-foreground mt-1">{t("loading")}</p>
            ) : leaderboard?.challenge ? (
              <>
                <p className="text-sm text-muted-foreground mt-1">
                  {leaderboard.userRank
                    ? `${t("youAreRankedPrefix")} #${leaderboard.userRank.rank} ${t("youAreRankedIn")} "${leaderboard.challenge.name}".`
                    : `${t("leaderboardJoinPrefix")} "${leaderboard.challenge.name}".`}
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("leaderboardTopParticipants")}
                  </p>
                  {leaderboard.leaders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("leaderboardNoParticipants")}</p>
                  ) : (
                    leaderboard.leaders.map((leader, index) => (
                      <div key={leader.userId} className="flex items-center justify-between text-sm">
                        <span>
                          #{leader.rank ?? index + 1} {leader.firstName} {leader.lastName}
                        </span>
                        <span className="text-muted-foreground">
                          {leader.currentValue ?? 0} {leaderboard.challenge?.metricName}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">{t("leaderboardNoData")}</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase text-muted-foreground">
              {t("myChallenges")}
            </p>
          </div>
          {challengesLoading && (
            <div className="rounded border bg-slate-50 p-3 text-sm text-muted-foreground">
              {t("loadingChallenges")}
            </div>
          )}
          {challengesError && (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {t("loadChallengesError")}
            </div>
          )}
          {!challengesLoading && !challengesError && joinedChallenges.length === 0 && (
            <div className="rounded border bg-slate-50 p-3 text-sm text-muted-foreground">
              {t("noJoinedChallenges")}
            </div>
          )}
          {!challengesLoading && joinedChallenges.length > 0 && (
            <div className="space-y-3">
              {joinedChallenges.map((challenge) => {
                const status = getChallengeStatus(challenge);
                const dateRange = formatChallengeDateRange(challenge.startDate, challenge.endDate, locale);
                const currentValue = challenge.userParticipation?.currentValue ?? 0;
                const targetValue = getProgressTarget(challenge);
                const progressValue = getProgressValue(challenge);
                const isUpdating = updatingChallengeId === challenge.id && updateProgressMutation.isPending;
                const challengeMedia = normalizeMediaItems(challenge.mediaUrls);

                return (
                  <div key={challenge.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{challenge.name}</p>
                        {challenge.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{challenge.description}</p>
                        )}
                        {challengeMedia.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 max-w-md pt-1">
                            {challengeMedia.slice(0, 4).map((media, mediaIndex) => (
                              <div key={`joined-media-${challenge.id}-${mediaIndex}`} className="rounded-md border bg-black/5 overflow-hidden">
                                {media.type === "video" ? (
                                  <video src={media.url} controls className="h-24 w-full object-cover" preload="metadata" />
                                ) : (
                                  <img src={media.url} alt={challenge.name} className="h-24 w-full object-cover" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">{dateRange}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary">
                          {challengeTypeLabels[challenge.challengeType] ?? challenge.challengeType}
                        </Badge>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t("progressValueLabel")}</span>
                        <span>
                          {typeof challenge.targetValue === "number"
                            ? `${currentValue} / ${targetValue} ${challenge.metricName}`
                            : `${currentValue} ${challenge.metricName}`}
                        </span>
                      </div>
                      <Progress value={progressValue} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        className="h-9 max-w-[160px]"
                        placeholder={t("progressValuePlaceholder")}
                        value={progressInputs[challenge.id] ?? ""}
                        onChange={(e) => handleProgressChange(challenge.id, e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateProgress(challenge, "update")}
                        disabled={isUpdating}
                      >
                        {t("updateProgress")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateProgress(challenge, "complete")}
                        disabled={isUpdating}
                      >
                        {t("completeChallenge")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleChallenge(challenge)}
                        disabled={leaveChallengeMutation.isPending}
                      >
                        {t("leaveChallenge")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase text-muted-foreground">
              {t("activeChallenges")}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={invalidateChallenges}
              disabled={challengesLoading}
            >
              {t("refreshList")}
            </Button>
          </div>
          {challengesLoading && (
            <div className="rounded border bg-slate-50 p-3 text-sm text-muted-foreground">
              {t("loadingChallenges")}
            </div>
          )}
          {challengesError && (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {t("loadChallengesError")}
            </div>
          )}
          {!challengesLoading && !challengesError && challenges.length === 0 && (
            <div className="rounded border bg-slate-50 p-3 text-sm text-muted-foreground">
              {t("noChallengesMessage")}
            </div>
          )}
          {!challengesLoading && challenges.length > 0 && (
            <div className="space-y-3">
              {challenges.map((challenge) => {
                const status = getChallengeStatus(challenge);
                const dateRange = formatChallengeDateRange(challenge.startDate, challenge.endDate, locale);
                const isProcessing = joiningChallengeId === challenge.id && (joinChallengeMutation.isPending || leaveChallengeMutation.isPending);
                const isJoined = !!challenge.userParticipation;
                const challengeMedia = normalizeMediaItems(challenge.mediaUrls);
                
                return (
                  <div key={challenge.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{challenge.name}</p>
                        {challenge.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{challenge.description}</p>
                        )}
                        {challengeMedia.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 max-w-md pt-1">
                            {challengeMedia.slice(0, 4).map((media, mediaIndex) => (
                              <div key={`active-media-${challenge.id}-${mediaIndex}`} className="rounded-md border bg-black/5 overflow-hidden">
                                {media.type === "video" ? (
                                  <video src={media.url} controls className="h-24 w-full object-cover" preload="metadata" />
                                ) : (
                                  <img src={media.url} alt={challenge.name} className="h-24 w-full object-cover" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">{dateRange}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary">
                          {challengeTypeLabels[challenge.challengeType] ?? challenge.challengeType}
                        </Badge>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground tracking-wide">{t("challengeMetricLabel")}</p>
                        <p className="font-medium">{challenge.metricName}</p>
                      </div>
                      {typeof challenge.targetValue === "number" && (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground tracking-wide">{t("challengeTargetLabel")}</p>
                          <p className="font-medium">{challenge.targetValue}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs uppercase text-muted-foreground tracking-wide">{t("challengeVisibilityLabel")}</p>
                        <p className="font-medium">
                          {challenge.isPublic ? t("publicChallengeLabel") : t("privateChallengeLabel")}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={isJoined ? "destructive" : "outline"}
                        onClick={() => handleToggleChallenge(challenge)}
                        disabled={isProcessing}
                      >
                        {isProcessing 
                          ? (isJoined ? t("leavingChallenge") || "Leaving..." : t("joiningChallenge")) 
                          : (isJoined ? t("leaveChallenge") || "Leave" : t("joinChallenge"))}
                      </Button>
                      {canManageChallenge(challenge) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditChallenge(challenge)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            {t("editChallenge")}
                          </Button>
                          <AlertDialog
                            open={deleteChallengeId === challenge.id}
                            onOpenChange={(open) => {
                              if (!open) {
                                setDeleteChallengeId(null);
                              }
                            }}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteChallengeId(challenge.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {t("deleteChallenge")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir={language === "ar" ? "rtl" : "ltr"}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("deleteChallengeTitle")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("deleteChallengeDescription")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteChallengeMutation.mutate(challenge.id)}
                                >
                                  {t("confirmDeleteChallenge")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!compact && (
          <>
            <div className="flex gap-2 flex-wrap">
              {canCreateChallenge && (
                <Dialog open={createChallengeOpen} onOpenChange={handleDialogChange}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      {t("createChallenge")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent 
                    dir={language === "ar" ? "rtl" : "ltr"}
                    className="max-h-[90vh] max-w-[95vw] sm:max-w-[600px] overflow-hidden flex flex-col"
                  >
                    <DialogHeader className="flex-shrink-0">
                      <DialogTitle>{t("createChallenge")}</DialogTitle>
                      <DialogDescription>
                        {t("createChallengeDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 overflow-y-auto flex-1 px-1">
                      <div className="space-y-2">
                        <Label htmlFor="challenge-title">{t("challengeTitleLabel")}</Label>
                        <Input
                          id="challenge-title"
                          placeholder={t("challengeTitlePlaceholder")}
                          value={challengeTitle}
                          onChange={(e) => setChallengeTitle(e.target.value)}
                          dir={language === "ar" ? "rtl" : "ltr"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="challenge-type">{t("challengeTypeLabel")}</Label>
                        <Select value={challengeType} onValueChange={handleChallengeTypeChange}>
                          <SelectTrigger dir={language === "ar" ? "rtl" : "ltr"}>
                            <SelectValue placeholder={t("selectType")} />
                          </SelectTrigger>
                          <SelectContent dir={language === "ar" ? "rtl" : "ltr"}>
                            {challengeTypeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="challenge-metric">{t("challengeMetricLabel")}</Label>
                        <Input
                          id="challenge-metric"
                          placeholder={t("challengeMetricPlaceholder")}
                          value={challengeMetricName}
                          onChange={(e) => {
                            setChallengeMetricName(e.target.value);
                            setMetricTouched(true);
                          }}
                          dir={language === "ar" ? "rtl" : "ltr"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="challenge-target">{t("challengeTargetLabel")}</Label>
                        <Input
                          id="challenge-target"
                          type="number"
                          min="0"
                          placeholder={t("challengeTargetPlaceholder")}
                          value={challengeTargetValue}
                          onChange={(e) => setChallengeTargetValue(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="challenge-start">{t("challengeStartDate")}</Label>
                          <Input
                            id="challenge-start"
                            type="datetime-local"
                            step={900}
                            value={challengeStartDate}
                            onChange={(e) => setChallengeStartDate(e.target.value)}
                            dir="ltr"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="challenge-end">{t("challengeEndDate")}</Label>
                          <Input
                            id="challenge-end"
                            type="datetime-local"
                            step={900}
                            value={challengeEndDate}
                            onChange={(e) => setChallengeEndDate(e.target.value)}
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="challenge-description">{t("description")}</Label>
                        <Textarea
                          id="challenge-description"
                          placeholder={t("descriptionPlaceholder")}
                          value={challengeDescription}
                          onChange={(e) => setChallengeDescription(e.target.value)}
                          rows={4}
                          dir={language === "ar" ? "rtl" : "ltr"}
                        />
                      </div>
                      <MediaCollectionField
                        label={t("mediaAssets") || "Media Assets"}
                        description={t("mediaAssetsChallengeHint") || "Add image or video files/URLs for this challenge."}
                        items={challengeMediaItems}
                        onChange={setChallengeMediaItems}
                        maxItems={4}
                        addLabel={t("addMediaItem") || "Add media item"}
                        removeLabel={t("remove") || "Remove"}
                        typeLabel={t("mediaType") || "Type"}
                        imageLabel={t("mediaTypeImage") || "Image"}
                        videoLabel={t("mediaTypeVideo") || "Video"}
                      />
                      <div className="flex items-center justify-between rounded border p-3">
                        <div>
                          <p className="text-sm font-medium">{t("challengeVisibilityLabel")}</p>
                          <p className="text-xs text-muted-foreground">{t("publicChallengeLabel")}</p>
                        </div>
                        <Switch checked={challengeIsPublic} onCheckedChange={setChallengeIsPublic} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 flex-shrink-0 pt-4 border-t">
                      <Button variant="outline" onClick={() => handleDialogChange(false)}>
                        {t("cancel")}
                      </Button>
                      <Button onClick={handleCreateChallenge} disabled={createChallengeMutation.isPending}>
                        {createChallengeMutation.isPending ? t("creatingChallenge") : t("createChallenge")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <Dialog open={editChallengeOpen} onOpenChange={handleEditDialogChange}>
              <DialogContent
                dir={language === "ar" ? "rtl" : "ltr"}
                className="max-h-[90vh] max-w-[95vw] sm:max-w-[600px] overflow-hidden flex flex-col"
              >
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>{t("editChallenge")}</DialogTitle>
                  <DialogDescription>{t("editChallengeDescription")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto flex-1 px-1">
                  <div className="space-y-2">
                    <Label htmlFor="edit-challenge-title">{t("challengeTitleLabel")}</Label>
                    <Input
                      id="edit-challenge-title"
                      placeholder={t("challengeTitlePlaceholder")}
                      value={editChallengeTitle}
                      onChange={(e) => setEditChallengeTitle(e.target.value)}
                      dir={language === "ar" ? "rtl" : "ltr"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-challenge-type">{t("challengeTypeLabel")}</Label>
                    <Select value={editChallengeType} onValueChange={handleEditChallengeTypeChange}>
                      <SelectTrigger dir={language === "ar" ? "rtl" : "ltr"}>
                        <SelectValue placeholder={t("selectType")} />
                      </SelectTrigger>
                      <SelectContent dir={language === "ar" ? "rtl" : "ltr"}>
                        {challengeTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-challenge-metric">{t("challengeMetricLabel")}</Label>
                    <Input
                      id="edit-challenge-metric"
                      placeholder={t("challengeMetricPlaceholder")}
                      value={editChallengeMetricName}
                      onChange={(e) => {
                        setEditChallengeMetricName(e.target.value);
                        setEditMetricTouched(true);
                      }}
                      dir={language === "ar" ? "rtl" : "ltr"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-challenge-target">{t("challengeTargetLabel")}</Label>
                    <Input
                      id="edit-challenge-target"
                      type="number"
                      min="0"
                      placeholder={t("challengeTargetPlaceholder")}
                      value={editChallengeTargetValue}
                      onChange={(e) => setEditChallengeTargetValue(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-challenge-start">{t("challengeStartDate")}</Label>
                      <Input
                        id="edit-challenge-start"
                        type="datetime-local"
                        step={900}
                        value={editChallengeStartDate}
                        onChange={(e) => setEditChallengeStartDate(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-challenge-end">{t("challengeEndDate")}</Label>
                      <Input
                        id="edit-challenge-end"
                        type="datetime-local"
                        step={900}
                        value={editChallengeEndDate}
                        onChange={(e) => setEditChallengeEndDate(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-challenge-description">{t("description")}</Label>
                    <Textarea
                      id="edit-challenge-description"
                      placeholder={t("descriptionPlaceholder")}
                      value={editChallengeDescription}
                      onChange={(e) => setEditChallengeDescription(e.target.value)}
                      rows={4}
                      dir={language === "ar" ? "rtl" : "ltr"}
                    />
                  </div>
                  <MediaCollectionField
                    label={t("mediaAssets") || "Media Assets"}
                    description={t("mediaAssetsChallengeHint") || "Add image or video files/URLs for this challenge."}
                    items={editChallengeMediaItems}
                    onChange={setEditChallengeMediaItems}
                    maxItems={4}
                    addLabel={t("addMediaItem") || "Add media item"}
                    removeLabel={t("remove") || "Remove"}
                    typeLabel={t("mediaType") || "Type"}
                    imageLabel={t("mediaTypeImage") || "Image"}
                    videoLabel={t("mediaTypeVideo") || "Video"}
                  />
                  <div className="flex items-center justify-between rounded border p-3">
                    <div>
                      <p className="text-sm font-medium">{t("challengeVisibilityLabel")}</p>
                      <p className="text-xs text-muted-foreground">{t("publicChallengeLabel")}</p>
                    </div>
                    <Switch checked={editChallengeIsPublic} onCheckedChange={setEditChallengeIsPublic} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 flex-shrink-0 pt-4 border-t">
                  <Button variant="outline" onClick={() => handleEditDialogChange(false)}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={handleUpdateChallenge} disabled={updateChallengeMutation.isPending}>
                    {updateChallengeMutation.isPending ? t("updating") : t("saveChanges")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const ContentHubPanel: React.FC<Props> = ({ compact }) => {
  const fire = useActionToast();
  const { t } = useLanguage();
  return (
    <Card className="h-full">
      <CardHeader>
        <SectionHeader
          title={t("contentHubTitle")}
          badge={t("epicGLabel")}
          subtitle={t("articlesVideosSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { title: t("mobilityForDeskWorkers"), type: t("article"), score: 4.8 },
            { title: t("proteinTiming101"), type: t("video"), score: 4.6 },
            { title: t("ramadanTrainingFaq"), type: t("faq"), score: 4.9 },
          ].map((item) => (
            <div key={item.title} className="rounded border p-3">
              <p className="font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.type}</p>
              <div className="flex items-center gap-1 text-amber-500 text-sm mt-1">
                <Stars className="h-4 w-4" />
                {item.score}
              </div>
              <Button
                size="sm"
                variant="link"
                className="px-0 mt-1"
                onClick={() => fire(`${t("open")} ${item.title}`)}
              >
                {t("open")}
              </Button>
            </div>
          ))}
        </div>
        {!compact && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => fire(t("addContent"))}>
              {t("addContent")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => fire(t("viewBookmarks"))}>
              {t("viewBookmarks")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const PaymentsPanel: React.FC<Props> = ({ compact }) => {
  const fire = useActionToast();
  const { t } = useLanguage();
  return (
    <Card className="h-full">
      <CardHeader>
        <SectionHeader
          title={t("paymentsTitle")}
          badge={t("epicHLabel")}
          subtitle={t("plansMethodsSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded border p-3 flex items-center justify-between">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              {t("premiumPlan")}
            </p>
            <p className="text-sm text-muted-foreground">{t("renewsDate")}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => fire(t("updateBilling"))}>
            {t("update")}
          </Button>
        </div>
        {!compact && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: t("mrr"), value: "$12.4k" },
              { label: t("churn"), value: "1.3%" },
              { label: t("refunds"), value: "0.2%" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded border p-3">
                <p className="text-xs text-muted-foreground uppercase">{kpi.label}</p>
                <p className="font-semibold text-lg">{kpi.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const TaxonomyPanel: React.FC<Props> = ({ compact }) => {
  const { t } = useLanguage();
  return (
    <Card className="h-full">
      <CardHeader>
        <SectionHeader
          title={t("taxonomyTitle")}
          subtitle={t("entityTaggingSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded border p-3">
          <p className="font-semibold flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" />
            {t("taxonomy")}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {[t("workouts"), t("nutrition"), t("supplements"), t("files"), t("community"), t("billing")].map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded border p-3">
          <p className="font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            {t("unifiedSearch")}
          </p>
          <Input placeholder={t("searchPlaceholder")} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {t("backupsNightly")}
          </p>
        </div>
        {!compact && (
          <div className="rounded border p-3 bg-slate-50">
            <p className="text-sm text-muted-foreground">
              {t("archivePolicy")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CreateAdDialog: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [open, setOpen] = React.useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campaignMediaItems, setCampaignMediaItems] = React.useState<MediaItem[]>([]);
  const [formData, setFormData] = React.useState({
    title: "",
    title_ar: "",
    description: "",
    description_ar: "",
    campaign_type: "general",
    status: "active",
    start_date: formatInputDateTime(new Date()),
    end_date: formatInputDateTime(addDays(new Date(), 2)),
    daily_budget: "",
    total_budget: ""
  });

  const createAdMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        const response = await apiRequest("POST", "/api/admin/ads", data);
        return response;
      } catch (error: any) {
        throw new Error(error?.message || t("adCampaignCreateError"));
      }
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("adCampaignCreatedSuccess")
      });
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      setOpen(false);
      setFormData({
        title: "",
        title_ar: "",
        description: "",
        description_ar: "",
        campaign_type: "general",
        status: "active",
        start_date: formatInputDateTime(new Date()),
        end_date: formatInputDateTime(addDays(new Date(), 2)),
        daily_budget: "",
        total_budget: ""
      });
      setCampaignMediaItems([]);
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Error creating ad:", error);
      toast({
        title: t("error"),
        description: error?.message || t("adCampaignCreateError"),
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trimmedTitle = formData.title.trim();
      const trimmedTitleAr = formData.title_ar.trim();

      if ((!trimmedTitle && !trimmedTitleAr) || !formData.campaign_type) {
        toast({
          title: t("error"),
          description: t("adTitleRequired"),
          variant: "destructive"
        });
        return;
      }

      if (!formData.start_date || !formData.end_date) {
        toast({
          title: t("error"),
          description: t("adDatesRequired"),
          variant: "destructive"
        });
        return;
      }

      const payload = {
        ...formData,
        title: trimmedTitle || trimmedTitleAr,
        title_ar: trimmedTitleAr || null,
        media_urls: sanitizeMediaItems(campaignMediaItems),
        daily_budget: formData.daily_budget ? parseFloat(formData.daily_budget) : null,
        total_budget: formData.total_budget ? parseFloat(formData.total_budget) : null,
        start_date: toDateTimeLocalUtcIso(formData.start_date),
        end_date: toDateTimeLocalUtcIso(formData.end_date)
      };

      createAdMutation.mutate(payload);
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: t("error"),
        description: t("adCampaignCreateError"),
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          {t("createAd")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createAdCampaign")}</DialogTitle>
          <DialogDescription>{t("createAdCampaignDesc")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("adTitleEn")}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t("adTitlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title_ar">{t("adTitleAr")}</Label>
              <Input
                id="title_ar"
                value={formData.title_ar}
                onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                placeholder={t("adTitleArPlaceholder")}
                dir="rtl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">{t("adDescriptionEn")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("adDescriptionPlaceholder")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description_ar">{t("adDescriptionAr")}</Label>
              <Textarea
                id="description_ar"
                value={formData.description_ar}
                onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                placeholder={t("adDescriptionArPlaceholder")}
                dir="rtl"
                rows={3}
              />
            </div>
          </div>

          <MediaCollectionField
            label={t("mediaAssets") || "Media Assets"}
            description={t("mediaAssetsCampaignHint") || "Upload or paste image/video URLs for this campaign."}
            items={campaignMediaItems}
            onChange={setCampaignMediaItems}
            maxItems={6}
            addLabel={t("addMediaItem") || "Add media item"}
            removeLabel={t("remove") || "Remove"}
            typeLabel={t("mediaType") || "Type"}
            imageLabel={t("mediaTypeImage") || "Image"}
            videoLabel={t("mediaTypeVideo") || "Video"}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campaign_type">{t("adCampaignType")} *</Label>
              <Select
                value={formData.campaign_type}
                onValueChange={(value) => setFormData({ ...formData, campaign_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer">{t("adTypeOffer")}</SelectItem>
                  <SelectItem value="educational">{t("adTypeEducational")}</SelectItem>
                  <SelectItem value="event">{t("adTypeEvent")}</SelectItem>
                  <SelectItem value="general">{t("adTypeGeneral")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{t("adStatus")}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("adStatusDraft")}</SelectItem>
                  <SelectItem value="active">{t("adStatusActive")}</SelectItem>
                  <SelectItem value="paused">{t("adStatusPaused")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">{t("adStartDate")} *</Label>
              <Input
                id="start_date"
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">{t("adEndDate")} *</Label>
              <Input
                id="end_date"
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_budget">{t("adDailyBudget")}</Label>
              <Input
                id="daily_budget"
                type="number"
                step="0.01"
                value={formData.daily_budget}
                onChange={(e) => setFormData({ ...formData, daily_budget: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_budget">{t("adTotalBudget")}</Label>
              <Input
                id="total_budget"
                type="number"
                step="0.01"
                value={formData.total_budget}
                onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={createAdMutation.isPending}>
              {createAdMutation.isPending ? t("creating") : t("createCampaign")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const AdsCoursesPanel: React.FC<Props> = ({ compact }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCampaign, setEditingCampaign] = React.useState<any>(null);
  const [deletingCampaign, setDeletingCampaign] = React.useState<any>(null);
  const [campaignSearch, setCampaignSearch] = React.useState("");
  const [campaignFilter, setCampaignFilter] = React.useState("all");

  // Fetch ad campaigns
  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ["ad-campaigns"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/admin/ads");
        const data = await response.json();
        // Handle both array and object responses
        if (Array.isArray(data)) {
          return data;
        }
        return data?.data || data || [];
      } catch (err: any) {
        console.error("Error fetching campaigns:", err);
        // Return empty array on error instead of throwing
        return [];
      }
    },
    retry: 1,
    staleTime: 60000 // 1 minute
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/ads/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("adCampaignDeleted"),
      });
      queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
      setDeletingCampaign(null);
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error?.message || t("adCampaignDeleteError"),
        variant: "destructive",
      });
    },
  });

  // Show error toast if fetch failed
  React.useEffect(() => {
    if (error) {
      toast({
        title: t("error"),
        description: t("failedLoadCampaigns"),
        variant: "destructive"
      });
    }
  }, [error, toast, t]);

  const now = new Date();
  const activeCampaigns = Array.isArray(campaigns) 
    ? campaigns.filter((c: any) => {
        const isActive = c.status === 'active';
        const hasStarted = !c.start_date || new Date(c.start_date) <= now;
        const notEnded = !c.end_date || new Date(c.end_date) >= now;
        return isActive && hasStarted && notEnded;
      })
    : [];

  const totalCampaigns = Array.isArray(campaigns) ? campaigns.length : 0;

  const handleEdit = (campaign: any) => {
    setEditingCampaign(campaign);
  };

  const handleDelete = (campaign: any) => {
    setDeletingCampaign(campaign);
  };

  const getCampaignTypeColor = (type: string) => {
    switch (type) {
      case 'offer': return 'bg-green-100 text-green-800 border-green-300';
      case 'educational': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'event': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("noDate");
    return new Date(dateString).toLocaleDateString();
  };

  const getCampaignStatusKey = (campaign: any) => {
    const hasEnded = campaign.end_date && new Date(campaign.end_date) < now;
    if (hasEnded) return "Past";
    if (campaign.status === "active") return "Active";
    if (campaign.status === "paused") return "Paused";
    if (campaign.status === "draft") return "Draft";
    if (campaign.status === "completed" || campaign.status === "archived") return "Past";
    return "Draft";
  };

  const filteredCampaigns = Array.isArray(campaigns)
    ? campaigns.filter((campaign: any) => {
        const searchValue = campaignSearch.trim().toLowerCase();
        const matchesSearch = !searchValue
          || `${campaign.title || ""} ${campaign.title_ar || ""} ${campaign.description || ""} ${campaign.description_ar || ""}`
            .toLowerCase()
            .includes(searchValue);

        if (!matchesSearch) return false;
        if (campaignFilter === "all") return true;

        const statusKey = getCampaignStatusKey(campaign).toLowerCase();
        return statusKey === campaignFilter;
      })
    : [];

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <SectionHeader
            title={t("adsCoursesTitle")}
            subtitle={t("campaignsCoursesSubtitle")}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border p-3">
              <p className="font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                {t("campaigns")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isLoading ? t("loading") : `${activeCampaigns.length} ${t("active")} / ${totalCampaigns} ${t("total")}`}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {t("courses")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t("lessonsEnabled")}</p>
            </div>
          </div>
          
          {!compact && (
            <div className="flex gap-2 flex-wrap">
              <CreateAdDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] })} />
              <Button size="sm" variant="outline" onClick={() => window.location.href = "/manage-courses"}>
                {t("manageCourses")}
              </Button>
            </div>
          )}

          {!compact && totalCampaigns > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <Label htmlFor="campaign-search">{t("search")}</Label>
                <Input
                  id="campaign-search"
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  placeholder={t("searchCampaigns")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="campaign-filter">{t("status")}</Label>
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger id="campaign-filter">
                    <SelectValue placeholder={t("all")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all")}</SelectItem>
                    <SelectItem value="active">{t("adStatusActive")}</SelectItem>
                    <SelectItem value="draft">{t("adStatusDraft")}</SelectItem>
                    <SelectItem value="paused">{t("adStatusPaused")}</SelectItem>
                    <SelectItem value="past">{t("adStatusPast")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* All Campaigns Section */}
          {!compact && totalCampaigns > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mt-4">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">{t("allCampaigns")}</h3>
              </div>
              <div className="space-y-2">
                {filteredCampaigns.map((campaign: any) => (
                  <div 
                    key={campaign.id} 
                    className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex-1 space-y-1">
                      {normalizeMediaItems(campaign.media_urls).length > 0 && (
                        <div className="grid grid-cols-2 gap-2 max-w-sm mb-2">
                          {normalizeMediaItems(campaign.media_urls).slice(0, 2).map((media, mediaIndex) => (
                            <div key={`campaign-media-${campaign.id}-${mediaIndex}`} className="rounded-md border bg-black/5 overflow-hidden">
                              {media.type === "video" ? (
                                <video src={media.url} controls className="h-20 w-full object-cover" preload="metadata" />
                              ) : (
                                <img src={media.url} alt={campaign.title || campaign.title_ar || "campaign media"} className="h-20 w-full object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{campaign.title || campaign.title_ar}</span>
                        <Badge className={getCampaignTypeColor(campaign.campaign_type)}>
                          {t(`adType${campaign.campaign_type.charAt(0).toUpperCase() + campaign.campaign_type.slice(1)}`)}
                        </Badge>
                        <Badge variant={getCampaignStatusKey(campaign) === "Active" ? "default" : getCampaignStatusKey(campaign) === "Paused" ? "secondary" : "outline"}>
                          {t(`adStatus${getCampaignStatusKey(campaign)}`)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {campaign.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(campaign.start_date)}
                          </span>
                        )}
                        {campaign.end_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t("endsOn")} {formatDate(campaign.end_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(campaign)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(campaign)} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!compact && totalCampaigns === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t("noCampaignsYet")}</p>
            </div>
          )}
          {!compact && totalCampaigns > 0 && filteredCampaigns.length === 0 && !isLoading && (
            <div className="text-center py-6 text-muted-foreground">
              <p>{t("noCampaignsMatch")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Campaign Dialog */}
      {editingCampaign && (
        <EditAdDialog
          campaign={editingCampaign}
          open={!!editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["ad-campaigns"] });
            setEditingCampaign(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCampaign} onOpenChange={(open) => !open && setDeletingCampaign(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteCampaign")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteCampaignConfirm")} "{deletingCampaign?.title || deletingCampaign?.title_ar}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCampaign && deleteMutation.mutate(deletingCampaign.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Edit Ad Dialog Component
const EditAdDialog: React.FC<{ 
  campaign: any; 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void; 
}> = ({ campaign, open, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [campaignMediaItems, setCampaignMediaItems] = React.useState<MediaItem[]>(normalizeMediaItems(campaign.media_urls));
  const [formData, setFormData] = React.useState({
    title: campaign.title || "",
    title_ar: campaign.title_ar || "",
    description: campaign.description || "",
    description_ar: campaign.description_ar || "",
    campaign_type: campaign.campaign_type || "general",
    status: campaign.status || "draft",
    start_date: toDateTimeLocalValue(campaign.start_date),
    end_date: toDateTimeLocalValue(campaign.end_date),
    daily_budget: campaign.daily_budget?.toString() || "",
    total_budget: campaign.total_budget?.toString() || ""
  });

  React.useEffect(() => {
    setCampaignMediaItems(normalizeMediaItems(campaign.media_urls));
    setFormData({
      title: campaign.title || "",
      title_ar: campaign.title_ar || "",
      description: campaign.description || "",
      description_ar: campaign.description_ar || "",
      campaign_type: campaign.campaign_type || "general",
      status: campaign.status || "draft",
      start_date: toDateTimeLocalValue(campaign.start_date),
      end_date: toDateTimeLocalValue(campaign.end_date),
      daily_budget: campaign.daily_budget?.toString() || "",
      total_budget: campaign.total_budget?.toString() || "",
    });
  }, [campaign]);

  const updateAdMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/admin/ads/${campaign.id}`, data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: t("success"),
        description: t("adCampaignUpdated")
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error?.message || t("adCampaignUpdateError"),
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = formData.title.trim();
    const trimmedTitleAr = formData.title_ar.trim();

    if (!trimmedTitle && !trimmedTitleAr) {
      toast({
        title: t("error"),
        description: t("adTitleRequired"),
        variant: "destructive"
      });
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      toast({
        title: t("error"),
        description: t("adDatesRequired"),
        variant: "destructive"
      });
      return;
    }

    const payload: any = {
      ...formData,
      title: trimmedTitle || trimmedTitleAr,
      title_ar: trimmedTitleAr || null,
      media_urls: sanitizeMediaItems(campaignMediaItems),
      daily_budget: formData.daily_budget ? parseFloat(formData.daily_budget) : null,
      total_budget: formData.total_budget ? parseFloat(formData.total_budget) : null,
      start_date: toDateTimeLocalUtcIso(formData.start_date),
      end_date: toDateTimeLocalUtcIso(formData.end_date)
    };

    updateAdMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("editAdCampaign")}</DialogTitle>
          <DialogDescription>{t("updateAdCampaignDetails")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">{t("adTitleEn")}</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t("adTitlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title_ar">{t("adTitleAr")}</Label>
              <Input
                id="edit-title_ar"
                value={formData.title_ar}
                onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                placeholder={t("adTitleArPlaceholder")}
                dir="rtl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("adDescriptionEn")}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("adDescriptionPlaceholder")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description_ar">{t("adDescriptionAr")}</Label>
              <Textarea
                id="edit-description_ar"
                value={formData.description_ar}
                onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                placeholder={t("adDescriptionArPlaceholder")}
                dir="rtl"
                rows={3}
              />
            </div>
          </div>

          <MediaCollectionField
            label={t("mediaAssets") || "Media Assets"}
            description={t("mediaAssetsCampaignHint") || "Upload or paste image/video URLs for this campaign."}
            items={campaignMediaItems}
            onChange={setCampaignMediaItems}
            maxItems={6}
            addLabel={t("addMediaItem") || "Add media item"}
            removeLabel={t("remove") || "Remove"}
            typeLabel={t("mediaType") || "Type"}
            imageLabel={t("mediaTypeImage") || "Image"}
            videoLabel={t("mediaTypeVideo") || "Video"}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-campaign_type">{t("adCampaignType")} *</Label>
              <Select
                value={formData.campaign_type}
                onValueChange={(value) => setFormData({ ...formData, campaign_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="offer">{t("adTypeOffer")}</SelectItem>
                  <SelectItem value="educational">{t("adTypeEducational")}</SelectItem>
                  <SelectItem value="event">{t("adTypeEvent")}</SelectItem>
                  <SelectItem value="general">{t("adTypeGeneral")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">{t("adStatus")}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("adStatusDraft")}</SelectItem>
                  <SelectItem value="active">{t("adStatusActive")}</SelectItem>
                  <SelectItem value="paused">{t("adStatusPaused")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start_date">{t("adStartDate")} *</Label>
              <Input
                id="edit-start_date"
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end_date">{t("adEndDate")} *</Label>
              <Input
                id="edit-end_date"
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-daily_budget">{t("adDailyBudget")}</Label>
              <Input
                id="edit-daily_budget"
                type="number"
                step="0.01"
                value={formData.daily_budget}
                onChange={(e) => setFormData({ ...formData, daily_budget: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-total_budget">{t("adTotalBudget")}</Label>
              <Input
                id="edit-total_budget"
                type="number"
                step="0.01"
                value={formData.total_budget}
                onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={updateAdMutation.isPending}>
              {updateAdMutation.isPending ? t("updating") : t("updateCampaign")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};


export const TenantOpsPanel: React.FC<Props> = ({ compact }) => {
  const fire = useActionToast();
  const { t } = useLanguage();
  const [showLimitsDialog, setShowLimitsDialog] = React.useState(false);
  const [limits, setLimits] = React.useState({
    maxUsers: 100,
    maxStorageGb: 50,
    maxApiCallsPerDay: 10000
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Mock tenant ID - in a real scenario this would come from context or props
  const TENANT_ID = 1;

  const handleLoadLimits = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tenants/${TENANT_ID}`);
      if (response.ok) {
        const tenant = await response.json();
        setLimits({
          maxUsers: tenant.max_users || 100,
          maxStorageGb: tenant.max_storage_gb || 50,
          maxApiCallsPerDay: tenant.max_api_calls_per_day || 10000
        });
      }
    } catch (error) {
      console.error('Error loading tenant limits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLimits = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/tenants/${TENANT_ID}/limits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxUsers: limits.maxUsers,
          maxStorageGb: limits.maxStorageGb,
          maxApiCallsPerDay: limits.maxApiCallsPerDay
        })
      });
      if (response.ok) {
        fire(t("limitsUpdated"));
        setShowLimitsDialog(false);
      } else {
        const error = await response.json();
        alert(error.message || t("errorUpdatingLimits"));
      }
    } catch (error) {
      console.error('Error saving tenant limits:', error);
      alert(t("errorUpdatingLimits"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDialog = async () => {
    setShowLimitsDialog(true);
    await handleLoadLimits();
  };

  return (
    <>
      <Card className="h-full">
        <CardHeader>
          <SectionHeader
            title={t("tenantOpsTitle")}
            badge={t("epicKLabel")}
            subtitle={t("tenantLimitsSubtitle")}
          />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border p-3 flex items-center justify-between">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                {t("tenantIsolation")}
              </p>
              <p className="text-sm text-muted-foreground">{t("perTenantLimits")}</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleOpenDialog}>
              {t("editLimits")}
            </Button>
          </div>
          {!compact && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded border p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-amber-600" />
                  {t("domains")}
                </p>
                <p className="text-sm text-muted-foreground">{t("customDomain")}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => fire(t("addDomain"))}>
                    Add domain
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fire(t("verifyDns"))}>
                    Verify DNS
                  </Button>
                </div>
              </div>
              <div className="rounded border p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <LaptopMinimal className="h-4 w-4 text-primary" />
                  {t("branding")}
                </p>
                <p className="text-sm text-muted-foreground">{t("logoAndPalette")}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => fire(t("uploadLogo"))}>
                    Upload logo
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fire(t("editTheme"))}>
                    Edit theme
                  </Button>
                </div>
              </div>
              <div className="rounded border p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  {t("billingIsolation")}
                </p>
                <p className="text-sm text-muted-foreground">{t("stripeKeyAndLimits")}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => fire(t("rotateApiKeys"))}>
                    Rotate API keys
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fire(t("runInvoiceSync"))}>
                    Run invoice sync
                  </Button>
                </div>
              </div>
              <div className="rounded border p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  {t("complianceAndAudit")}
                </p>
                <p className="text-sm text-muted-foreground">{t("auditTrailsDesc")}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => fire(t("exportAuditLog"))}>
                    Export audit log
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fire(t("runAccessReview"))}>
                    Run access review
                  </Button>
                </div>
              </div>
              <div className="rounded border p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-primary" />
                  {t("throttlingAndQuotas")}
                </p>
                <p className="text-sm text-muted-foreground">{t("apiRateLimits")}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => fire(t("adjustRateLimits"))}>
                    Adjust rate limits
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fire(t("pauseTenantTraffic"))}>
                    Pause tenant traffic
                  </Button>
                </div>
              </div>
              <div className="rounded border p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <MonitorCog className="h-4 w-4 text-primary" />
                  {t("backupsAndRestores")}
                </p>
                <p className="text-sm text-muted-foreground">{t("nightlyBackupsDesc")}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => fire(t("startBackup"))}>
                    Start backup
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fire(t("testRestore"))}>
                    Test restore
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Limits Dialog */}
      {showLimitsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>{t("editLimits")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("maxUsers")}</label>
                <input
                  type="number"
                  value={limits.maxUsers}
                  onChange={(e) => setLimits({ ...limits, maxUsers: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("maxStorageGb")}</label>
                <input
                  type="number"
                  value={limits.maxStorageGb}
                  onChange={(e) => setLimits({ ...limits, maxStorageGb: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("maxApiCallsPerDay")}</label>
                <input
                  type="number"
                  value={limits.maxApiCallsPerDay}
                  onChange={(e) => setLimits({ ...limits, maxApiCallsPerDay: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded px-3 py-2"
                  min="1"
                />
              </div>
            </CardContent>
            <div className="flex gap-2 p-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowLimitsDialog(false)}
                disabled={isSaving}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSaveLimits}
                disabled={isSaving || isLoading}
              >
                {isSaving ? t("saving") : t("save")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export const SecurityOpsPanel: React.FC<Props> = ({ compact, hideEpicBadge }) => {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  return (
    <Card className={`h-full ${isRTL ? "text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
      <CardHeader className={isRTL ? "text-right" : ""}>
        <SectionHeader
          title={t("securityOpsTitle")}
          subtitle={t("auditIncidentsSubtitle")}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: t("uptime30d"), value: t("uptimeValue"), icon: <LineChart className="h-4 w-4 text-emerald-600" /> },
            { label: t("incidents"), value: t("openIncidents"), icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> },
            { label: t("auditTrails"), value: t("auditOn"), icon: <Lock className="h-4 w-4 text-primary" /> },
          ].map((item) => (
          <div key={item.label} className="rounded border p-3 flex items-center gap-2">
            {item.icon}
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="rounded border p-3">
          <p className="font-semibold flex items-center gap-2">
            <MonitorCog className="h-4 w-4 text-primary" />
            {t("maintenanceWindow")}
          </p>
          <p className="text-sm text-muted-foreground">{t("maintenanceSchedule")}</p>
        </div>
      )}
    </CardContent>
  </Card>
  );
};
