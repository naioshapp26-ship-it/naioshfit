import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Edit3,
  CheckCircle,
  XCircle,
  RefreshCw,
  Coins,
  BadgeDollarSign,
  Activity,
  Trash2,
  CreditCard,
  UserSearch,
} from "lucide-react";

export type CreditBundleRecord = {
  id: string;
  tenant_id: string | null;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreditActionRecord = {
  id: string;
  tenant_id: string | null;
  action_key: string;
  description: string | null;
  cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type BundleForm = {
  id?: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
};

type ActionForm = {
  id?: string;
  actionKey: string;
  description?: string | null;
  cost: number;
  isActive: boolean;
};

type AdjustForm = {
  userId: string;
  creditsDelta: string;
  reason: string;
};

type BonusReason = "signup_bonus" | "manual_bonus";

type BonusForm = {
  bonusType: BonusReason;
  credits: string;
};

type CreditBonusSettingsResponse = {
  signupBonusCredits: number;
};

type UserOption = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  whatsappWithCode?: string | null;
};

const DEFAULT_ACTION_KEY = "nutrition_view_plan";

const defaultBundleForm: BundleForm = {
  name: "Starter 50",
  credits: 50,
  priceCents: 9900,
  currency: "usd",
  isActive: true,
  sortOrder: 1,
};

const defaultActionForm: ActionForm = {
  actionKey: DEFAULT_ACTION_KEY,
  description: "View nutrition plan",
  cost: 0,
  isActive: true,
};

const defaultAdjustForm: AdjustForm = {
  userId: "",
  creditsDelta: "",
  reason: "",
};

const defaultBonusForm: BonusForm = {
  bonusType: "signup_bonus",
  credits: "",
};

const RELATED_TRANSACTIONS_ERROR = "Cannot delete bundle that has related transactions";

const parseApiErrorMessage = (error: Error | null | undefined) => {
  if (!error?.message) return "";
  const rawMessage = error.message;
  const jsonStart = rawMessage.indexOf("{");
  if (jsonStart === -1) return rawMessage;

  const jsonText = rawMessage.slice(jsonStart);
  try {
    const parsed = JSON.parse(jsonText) as { message?: string };
    if (parsed?.message) return String(parsed.message);
  } catch {
    return rawMessage;
  }

  return rawMessage;
};

export function CreditBillingAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [bundleForm, setBundleForm] = useState<BundleForm>(defaultBundleForm);
  const [actionForm, setActionForm] = useState<ActionForm>(defaultActionForm);
  const [adjustForm, setAdjustForm] = useState<AdjustForm>(defaultAdjustForm);
  const [bonusForm, setBonusForm] = useState<BonusForm>(defaultBonusForm);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [bundleToDelete, setBundleToDelete] = useState<CreditBundleRecord | null>(null);
  const [actionToDelete, setActionToDelete] = useState<CreditActionRecord | null>(null);

  const text = useMemo(() => {
    const translations = {
      en: {
        creditBilling: "Credit Billing",
        creditBillingDesc: "Configure bundles, prices, and per-action credit costs.",
        activeBundles: "active bundles",
        activeActions: "active actions",
        bundles: "Bundles",
        actions: "Actions",
        adjust: "Adjust",
        bundlesTitle: "Credit Bundles",
        bundlesDesc: "Manage purchasable bundles trainees can buy.",
        refresh: "Refresh",
        newBundle: "New bundle",
        name: "Name",
        credits: "Credits",
        price: "Price",
        currency: "Currency",
        sort: "Sort",
        status: "Status",
        actionsLabel: "Actions",
        noBundles: "No bundles configured yet.",
        active: "Active",
        inactive: "Inactive",
        edit: "Edit",
        disable: "Disable",
        enable: "Enable",
        delete: "Delete",
        confirmDeleteTitle: "Delete bundle?",
        confirmDeleteDesc: "This will remove the bundle. Existing purchases stay intact.",
        confirmActionDeleteTitle: "Delete action?",
        confirmActionDeleteDesc: "This removes the action cost. Existing transactions stay intact.",
        cancel: "Cancel",
        saveBundle: "Save bundle",
        bundleNameLabel: "Bundle name",
        bundleCreditsLabel: "Credits",
        bundlePriceLabel: "Price (cents)",
        bundleCurrencyLabel: "Currency",
        bundleActiveLabel: "Active",
        bundleSortLabel: "Sort order",
        actionsTitle: "Action Costs",
        actionsDesc: "Define how many credits each action consumes.",
        newAction: "New action",
        key: "Key",
        description: "Description",
        cost: "Cost",
        noActions: "No actions configured yet.",
        saveAction: "Save action",
        actionKeyLabel: "Action key",
        selectActionPlaceholder: "Select an action",
        actionCostLabel: "Credit cost",
        actionDescriptionLabel: "Description",
        actionDescriptionPlaceholder: "Shown to admins",
        adjustTitle: "Adjust User Credits",
        adjustDesc: "Manually add or deduct credits for a user.",
        adjustUserLookupLabel: "User",
        adjustUserLookupPlaceholder: "Search by name, phone, or ID",
        adjustUserLookupEmpty: "No users found",
        adjustUserIdLabel: "User ID",
        adjustUserBalanceLabel: "Current balance",
        adjustUserBalanceEmpty: "Select a user to view balance",
        adjustCreditsDeltaLabel: "Credits change",
        adjustCreditsDeltaHint: "Use a positive number to add, negative to deduct.",
        adjustReasonLabel: "Reason (optional)",
        adjustReasonPlaceholder: "Refund, promotional bonus, compensation",
        adjustSubmit: "Apply adjustment",
        adjustSuccess: "Credits updated",
        adjustFailed: "Failed to adjust credits",
        bonusTitle: "Bonus Credits",
        bonusDesc: "Set the signup bonus for all new users, or apply a manual bonus to a selected user.",
        bonusTypeLabel: "Bonus type",
        bonusTypeSignup: "Signup bonus",
        bonusTypeManual: "Manual bonus",
        bonusCreditsLabel: "Bonus credits",
        bonusCreditsHint: "Use a positive integer.",
        bonusSignupHint: "This value will be granted automatically to every newly created user.",
        bonusUserRequired: "Select a user above before applying bonus credits.",
        bonusSubmit: "Apply bonus credits",
        bonusSaveSignup: "Save signup bonus",
        bonusSuccess: "Bonus credits applied",
        bonusFailed: "Failed to apply bonus credits",
        bonusSignupSaved: "Signup bonus saved",
        bonusSignupSaveFailed: "Failed to save signup bonus",
        saved: "Saved",
        bundleSaved: "Bundle saved successfully.",
        actionSaved: "Action saved successfully.",
        saveFailed: "Save failed",
        deleteSuccess: "Bundle deleted",
        deleteFailed: "Delete failed",
        deleteBundleHasTransactions: "Cannot delete bundle with related transactions.",
        deleteActionSuccess: "Action deleted",
        deleteActionFailed: "Failed to delete action",
        actionsGroupNutrition: "Nutrition",
        actionsGroupWorkouts: "Workouts",
        actionsGroupProgress: "Progress",
        actionsGroupFiles: "Files",
        actionsGroupAi: "AI",
        actionsGroupOther: "Other",
        actionNutritionViewPlan: "Nutrition: View plan",
        actionNutritionLogMeal: "Nutrition: Log meal",
        actionNutritionLogWater: "Nutrition: Log water",
        actionNutritionGeneratePlan: "Nutrition: Generate plan",
        actionWorkoutStartSession: "Workout: Start session",
        actionWorkoutCompleteSession: "Workout: Complete session",
        actionWorkoutViewPlan: "Workout: View plan",
        actionProgressLogEntry: "Progress: Log update",
        actionProgressUploadPhoto: "Progress: Upload photo",
        actionLogProgress: "Progress: Log update",
        actionLogMeal: "Meal: Log meal",
        actionWatchVideo: "Video: Watch video",
        actionWatchWorkout: "Workout: Watch workout",
        actionFilesUpload: "Files: Upload file",
        actionAiGeneratePlan: "AI Assistant: Generate plan",
        actionAiAgentChat: "AI Agent: Send message",
        customActionPrefix: "Existing: {key}",
      },
      ar: {
        creditBilling: "فوترة الرصيد",
        creditBillingDesc: "إدارة الباقات والأسعار وتكلفة الأفعال بالرصيد.",
        activeBundles: "باقات مفعّلة",
        activeActions: "أفعال مفعّلة",
        bundles: "الباقات",
        actions: "الأفعال",
        adjust: "تعديل",
        bundlesTitle: "باقات الرصيد",
        bundlesDesc: "إدارة الباقات التي يمكن للمتدربين شراؤها.",
        refresh: "تحديث",
        newBundle: "باقة جديدة",
        name: "الاسم",
        credits: "الرصيد",
        price: "السعر",
        currency: "العملة",
        sort: "الترتيب",
        status: "الحالة",
        actionsLabel: "الإجراءات",
        noBundles: "لا توجد باقات حتى الآن.",
        active: "مفعّل",
        inactive: "غير مفعّل",
        edit: "تعديل",
        disable: "إيقاف",
        enable: "تفعيل",
        delete: "حذف",
        confirmDeleteTitle: "حذف الباقة؟",
        confirmDeleteDesc: "سيتم إزالة الباقة، وستبقى المشتريات السابقة كما هي.",
        confirmActionDeleteTitle: "حذف الفعل؟",
        confirmActionDeleteDesc: "سيتم إزالة تكلفة الفعل وستظل المعاملات السابقة كما هي.",
        cancel: "إلغاء",
        saveBundle: "حفظ الباقة",
        bundleNameLabel: "اسم الباقة",
        bundleCreditsLabel: "الرصيد",
        bundlePriceLabel: "السعر (سنت)",
        bundleCurrencyLabel: "العملة",
        bundleActiveLabel: "مفعّل",
        bundleSortLabel: "ترتيب العرض",
        actionsTitle: "تكلفة الأفعال",
        actionsDesc: "حدد عدد الأرصدة التي يستهلكها كل فعل.",
        newAction: "فعل جديد",
        key: "المفتاح",
        description: "الوصف",
        cost: "التكلفة",
        noActions: "لا توجد أفعال حتى الآن.",
        saveAction: "حفظ الفعل",
        actionKeyLabel: "مفتاح الفعل",
        selectActionPlaceholder: "اختر فعلاً",
        actionCostLabel: "تكلفة الرصيد",
        actionDescriptionLabel: "الوصف",
        actionDescriptionPlaceholder: "ظاهر للمشرفين",
        adjustTitle: "تعديل رصيد المستخدم",
        adjustDesc: "إضافة أو خصم الرصيد يدويًا للمستخدم.",
        adjustUserLookupLabel: "المستخدم",
        adjustUserLookupPlaceholder: "ابحث بالاسم أو الهاتف أو المعرف",
        adjustUserLookupEmpty: "لا توجد نتائج",
        adjustUserIdLabel: "معرف المستخدم",
        adjustUserBalanceLabel: "الرصيد الحالي",
        adjustUserBalanceEmpty: "اختر مستخدمًا لعرض الرصيد",
        adjustCreditsDeltaLabel: "تغيير الرصيد",
        adjustCreditsDeltaHint: "استخدم رقمًا موجبًا للإضافة وسالبًا للخصم.",
        adjustReasonLabel: "السبب (اختياري)",
        adjustReasonPlaceholder: "استرجاع، مكافأة ترويجية، تعويض",
        adjustSubmit: "تطبيق التعديل",
        adjustSuccess: "تم تحديث الرصيد",
        adjustFailed: "فشل تعديل الرصيد",
        bonusTitle: "أرصدة المكافآت",
        bonusDesc: "حدد مكافأة التسجيل لكل المستخدمين الجدد، أو أضف مكافأة يدوية لمستخدم محدد.",
        bonusTypeLabel: "نوع المكافأة",
        bonusTypeSignup: "مكافأة التسجيل",
        bonusTypeManual: "مكافأة يدوية",
        bonusCreditsLabel: "رصيد المكافأة",
        bonusCreditsHint: "استخدم رقمًا صحيحًا موجبًا.",
        bonusSignupHint: "سيتم منح هذه القيمة تلقائيًا لكل مستخدم جديد.",
        bonusUserRequired: "اختر مستخدمًا بالأعلى قبل تطبيق رصيد المكافأة.",
        bonusSubmit: "تطبيق رصيد المكافأة",
        bonusSaveSignup: "حفظ مكافأة التسجيل",
        bonusSuccess: "تم تطبيق رصيد المكافأة",
        bonusFailed: "فشل تطبيق رصيد المكافأة",
        bonusSignupSaved: "تم حفظ مكافأة التسجيل",
        bonusSignupSaveFailed: "فشل حفظ مكافأة التسجيل",
        saved: "تم الحفظ",
        bundleSaved: "تم حفظ الباقة بنجاح.",
        actionSaved: "تم حفظ الفعل بنجاح.",
        saveFailed: "فشل الحفظ",
        deleteSuccess: "تم حذف الباقة",
        deleteFailed: "فشل الحذف",
        deleteBundleHasTransactions: "لا يمكن حذف الباقة لوجود معاملات مرتبطة بها.",
        deleteActionSuccess: "تم حذف الفعل",
        deleteActionFailed: "فشل حذف الفعل",
        actionsGroupNutrition: "التغذية",
        actionsGroupWorkouts: "التمارين",
        actionsGroupProgress: "التقدم",
        actionsGroupFiles: "الملفات",
        actionsGroupAi: "الذكاء الاصطناعي",
        actionsGroupOther: "أخرى",
        actionNutritionViewPlan: "تغذية: عرض الخطة",
        actionNutritionLogMeal: "تغذية: تسجيل وجبة",
        actionNutritionLogWater: "تغذية: تسجيل ماء",
        actionNutritionGeneratePlan: "تغذية: إنشاء خطة",
        actionWorkoutStartSession: "تمرين: بدء جلسة",
        actionWorkoutCompleteSession: "تمرين: إنهاء جلسة",
        actionWorkoutViewPlan: "تمرين: عرض الخطة",
        actionProgressLogEntry: "تقدم: تسجيل تحديث",
        actionProgressUploadPhoto: "تقدم: رفع صورة",
        actionLogProgress: "تقدم: تسجيل تحديث",
        actionLogMeal: "وجبة: تسجيل وجبة",
        actionWatchVideo: "فيديو: مشاهدة فيديو",
        actionWatchWorkout: "تمرين: مشاهدة تمرين",
        actionFilesUpload: "ملفات: رفع ملف",
        actionAiGeneratePlan: "مساعد ذكي: إنشاء خطة",
        actionAiAgentChat: "وكيل ذكي: إرسال رسالة",
        customActionPrefix: "قائم: {key}",
      },
    } as const;

    return translations[language as "en" | "ar"] || translations.en;
  }, [language]);

  const actionOptions = useMemo(() => {
    const base = [
      { key: "nutrition_view_plan", label: text.actionNutritionViewPlan, group: "nutrition" as const },
      { key: "nutrition_log_meal", label: text.actionNutritionLogMeal, group: "nutrition" as const },
      { key: "nutrition_log_water", label: text.actionNutritionLogWater, group: "nutrition" as const },
      { key: "nutrition_generate_plan", label: text.actionNutritionGeneratePlan, group: "nutrition" as const },
      { key: "workout_start_session", label: text.actionWorkoutStartSession, group: "workouts" as const },
      { key: "workout_complete_session", label: text.actionWorkoutCompleteSession, group: "workouts" as const },
      { key: "workout_view_plan", label: text.actionWorkoutViewPlan, group: "workouts" as const },
      { key: "progress_log_entry", label: text.actionProgressLogEntry, group: "progress" as const },
      { key: "progress_upload_photo", label: text.actionProgressUploadPhoto, group: "progress" as const },
      { key: "log_progress", label: text.actionLogProgress, group: "progress" as const },
      { key: "log_meal", label: text.actionLogMeal, group: "nutrition" as const },
      { key: "watch_video", label: text.actionWatchVideo, group: "workouts" as const },
      { key: "watch_workout", label: text.actionWatchWorkout, group: "workouts" as const },
      { key: "files_upload", label: text.actionFilesUpload, group: "files" as const },
      { key: "ai_generate_plan", label: text.actionAiGeneratePlan, group: "ai" as const },
      { key: "ai_agent_chat", label: text.actionAiAgentChat, group: "ai" as const },
    ];

    if (actionForm.actionKey && !base.some((item) => item.key === actionForm.actionKey)) {
      const customLabel = text.customActionPrefix.replace("{key}", actionForm.actionKey);
      base.push({ key: actionForm.actionKey, label: customLabel, group: "other" as const });
    }

    return base;
  }, [text, actionForm.actionKey]);

  const actionGroups = useMemo(() => {
    const groups = [
      { id: "nutrition", label: text.actionsGroupNutrition },
      { id: "workouts", label: text.actionsGroupWorkouts },
      { id: "progress", label: text.actionsGroupProgress },
      { id: "files", label: text.actionsGroupFiles },
      { id: "ai", label: text.actionsGroupAi },
      { id: "other", label: text.actionsGroupOther },
    ];

    return groups
      .map((group) => ({
        ...group,
        items: actionOptions.filter((item) => item.group === group.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [actionOptions, text]);

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery<CreditBundleRecord[]>({
    queryKey: ["credit-bundles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/credits/bundles");
      return res.json();
    },
  });

  const { data: actions = [], isLoading: actionsLoading } = useQuery<CreditActionRecord[]>({
    queryKey: ["credit-actions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/credits/actions");
      return res.json();
    },
  });

  const { data: userSearchResults = { data: [] }, isLoading: usersLoading } = useQuery<{ data: UserOption[] }>({
    queryKey: ["credit-adjust-users", userSearchQuery],
    queryFn: async () => {
      const query = encodeURIComponent(userSearchQuery.trim());
      const res = await apiRequest("GET", `/api/users?role=user&search=${query}&page=1&limit=20`);
      return res.json();
    },
    enabled: userSearchOpen && userSearchQuery.trim().length > 0,
  });

  const parsedAdjustUserId = Number(adjustForm.userId);
  const fallbackUserId = Number.isFinite(parsedAdjustUserId) && parsedAdjustUserId > 0 ? parsedAdjustUserId : null;
  const selectedUserId = selectedUser?.id ?? fallbackUserId;

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: number; lowBalanceThreshold?: number }>({
    queryKey: ["credit-balance", selectedUserId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/credits/balance/${selectedUserId}`);
      return res.json();
    },
    enabled: !!selectedUserId,
  });

  const { data: bonusSettings, isLoading: bonusSettingsLoading } = useQuery<CreditBonusSettingsResponse>({
    queryKey: ["credit-bonus-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/credits/bonus-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (bonusSettings && Number.isInteger(bonusSettings.signupBonusCredits) && bonusSettings.signupBonusCredits > 0) {
      setBonusForm((prev) => ({
        ...prev,
        credits: String(bonusSettings.signupBonusCredits),
      }));
    }
  }, [bonusSettings]);

  const bundleMutation = useMutation({
    mutationFn: async (payload: BundleForm) => {
      const res = await apiRequest("POST", "/api/admin/credits/bundles", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-bundles"] });
      toast({ title: text.saved, description: text.bundleSaved });
      setBundleDialogOpen(false);
      setBundleForm(defaultBundleForm);
    },
    onError: (error: Error) => {
      toast({ title: text.saveFailed, description: error.message, variant: "destructive" });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: ActionForm) => {
      const res = await apiRequest("POST", "/api/admin/credits/actions", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-actions"] });
      toast({ title: text.saved, description: text.actionSaved });
      setActionDialogOpen(false);
      setActionForm(defaultActionForm);
    },
    onError: (error: Error) => {
      toast({ title: text.saveFailed, description: error.message, variant: "destructive" });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (payload: { userId: number; creditsDelta: number; reason?: string }) => {
      const res = await apiRequest("POST", "/api/admin/credits/adjust", payload);
      return res.json();
    },
    onSuccess: (data: { balance?: number }) => {
      const balanceText = typeof data?.balance === "number" ? ` (${data.balance} ${text.credits})` : "";
      toast({ title: text.adjustSuccess, description: `${text.adjustDesc}${balanceText}` });
      setAdjustForm((prev) => ({ ...prev, creditsDelta: "", reason: "" }));
      queryClient.invalidateQueries({ queryKey: ["credit-balance", selectedUserId] });
    },
    onError: (error: Error) => {
      const message = parseApiErrorMessage(error) || error.message;
      toast({ title: text.adjustFailed, description: message, variant: "destructive" });
    },
  });

  const bonusMutation = useMutation({
    mutationFn: async (payload: { userId: number; creditsDelta: number; reason: BonusReason }) => {
      const res = await apiRequest("POST", "/api/admin/credits/adjust", payload);
      return res.json();
    },
    onSuccess: (data: { balance?: number }, variables) => {
      const balanceText = typeof data?.balance === "number" ? ` (${data.balance} ${text.credits})` : "";
      const bonusTypeText = variables.reason === "signup_bonus" ? text.bonusTypeSignup : text.bonusTypeManual;
      toast({ title: text.bonusSuccess, description: `${bonusTypeText}${balanceText}` });
      setBonusForm((prev) => ({ ...prev, credits: "" }));
      queryClient.invalidateQueries({ queryKey: ["credit-balance", selectedUserId] });
    },
    onError: (error: Error) => {
      const message = parseApiErrorMessage(error) || error.message;
      toast({ title: text.bonusFailed, description: message, variant: "destructive" });
    },
  });

  const bonusSettingsMutation = useMutation({
    mutationFn: async (payload: CreditBonusSettingsResponse) => {
      const res = await apiRequest("POST", "/api/admin/credits/bonus-settings", payload);
      return res.json();
    },
    onSuccess: (data: CreditBonusSettingsResponse) => {
      toast({
        title: text.bonusSignupSaved,
        description: `${data?.signupBonusCredits ?? bonusCredits} ${text.credits}`,
      });
      queryClient.invalidateQueries({ queryKey: ["credit-bonus-settings"] });
    },
    onError: (error: Error) => {
      const message = parseApiErrorMessage(error) || error.message;
      toast({ title: text.bonusSignupSaveFailed, description: message, variant: "destructive" });
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/credits/bundles/${bundleId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-bundles"] });
      toast({ title: text.deleteSuccess });
      setBundleToDelete(null);
    },
    onError: (error: Error) => {
      const message = parseApiErrorMessage(error);
      const description = message.includes("related transactions")
        ? text.deleteBundleHasTransactions
        : message || error.message;
      toast({ title: text.deleteFailed, description, variant: "destructive" });
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/credits/actions/${actionId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-actions"] });
      toast({ title: text.deleteActionSuccess });
      setActionToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: text.deleteActionFailed, description: error.message, variant: "destructive" });
    },
  });

  const uniqueActions = useMemo(() => {
    const seen = new Set<string>();
    return actions.filter((action) => {
      if (seen.has(action.action_key)) return false;
      seen.add(action.action_key);
      return true;
    });
  }, [actions]);

  const activeBundles = useMemo(() => bundles.filter((b) => b.is_active), [bundles]);
  const activeActions = useMemo(() => uniqueActions.filter((a) => a.is_active), [uniqueActions]);

  const openBundleEditor = (bundle?: CreditBundleRecord) => {
    if (bundle) {
      setBundleForm({
        id: bundle.id,
        name: bundle.name,
        credits: bundle.credits,
        priceCents: bundle.price_cents,
        currency: bundle.currency,
        isActive: bundle.is_active,
        sortOrder: bundle.sort_order,
      });
    } else {
      setBundleForm(defaultBundleForm);
    }
    setBundleDialogOpen(true);
  };

  const openActionEditor = (action?: CreditActionRecord) => {
    if (action) {
      setActionForm({
        id: action.id,
        actionKey: action.action_key,
        description: action.description,
        cost: action.cost,
        isActive: action.is_active,
      });
    } else {
      setActionForm(defaultActionForm);
    }
    setActionDialogOpen(true);
  };

  const handleToggleBundle = (bundle: CreditBundleRecord) => {
    bundleMutation.mutate({
      id: bundle.id,
      name: bundle.name,
      credits: bundle.credits,
      priceCents: bundle.price_cents,
      currency: bundle.currency,
      isActive: !bundle.is_active,
      sortOrder: bundle.sort_order,
    });
  };

  const handleToggleAction = (action: CreditActionRecord) => {
    actionMutation.mutate({
      id: action.id,
      actionKey: action.action_key,
      description: action.description,
      cost: action.cost,
      isActive: !action.is_active,
    });
  };

  const bundleFormInvalid = !bundleForm.name.trim() || bundleForm.credits <= 0 || bundleForm.priceCents < 0 || !bundleForm.currency.trim();
  const actionFormInvalid = !actionForm.actionKey || !actionForm.actionKey.trim() || actionForm.cost < 0;
  const adjustUserId = Number(adjustForm.userId);
  const adjustDelta = Number(adjustForm.creditsDelta);
  const adjustFormInvalid =
    !Number.isInteger(adjustUserId) ||
    adjustUserId <= 0 ||
    !Number.isInteger(adjustDelta) ||
    adjustDelta === 0;
  const bonusCredits = Number(bonusForm.credits);
  const isSignupBonusType = bonusForm.bonusType === "signup_bonus";
  const bonusFormInvalid =
    !Number.isInteger(bonusCredits) ||
    bonusCredits <= 0 ||
    (!isSignupBonusType && !selectedUserId);

  return (
    <div className={`credit-billing-admin space-y-6 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className={isRTL ? "w-full flex items-center justify-between flex-row-reverse gap-3" : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"}>
        <div className={isRTL ? "text-right ml-auto" : "text-left"}>
          <h2 className="text-2xl font-bold">{text.creditBilling}</h2>
          <p className="text-muted-foreground">{text.creditBillingDesc}</p>
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row" : ""}`}>
          <Badge className="bg-green-100 text-green-800 gap-1">
            <CheckCircle className="h-3 w-3" /> {activeBundles.length} {text.activeBundles}
          </Badge>
          <Badge className="bg-blue-100 text-blue-800 gap-1">
            <Activity className="h-3 w-3" /> {activeActions.length} {text.activeActions}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="bundles" className="space-y-4">
        <TabsList
          className={`w-full sm:w-auto flex ${isRTL ? "!flex-row !justify-start ml-auto text-right" : "!justify-start"}`}
          dir={isRTL ? "rtl" : "ltr"}
        >
          <TabsTrigger value="bundles">{text.bundles}</TabsTrigger>
          <TabsTrigger value="actions">{text.actions}</TabsTrigger>
          <TabsTrigger value="adjust">{text.adjust}</TabsTrigger>
        </TabsList>

        <TabsContent value="bundles" className="space-y-4">
          <Card>
            <CardHeader className={`flex flex-col gap-2 sm:items-center sm:justify-between ${isRTL ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" /> {text.bundlesTitle}
                </CardTitle>
                <CardDescription>{text.bundlesDesc}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["credit-bundles"] })}>
                  <RefreshCw className="h-4 w-4 mr-1" /> {text.refresh}
                </Button>
                <Button size="sm" onClick={() => openBundleEditor()}>
                  <Plus className="h-4 w-4 mr-1" /> {text.newBundle}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bundlesLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, idx) => (
                    <div key={idx} className="h-10 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <Table dir={isRTL ? "rtl" : "ltr"}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{text.name}</TableHead>
                      <TableHead>{text.credits}</TableHead>
                      <TableHead>{text.price}</TableHead>
                      <TableHead>{text.currency}</TableHead>
                      <TableHead>{text.sort}</TableHead>
                      <TableHead>{text.status}</TableHead>
                      <TableHead className={isRTL ? "text-left" : "text-right"}>{text.actionsLabel}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">{text.noBundles}</TableCell>
                      </TableRow>
                    ) : (
                      bundles.map((bundle) => (
                        <TableRow key={bundle.id}>
                          <TableCell className="font-medium">{bundle.name}</TableCell>
                          <TableCell>{bundle.credits}</TableCell>
                          <TableCell>${(bundle.price_cents / 100).toFixed(2)}</TableCell>
                          <TableCell className="uppercase">{bundle.currency}</TableCell>
                          <TableCell>{bundle.sort_order ?? "-"}</TableCell>
                          <TableCell>
                            {bundle.is_active ? (
                              <Badge className="bg-green-100 text-green-800">{text.active}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">{text.inactive}</Badge>
                            )}
                          </TableCell>
                          <TableCell className={`${isRTL ? "text-left" : "text-right"} space-x-2`}>
                            <Button variant="ghost" size="sm" onClick={() => openBundleEditor(bundle)}>
                              <Edit3 className="h-4 w-4 mr-1" /> {text.edit}
                            </Button>
                            <Button
                              variant={bundle.is_active ? "outline" : "secondary"}
                              size="sm"
                              onClick={() => handleToggleBundle(bundle)}
                              disabled={bundleMutation.isPending}
                            >
                              {bundle.is_active ? <XCircle className="h-4 w-4 mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                              {bundle.is_active ? text.disable : text.enable}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setBundleToDelete(bundle)}
                              disabled={deleteBundleMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> {text.delete}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader className={`flex flex-col gap-2 sm:items-center sm:justify-between ${isRTL ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BadgeDollarSign className="h-5 w-5" /> {text.actionsTitle}
                </CardTitle>
                <CardDescription>{text.actionsDesc}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["credit-actions"] })}>
                  <RefreshCw className="h-4 w-4 mr-1" /> {text.refresh}
                </Button>
                <Button size="sm" onClick={() => openActionEditor()}>
                  <Plus className="h-4 w-4 mr-1" /> {text.newAction}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {actionsLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, idx) => (
                    <div key={idx} className="h-10 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <Table dir={isRTL ? "rtl" : "ltr"}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{text.key}</TableHead>
                      <TableHead>{text.description}</TableHead>
                      <TableHead>{text.cost}</TableHead>
                      <TableHead>{text.status}</TableHead>
                      <TableHead className={isRTL ? "text-left" : "text-right"}>{text.actionsLabel}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniqueActions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">{text.noActions}</TableCell>
                      </TableRow>
                    ) : (
                      uniqueActions.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell className="font-medium">{action.action_key}</TableCell>
                          <TableCell className="max-w-[320px] text-muted-foreground">{action.description || "-"}</TableCell>
                          <TableCell>
                            {action.cost} {text.credits}
                          </TableCell>
                          <TableCell>
                            {action.is_active ? (
                              <Badge className="bg-green-100 text-green-800">{text.active}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">{text.inactive}</Badge>
                            )}
                          </TableCell>
                          <TableCell className={`${isRTL ? "text-left" : "text-right"} space-x-2`}>
                            <Button variant="ghost" size="sm" onClick={() => openActionEditor(action)}>
                              <Edit3 className="h-4 w-4 mr-1" /> {text.edit}
                            </Button>
                            <Button
                              variant={action.is_active ? "outline" : "secondary"}
                              size="sm"
                              onClick={() => handleToggleAction(action)}
                              disabled={actionMutation.isPending}
                            >
                              {action.is_active ? <XCircle className="h-4 w-4 mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                              {action.is_active ? text.disable : text.enable}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setActionToDelete(action)}
                              disabled={deleteActionMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> {text.delete}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjust" className={`space-y-4 ${isRTL ? "text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
          <Card>
            <CardHeader className={isRTL ? "text-right" : "text-left"}>
              <CardTitle className={`flex items-center gap-2 ${isRTL ? "justify-start" : ""}`}>
                <CreditCard className="h-5 w-5" /> {text.adjustTitle}
              </CardTitle>
              <CardDescription>{text.adjustDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isRTL ? "text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
                <div className="space-y-2">
                  <Label>{text.adjustUserLookupLabel}</Label>
                  <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className={`w-full ${isRTL ? "text-right" : ""} justify-between`}>
                        <span className="truncate">
                          {selectedUser
                            ? `${selectedUser.firstName || ""} ${selectedUser.lastName || ""}`.trim() || selectedUser.username || selectedUser.email || `#${selectedUser.id}`
                            : text.adjustUserLookupPlaceholder}
                        </span>
                        <UserSearch className="h-4 w-4 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          value={userSearchQuery}
                          onValueChange={setUserSearchQuery}
                          placeholder={text.adjustUserLookupPlaceholder}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {usersLoading ? text.refresh : text.adjustUserLookupEmpty}
                          </CommandEmpty>
                          <CommandGroup>
                            {userSearchResults.data.map((user) => {
                              const label = `${user.firstName || ""} ${user.lastName || ""}`.trim();
                              const secondary = user.whatsappWithCode || user.email || user.username || "";
                              return (
                                <CommandItem
                                  key={user.id}
                                  value={`${label} ${secondary} ${user.id}`.trim()}
                                  onSelect={() => {
                                    setSelectedUser(user);
                                    setAdjustForm((prev) => ({ ...prev, userId: String(user.id) }));
                                    setUserSearchOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span>{label || user.username || user.email || `#${user.id}`}</span>
                                    <span className="text-xs text-muted-foreground">{secondary || `ID: ${user.id}`}</span>
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adjust-user-id">{text.adjustUserIdLabel}</Label>
                  <Input
                    id="adjust-user-id"
                    type="number"
                    min={1}
                    value={adjustForm.userId}
                    readOnly
                    placeholder="123"
                    className={isRTL ? "text-right" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{text.adjustUserBalanceLabel}</Label>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    {selectedUserId ? (
                      balanceLoading ? (
                        <span className="text-muted-foreground">{text.refresh}</span>
                      ) : (
                        <span>{balanceData?.balance ?? 0} {text.credits}</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">{text.adjustUserBalanceEmpty}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adjust-credits">{text.adjustCreditsDeltaLabel}</Label>
                  <Input
                    id="adjust-credits"
                    type="number"
                    step={1}
                    value={adjustForm.creditsDelta}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, creditsDelta: e.target.value }))}
                    placeholder="+50 or -20"
                    className={isRTL ? "text-right" : ""}
                  />
                  <p className="text-xs text-muted-foreground">{text.adjustCreditsDeltaHint}</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="adjust-reason">{text.adjustReasonLabel}</Label>
                  <Input
                    id="adjust-reason"
                    value={adjustForm.reason}
                    onChange={(e) => setAdjustForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder={text.adjustReasonPlaceholder}
                    className={isRTL ? "text-right" : ""}
                  />
                </div>
              </div>
              <div className={`flex gap-2 pt-4 ${isRTL ? "justify-start" : "justify-end"}`}>
                <Button
                  onClick={() => {
                    if (adjustFormInvalid) return;
                    adjustMutation.mutate({
                      userId: adjustUserId,
                      creditsDelta: adjustDelta,
                      reason: adjustForm.reason.trim() || undefined,
                    });
                  }}
                  disabled={adjustFormInvalid || adjustMutation.isPending}
                >
                  {adjustMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {text.adjustSubmit}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className={isRTL ? "text-right" : "text-left"}>
              <CardTitle className={`flex items-center gap-2 ${isRTL ? "justify-start" : ""}`}>
                <BadgeDollarSign className="h-5 w-5" /> {text.bonusTitle}
              </CardTitle>
              <CardDescription>{text.bonusDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isRTL ? "text-right" : ""}`} dir={isRTL ? "rtl" : "ltr"}>
                <div className="space-y-2">
                  <Label htmlFor="bonus-type">{text.bonusTypeLabel}</Label>
                  <Select
                    value={bonusForm.bonusType}
                    onValueChange={(value: BonusReason) => setBonusForm((prev) => ({ ...prev, bonusType: value }))}
                  >
                    <SelectTrigger id="bonus-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="signup_bonus">{text.bonusTypeSignup}</SelectItem>
                      <SelectItem value="manual_bonus">{text.bonusTypeManual}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bonus-credits">{text.bonusCreditsLabel}</Label>
                  <Input
                    id="bonus-credits"
                    type="number"
                    min={1}
                    step={1}
                    value={bonusForm.credits}
                    onChange={(e) => setBonusForm((prev) => ({ ...prev, credits: e.target.value }))}
                    placeholder="100"
                    className={isRTL ? "text-right" : ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isSignupBonusType
                      ? text.bonusSignupHint
                      : selectedUserId
                        ? text.bonusCreditsHint
                        : text.bonusUserRequired}
                  </p>
                </div>
              </div>
              <div className={`flex gap-2 pt-4 ${isRTL ? "justify-start" : "justify-end"}`}>
                <Button
                  onClick={() => {
                    if (bonusFormInvalid) return;
                    if (isSignupBonusType) {
                      bonusSettingsMutation.mutate({ signupBonusCredits: bonusCredits });
                      return;
                    }

                    if (!selectedUserId) return;
                    bonusMutation.mutate({
                      userId: selectedUserId,
                      creditsDelta: bonusCredits,
                      reason: "manual_bonus",
                    });
                  }}
                  disabled={bonusFormInvalid || bonusMutation.isPending || bonusSettingsLoading || bonusSettingsMutation.isPending}
                >
                  {bonusMutation.isPending || bonusSettingsMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                  {isSignupBonusType ? text.bonusSaveSignup : text.bonusSubmit}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={bundleDialogOpen} onOpenChange={setBundleDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{bundleForm.id ? text.edit : text.newBundle}</DialogTitle>
            <DialogDescription>{text.bundlesDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bundle-name">{text.bundleNameLabel}</Label>
                <Input
                  id="bundle-name"
                  value={bundleForm.name}
                  onChange={(e) => setBundleForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Starter 50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-credits">{text.bundleCreditsLabel}</Label>
                <Input
                  id="bundle-credits"
                  type="number"
                  min={1}
                  value={bundleForm.credits}
                  onChange={(e) => setBundleForm((prev) => ({ ...prev, credits: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-price">{text.bundlePriceLabel}</Label>
                <Input
                  id="bundle-price"
                  type="number"
                  min={0}
                  value={bundleForm.priceCents}
                  onChange={(e) => setBundleForm((prev) => ({ ...prev, priceCents: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-currency">{text.bundleCurrencyLabel}</Label>
                <Input
                  id="bundle-currency"
                  value={bundleForm.currency}
                  className="uppercase"
                  onChange={(e) => setBundleForm((prev) => ({ ...prev, currency: e.target.value.toLowerCase() }))}
                  placeholder="usd"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bundle-sort">{text.bundleSortLabel}</Label>
                <Input
                  id="bundle-sort"
                  type="number"
                  value={bundleForm.sortOrder}
                  onChange={(e) => setBundleForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="bundle-active"
                  checked={bundleForm.isActive}
                  onCheckedChange={(checked) => setBundleForm((prev) => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="bundle-active">{text.bundleActiveLabel}</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBundleDialogOpen(false)}>
                {text.cancel}
              </Button>
              <Button
                onClick={() => bundleMutation.mutate(bundleForm)}
                disabled={bundleFormInvalid || bundleMutation.isPending}
              >
                {bundleMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                {bundleForm.id ? text.edit : text.saveBundle}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{actionForm.id ? text.edit : text.newAction}</DialogTitle>
            <DialogDescription>{text.actionsDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="action-key">{text.actionKeyLabel}</Label>
                <Select
                  value={actionForm.actionKey || actionOptions[0]?.key || ""}
                  onValueChange={(value) => setActionForm((prev) => ({ ...prev, actionKey: value }))}
                >
                  <SelectTrigger id="action-key">
                    <SelectValue placeholder={text.selectActionPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {actionGroups.map((group) => (
                      <SelectGroup key={group.id}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.items.map((item) => (
                          <SelectItem key={item.key} value={item.key}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="action-description">{text.actionDescriptionLabel}</Label>
                <Input
                  id="action-description"
                  value={actionForm.description ?? ""}
                  onChange={(e) => setActionForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={text.actionDescriptionPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="action-cost">{text.actionCostLabel}</Label>
                <Input
                  id="action-cost"
                  type="number"
                  min={0}
                  value={actionForm.cost}
                  onChange={(e) => setActionForm((prev) => ({ ...prev, cost: Number(e.target.value) }))}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="action-active"
                  checked={actionForm.isActive}
                  onCheckedChange={(checked) => setActionForm((prev) => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="action-active">{text.bundleActiveLabel}</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setActionDialogOpen(false)}>
                {text.cancel}
              </Button>
              <Button
                onClick={() => actionMutation.mutate(actionForm)}
                disabled={actionFormInvalid || actionMutation.isPending}
              >
                {actionMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
                {actionForm.id ? text.edit : text.saveAction}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!bundleToDelete} onOpenChange={() => setBundleToDelete(null)}>
        <AlertDialogContent dir={language === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{text.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{text.confirmDeleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{text.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (bundleToDelete) {
                  deleteBundleMutation.mutate(bundleToDelete.id);
                }
              }}
              disabled={deleteBundleMutation.isPending}
            >
              {text.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!actionToDelete} onOpenChange={() => setActionToDelete(null)}>
        <AlertDialogContent dir={language === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{text.confirmActionDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{text.confirmActionDeleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{text.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionToDelete) {
                  deleteActionMutation.mutate(actionToDelete.id);
                }
              }}
              disabled={deleteActionMutation.isPending}
            >
              {text.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CreditBillingAdmin;
