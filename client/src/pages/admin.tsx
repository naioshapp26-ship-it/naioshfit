import { useState, useEffect, useMemo } from "react";
import { normalizeDigitsUniversal } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SwipeableTabs, SwipeableTabsContent, SwipeableTabsList, SwipeableTabsTrigger } from "@/components/ui/swipeable-tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Dumbbell, UtensilsCrossed, Edit, Plus, Trash2, TrendingUp, Target, Activity, Clock, Calendar, CheckCircle, Search, UserCog, Eye, EyeOff, CalendarDays, Filter, MoreVertical, Store, ExternalLink, Sparkles, BarChart3, Award, Scale, ShoppingCart, XCircle, CreditCard, Building2, Printer, FileDown } from "lucide-react";
import { formatInAppTz } from '@/lib/timezone';
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { calculateSubscriptionEndDate, getSubscriptionStatus, isSubscriptionSuspended, isValidSubscriptionType } from "@shared/subscriptionUtils";
import { User, UserPlan, UserWorkout, WorkoutSession, Meal, Progress as ProgressType, DailyStats, AffiliateProduct, Product, CoachProduct } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/LanguageContext";
import { translations } from "@/lib/translations-data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AdminUsersTable } from "@/components/AdminUsersTable";
import { TenantManagementPanel } from "@/components/admin/TenantManagementPanel";
import PaymentSettingsAdmin from "@/components/admin/PaymentSettingsAdmin";
import EmailSettingsAdmin from "@/components/admin/EmailSettingsAdmin";
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import CreditBillingAdmin from "@/components/admin/CreditBillingAdmin";
import AiSettingsAdmin from "@/components/admin/AiSettingsAdmin";
import BlogManager from "@/components/blog/BlogManager";
import { SeoSettingsPanel } from "@/components/admin/SeoSettingsPanel";
import BrandingSettingsAdmin from "@/components/admin/BrandingSettingsAdmin";
import PublicContentManager from "@/components/admin/PublicContentManager";
import { MediaUpload } from "@/components/ui/media-upload";
import { AdBanner } from "@/components/ads/AdBanner";
import { CommunityPanel } from "@/components/epics/EpicWidgets";
import { TechnicalIssuesPanel } from "@/components/admin/TechnicalIssuesPanel";
import { isPlatformAdminRole, isTenantManagerRole } from "@shared/roleAccess";

// Helper function to map workout days to activity level for regeneration
const getActivityLevelFromWorkoutDays = (workoutDays: number): string => {
  if (workoutDays <= 2) return 'sedentary';
  if (workoutDays <= 3) return 'lightly-active';
  if (workoutDays <= 4) return 'moderately-active';
  if (workoutDays <= 5) return 'very-active';
  return 'extra-active';
};

// Helper function to get translations for a specific language
const getTranslation = (language: 'en' | 'ar', key: string): string => {
  return (translations[language] as any)?.[key] || key;
};

type TrackingFormState = {
  metaPixelId: string;
  metaPixelAccessToken: string;
  metaPixelTestEventCode: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  googleAdsSendTo: string;
  googleAnalyticsMeasurementId: string;
  googleAnalyticsApiSecret: string;
  googleAnalyticsStreamId: string;
  googleAnalyticsPropertyId: string;
};

export function AdminDashboard() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'workout' | 'nutrition'>('workout');
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Role gate - only admin or super_admin can access
  if (!user || !isPlatformAdminRole(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="text-center">{t('accessDenied')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600">
              {t('onlyAdminsAccess')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isTenantSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length > 2 && parts[0] !== "www") {
      return true;
    }
    return false;
  }, []);

  const showTenantManagement = !isTenantSubdomain && isTenantManagerRole(user.role);

  // Subscription form state
  const [subscriptionType, setSubscriptionType] = useState('');
  const [subscriptionStartDate, setSubscriptionStartDate] = useState('');

  // User management state
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    whatsappWithCode: '',
    role: 'user',
    city: '',
    country: '',
    gender: 'male' as 'male' | 'female',
    religion: 'muslim' as 'muslim' | 'christian',
    height: 170,
    age: 25,
    weight: 70,
    howFoundUs: 'instagram' as 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'whatsapp'
  });
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    message: string;
    onConfirm?: () => void;
  }>({
    open: false,
    message: ''
  });
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editUserFormData, setEditUserFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    whatsappWithCode: '',
  });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  
  // User filter state
  const [userFilters, setUserFilters] = useState({
    status: [] as string[], // 'active', 'inactive'
    subscription: [] as string[], // 'active_subscription', 'suspended_subscription'
    planStatus: [] as string[], // 'with_plans', 'without_plans'
    role: [] as string[], // 'coach', 'user', 'admin', 'gym'
    coachAssignment: '' as string, // coachId or 'unassigned'
    gymAssignment: '' as string, // gymId or 'unassigned'
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Detail view state
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [detailViewUser, setDetailViewUser] = useState<any>(null);
  const [activityFilter, setActivityFilter] = useState('all');

  // User management dialog state
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [managingUser, setManagingUser] = useState<any>(null);

  // Generate Both button state
  const [generating, setGenerating] = useState(false);


  // Role assignment state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<any>(null);
  const [newRole, setNewRole] = useState('');

  // Coach assignment state
  const [coachAssignDialogOpen, setCoachAssignDialogOpen] = useState(false);
  const [selectedUserForCoach, setSelectedUserForCoach] = useState<any>(null);
  const [selectedCoachId, setSelectedCoachId] = useState('');

  // Affiliate products state
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<AffiliateProduct | null>(null);
  const [affiliateFormData, setAffiliateFormData] = useState({
    title: '',
    url: '',
    description: '',
    thumbnailUrl: '',
    category: '',
    source: '',
    isActive: true
  });

  // Affiliate categories state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [categoryFormData, setCategoryFormData] = useState<{
    nameEn: string;
    nameAr: string;
    slug: string;
    isActive: boolean;
    displayOrder: number | '';
  }>({
    nameEn: '',
    nameAr: '',
    slug: '',
    isActive: true,
    displayOrder: ''
  });

  // Shop products state
  const [shopProductDialogOpen, setShopProductDialogOpen] = useState(false);
  const [editingShopProduct, setEditingShopProduct] = useState<Product | null>(null);
  const [shopProductFormData, setShopProductFormData] = useState({
    name: '',
    description: '',
    price: 0,
    imageUrl: '',
    category: '',
    rating: 0,
    reviewCount: 0,
    stock: 0
  });

  // Coach products filter state (view only)
  const [coachProductsFilter, setCoachProductsFilter] = useState<string>(''); // coach ID filter

  // Coach products state (for admin edit/delete)
  const [coachProductDialogOpen, setCoachProductDialogOpen] = useState(false);
  const [editingCoachProduct, setEditingCoachProduct] = useState<CoachProduct | null>(null);
  const [coachProductFormData, setCoachProductFormData] = useState({
    title: '',
    url: '',
    description: '',
    thumbnailUrl: ''
  });

  // Store sub-tabs state
  const [storeTab, setStoreTab] = useState('affiliate'); // affiliate | shop | coach | categories

  const [trackingForm, setTrackingForm] = useState<TrackingFormState>({
    metaPixelId: '',
    metaPixelAccessToken: '',
    metaPixelTestEventCode: '',
    googleAdsConversionId: '',
    googleAdsConversionLabel: '',
    googleAdsSendTo: '',
    googleAnalyticsMeasurementId: '',
    googleAnalyticsApiSecret: '',
    googleAnalyticsStreamId: '',
    googleAnalyticsPropertyId: '',
  });

  // Fetch all users
  const { data: usersResponse, isLoading: usersLoading } = useQuery<any>({
    queryKey: ['/api/users', userFilters, userSearchQuery, currentPage, pageSize],
    queryFn: async () => {
      // Build query parameters from filters
      const params = new URLSearchParams();
      
      params.append('page', currentPage.toString());
      params.append('limit', pageSize.toString());
      
      if (userFilters.status.length > 0) {
        params.append('status', userFilters.status.join(','));
      }
      if (userFilters.subscription.length > 0) {
        params.append('subscription', userFilters.subscription.join(','));
      }
      if (userFilters.planStatus.length > 0) {
        params.append('planStatus', userFilters.planStatus.join(','));
      }
      if (userFilters.role.length > 0) {
        params.append('role', userFilters.role.join(','));
      }
      if (userFilters.coachAssignment) {
        params.append('coachAssignment', userFilters.coachAssignment);
      }
      if (userFilters.gymAssignment) {
        params.append('gymAssignment', userFilters.gymAssignment);
      }
      if (userSearchQuery.trim()) {
        params.append('search', userSearchQuery.trim());
      }
      
      const queryString = params.toString();
      const url = queryString ? `/api/users?${queryString}` : '/api/users';
      
      const response = await apiRequest('GET', url);
      return await response.json();
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [userSearchQuery]);

  // Extract users from response (handle both new paginated format and old format for backward compatibility)
  const users: User[] = usersResponse?.data || usersResponse || [];
  const paginationInfo = usersResponse?.pagination || { page: 1, limit: 10, total: users.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

  // Fetch coaches for assignment dropdown
  const { data: coaches = [] } = useQuery<User[]>({
    queryKey: ['/api/coaches'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/coaches');
      return await response.json();
    },
  });

  // Fetch gyms for assignment dropdown
  const { data: gymsResponse = {} } = useQuery({
    queryKey: ['/api/gyms'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=gym&page=1&limit=100');
      return await response.json();
    },
  });
  
  const gyms = Array.isArray(gymsResponse) ? gymsResponse : (gymsResponse?.data || []);

  // Fetch user plans for selected user (get latest plan only)
  const { data: userPlans = [], isLoading: plansLoading } = useQuery<UserPlan[]>({
    queryKey: ['/api/user-plans', selectedUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/user-plans/${selectedUser?.id}`);
      const plans = await response.json();
      // Return all plans (sorted by server). We'll display relevant ones per tab.
      return Array.isArray(plans) ? plans : [];
    },
    enabled: !!selectedUser?.id,
  });

  // Fetch user workouts for selected user
  const { data: userWorkouts = [], isLoading: workoutsLoading } = useQuery<UserWorkout[]>({
    queryKey: ['/api/user-workouts', selectedUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/user-workouts?userId=${selectedUser?.id}`);
      return await response.json();
    },
    enabled: !!selectedUser?.id,
  });


  // Fetch detailed trainee activity data when detail view is open
  const { data: traineeProgress = [], isLoading: traineeProgressLoading } = useQuery({
    queryKey: ['/api/admin/trainee-progress', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-progress/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailViewOpen,
  });

  const { data: traineeMeals = [], isLoading: traineeMealsLoading } = useQuery({
    queryKey: ['/api/admin/trainee-meals', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-meals/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailViewOpen,
  });

  const { data: traineeWorkoutSessions = [], isLoading: traineeWorkoutSessionsLoading } = useQuery({
    queryKey: ['/api/admin/trainee-workout-sessions', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-workout-sessions/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailViewOpen,
  });

  const { data: traineeDailyStats = [], isLoading: traineeDailyStatsLoading } = useQuery({
    queryKey: ['/api/admin/trainee-daily-stats', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-daily-stats/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailViewOpen,
  });

  // Fetch user plans for detail view user
  const { data: detailViewUserPlans = [], isLoading: detailViewUserPlansLoading } = useQuery<UserPlan[]>({
    queryKey: ['/api/user-plans', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/user-plans/${detailViewUser?.id}`);
      const plans = await response.json();
      return Array.isArray(plans) ? plans : [];
    },
    enabled: !!detailViewUser?.id && detailViewOpen,
  });

  // Fetch user plans for managing user (for the management dialog)
  const { data: managingUserPlans = [], isLoading: managingUserPlansLoading } = useQuery<UserPlan[]>({
    queryKey: ['/api/user-plans', managingUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/user-plans/${managingUser?.id}`);
      const plans = await response.json();
      return Array.isArray(plans) ? plans : [];
    },
    enabled: !!managingUser?.id && userManagementOpen,
  });

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/admin/analytics'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/analytics');
      return await response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Print Analytics function
  const handlePrintAnalytics = () => {
    window.print();
  };

  // Export to Excel function
  const handleExportToExcel = async () => {
    if (!analyticsData) {
      toast({
        title: t('exportError'),
        description: t('noAnalyticsData'),
        variant: "destructive"
      });
      return;
    }

    try {
      // Dynamically import xlsx
      const XLSX = await import('xlsx');
      
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Coaches Sheet
      const coachesData = [
        ['Metric', 'Value'],
        ['Total Coaches', analyticsData.coaches.total],
        ['New Today', analyticsData.coaches.newToday],
        ['New This Week', analyticsData.coaches.newThisWeek],
        ['New This Month', analyticsData.coaches.newThisMonth],
        ['New This Year', analyticsData.coaches.newThisYear]
      ];
      const coachesWs = XLSX.utils.aoa_to_sheet(coachesData);
      XLSX.utils.book_append_sheet(wb, coachesWs, 'Coaches');

      // Users Sheet
      const usersData = [
        ['Metric', 'Value'],
        ['Total Users', analyticsData.users.total],
        ['New Today', analyticsData.users.newToday],
        ['New This Week', analyticsData.users.newThisWeek],
        ['New This Month', analyticsData.users.newThisMonth],
        ['New This Year', analyticsData.users.newThisYear],
        ['Active Last 24h', analyticsData.users.activeLast24h],
        ['Active Last 7 Days', analyticsData.users.activeLast7days],
        ['Active Last 30 Days', analyticsData.users.activeLast30days]
      ];
      const usersWs = XLSX.utils.aoa_to_sheet(usersData);
      XLSX.utils.book_append_sheet(wb, usersWs, 'Users');

      // Gyms Sheet
      const gymsData = [
        ['Metric', 'Value'],
        ['Total Gyms', analyticsData.gyms?.total || 0],
        ['New Today', analyticsData.gyms?.newToday || 0],
        ['New This Week', analyticsData.gyms?.newThisWeek || 0],
        ['New This Month', analyticsData.gyms?.newThisMonth || 0],
        ['New This Year', analyticsData.gyms?.newThisYear || 0]
      ];
      const gymsWs = XLSX.utils.aoa_to_sheet(gymsData);
      XLSX.utils.book_append_sheet(wb, gymsWs, 'Gyms');

      // Meals Sheet
      const mealsData = [
        ['Metric', 'Value'],
        ['Total Today', analyticsData.meals.totalToday],
        ['Total This Week', analyticsData.meals.totalThisWeek],
        ['Total This Month', analyticsData.meals.totalThisMonth],
        ['Total This Year', analyticsData.meals.totalThisYear],
        ['Most Logged Meal Time', analyticsData.meals.mostLoggedMealTime],
        [],
        ['Meal Type', 'Count'],
        ...Object.entries(analyticsData.meals.mealTypeCounts || {}).map(([type, count]) => [type, count])
      ];
      const mealsWs = XLSX.utils.aoa_to_sheet(mealsData);
      XLSX.utils.book_append_sheet(wb, mealsWs, 'Meals');

      // Workouts Sheet
      const workoutsData = [
        ['Metric', 'Value'],
        ['Total Today', analyticsData.workouts.totalToday],
        ['Total This Week', analyticsData.workouts.totalThisWeek],
        ['Total This Month', analyticsData.workouts.totalThisMonth],
        ['Total This Year', analyticsData.workouts.totalThisYear]
      ];
      const workoutsWs = XLSX.utils.aoa_to_sheet(workoutsData);
      XLSX.utils.book_append_sheet(wb, workoutsWs, 'Workouts');

      // Streaks and Points Sheet
      const streaksData = [
        ['Top Streaks'],
        ['Rank', 'User', 'Streak (days)'],
        ...analyticsData.streaksAndPoints.top3Streaks.map((item: any, idx: number) => 
          [idx + 1, item.userName, item.streak]
        ),
        [],
        ['Top Points'],
        ['Rank', 'User', 'Points'],
        ...analyticsData.streaksAndPoints.top3Points.map((item: any, idx: number) => 
          [idx + 1, item.userName, item.points]
        )
      ];
      const streaksWs = XLSX.utils.aoa_to_sheet(streaksData);
      XLSX.utils.book_append_sheet(wb, streaksWs, 'Streaks & Points');

      // Plans Sheet
      const plansData = [
        ['Metric', 'Value'],
        ['Users With Plans', analyticsData.plans.usersWithPlans],
        ['Users Without Plans', analyticsData.plans.usersWithoutPlans],
        ['Assigned Today', analyticsData.plans.assignedToday],
        ['Assigned This Week', analyticsData.plans.assignedThisWeek],
        ['Assigned This Month', analyticsData.plans.assignedThisMonth],
        ['Assigned This Year', analyticsData.plans.assignedThisYear]
      ];
      const plansWs = XLSX.utils.aoa_to_sheet(plansData);
      XLSX.utils.book_append_sheet(wb, plansWs, 'Plans');

      // Weight Logs Sheet
      const weightLogsData = [
        ['Metric', 'Value'],
        ['Total Today', analyticsData.weightLogs.totalToday],
        ['Total This Week', analyticsData.weightLogs.totalThisWeek],
        ['Total This Month', analyticsData.weightLogs.totalThisMonth],
        ['Total This Year', analyticsData.weightLogs.totalThisYear]
      ];
      const weightLogsWs = XLSX.utils.aoa_to_sheet(weightLogsData);
      XLSX.utils.book_append_sheet(wb, weightLogsWs, 'Weight Logs');

      // Products & Clicks Sheet
      const productsData = [
        ['Click Analytics'],
        ['Period', 'Clicks'],
        ['Today', analyticsData.products.totalClicksToday || 0],
        ['This Week', analyticsData.products.totalClicksThisWeek || 0],
        ['This Month', analyticsData.products.totalClicksThisMonth || 0],
        ['This Year', analyticsData.products.totalClicksThisYear || 0],
        [],
        ['Most Clicked Products'],
        ['Product', 'Total Clicks', 'Clicks Today', 'Clicks This Week', 'Clicks This Month', 'Clicks This Year'],
        ...analyticsData.products.mostClickedLinks.map((product: any) => 
          [product.title, product.totalClicks, product.clicksToday, product.clicksThisWeek, product.clicksThisMonth, product.clicksThisYear]
        ),
        [],
        ['Purchases'],
        ['Period', 'Count'],
        ['Today', analyticsData.products.purchasesToday || 0],
        ['This Week', analyticsData.products.purchasesThisWeek || 0],
        ['This Month', analyticsData.products.purchasesThisMonth || 0],
        ['This Year', analyticsData.products.purchasesThisYear || 0]
      ];
      const productsWs = XLSX.utils.aoa_to_sheet(productsData);
      XLSX.utils.book_append_sheet(wb, productsWs, 'Products & Purchases');

      // Subscriptions Sheet
      const subscriptionsData = [
        ['Metric', 'Value'],
        ['Active Subscriptions', analyticsData.subscriptions.active],
        ['Expired Subscriptions', analyticsData.subscriptions.expired || 0],
        ['Suspended Subscriptions', analyticsData.subscriptions.suspended],
        [],
        ['Subscription Type', 'Count'],
        ...Object.entries(analyticsData.subscriptions.byCounts).map(([type, count]) => [type, count])
      ];
      const subscriptionsWs = XLSX.utils.aoa_to_sheet(subscriptionsData);
      XLSX.utils.book_append_sheet(wb, subscriptionsWs, 'Subscriptions');

      // Failed Logs Sheet
      const failedLogsData = [
        ['Type', 'Count'],
        ['Failed Meal Logs', analyticsData.failedLogs.meals],
        ['Failed Workout Logs', analyticsData.failedLogs.workouts]
      ];
      const failedLogsWs = XLSX.utils.aoa_to_sheet(failedLogsData);
      XLSX.utils.book_append_sheet(wb, failedLogsWs, 'Failed Logs');

      // Generate Excel file
      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `analytics_${timestamp}.xlsx`);

      toast({
        title: t('exportSuccess'),
        description: `Analytics exported to analytics_${timestamp}.xlsx`
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: t('exportError'),
        description: 'Failed to export analytics data',
        variant: "destructive"
      });
    }
  };

  const { data: trackingSettings, isLoading: trackingSettingsLoading } = useQuery({
    queryKey: ['/api/admin/tracking-settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/tracking-settings');
      return await response.json();
    },
    enabled: isPlatformAdminRole(user?.role),
  });

  useEffect(() => {
    if (trackingSettings) {
      setTrackingForm({
        metaPixelId: trackingSettings.metaPixelId ?? '',
        metaPixelAccessToken: trackingSettings.metaPixelAccessToken ?? '',
        metaPixelTestEventCode: trackingSettings.metaPixelTestEventCode ?? '',
        googleAdsConversionId: trackingSettings.googleAdsConversionId ?? '',
        googleAdsConversionLabel: trackingSettings.googleAdsConversionLabel ?? '',
        googleAdsSendTo: trackingSettings.googleAdsSendTo ?? '',
        googleAnalyticsMeasurementId: trackingSettings.googleAnalyticsMeasurementId ?? '',
        googleAnalyticsApiSecret: trackingSettings.googleAnalyticsApiSecret ?? '',
        googleAnalyticsStreamId: trackingSettings.googleAnalyticsStreamId ?? '',
        googleAnalyticsPropertyId: trackingSettings.googleAnalyticsPropertyId ?? '',
      });
    }
  }, [trackingSettings]);

  // Generate mock progress data for each user for demonstration
  const { data: usersProgress = {} } = useQuery<Record<number, any>>({
    queryKey: ['/api/users-progress'],
    queryFn: async () => {
      const progressData: Record<number, any> = {};
      for (const user of users) {
        // Generate realistic progress data for each user
        progressData[user.id] = {
          progressSummary: {
            weightProgress: Math.floor(Math.random() * 70) + 20, // 20-90%
            calorieGoalProgress: Math.floor(Math.random() * 60) + 30, // 30-90%
            workoutProgress: Math.floor(Math.random() * 80) + 10, // 10-90%
            totalDaysTracked: Math.floor(Math.random() * 20) + 5 // 5-25 days
          }
        };
      }
      return progressData;
    },
    enabled: users.length > 0,
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/user-plans', data);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      setDialogOpen(false);
      const isNutrition = dialogType === 'nutrition';
      const successMessage = isNutrition ? t('nutritionPlanCreatedSuccess') : t('workoutPlanCreatedSuccess');
      toast({ title: successMessage });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || t('failedToCreatePlan');
      toast({ 
        title: t('failedToCreatePlan'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Create workout mutation
  const createWorkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/user-workouts', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-workouts'] });
      setDialogOpen(false);
      toast({ title: t('workoutPlanCreatedSuccess') });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || t('failedToCreatePlan');
      toast({ 
        title: t('failedToCreatePlan'),
        description: errorMessage,
        variant: "destructive"
      });
    }
  });





  // Update plan mutation
  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, updateData }: { planId: number, updateData: any }) => {
      try {
        const response = await apiRequest('PATCH', `/api/user-plans/${planId}`, updateData);

        // Check if response is valid
        if (!response || typeof response.json !== 'function') {
          throw new Error('Invalid response received from server');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Update failed' }));
          throw new Error(errorData.message || 'Failed to update plan');
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Update plan error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure fresh data across all pages
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans', selectedUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] }); // Profile page query
      queryClient.invalidateQueries({ queryKey: ['/api/user-workouts'] }); // Profile & Workouts page query
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUser?.id] }); // User data query
      queryClient.invalidateQueries({ queryKey: ['/api/workouts'] }); // All workouts data
      queryClient.invalidateQueries({ queryKey: ['/api/daily-stats'] }); // Daily stats for nutrition/dashboard

      // Force refetch to get the latest data immediately across all user interfaces
      queryClient.refetchQueries({ queryKey: ['/api/user-plans', selectedUser?.id] });
      queryClient.refetchQueries({ queryKey: ['/api/user-plans', { latest: true }] });
      queryClient.refetchQueries({ queryKey: ['/api/user-workouts'] });
      queryClient.refetchQueries({ queryKey: ['/api/users', selectedUser?.id] });
      queryClient.refetchQueries({ queryKey: ['/api/daily-stats'] }); // Refresh daily stats

      setEditingPlan(null);
      setIsEditing(false);
      setDialogOpen(false);
      const isNutrition = dialogType === 'nutrition';
      const successMessage = isNutrition ? t('nutritionPlanUpdatedSuccess') : t('workoutPlanUpdatedSuccess');
      toast({ title: successMessage });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdatePlan'), 
        description: error.message || t('failedToUpdatePlan'),
        variant: "destructive" 
      });
    }
  });

  // Delete plan mutation (admin can delete any plan)
  const deletePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const res = await apiRequest('DELETE', `/api/user-plans/${planId}`);
      if (res.status === 204) return { success: true };
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Failed to delete plan');
      return body;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', selectedUser?.id] });
      await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
      toast({ title: t('planDeletedSuccess') });
    },
    onError: (e: any) => {
      toast({ title: t('planDeleteFailed'), description: e?.message || t('pleaseTryAgain'), variant: 'destructive' });
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const normalizedEmail = String(userData.email || '').trim().toLowerCase();
      const normalizedUsername = String(userData.username || '').trim() || normalizedEmail;
      let payload: any;
      
      if (userData.role === 'user') {
        // For regular users, include all required fields with defaults
        payload = {
          ...userData,
          username: normalizedUsername,
          email: normalizedEmail,
          whatsappWithCode: userData.whatsappWithCode ? userData.whatsappWithCode.replace(/[^0-9]/g, '') : '201234567890',
          city: userData.city || 'Unknown',
          country: userData.country || 'Unknown',
          gender: userData.gender || 'male',
          religion: userData.religion || 'muslim',
          height: userData.height || 170,
          age: userData.age || 25,
          weight: userData.weight || 70,
          howFoundUs: userData.howFoundUs || 'instagram'
        };
      } else {
        // For coaches, gyms, and admins, only send required fields
        payload = {
          username: normalizedUsername,
          email: normalizedEmail,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          whatsappWithCode: userData.whatsappWithCode ? userData.whatsappWithCode.replace(/[^0-9]/g, '') : undefined
        };
      }
      
      const response = await apiRequest('POST', '/api/users', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', { role: 'coach', pending: 'true' }] });
      setUserDialogOpen(false);
      setUserFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        whatsappWithCode: '',
        role: 'user',
        city: '',
        country: '',
        gender: 'male' as 'male' | 'female',
        religion: 'muslim' as 'muslim' | 'christian',
        height: 170,
        age: 25,
        weight: 70,
        howFoundUs: 'instagram' as 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'whatsapp'
      });
      toast({ title: t('userCreatedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToCreateUser'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('DELETE', `/api/users/${userId}`);
      // 204 No Content response doesn't have a body to parse
      if (response.status === 204) {
        return { success: true };
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      if (selectedUser?.id === userToDelete?.id) {
        setSelectedUser(null);
      }
      toast({ title: t('userDeletedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToDeleteUser'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: number, userData: any }) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}`, userData);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditUserDialogOpen(false);
      setEditingUser(null);
      setEditUserFormData({
        firstName: '',
        lastName: '',
        email: '',
        whatsappWithCode: ''
      });
      // Update selected user if it's the one being edited
      if (selectedUser?.id === updatedUser.id) {
        setSelectedUser(updatedUser);
      }
      toast({ title: t('userUpdatedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateUser'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Update subscription mutation
  const updateSubscriptionMutation = useMutation({
    mutationFn: ({ userId, subscriptionData }: { userId: number, subscriptionData: any }) => 
      fetch(`/api/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionData)
      }).then(res => {
        if (!res.ok) {
          return res.json().then(err => Promise.reject(err));
        }
        return res.json();
      }),
    onSuccess: async (updatedUser) => {
      console.log('Subscription update successful:', updatedUser);

      // Update the selected user with the new subscription data
      if (updatedUser) {
        setSelectedUser(updatedUser);
        // Also update managing user if it matches
        if (managingUser?.id === updatedUser.id) {
          setManagingUser(updatedUser);
        }
        // Update form fields with new dates
        setSubscriptionType(updatedUser.subscriptionType || '');
        setSubscriptionStartDate(updatedUser.subscriptionStartDate 
          ? formatInAppTz(new Date(updatedUser.subscriptionStartDate), 'yyyy-MM-dd')
          : ''
        );
      }

      // Invalidate and refetch all related queries
      await queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/users', selectedUser?.id] });

      // Force immediate refetch to get updated status
      await queryClient.refetchQueries({ queryKey: ['/api/users'] });

      // Small delay to ensure UI updates properly
      setTimeout(() => {
        if (updatedUser && selectedUser?.id === updatedUser.id) {
          setSelectedUser(updatedUser);
        }
      }, 100);

      toast({ title: t('subscriptionUpdatedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateSubscription'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number, role: string }) => {
      const response = await apiRequest('PATCH', `/api/users/${userId}`, { role });
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setRoleDialogOpen(false);
      setSelectedUserForRole(null);
      setNewRole('');
      // Update selected user if it's the one being updated
      if (selectedUser?.id === updatedUser.id) {
        setSelectedUser(updatedUser);
      }
      toast({ title: t('roleUpdatedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateRole'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Assign coach mutation (admin picks coach; coach claims trainee via dedicated endpoint)
  const assignCoachMutation = useMutation({
    mutationFn: async ({ userId, coachId }: { userId: number, coachId: string | null }) => {
      const isCoachSelfClaim = user?.role === 'coach' && coachId === user?.id?.toString();
      const body = isCoachSelfClaim
        ? {}
        : { coachId: coachId ? parseInt(coachId) : null };
      const response = await apiRequest('PATCH', `/api/coach/users/${userId}/assign`, body);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || t('failedToAssignCoach'));
      }
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/my-users'] });
      setCoachAssignDialogOpen(false);
      setSelectedUserForCoach(null);
      setSelectedCoachId('');
      // Update selected user if it's the one being assigned
      if (selectedUser?.id === updatedUser.id) {
        setSelectedUser(updatedUser);
      }
      toast({ title: t('coachAssignedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToAssignCoach'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Fetch pending coaches (admin only)
  const { data: pendingCoaches = [], isLoading: pendingCoachesLoading } = useQuery<User[]>({
    queryKey: ['/api/users', { role: 'coach', pending: 'true' }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users?role=coach&pending=true');
      return await response.json();
    },
    enabled: isPlatformAdminRole(user?.role),
  });

  // Approve/reject coach mutation (admin only)
  const approveCoachMutation = useMutation({
    mutationFn: async ({ coachId, isApproved }: { coachId: number, isApproved: boolean }) => {
      const response = await apiRequest('PATCH', `/api/admin/coaches/${coachId}/approval`, { isApproved });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', { role: 'coach', pending: 'true' }] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ 
        title: "Success", 
        description: t('coachApprovalStatusUpdated')
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error",
        description: error.message || t('failedToUpdateCoachApproval'),
        variant: "destructive" 
      });
    }
  });

  // Fetch affiliate products (admin only)
  const { data: affiliateProducts = [], isLoading: affiliateProductsLoading } = useQuery<AffiliateProduct[]>({
    queryKey: ['/api/admin/affiliate-products'],
    enabled: isPlatformAdminRole(user?.role),
  });

  // Create affiliate product mutation
  const createAffiliateProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/admin/affiliate-products', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/affiliate-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-products'] });
      setAffiliateDialogOpen(false);
      setAffiliateFormData({
        title: '',
        url: '',
        description: '',
        thumbnailUrl: '',
        category: '',
        source: '',
        isActive: true
      });
      toast({ title: t('affiliateProductCreatedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToCreateAffiliateProduct'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Update affiliate product mutation
  const updateAffiliateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await apiRequest('PATCH', `/api/admin/affiliate-products/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/affiliate-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-products'] });
      setAffiliateDialogOpen(false);
      setEditingAffiliate(null);
      setAffiliateFormData({
        title: '',
        url: '',
        description: '',
        thumbnailUrl: '',
        category: '',
        source: '',
        isActive: true
      });
      toast({ title: t('affiliateProductUpdatedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateAffiliateProduct'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Delete affiliate product mutation
  const deleteAffiliateProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/admin/affiliate-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/affiliate-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-products'] });
      toast({ title: t('affiliateProductDeletedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToDeleteAffiliateProduct'), 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Affiliate categories queries and mutations
  const { data: affiliateCategories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/affiliate-categories'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/affiliate-categories');
      const data = await response.json();
      return data;
    }
  });

  const normalizeCategoryPayload = (data: typeof categoryFormData) => ({
    ...data,
    displayOrder: data.displayOrder === '' ? 0 : Number(data.displayOrder) || 0,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryFormData) => {
      const response = await apiRequest('POST', '/api/admin/affiliate-categories', normalizeCategoryPayload(data));
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-categories/active'] });
      toast({ title: t('categoryCreatedSuccess') });
      setCategoryDialogOpen(false);
      setCategoryFormData({ nameEn: '', nameAr: '', slug: '', isActive: true, displayOrder: '' });
      setEditingCategory(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create category", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: typeof categoryFormData }) => {
      const response = await apiRequest('PATCH', `/api/admin/affiliate-categories/${id}`, normalizeCategoryPayload(data));
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-categories/active'] });
      toast({ title: t('categoryUpdatedSuccess') });
      setCategoryDialogOpen(false);
      setCategoryFormData({ nameEn: '', nameAr: '', slug: '', isActive: true, displayOrder: '' });
      setEditingCategory(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update category", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/admin/affiliate-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/affiliate-categories/active'] });
      toast({ title: t('categoryDeletedSuccess') });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete category", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  // Fetch shop products (products table)
  const { data: shopProducts = [], isLoading: shopProductsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Create shop product mutation
  const createShopProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/products', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setShopProductDialogOpen(false);
      setShopProductFormData({
        name: '',
        description: '',
        price: 0,
        imageUrl: '',
        category: '',
        rating: 0,
        reviewCount: 0,
        stock: 0
      });
      toast({ title: t('productCreatedSuccess') || "Shop product created successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToCreateProduct') || "Failed to create product", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  // Update shop product mutation
  const updateShopProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await apiRequest('PATCH', `/api/products/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setShopProductDialogOpen(false);
      setEditingShopProduct(null);
      setShopProductFormData({
        name: '',
        description: '',
        price: 0,
        imageUrl: '',
        category: '',
        rating: 0,
        reviewCount: 0,
        stock: 0
      });
      toast({ title: t('productUpdatedSuccess') || "Shop product updated successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateProduct') || "Failed to update product", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  // Delete shop product mutation
  const deleteShopProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: t('productDeletedSuccess') || "Shop product deleted successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToDeleteProduct') || "Failed to delete product", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });

  // Fetch all coach products (coach_products table) - for viewing
  const { data: allCoachProducts = [], isLoading: coachProductsLoading } = useQuery<CoachProduct[]>({
    queryKey: ['/api/admin/coach-products'],
    enabled: isPlatformAdminRole(user?.role),
  });

  // Update coach product mutation
  const updateCoachProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await apiRequest('PATCH', `/api/coach/products/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coach-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/products'] });
      setCoachProductDialogOpen(false);
      setEditingCoachProduct(null);
      setCoachProductFormData({ title: '', url: '', description: '', thumbnailUrl: '' });
      toast({ title: t('coachProductUpdatedSuccess') || 'Coach product updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateCoachProduct') || 'Failed to update product', 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  // Delete coach product mutation
  const deleteCoachProductMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/coach/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coach-products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/coach/products'] });
      toast({ title: t('coachProductDeletedSuccess') || 'Coach product deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToDeleteCoachProduct') || 'Failed to delete product', 
        description: error.message || t('pleaseTryAgain'),
        variant: "destructive" 
      });
    }
  });

  const updateTrackingSettingsMutation = useMutation({
    mutationFn: async (payload: Record<string, string | null>) => {
      const response = await apiRequest('PUT', '/api/admin/tracking-settings', payload);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update tracking settings');
      }
      return data;
    },
    onSuccess: (data) => {
      setTrackingForm({
        metaPixelId: data.metaPixelId ?? '',
        metaPixelAccessToken: data.metaPixelAccessToken ?? '',
        metaPixelTestEventCode: data.metaPixelTestEventCode ?? '',
        googleAdsConversionId: data.googleAdsConversionId ?? '',
        googleAdsConversionLabel: data.googleAdsConversionLabel ?? '',
        googleAdsSendTo: data.googleAdsSendTo ?? '',
        googleAnalyticsMeasurementId: data.googleAnalyticsMeasurementId ?? '',
        googleAnalyticsApiSecret: data.googleAnalyticsApiSecret ?? '',
        googleAnalyticsStreamId: data.googleAnalyticsStreamId ?? '',
        googleAnalyticsPropertyId: data.googleAnalyticsPropertyId ?? '',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tracking-settings'] });
      toast({ title: t('trackingSettingsUpdatedSuccess') });
    },
    onError: (error: any) => {
      toast({
        title: t('failedToUpdateTrackingSettings'),
        description: error?.message || t('pleaseTryAgain'),
        variant: 'destructive'
      });
    }
  });

  const handleCreatePlan = (formData: FormData) => {
    const planData = {
      userId: selectedUser.id,
      coachId: (user as any)?.id, // Use current user's ID as coach
      title: formData.get('title'),
      description: formData.get('description'),
      weeklyFocus: formData.get('weeklyFocus'),
      goals: {
        calories: formData.get('calories'),
        protein: formData.get('protein'),
        carbs: formData.get('carbs'),
        fat: formData.get('fat')
      }
    };
    createPlanMutation.mutate(planData);
  };

  const handleCreateWorkout = (formData: FormData) => {
    const workoutData = {
      userId: selectedUser.id,
      workoutId: parseInt(formData.get('workoutId') as string),
      scheduledFor: new Date(formData.get('scheduledFor') as string),
      completed: false
    };
    createWorkoutMutation.mutate(workoutData);
  };

  // User management handlers
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.email || !userFormData.password) {
      const errorMsg = language === 'ar' 
        ? "يرجى ملء جميع الحقول المطلوبة (البريد الإلكتروني وكلمة المرور)" 
        : "Please fill all required fields (email and password)";
      toast({ title: errorMsg, variant: "destructive" });
      return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userFormData.email)) {
      const errorMsg = language === 'ar'
        ? "البريد الإلكتروني غير صحيح"
        : "Invalid email format";
      toast({ title: errorMsg, variant: "destructive" });
      return;
    }
    // Validate phone number format if provided (should start with country code, 8-15 digits)
    if (userFormData.whatsappWithCode) {
      const phoneRegex = /^[1-9]\d{7,14}$/;
      if (!phoneRegex.test(userFormData.whatsappWithCode)) {
        const errorMsg = language === 'ar'
          ? "رقم الهاتف يجب أن يبدأ بكود الدولة ويكون من 8-15 رقم (مثال: 201234567890)"
          : "Phone number must start with country code and be 8-15 digits (e.g., 201234567890)";
        toast({ title: errorMsg, variant: "destructive" });
        return;
      }
    }
    createUserMutation.mutate(userFormData);
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditUserFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      whatsappWithCode: user.whatsappWithCode || ''
    });
    setEditUserDialogOpen(true);
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserFormData.firstName || !editUserFormData.lastName) {
      const errorMsg = language === 'ar' 
        ? "يرجى ملء جميع الحقول المطلوبة" 
        : undefined;
      if (errorMsg) {
        toast({ title: errorMsg, variant: "destructive" });
      }
      return;
    }
    editUserMutation.mutate({
      userId: editingUser.id,
      userData: {
        firstName: editUserFormData.firstName,
        lastName: editUserFormData.lastName,
        whatsappWithCode: editUserFormData.whatsappWithCode
      }
    });
  };

  const openDialog = (type: 'workout' | 'nutrition') => {
    if (!selectedUser) {
      toast({ title: "Please select a user first", variant: "destructive" });
      return;
    }
    setDialogType(type);
    setDialogOpen(true);
  };

  // Initialize subscription form when user is selected
  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    setSubscriptionType(user.subscriptionType || '');
    setSubscriptionStartDate(user.subscriptionStartDate 
      ? formatInAppTz(new Date(user.subscriptionStartDate), 'yyyy-MM-dd')
      : ''
    );
  };

  const handleSubscriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionType) {
      toast({ 
        title: "Please enter a subscription duration", 
        variant: "destructive" 
      });
      return;
    }

    // Validate the subscription type format
    const match = subscriptionType.match(/^(\d+(?:\.\d+)?)(?:_months?)?$/);
    if (!match) {
      toast({ 
        title: "Invalid subscription format", 
        description: "Please enter a valid duration like 1.5_months or 12_months",
        variant: "destructive" 
      });
      return;
    }

    const subscriptionData = {
      subscriptionType,
      subscriptionStartDate: subscriptionStartDate || undefined
    };

    updateSubscriptionMutation.mutate({ 
      userId: selectedUser.id, 
      subscriptionData 
    });
  };


  // Role assignment handlers
  const handleAssignRole = (user: any) => {
    setSelectedUserForRole(user);
    setNewRole(user.role || 'user');
    setRoleDialogOpen(true);
  };

  const handleRoleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole || !newRole) {
      toast({ title: t('pleaseSelectRole'), variant: "destructive" });
      return;
    }
    updateUserRoleMutation.mutate({
      userId: selectedUserForRole.id,
      role: newRole
    });
  };

  // Coach assignment handlers
  const handleAssignCoach = (user: any) => {
    const role = user?.role;
    if (role && role !== 'user' && role !== 'visitor' && role !== 'guest') {
      toast({
        title: t('error'),
        description: t('assignCoachNotAllowedForRole'),
        variant: 'destructive',
      });
      return;
    }
    setSelectedUserForCoach(user);
    setSelectedCoachId(user.coachId ? user.coachId.toString() : 'UNASSIGN');
    setCoachAssignDialogOpen(true);
  };

  const handleCoachAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCoach) {
      toast({ title: t('noUserSelected'), variant: "destructive" });
      return;
    }
    assignCoachMutation.mutate({
      userId: selectedUserForCoach.id,
      coachId: selectedCoachId === "UNASSIGN" ? null : selectedCoachId
    });
  };

  // Affiliate products handlers
  const handleEditAffiliate = (affiliate: AffiliateProduct) => {
    setEditingAffiliate(affiliate);
    setAffiliateFormData({
      title: affiliate.title,
      url: affiliate.url,
      description: affiliate.description || '',
      thumbnailUrl: affiliate.thumbnailUrl || '',
      category: affiliate.category || '',
      source: affiliate.source || '',
      isActive: affiliate.isActive ?? true
    });
    setAffiliateDialogOpen(true);
  };

  const handleAffiliateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingAffiliate) {
      updateAffiliateProductMutation.mutate({
        id: editingAffiliate.id,
        data: affiliateFormData
      });
    } else {
      createAffiliateProductMutation.mutate(affiliateFormData);
    }
  };

  const handleDeleteAffiliate = (id: number) => {
    setConfirmDialog({
      open: true,
      message: t('confirmDeleteAffiliateProduct'),
      onConfirm: () => deleteAffiliateProductMutation.mutate(id)
    });
  };

  // Category handlers
  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setCategoryFormData({
      nameEn: category.nameEn,
      nameAr: category.nameAr,
      slug: category.slug,
      isActive: category.isActive ?? true,
      displayOrder: category.displayOrder ?? ''
    });
    setCategoryDialogOpen(true);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: categoryFormData
      });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const handleDeleteCategory = (id: number) => {
    setConfirmDialog({
      open: true,
      message: t('confirmDeleteCategory'),
      onConfirm: () => deleteCategoryMutation.mutate(id)
    });
  };

  // Shop products handlers
  const handleEditShopProduct = (product: Product) => {
    setEditingShopProduct(product);
    setShopProductFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl || '',
      category: product.category,
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      stock: product.stock
    });
    setShopProductDialogOpen(true);
  };

  const handleShopProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { name, description, category, price, stock } = shopProductFormData;
    if (!name.trim() || !description.trim() || !category.trim()) {
      toast({
        title: t('error'),
        description: t('fillAllRequiredFields'),
        variant: 'destructive',
      });
      return;
    }
    if (!price || price <= 0) {
      toast({
        title: t('error'),
        description: t('priceMustBeGreaterThanZero'),
        variant: 'destructive',
      });
      return;
    }
    if (!stock || stock <= 0) {
      toast({
        title: t('error'),
        description: t('stockMustBeGreaterThanZero'),
        variant: 'destructive',
      });
      return;
    }
    
    if (editingShopProduct) {
      updateShopProductMutation.mutate({
        id: editingShopProduct.id,
        data: shopProductFormData
      });
    } else {
      createShopProductMutation.mutate(shopProductFormData);
    }
  };

  const handleDeleteShopProduct = (id: number) => {
    setConfirmDialog({
      open: true,
      message: t('confirmDeleteProduct'),
      onConfirm: () => deleteShopProductMutation.mutate(id)
    });
  };

  const handleTrackingInputChange = (field: keyof TrackingFormState, value: string) => {
    setTrackingForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetTrackingFormFromServer = () => {
    if (!trackingSettings) return;
    setTrackingForm({
      metaPixelId: trackingSettings.metaPixelId ?? '',
      metaPixelAccessToken: trackingSettings.metaPixelAccessToken ?? '',
      metaPixelTestEventCode: trackingSettings.metaPixelTestEventCode ?? '',
      googleAdsConversionId: trackingSettings.googleAdsConversionId ?? '',
      googleAdsConversionLabel: trackingSettings.googleAdsConversionLabel ?? '',
      googleAdsSendTo: trackingSettings.googleAdsSendTo ?? '',
      googleAnalyticsMeasurementId: trackingSettings.googleAnalyticsMeasurementId ?? '',
      googleAnalyticsApiSecret: trackingSettings.googleAnalyticsApiSecret ?? '',
      googleAnalyticsStreamId: trackingSettings.googleAnalyticsStreamId ?? '',
      googleAnalyticsPropertyId: trackingSettings.googleAnalyticsPropertyId ?? '',
    });
  };

  const handleTrackingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPayload = Object.fromEntries(
      Object.entries(trackingForm).map(([key, value]) => {
        const trimmed = value.trim();
        return [key, trimmed.length === 0 ? null : trimmed];
      })
    ) as Record<string, string | null>;

    updateTrackingSettingsMutation.mutate(normalizedPayload);
  };

  return (
    <div className="admin-dashboard p-6 space-y-6 relative min-h-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <AnimatedBackground />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('adminDashboardTitle')}</h1>
          <p className="text-gray-600">{t('adminDashboardSubtitle')}</p>
        </div>
      </div>

      {/* Ad Banners */}
      <AdBanner />

      {/* Main Dashboard Tabs */}
      <SwipeableTabs defaultValue="users" className="space-y-6">
        <SwipeableTabsList
          className={`admin-tabs-list w-full flex flex-wrap gap-2 overflow-visible ${language === 'ar' ? 'justify-start md:justify-start' : 'justify-start md:justify-center'}`}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <SwipeableTabsTrigger value="users" className="admin-tabs-trigger whitespace-normal text-center">{t('userManagement')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="coach-approval" className="admin-tabs-trigger whitespace-normal text-center">{t('coachApproval')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="store" className="admin-tabs-trigger whitespace-normal text-center">{t('storeSettings')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="analytics" className="admin-tabs-trigger whitespace-normal text-center">{t('analytics')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="tracking" className="admin-tabs-trigger whitespace-normal text-center">{t('trackingAndAdsTab')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="aiSettings" className="admin-tabs-trigger whitespace-normal text-center">{t('aiSettings') || 'AI Settings'}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="payment" className="admin-tabs-trigger whitespace-normal text-center">{t('paymentSettings')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="email-settings" className="admin-tabs-trigger whitespace-normal text-center">{language === 'ar' ? 'إعدادات البريد الإلكتروني' : 'Email Settings'}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="credits" className="admin-tabs-trigger whitespace-normal text-center">{t('creditsTab')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="seo" className="admin-tabs-trigger whitespace-normal text-center">{t('seoSettingsTab')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="branding" className="admin-tabs-trigger whitespace-normal text-center">{t('brandingTab') || 'Branding'}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="public-content" className="admin-tabs-trigger whitespace-normal text-center">{language === 'ar' ? 'المحتوى العام' : 'Public Content'}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="blog" className="admin-tabs-trigger whitespace-normal text-center">{t('blogPosts')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="community" className="admin-tabs-trigger whitespace-normal text-center">{t('communityTitle')}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="technical-issues" className="admin-tabs-trigger whitespace-normal text-center">{t('technicalIssuesTab')}</SwipeableTabsTrigger>
          {showTenantManagement && (
            <SwipeableTabsTrigger value="tenants" className="admin-tabs-trigger whitespace-normal text-center">{t('tenantManagement')}</SwipeableTabsTrigger>
          )}
        </SwipeableTabsList>

        <SwipeableTabsContent value="users" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div>
            {/* Full-Width Users Table */}
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div>
                    <CardTitle className="flex items-center text-gray-900">
                      <Users className="w-5 h-5 mr-2" />
                      {t('usersLabel')}
                    </CardTitle>
                    <CardDescription className="text-gray-600">{t('selectUserManagePlans')}</CardDescription>
                  </div>
                  <Button 
                    onClick={() => setUserDialogOpen(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t('addUser')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search Bar */}
                <div className="mb-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder={t('searchByNamePhone')}
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-10"
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="admin-filters mb-4 space-y-3" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-1">
                      <Filter className="w-4 h-4" />
                      {t('filters')}
                    </Label>
                    {(userFilters.status.length > 0 || userFilters.subscription.length > 0 ||
                      userFilters.planStatus.length > 0 ||
                      userFilters.role.length > 0 || userFilters.coachAssignment || userFilters.gymAssignment) && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setUserFilters({
                          status: [],
                          subscription: [],
                          planStatus: [],
                          role: [],
                          coachAssignment: '',
                          gymAssignment: ''
                        })}
                        className="h-7 text-xs"
                      >
                        {t('clearAll')}
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Status Filter */}
                    <div className="space-y-1">
                      <div className="font-medium text-gray-700">{t('status')}</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={userFilters.status.includes('active') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              status: prev.status.includes('active')
                                ? prev.status.filter(s => s !== 'active')
                                : [...prev.status, 'active']
                            }));
                          }}
                        >
                            {t('responsiveStatus')}
                        </Badge>
                        <Badge
                          variant={userFilters.status.includes('inactive') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              status: prev.status.includes('inactive')
                                ? prev.status.filter(s => s !== 'inactive')
                                : [...prev.status, 'inactive']
                            }));
                          }}
                        >
                            {t('idleStatus')}
                        </Badge>
                      </div>
                    </div>

                    {/* Subscription Filter */}
                    <div className="space-y-1">
                      <div className="font-medium text-gray-700">{t('subscriptionLabel')}</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={userFilters.subscription.includes('active_subscription') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              subscription: prev.subscription.includes('active_subscription')
                                ? prev.subscription.filter(s => s !== 'active_subscription')
                                : [...prev.subscription, 'active_subscription']
                            }));
                          }}
                        >
                            {t('active')}
                        </Badge>
                        <Badge
                          variant={userFilters.subscription.includes('expired_subscription') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              subscription: prev.subscription.includes('expired_subscription')
                                ? prev.subscription.filter(s => s !== 'expired_subscription')
                                : [...prev.subscription, 'expired_subscription']
                            }));
                          }}
                        >
                            {t('expired')}
                        </Badge>
                        <Badge
                          variant={userFilters.subscription.includes('suspended_subscription') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              subscription: prev.subscription.includes('suspended_subscription')
                                ? prev.subscription.filter(s => s !== 'suspended_subscription')
                                : [...prev.subscription, 'suspended_subscription']
                            }));
                          }}
                        >
                            {t('suspended')}
                        </Badge>
                      </div>
                    </div>

                    {/* Plan Status Filter */}
                    <div className="space-y-1">
                      <div className="font-medium text-gray-700">{t('plans')}</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={userFilters.planStatus.includes('with_plans') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              planStatus: prev.planStatus.includes('with_plans')
                                ? prev.planStatus.filter(p => p !== 'with_plans')
                                : [...prev.planStatus, 'with_plans']
                            }));
                          }}
                        >
                            {t('withPlans')}
                        </Badge>
                        <Badge
                          variant={userFilters.planStatus.includes('without_plans') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              planStatus: prev.planStatus.includes('without_plans')
                                ? prev.planStatus.filter(p => p !== 'without_plans')
                                : [...prev.planStatus, 'without_plans']
                            }));
                          }}
                        >
                            {t('withoutPlans')}
                        </Badge>
                      </div>
                    </div>

                    {/* Role Filter */}
                    <div className="space-y-1">
                      <div className="font-medium text-gray-700">{t('role')}</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={userFilters.role.includes('admin') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              role: prev.role.includes('admin')
                                ? prev.role.filter(r => r !== 'admin')
                                : [...prev.role, 'admin']
                            }));
                          }}
                        >
                            {t('adminRole')}
                        </Badge>
                        <Badge
                          variant={userFilters.role.includes('super_admin') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              role: prev.role.includes('super_admin')
                                ? prev.role.filter(r => r !== 'super_admin')
                                : [...prev.role, 'super_admin']
                            }));
                          }}
                        >
                            {t('superAdminRole')}
                        </Badge>
                        <Badge
                          variant={userFilters.role.includes('coach') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              role: prev.role.includes('coach')
                                ? prev.role.filter(r => r !== 'coach')
                                : [...prev.role, 'coach']
                            }));
                          }}
                        >
                            {t('coachRole')}
                        </Badge>
                        <Badge
                          variant={userFilters.role.includes('user') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              role: prev.role.includes('user')
                                ? prev.role.filter(r => r !== 'user')
                                : [...prev.role, 'user']
                            }));
                          }}
                        >
                            {t('userRole')}
                        </Badge>
                        <Badge
                          variant={userFilters.role.includes('gym') ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setUserFilters(prev => ({
                              ...prev,
                              role: prev.role.includes('gym')
                                ? prev.role.filter(r => r !== 'gym')
                                : [...prev.role, 'gym']
                            }));
                          }}
                        >
                            {t('gymRole')}
                        </Badge>
                      </div>
                    </div>

                    {/* Coach Assignment Filter */}
                    <div className="space-y-1">
                      <div className="font-medium text-gray-700">{t('assignedToCoach')}</div>
                      <Select
                        value={userFilters.coachAssignment || "all"}
                        onValueChange={(value) => {
                          setUserFilters(prev => ({
                            ...prev,
                            coachAssignment: value === "all" ? '' : value
                          }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t('allUsers')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allUsers')}</SelectItem>
                          <SelectItem value="unassigned">{t('unassignedUsers')}</SelectItem>
                          {coaches.filter(c => c.isApproved).map((coach) => (
                            <SelectItem key={coach.id} value={coach.id.toString()}>
                              {coach.firstName} {coach.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Gym Assignment Filter */}
                    <div className="space-y-1">
                      <div className="font-medium text-gray-700">{t('assignedToGym')}</div>
                      <Select
                        value={userFilters.gymAssignment || "all"}
                        onValueChange={(value) => {
                          setUserFilters(prev => ({
                            ...prev,
                            gymAssignment: value === "all" ? '' : value
                          }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t('allUsers')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allUsers')}</SelectItem>
                          <SelectItem value="unassigned">{t('unassignedUsers')}</SelectItem>
                          {gyms.map((gym) => (
                            <SelectItem key={gym.id} value={gym.id.toString()}>
                              {gym.firstName} {gym.lastName} (ID: {gym.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {usersLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      // For coaches: show assigned users by default; when searching by phone number show exact match results to add new trainees
                      if (user?.role === 'coach') {
                        const myAssignedUsers = users.filter((u: any) => u.coachId === user.id && u.role !== 'coach' && u.role !== 'admin');

                        // If no search query, list assigned users
                        if (!userSearchQuery) {
                          if (myAssignedUsers.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>{t('noAssignedTrainees')}</p>
                                <p className="text-xs mt-1">{t('useSearchToAddTrainee')}</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              <div className="text-sm text-gray-500 mb-2">
                                {t('myTrainees')} ({myAssignedUsers.length})
                              </div>
                              {myAssignedUsers.map((assigned: any) => {
                                const userProgress = usersProgress[assigned.id];
                                const progressSummary = userProgress?.progressSummary || {
                                  weightProgress: 0,
                                  calorieGoalProgress: 0,
                                  workoutProgress: 0,
                                  totalDaysTracked: 0
                                };

                                return (
                                  <div
                                    key={assigned.id}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      selectedUser?.id === assigned.id
                                        ? 'bg-blue-50 border-blue-200'
                                        : 'hover:bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex-1 cursor-pointer" onClick={() => handleUserSelect(assigned)}>
                                        <div className="font-medium text-gray-900">{assigned.firstName} {assigned.lastName}</div>
                                        {/* Email removed */}
                                        {assigned.whatsappWithCode && (
                                          <div className="text-sm text-gray-500">📞 {assigned.whatsappWithCode}</div>
                                        )}
                                      </div>
                                      {/* Actions: inline on md+, dropdown on mobile */}
                                      <div className="hidden sm:flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDetailViewUser(assigned);
                                            setDetailViewOpen(true);
                                          }}
                                          className="text-green-500 hover:text-green-700 hover:bg-green-50"
                                          title="View Details"
                                        >
                                          <Eye className="w-4 h-4" />
                                          <span>{t('viewDetails') || t('view') || 'View'}</span>
                                        </Button>
                                      </div>
                                      <div className="sm:hidden">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
                                              <MoreVertical className="h-4 w-4" />
                                              <span>{t('columnActions') || 'Actions'}</span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailViewUser(assigned);
                                                setDetailViewOpen(true);
                                              }}
                                            >
                                              <Eye className="h-4 w-4 mr-2" /> {t('viewDetails') || t('view') || 'View'}
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          );
                        }

                        // When searching: partial match for name or phone number
                        // Only show users assigned to this coach OR users with no coach assigned
                        const searchResults = users.filter((u: any) => {
                          // Skip coaches and platform admins
                          if (u.role === 'coach' || u.role === 'admin' || u.role === 'super_admin') return false;
                          
                          // Only include users assigned to this coach or users with no coach
                          const isAssignedToMe = u.coachId === user.id;
                          const hasNoCoach = !u.coachId;
                          if (!isAssignedToMe && !hasNoCoach) return false;
                          
                          // Apply search filter
                          const query = userSearchQuery.toLowerCase();
                          const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
                          const contactLower = (u.whatsappWithCode || '').toLowerCase();
                          return fullName.includes(query) || contactLower.includes(query);
                        });

                        if (searchResults.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>{t('noUserFoundMatching')} "{userSearchQuery}"</p>
                              <p className="text-xs mt-1">{t('trySearchNamePhone')}</p>
                            </div>
                          );
                        }

                        return (
                          <>
                            <div className="text-sm text-green-600 mb-2 font-medium">
                              {t('foundUsers')} {searchResults.length}
                            </div>
                            {searchResults.map((foundUser: any) => {
                              const userProgress = usersProgress[foundUser.id];
                              const progressSummary = userProgress?.progressSummary || {
                                weightProgress: 0,
                                calorieGoalProgress: 0,
                                workoutProgress: 0,
                                totalDaysTracked: 0
                              };

                              return (
                                <div
                                  key={foundUser.id}
                                  className={`p-3 rounded-lg border transition-colors ${
                                    selectedUser?.id === foundUser.id
                                      ? 'bg-blue-50 border-blue-200'
                                      : 'hover:bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 cursor-pointer" onClick={() => handleUserSelect(foundUser)}>
                                      <div className="font-medium text-gray-900">{foundUser.firstName} {foundUser.lastName}</div>
                                      {/* Email removed */}
                                      {foundUser.whatsappWithCode && (
                                        <div className="text-sm text-gray-500">📞 {foundUser.whatsappWithCode}</div>
                                      )}
                                      {foundUser.coachId && foundUser.coachId !== user?.id && (
                                        <div className="text-xs text-orange-600 mt-1">
                                          Already has coach: {coaches.find(c => c.id === foundUser.coachId)?.firstName || 'Unknown'}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDetailViewUser(foundUser);
                                          setDetailViewOpen(true);
                                        }}
                                        className="text-green-500 hover:text-green-700 hover:bg-green-50"
                                        title="View Details"
                                      >
                                        <Eye className="w-4 h-4" />
                                        <span>{t('viewDetails') || t('view') || 'View'}</span>
                                      </Button>
                                      {!foundUser.coachId && (
                                        <Button
                                          variant="ghost" 
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            assignCoachMutation.mutate({
                                              userId: foundUser.id,
                                              coachId: user?.id?.toString()
                                            });
                                          }}
                                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                          title={t('assignSelfAsCoach')}
                                          disabled={assignCoachMutation.isPending}
                                        >
                                          <UserCog className="w-4 h-4" />
                                          <span>{t('assignSelfAsCoach')}</span>
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      }

                      // For admins: use new table component
                      return (
                        <AdminUsersTable
                          users={users}
                          isLoading={usersLoading}
                          paginationInfo={paginationInfo}
                          currentPage={currentPage}
                          onPageChange={setCurrentPage}
                          onSelectUser={(user) => {
                            setManagingUser(user);
                            setUserManagementOpen(true);
                            setSubscriptionType(user.subscriptionType || '');
                            setSubscriptionStartDate(user.subscriptionStartDate ? new Date(user.subscriptionStartDate).toISOString().slice(0,10) : '');
                          }}
                          onViewDetails={(user) => {
                            setDetailViewUser(user);
                            setDetailViewOpen(true);
                          }}
                          onAssignRole={handleAssignRole}
                          onAssignCoach={handleAssignCoach}
                          onEdit={handleEditUser}
                          onDelete={handleDeleteUser}
                          selectedUserId={managingUser?.id}
                          searchQuery={userSearchQuery}
                        />
                      );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
          </div>

        </SwipeableTabsContent>
        
        <SwipeableTabsContent value="aiSettings" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <AiSettingsAdmin />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="payment" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <PaymentSettingsAdmin />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="email-settings" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <EmailSettingsAdmin />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="credits" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <CreditBillingAdmin />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="seo" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <SeoSettingsPanel />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="branding" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <BrandingSettingsAdmin />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="public-content" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <PublicContentManager />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="blog" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <BlogManager mode="admin" />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="community" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <CommunityPanel />
        </SwipeableTabsContent>

        <SwipeableTabsContent value="technical-issues" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <TechnicalIssuesPanel />
        </SwipeableTabsContent>
        
        {showTenantManagement && (
          <SwipeableTabsContent value="tenants" className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <TenantManagementPanel />
          </SwipeableTabsContent>
        )}

        {/* User Management Dialog */}
        <Dialog open={userManagementOpen} onOpenChange={setUserManagementOpen}>
          <DialogContent 
            className="max-w-5xl max-h-[90vh] overflow-y-auto" 
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            {managingUser ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {t('manage')} {managingUser.firstName} {managingUser.lastName}
                  </DialogTitle>
                  <DialogDescription>
                    {t('manageUserNutritionWorkoutSubscription')}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="plans" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="plans">{t('nutritionPlans')}</TabsTrigger>
                  <TabsTrigger value="workouts">{t('workouts')}</TabsTrigger>
                  <TabsTrigger value="subscription">{t('subscription')}</TabsTrigger>
                </TabsList>

                {/* Nutrition Plans Tab */}
                <TabsContent value="plans">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <CardTitle>{t('nutritionPlans')} {t('for')} {managingUser.firstName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{t('nutritionPlansCoachOnly')}</p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {managingUserPlansLoading ? (
                        <div className="text-sm text-gray-500">{t('loadingNutritionPlan')}</div>
                      ) : (() => {
                        const nutritionPlans = managingUserPlans.filter((p: any) => {
                          const goals = p?.goals;
                          if (!goals) return false;
                          return goals.calories !== undefined || goals.protein !== undefined || 
                                 goals.carbs !== undefined || goals.fat !== undefined ||
                                 (Array.isArray(goals.meals) && goals.meals.length > 0);
                        });
                        const plan = nutritionPlans[0];
                        
                        return !plan ? (
                          <div className="text-sm text-gray-500">{t('noNutritionPlanAssigned')}</div>
                        ) : (
                          <div className="space-y-3">
                            <div className="border rounded p-3 bg-gray-50">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold break-words">{plan.title}</div>
                                  <div className="text-xs text-gray-500 break-words">{t('planId')}: {plan.id} · {t('created')} {plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</div>
                                  <div className="text-sm text-gray-600 mt-1 break-words">{plan.description}</div>
                                </div>
                              </div>

                              {plan?.goals && (
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="bg-white rounded border p-3">
                                    <div className="text-xs text-gray-500">{t('totalDailyCalories')}</div>
                                    <div className="text-lg font-semibold">{(plan.goals as any).calories ?? '—'}</div>
                                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                      <div><span className="text-xs text-gray-500">{t('protein')}</span><div className="font-medium">{(plan.goals as any).protein ?? '—'}g</div></div>
                                      <div><span className="text-xs text-gray-500">{t('carbs')}</span><div className="font-medium">{(plan.goals as any).carbs ?? '—'}g</div></div>
                                      <div><span className="text-xs text-gray-500">{t('fat')}</span><div className="font-medium">{(plan.goals as any).fat ?? '—'}g</div></div>
                                    </div>
                                  </div>
                                  <div className="bg-white rounded border p-3 md:col-span-2">
                                    <div className="font-medium mb-2">{t('exampleMeals')}</div>
                                    {(() => {
                                      const meals: string[] = Array.isArray((plan.goals as any).meals) ? (plan.goals as any).meals : [];
                                      const groups: Record<string, string[]> = {};
                                      for (const m of meals) {
                                        const parts = String(m).split(":");
                                        const key = parts[0]?.trim().toLowerCase() || 'meal';
                                        const rest = parts.slice(1).join(":").trim();
                                        if (!groups[key]) groups[key] = [];
                                        groups[key].push(rest || parts[0]);
                                      }
                                      const order = ['breakfast','lunch','dinner','snacks'];
                                      const keys = Object.keys(groups).sort((a,b)=>{
                                        const ia = order.indexOf(a); const ib = order.indexOf(b);
                                        if (ia === -1 && ib === -1) return a.localeCompare(b);
                                        if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
                                      });
                                      return keys.length ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          {keys.map(k => (
                                            <div key={k} className="border rounded p-2">
                                              <div className="text-sm font-semibold capitalize">{t(k)}</div>
                                              <ul className="mt-1 list-disc ml-5 text-sm">
                                                {groups[k].map((it, idx) => <li key={idx}>{it}</li>)}
                                              </ul>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-gray-500">{t('noMealsProvided')}</div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              )}

                              {Array.isArray((plan?.goals as any)?.tips) && (plan.goals as any).tips.length > 0 && (
                                <div className="mt-3 bg-white rounded border p-3">
                                  <div className="font-medium mb-2">{t('tipsAndRecommendations')}</div>
                                  <ul className="list-disc ml-5 text-sm">
                                    {(plan.goals as any).tips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Workouts Tab */}
                <TabsContent value="workouts">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <CardTitle>{t('workoutPlan')} {t('for')} {managingUser.firstName}</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedUser(managingUser);
                              setDialogType('workout');
                              setIsEditing(false);
                              setEditingPlan(null);
                              setDialogOpen(true);
                            }}
                            className="whitespace-nowrap"
                          >
                            <Plus className="w-4 h-4 sm:mr-1" /> <span>{t('add')}</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {managingUserPlansLoading ? (
                        <div className="text-sm text-gray-500">{t('loadingWorkoutPlan')}</div>
                      ) : (() => {
                        const workoutPlans = managingUserPlans.filter((p: any) => {
                          const schedule = p?.weeklySchedule;
                          if (!schedule) return false;
                          return schedule.workouts && Array.isArray(schedule.workouts) && schedule.workouts.length > 0;
                        });
                        const latestPlan = workoutPlans[0];
                        const workoutPlan = latestPlan?.weeklySchedule;
                        
                        return !workoutPlan ? (
                          <div className="text-sm text-gray-500">{t('noWorkoutPlanAssigned')}</div>
                        ) : (
                          <div className="space-y-3">
                            <div className="border rounded p-3 bg-gray-50">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold break-words">{latestPlan.title}</div>
                                  <div className="text-xs text-gray-500 break-words">{t('planId')}: {latestPlan.id} · {t('created')} {latestPlan.createdAt ? new Date(latestPlan.createdAt).toLocaleString() : '—'}</div>
                                  <div className="text-sm text-gray-600 mt-1 break-words">{latestPlan.description}</div>
                                </div>
                                <div className="flex gap-2 sm:flex-shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUser(managingUser);
                                      setDialogType('workout');
                                      setIsEditing(true);
                                      setEditingPlan(latestPlan);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4 sm:mr-1" /> <span>{t('edit')}</span>
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      setConfirmDialog({
                                        open: true,
                                        message: t('confirmDeletePlan'),
                                        onConfirm: () => deletePlanMutation.mutate(latestPlan.id)
                                      });
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 sm:mr-1" /> <span>{t('delete')}</span>
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-3 bg-blue-50 p-3 rounded">
                                <div className="font-medium">{t('focus')}</div>
                                <div className="text-sm">{(workoutPlan as any).focus}</div>
                                <div className="flex gap-4 text-sm mt-1 text-blue-700">
                                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{(latestPlan?.goals as any)?.workoutDays || 0} {t('daysPerWeek')}</span>
                                  <span className="flex items-center gap-1"><Activity className="h-4 w-4" />{managingUser.fitnessGoal || '—'}</span>
                                </div>
                              </div>
                              <div className="mt-3 space-y-2">
                                {(workoutPlan as any).workouts?.map((w: any, i: number) => (
                                  <div key={i} className="p-3 bg-white rounded border">
                                    <div className="flex justify-between">
                                      <div>
                                        <div className="font-medium">{w.day}</div>
                                        <div className="text-xs text-blue-700">{w.type}</div>
                                      </div>
                                      <div className="text-sm text-gray-600">{w.duration}</div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-700 space-y-1">
                                      {w.exercises?.map((ex: string, idx: number) => (
                                        <div key={idx}>• {ex}</div>
                                      ))}
                                    </div>
                                    {w.notes && (
                                      <div className="mt-2 text-xs text-gray-600 italic">{t('note')}: {w.notes}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Subscription Tab */}
                <TabsContent value="subscription">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('subscription')} {t('for')} {managingUser.firstName}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                        <div className="bg-blue-50 p-3 rounded">
                          <div className="text-xs text-gray-600">{t('currentPlan')}</div>
                          <div className="font-semibold text-sm">{managingUser.subscriptionType || t('none')}</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <div className="text-xs text-gray-600">{t('startDate')}</div>
                          <div className="font-semibold text-sm">{managingUser.subscriptionStartDate ? new Date(managingUser.subscriptionStartDate).toLocaleDateString() : '—'}</div>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <div className="text-xs text-gray-600">{t('endDate')}</div>
                          <div className="font-semibold text-sm">{managingUser.subscriptionEndDate ? new Date(managingUser.subscriptionEndDate).toLocaleDateString() : '—'}</div>
                        </div>
                      </div>

                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const data = { subscriptionType, subscriptionStartDate: subscriptionStartDate || undefined };
                        updateSubscriptionMutation.mutate({ userId: managingUser.id, subscriptionData: data });
                      }} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>{t('subscriptionDurationMonths')}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max="120"
                              value={subscriptionType.replace(/_months?$/, '')}
                              onChange={(e) => setSubscriptionType(normalizeDigitsUniversal(e.target.value))}
                              placeholder={t('placeholderDuration')}
                            />
                          </div>
                          <div>
                            <Label>{t('startDate')}</Label>
                            <Input type="date" value={subscriptionStartDate} onChange={(e) => setSubscriptionStartDate(e.target.value)} />
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {t('calculatedEndDate')}: {(() => {
                            if (!subscriptionType || !subscriptionStartDate) return '—';
                            const normalizedType = subscriptionType.endsWith('_months') ? subscriptionType : `${subscriptionType}_months`;
                            if (!isValidSubscriptionType(normalizedType)) return '—';
                            try {
                              return calculateSubscriptionEndDate(
                                new Date(subscriptionStartDate),
                                normalizedType
                              ).toLocaleDateString();
                            } catch {
                              return '—';
                            }
                          })()}
                        </div>
                        <Button type="submit" disabled={updateSubscriptionMutation.isPending}>
                          {updateSubscriptionMutation.isPending ? t('updating') : t('updateSubscription')}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p>Loading user information...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Coach Approval Tab */}
        <SwipeableTabsContent value="coach-approval" className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center text-gray-900">
                    <UserCog className="w-5 h-5 mr-2" />
                    {t('pendingCoachApprovals')}
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    {t('pendingCoachApprovalsDescription')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                if (pendingCoachesLoading) {
                  return (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  );
                }

                if (pendingCoaches.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <UserCog className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium">{t('noPendingCoachApprovals')}</p>
                      <p className="text-sm mt-2">{t('allCoachRequestsProcessed')}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {pendingCoaches.map((coach) => (
                      <div
                        key={coach.id}
                        className="p-4 rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div>
                                <h3 className="font-semibold text-lg text-gray-900">
                                  {coach.firstName} {coach.lastName}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {coach.whatsappWithCode && `📞 ${coach.whatsappWithCode}`}
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                              {coach.country && (
                                <div className="text-sm">
                                  <span className="text-gray-500">Country:</span>{' '}
                                  <span className="font-medium text-gray-900">{coach.country}</span>
                                </div>
                              )}
                              {coach.city && (
                                <div className="text-sm">
                                  <span className="text-gray-500">City:</span>{' '}
                                  <span className="font-medium text-gray-900">{coach.city}</span>
                                </div>
                              )}
                              {coach.bio && (
                                <div className="text-sm col-span-2">
                                  <span className="text-gray-500">Bio:</span>{' '}
                                  <span className="text-gray-900">{coach.bio}</span>
                                </div>
                              )}
                            </div>

                            {coach.createdAt && (
                              <p className="text-xs text-gray-500 mt-3">
                                Registered: {new Date(coach.createdAt).toLocaleDateString()} at {new Date(coach.createdAt).toLocaleTimeString()}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  message: `${t('confirmApproveCoachPrefix')} ${coach.firstName} ${coach.lastName} ${t('confirmApproveCoachSuffix')}`,
                                  onConfirm: () => approveCoachMutation.mutate({ coachId: coach.id, isApproved: true })
                                });
                              }}
                              disabled={approveCoachMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {t('approve')}
                            </Button>
                            <Button
                              onClick={() => {
                                setConfirmDialog({
                                  open: true,
                                  message: `${t('confirmRejectCoachPrefix')} ${coach.firstName} ${coach.lastName}${t('confirmRejectCoachSuffix')}`,
                                  onConfirm: () => approveCoachMutation.mutate({ coachId: coach.id, isApproved: false })
                                });
                              }}
                              disabled={approveCoachMutation.isPending}
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {t('reject')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </SwipeableTabsContent>

        {/* Store Settings Tab */}
        <SwipeableTabsContent
          value="store"
          className={language === 'ar' ? 'admin-store-section space-y-4' : 'space-y-4'}
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Store className="w-5 h-5 mr-2" />
                {t('storeManagement') || 'Store Management'}
              </CardTitle>
              <CardDescription>
                {t('manageStoreProducts') || 'Manage all product types and categories'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Store Sub-Tabs */}
              <Tabs value={storeTab} onValueChange={setStoreTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <TabsTrigger value="affiliate">
                    <Store className="w-4 h-4 mr-2" />
                    {t('affiliateProducts') || 'Affiliate'}
                  </TabsTrigger>
                  <TabsTrigger value="shop">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {t('shopProducts') || 'Shop'}
                  </TabsTrigger>
                  <TabsTrigger value="coach">
                    <UserCog className="w-4 h-4 mr-2" />
                    {t('coachProducts') || 'Coach'}
                  </TabsTrigger>
                  <TabsTrigger value="categories">
                    <Filter className="w-4 h-4 mr-2" />
                    {t('categories') || 'Categories'}
                  </TabsTrigger>
                </TabsList>

                {/* Affiliate Products Tab */}
                <TabsContent value="affiliate" className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{t('affiliateProductsManagement')}</h3>
                      <p className="text-sm text-gray-500">{t('affiliateProductsDescription')}</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setEditingAffiliate(null);
                        setAffiliateFormData({
                          title: '',
                          url: '',
                          description: '',
                          thumbnailUrl: '',
                          category: '',
                          source: '',
                          isActive: true
                        });
                        setAffiliateDialogOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('addAffiliateProduct')}
                    </Button>
                  </div>

                  {affiliateProductsLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : affiliateProducts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Store className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500 mb-4">{t('noAffiliateProducts')}</p>
                      <Button 
                        onClick={() => setAffiliateDialogOpen(true)}
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('addFirstProduct')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {affiliateProducts.map((product) => (
                        <Card key={product.id} className="border-2">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className={language === 'ar' ? "flex-1 text-right" : "flex-1"}>
                                <div className={language === 'ar' ? "flex items-center justify-end gap-2 mb-2" : "flex items-center gap-2 mb-2"}>
                                  <h3 className="font-semibold text-lg">{product.title}</h3>
                                  <Badge variant={product.isActive ? "default" : "secondary"}>
                                    {product.isActive ? t('active') : t('inactive')}
                                  </Badge>
                                  {product.source && (
                                    <Badge variant="outline" className="capitalize">
                                      {product.source}
                                    </Badge>
                                  )}
                                </div>
                                {product.description && (
                                  <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                                )}
                                <div className={language === 'ar' ? "flex flex-row-reverse items-center gap-2 text-sm text-gray-500" : "flex items-center gap-2 text-sm text-gray-500"}>
                                  <ExternalLink className="w-4 h-4" />
                                  <a 
                                    href={product.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-600 truncate max-w-md"
                                  >
                                    {product.url}
                                  </a>
                                </div>
                                {product.category && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {t('productCategory')}: {product.category}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditAffiliate(product)}
                                >
                                  <Edit className="w-4 h-4" />
                                  <span>{t('edit')}</span>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteAffiliate(product.id)}
                                  disabled={deleteAffiliateProductMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>{t('delete')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Shop Products Tab */}
                <TabsContent value="shop" className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{t('shopProductsManagement') || 'Shop Products Management'}</h3>
                      <p className="text-sm text-gray-500">{t('shopProductsDescription') || 'Manage purchasable products in your store'}</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setEditingShopProduct(null);
                        setShopProductFormData({
                          name: '',
                          description: '',
                          price: 0,
                          imageUrl: '',
                          category: '',
                          rating: 0,
                          reviewCount: 0,
                          stock: 0
                        });
                        setShopProductDialogOpen(true);
                      }}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('addShopProduct') || 'Add Shop Product'}
                    </Button>
                  </div>

                  {shopProductsLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : shopProducts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500 mb-4">{t('noShopProducts') || 'No shop products yet'}</p>
                      <Button 
                        onClick={() => setShopProductDialogOpen(true)}
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('addFirstShopProduct') || 'Add First Product'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {shopProducts.map((product) => (
                        <Card key={product.id} className="border-2">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className={language === 'ar' ? "flex-1 text-right" : "flex-1"}>
                                <div className={language === 'ar' ? "flex items-center justify-end gap-2 mb-2" : "flex items-center gap-2 mb-2"}>
                                  <h3 className="font-semibold text-lg">{product.name}</h3>
                                  <Badge variant="outline" className="capitalize">{product.category}</Badge>
                                  <Badge variant={product.stock > 0 ? "default" : "destructive"}>
                                    {product.stock > 0 ? `${t('inStock')}: ${product.stock}` : t('outOfStock')}
                                  </Badge>
                                </div>
                                {product.description && (
                                  <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                                )}
                                <div className={language === 'ar' ? "flex items-center justify-end gap-4 text-sm text-gray-600" : "flex items-center gap-4 text-sm text-gray-600"}>
                                  <span className="font-semibold text-primary">{product.price.toFixed(2)} EGP</span>
                                  {product.rating && (
                                    <span>★ {product.rating} ({product.reviewCount || 0} {t('reviews')})</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditShopProduct(product)}
                                >
                                  <Edit className="w-4 h-4" />
                                  <span>{t('edit')}</span>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteShopProduct(product.id)}
                                  disabled={deleteShopProductMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>{t('delete')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Coach Products Tab */}
                <TabsContent value="coach" className="space-y-4 mt-6">
                  <div>
                    <h3 className="text-lg font-semibold">{t('coachProductsOverview') || 'Coach Products Overview'}</h3>
                    <p className="text-sm text-gray-500">{t('coachProductsDescription') || 'View products recommended by coaches (managed by individual coaches)'}</p>
                  </div>

                  {coachProductsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : allCoachProducts.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <UserCog className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">{t('noCoachProducts') || 'No coach products yet'}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allCoachProducts.map((product) => (
                        <Card key={product.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className={language === 'ar' ? "flex-1 text-right" : "flex-1"}>
                                <div className={language === 'ar' ? "flex items-center justify-end gap-2 mb-1" : "flex items-center gap-2 mb-1"}>
                                  <h4 className="font-medium">{product.title}</h4>
                                  <Badge variant="outline">{t('coachManaged') || 'Coach Managed'}</Badge>
                                </div>
                                {product.description && (
                                  <p className="text-sm text-gray-600 mb-1">{product.description}</p>
                                )}
                                <div className={language === 'ar' ? "flex flex-row-reverse items-center gap-2 text-sm text-gray-500" : "flex items-center gap-2 text-sm text-gray-500"}>
                                  <ExternalLink className="w-3 h-3" />
                                  <a 
                                    href={product.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-600 truncate max-w-md"
                                  >
                                    {product.url}
                                  </a>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingCoachProduct(product);
                                    setCoachProductFormData({
                                      title: product.title,
                                      url: product.url,
                                      description: product.description || '',
                                      thumbnailUrl: product.thumbnailUrl || ''
                                    });
                                    setCoachProductDialogOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                  <span>{t('edit')}</span>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(t('confirmDeleteCoachProduct') || 'Are you sure you want to delete this product?')) {
                                      deleteCoachProductMutation.mutate(product.id);
                                    }
                                  }}
                                  disabled={deleteCoachProductMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>{t('delete')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Categories Tab */}
                <TabsContent value="categories" className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{t('categoryManagement')}</h3>
                      <p className="text-sm text-gray-500">{t('manageCategoriesDesc')}</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryFormData({
                          nameEn: '',
                          nameAr: '',
                          slug: '',
                          isActive: true,
                          displayOrder: ''
                        });
                        setCategoryDialogOpen(true);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('addCategory')}
                    </Button>
                  </div>

                  {categoriesLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : affiliateCategories.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Filter className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500 mb-4">{t('noCategoriesYet')}</p>
                      <Button 
                        onClick={() => setCategoryDialogOpen(true)}
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('addFirstCategory')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {affiliateCategories.map((category: any) => (
                        <Card key={category.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className={language === 'ar' ? "flex-1 text-right" : "flex-1"}>
                                <div className={language === 'ar' ? "flex items-center justify-end gap-2 mb-1" : "flex items-center gap-2 mb-1"}>
                                  <h4 className="font-medium">{category.nameEn}</h4>
                                  <span className="text-sm text-gray-500">({category.nameAr})</span>
                                  <Badge variant={category.isActive ? "default" : "secondary"}>
                                    {category.isActive ? t('active') : t('inactive')}
                                  </Badge>
                                </div>
                                <div className={language === 'ar' ? "flex items-center justify-end gap-3 text-sm text-gray-500" : "flex items-center gap-3 text-sm text-gray-500"}>
                                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{category.slug}</span>
                                  <span>Order: {category.displayOrder}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditCategory(category)}
                                >
                                  <Edit className="w-4 h-4" />
                                  <span>{t('edit')}</span>
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteCategory(category.id)}
                                  disabled={deleteCategoryMutation.isPending}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>{t('delete')}</span>
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </SwipeableTabsContent>

        {/* Analytics Tab */}
        <SwipeableTabsContent value="analytics" className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {/* Action Buttons */}
          <div className={`admin-actions-row flex gap-3 no-print ${language === 'ar' ? 'justify-start' : 'justify-end'}`}>
            <Button
              onClick={handlePrintAnalytics}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              {t('printAnalytics')}
            </Button>
            <Button
              onClick={handleExportToExcel}
              variant="default"
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              {t('exportToExcel')}
            </Button>
          </div>

          {analyticsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(12)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-32 bg-gray-200 rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : analyticsData ? (
            <div className="space-y-8">
              {/* Coaches Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-blue-600" />
                    {t('coachesAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-blue-700 font-medium">{t('totalCoaches')}</div>
                        <div className="text-3xl font-bold text-blue-900">{analyticsData.coaches.total}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('today')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.coaches.newToday}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisWeek')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.coaches.newThisWeek}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisMonth')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.coaches.newThisMonth}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisYear')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.coaches.newThisYear}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: t('today'), value: analyticsData.coaches.newToday },
                      { name: t('thisWeek'), value: analyticsData.coaches.newThisWeek },
                      { name: t('thisMonth'), value: analyticsData.coaches.newThisMonth },
                      { name: t('thisYear'), value: analyticsData.coaches.newThisYear }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Users Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    {t('usersAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-green-700 font-medium">{t('totalUsers')}</div>
                        <div className="text-3xl font-bold text-green-900">{analyticsData.users.total}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('today')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.users.newToday}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisWeek')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.users.newThisWeek}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisMonth')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.users.newThisMonth}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisYear')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.users.newThisYear}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">{t('newUsersTrend')}</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={[
                          { name: t('today'), value: analyticsData.users.newToday },
                          { name: t('thisWeek'), value: analyticsData.users.newThisWeek },
                          { name: t('thisMonth'), value: analyticsData.users.newThisMonth },
                          { name: t('thisYear'), value: analyticsData.users.newThisYear }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">{t('activeUsers')}</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { name: t('last24h'), value: analyticsData.users.activeLast24h },
                          { name: t('last7days'), value: analyticsData.users.activeLast7days },
                          { name: t('last30days'), value: analyticsData.users.activeLast30days }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gyms Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    {t('gymsAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-purple-700 font-medium">{t('totalGyms')}</div>
                        <div className="text-3xl font-bold text-purple-900">{analyticsData.gyms?.total || 0}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('today')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.gyms?.newToday || 0}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisWeek')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.gyms?.newThisWeek || 0}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisMonth')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.gyms?.newThisMonth || 0}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisYear')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.gyms?.newThisYear || 0}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { name: t('today'), value: analyticsData.gyms?.newToday || 0 },
                      { name: t('thisWeek'), value: analyticsData.gyms?.newThisWeek || 0 },
                      { name: t('thisMonth'), value: analyticsData.gyms?.newThisMonth || 0 },
                      { name: t('thisYear'), value: analyticsData.gyms?.newThisYear || 0 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#9333ea" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Meals Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-orange-600" />
                    {t('mealsAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('today')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.meals.totalToday}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisWeek')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.meals.totalThisWeek}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisMonth')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.meals.totalThisMonth}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisYear')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.meals.totalThisYear}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-orange-700 font-medium">{t('mostLogged')}</div>
                        <div className="text-xl font-bold text-orange-900 capitalize">{t(analyticsData.meals.mostLoggedMealTime)}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">{t('mealsOverTime')}</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { name: t('today'), value: analyticsData.meals.totalToday },
                          { name: t('thisWeek'), value: analyticsData.meals.totalThisWeek },
                          { name: t('thisMonth'), value: analyticsData.meals.totalThisMonth },
                          { name: t('thisYear'), value: analyticsData.meals.totalThisYear }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#f97316" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">{t('mealTypeDistribution')}</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={Object.entries(analyticsData.meals.mealTypeCounts || {}).map(([key, value]) => ({
                              name: key,
                              value: value as number
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.entries(analyticsData.meals.mealTypeCounts || {}).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#f97316', '#3b82f6', '#10b981', '#8b5cf6'][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Workouts Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-purple-600" />
                    {t('workoutsAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('today')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.workouts.totalToday}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisWeek')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.workouts.totalThisWeek}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisMonth')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.workouts.totalThisMonth}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisYear')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.workouts.totalThisYear}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={[
                      { name: t('today'), value: analyticsData.workouts.totalToday },
                      { name: t('thisWeek'), value: analyticsData.workouts.totalThisWeek },
                      { name: t('thisMonth'), value: analyticsData.workouts.totalThisMonth },
                      { name: t('thisYear'), value: analyticsData.workouts.totalThisYear }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Streak and Points Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-600" />
                      {t('topStreakHolders')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.streaksAndPoints.top3Streaks.map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              'bg-orange-300 text-orange-900'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="font-medium">{item.userName}</div>
                          </div>
                          <div className="text-lg font-bold text-yellow-600">{item.streak} {t('days')}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                      {t('topPointsScorers')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analyticsData.streaksAndPoints.top3Points.map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              'bg-orange-300 text-orange-900'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="font-medium">{item.userName}</div>
                          </div>
                          <div className="text-lg font-bold text-indigo-600">{item.points} {t('pts')}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Plans Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-cyan-600" />
                    {t('plansAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-cyan-700 font-medium">{t('withPlans')}</div>
                        <div className="text-3xl font-bold text-cyan-900">{analyticsData.plans.usersWithPlans}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-red-700 font-medium">{t('withoutPlans')}</div>
                        <div className="text-3xl font-bold text-red-900">{analyticsData.plans.usersWithoutPlans}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">{t('plansAssignedOverTime')}</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: t('today'), value: analyticsData.plans.assignedToday },
                        { name: t('thisWeek'), value: analyticsData.plans.assignedThisWeek },
                        { name: t('thisMonth'), value: analyticsData.plans.assignedThisMonth },
                        { name: t('thisYear'), value: analyticsData.plans.assignedThisYear }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Weight Logs Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-pink-600" />
                    {t('weightLogsAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('today')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.weightLogs.totalToday}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisWeek')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.weightLogs.totalThisWeek}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisMonth')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.weightLogs.totalThisMonth}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('thisYear')}</div>
                        <div className="text-2xl font-bold text-gray-900">{analyticsData.weightLogs.totalThisYear}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={[
                      { name: t('today'), value: analyticsData.weightLogs.totalToday },
                      { name: t('thisWeek'), value: analyticsData.weightLogs.totalThisWeek },
                      { name: t('thisMonth'), value: analyticsData.weightLogs.totalThisMonth },
                      { name: t('thisYear'), value: analyticsData.weightLogs.totalThisYear }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Products & Purchases Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                    {t('productsPurchases')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3">{t('clickAnalytics')}</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="p-4">
                          <div className="text-sm text-blue-700 font-medium">{t('today')}</div>
                          <div className="text-2xl font-bold text-blue-900">{analyticsData.products.totalClicksToday || 0}</div>
                          <div className="text-xs text-blue-600 mt-1">{t('clicks')}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="p-4">
                          <div className="text-sm text-green-700 font-medium">{t('thisWeek')}</div>
                          <div className="text-2xl font-bold text-green-900">{analyticsData.products.totalClicksThisWeek || 0}</div>
                          <div className="text-xs text-green-600 mt-1">{t('clicks')}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="p-4">
                          <div className="text-sm text-purple-700 font-medium">{t('thisMonth')}</div>
                          <div className="text-2xl font-bold text-purple-900">{analyticsData.products.totalClicksThisMonth || 0}</div>
                          <div className="text-xs text-purple-600 mt-1">{t('clicks')}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                        <CardContent className="p-4">
                          <div className="text-sm text-orange-700 font-medium">{t('thisYear')}</div>
                          <div className="text-2xl font-bold text-orange-900">{analyticsData.products.totalClicksThisYear || 0}</div>
                          <div className="text-xs text-orange-600 mt-1">{t('clicks')}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">{t('mostClickedLinks')}</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {analyticsData.products.mostClickedLinks && analyticsData.products.mostClickedLinks.length > 0 ? (
                        analyticsData.products.mostClickedLinks.map((product: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium truncate">{product.title}</div>
                                <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                                  {t('viewProduct')}
                                </a>
                              </div>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="ml-4">
                                    <span className="font-bold text-emerald-600">{product.totalClicks}</span>
                                    <span className="ml-1 text-gray-600">{t('clicks')}</span>
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>{product.title} - {t('clickDetails')}</DialogTitle>
                                    <DialogDescription>
                                      {t('usersWhoClicked')}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                          <div className="text-xs text-blue-600">{t('today')}</div>
                                        <div className="text-lg font-bold text-blue-900">{product.clicksToday}</div>
                                      </div>
                                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                          <div className="text-xs text-green-600">{t('thisWeek')}</div>
                                        <div className="text-lg font-bold text-green-900">{product.clicksThisWeek}</div>
                                      </div>
                                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                          <div className="text-xs text-purple-600">{t('thisMonth')}</div>
                                        <div className="text-lg font-bold text-purple-900">{product.clicksThisMonth}</div>
                                      </div>
                                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                                          <div className="text-xs text-orange-600">{t('thisYear')}</div>
                                        <div className="text-lg font-bold text-orange-900">{product.clicksThisYear}</div>
                                      </div>
                                    </div>
                                    {product.userClicks && product.userClicks.length > 0 ? (
                                      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                                        {product.userClicks.map((click: any, idx: number) => (
                                          <div key={idx} className="p-3 hover:bg-gray-50">
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <div className="font-medium">{click.userName}</div>
                                                <div className="text-sm text-gray-600 flex items-center gap-2">
                                                  <span>{click.whatsapp}</span>
                                                  <span className="text-xs text-gray-400">•</span>
                                                  <span className="text-xs">{new Date(click.clickedAt).toLocaleString()}</span>
                                                </div>
                                              </div>
                                              <a href={`https://wa.me/${click.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                                                <Button variant="outline" size="sm">
                                                  {t('contact')}
                                                </Button>
                                              </a>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center text-gray-500 py-8">
                                        {t('noClicksYet')}
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          {t('noClicksYet')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">{t('purchasesOverTime')}</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <Card className="bg-white">
                        <CardContent className="p-4">
                          <div className="text-sm text-gray-600">{t('today')}</div>
                          <div className="text-2xl font-bold text-gray-900">{analyticsData.products.purchasesToday || 0}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-white">
                        <CardContent className="p-4">
                          <div className="text-sm text-gray-600">{t('thisWeek')}</div>
                          <div className="text-2xl font-bold text-gray-900">{analyticsData.products.purchasesThisWeek || 0}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-white">
                        <CardContent className="p-4">
                          <div className="text-sm text-gray-600">{t('thisMonth')}</div>
                          <div className="text-2xl font-bold text-gray-900">{analyticsData.products.purchasesThisMonth || 0}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-white">
                        <CardContent className="p-4">
                          <div className="text-sm text-gray-600">{t('thisYear')}</div>
                          <div className="text-2xl font-bold text-gray-900">{analyticsData.products.purchasesThisYear || 0}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Failed Logs Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    {t('failedLogs')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-red-700 font-medium">{t('failedMealLogs')}</div>
                        <div className="text-3xl font-bold text-red-900">{analyticsData.failedLogs.meals}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50 border-red-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-red-700 font-medium">{t('failedWorkoutLogs')}</div>
                        <div className="text-3xl font-bold text-red-900">{analyticsData.failedLogs.workouts}</div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Subscription Analytics Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-violet-600" />
                    {t('subscriptionAnalytics')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-green-700 font-medium">{t('activeSubscriptions')}</div>
                        <div className="text-3xl font-bold text-green-900">{analyticsData.subscriptions.active}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-yellow-700 font-medium">{t('expired')}</div>
                        <div className="text-3xl font-bold text-yellow-900">{analyticsData.subscriptions.expired || 0}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                      <CardContent className="p-4">
                        <div className="text-sm text-orange-700 font-medium">{t('suspended')}</div>
                        <div className="text-3xl font-bold text-orange-900">{analyticsData.subscriptions.suspended}</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white">
                      <CardContent className="p-4">
                        <div className="text-sm text-gray-600">{t('totalSubscribed')}</div>
                        <div className="text-3xl font-bold text-gray-900">{analyticsData.subscriptions.active + (analyticsData.subscriptions.expired || 0) + analyticsData.subscriptions.suspended}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">{t('subscriptionPlansDistribution')}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(analyticsData.subscriptions.byCounts).map(([plan, count]) => (
                        <Card key={plan} className="bg-gray-50">
                          <CardContent className="p-3">
                            <div className="text-xs text-gray-600 capitalize">{plan.replace('_', ' ')}</div>
                            <div className="text-xl font-bold text-gray-900">{count as number}</div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">{t('noAnalyticsData')}</p>
            </div>
          )}
        </SwipeableTabsContent>

        {/* Tracking & Ads Tab */}
        <SwipeableTabsContent value="tracking" className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {trackingSettingsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, idx) => (
                <Card key={idx}>
                  <CardContent className="p-6">
                    <div className="h-24 bg-gray-200 rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-indigo-600" />
                      {t('realTimeTrackingOverview')}
                    </CardTitle>
                    <CardDescription>
                      {t('trackingLiveConfig')}
                    </CardDescription>
                  </div>
                  {trackingSettings?.updatedAt && (
                    <div className="text-xs text-gray-500">
                      {t('lastSynced')} {formatInAppTz(new Date(trackingSettings.updatedAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[{
                      label: t('metaPixel'),
                      status: trackingForm.metaPixelId ? t('connected') : t('notConfigured'),
                      detail: trackingForm.metaPixelId ? `${t('pixelIdLabel')} • ${trackingForm.metaPixelId}` : t('waitingForPixelId'),
                      icon: <Activity className="h-4 w-4" />,
                      connected: Boolean(trackingForm.metaPixelId),
                    }, {
                      label: t('googleAds'),
                      status: trackingForm.googleAdsConversionId ? t('conversionActive') : t('missingConversionId'),
                      detail: trackingForm.googleAdsSendTo ? trackingForm.googleAdsSendTo : t('addAwSendToValue'),
                      icon: <Target className="h-4 w-4" />,
                      connected: Boolean(trackingForm.googleAdsConversionId),
                    }, {
                      label: t('ga4'),
                      status: trackingForm.googleAnalyticsMeasurementId ? t('streamingData') : t('measurementIdMissing'),
                      detail: trackingForm.googleAnalyticsMeasurementId ? trackingForm.googleAnalyticsMeasurementId : t('addMeasurementId'),
                      icon: <BarChart3 className="h-4 w-4" />,
                      connected: Boolean(trackingForm.googleAnalyticsMeasurementId),
                    }].map((integration) => (
                      <div
                        key={integration.label}
                        className={`rounded-xl border p-4 ${integration.connected ? 'bg-gradient-to-br from-green-50 to-white border-green-200' : 'bg-white border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            {integration.icon}
                            {integration.label}
                          </div>
                          <Badge variant={integration.connected ? 'default' : 'secondary'}>
                            {integration.status}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{integration.detail}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <form onSubmit={handleTrackingSubmit} className="space-y-6">
                <Card className="border-blue-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-blue-600" />
                      {t('trackingMetaPixelTitle')}
                    </CardTitle>
                    <CardDescription>
                      {t('trackingMetaPixelDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="metaPixelId">{t('trackingPixelIdLabel')}</Label>
                      <Input
                        id="metaPixelId"
                        placeholder={t('trackingPixelIdPlaceholder')}
                        value={trackingForm.metaPixelId}
                        onChange={(e) => handleTrackingInputChange('metaPixelId', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="metaPixelAccessToken">{t('trackingAccessTokenLabel')}</Label>
                      <Input
                        id="metaPixelAccessToken"
                        placeholder={t('trackingAccessTokenPlaceholder')}
                        value={trackingForm.metaPixelAccessToken}
                        onChange={(e) => handleTrackingInputChange('metaPixelAccessToken', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="metaPixelTestEventCode">{t('trackingTestEventCodeLabel')}</Label>
                      <Input
                        id="metaPixelTestEventCode"
                        placeholder={t('trackingTestEventCodePlaceholder')}
                        value={trackingForm.metaPixelTestEventCode}
                        onChange={(e) => handleTrackingInputChange('metaPixelTestEventCode', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-amber-600" />
                      {t('trackingGoogleAdsTitle')}
                    </CardTitle>
                    <CardDescription>
                      {t('trackingGoogleAdsDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="googleAdsConversionId">{t('trackingConversionIdLabel')}</Label>
                      <Input
                        id="googleAdsConversionId"
                        placeholder={t('trackingConversionIdPlaceholder')}
                        value={trackingForm.googleAdsConversionId}
                        onChange={(e) => handleTrackingInputChange('googleAdsConversionId', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="googleAdsConversionLabel">{t('trackingConversionLabelLabel')}</Label>
                      <Input
                        id="googleAdsConversionLabel"
                        placeholder={t('trackingConversionLabelPlaceholder')}
                        value={trackingForm.googleAdsConversionLabel}
                        onChange={(e) => handleTrackingInputChange('googleAdsConversionLabel', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="googleAdsSendTo">{t('trackingSendToLabel')}</Label>
                      <Input
                        id="googleAdsSendTo"
                        placeholder={t('trackingSendToPlaceholder')}
                        value={trackingForm.googleAdsSendTo}
                        onChange={(e) => handleTrackingInputChange('googleAdsSendTo', e.target.value)}
                      />
                      <p className="mt-1 text-xs text-gray-500">{t('trackingSendToHelper')}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-emerald-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-emerald-600" />
                      {t('trackingGa4Title')}
                    </CardTitle>
                    <CardDescription>
                      {t('trackingGa4Desc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="gaMeasurementId">{t('trackingMeasurementIdLabel')}</Label>
                      <Input
                        id="gaMeasurementId"
                        placeholder={t('trackingMeasurementIdPlaceholder')}
                        value={trackingForm.googleAnalyticsMeasurementId}
                        onChange={(e) => handleTrackingInputChange('googleAnalyticsMeasurementId', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gaApiSecret">{t('trackingApiSecretLabel')}</Label>
                      <Input
                        id="gaApiSecret"
                        placeholder={t('trackingApiSecretPlaceholder')}
                        value={trackingForm.googleAnalyticsApiSecret}
                        onChange={(e) => handleTrackingInputChange('googleAnalyticsApiSecret', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gaStreamId">{t('trackingStreamIdLabel')}</Label>
                      <Input
                        id="gaStreamId"
                        placeholder={t('trackingStreamIdPlaceholder')}
                        value={trackingForm.googleAnalyticsStreamId}
                        onChange={(e) => handleTrackingInputChange('googleAnalyticsStreamId', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gaPropertyId">{t('trackingPropertyIdLabel')}</Label>
                      <Input
                        id="gaPropertyId"
                        placeholder={t('trackingPropertyIdPlaceholder')}
                        value={trackingForm.googleAnalyticsPropertyId}
                        onChange={(e) => handleTrackingInputChange('googleAnalyticsPropertyId', e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetTrackingFormFromServer}
                    disabled={!trackingSettings || updateTrackingSettingsMutation.isPending}
                  >
                    {t('trackingRevertLiveData')}
                  </Button>
                  <Button type="submit" disabled={updateTrackingSettingsMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {updateTrackingSettingsMutation.isPending ? t('trackingSavingLiveSettings') : t('trackingSaveSettings')}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </SwipeableTabsContent>

      </SwipeableTabs>

      {/* Affiliate Product Dialog */}
      <Dialog open={affiliateDialogOpen} onOpenChange={setAffiliateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingAffiliate ? t('editAffiliateProduct') : t('addAffiliateProduct')}
            </DialogTitle>
            <DialogDescription>
              {t('addUpdateAffiliateProductLinks')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAffiliateSubmit} className="space-y-4">
            <div>
              <Label htmlFor="affiliate-title">{t('productTitleRequired')}</Label>
              <Input
                id="affiliate-title"
                value={affiliateFormData.title}
                onChange={(e) => setAffiliateFormData({...affiliateFormData, title: e.target.value})}
                placeholder={t('productTitlePlaceholder')}
                required
              />
            </div>
            <div>
              <Label htmlFor="affiliate-url">{t('productUrlRequired')}</Label>
              <Input
                id="affiliate-url"
                type="url"
                value={affiliateFormData.url}
                onChange={(e) => setAffiliateFormData({...affiliateFormData, url: e.target.value})}
                placeholder={t('productUrlPlaceholder')}
                required
              />
            </div>
            <div>
              <Label htmlFor="affiliate-description">{t('description')}</Label>
              <Textarea
                id="affiliate-description"
                value={affiliateFormData.description}
                onChange={(e) => setAffiliateFormData({...affiliateFormData, description: e.target.value})}
                placeholder={t('briefProductDescription')}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="affiliate-source">{t('source')}</Label>
                <Select 
                  value={affiliateFormData.source} 
                  onValueChange={(value) => setAffiliateFormData({...affiliateFormData, source: value})}
                >
                  <SelectTrigger id="affiliate-source">
                    <SelectValue placeholder={t('selectSource')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amazon">{t('amazon')}</SelectItem>
                    <SelectItem value="noon">{t('noon')}</SelectItem>
                    <SelectItem value="other">{t('other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="affiliate-category">{t('category')}</Label>
                <Select 
                  value={affiliateFormData.category} 
                  onValueChange={(value) => setAffiliateFormData({...affiliateFormData, category: value})}
                >
                  <SelectTrigger id="affiliate-category">
                    <SelectValue placeholder={t('selectCategoryAffiliate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {affiliateCategories
                      .filter((cat: any) => cat.isActive)
                      .map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {language === 'ar' ? cat.nameAr : cat.nameEn}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <MediaUpload
              label={t('thumbnailUrlOptionalAffiliate') || 'Thumbnail URL (Optional)'}
              value={affiliateFormData.thumbnailUrl}
              onChange={(url) => setAffiliateFormData({...affiliateFormData, thumbnailUrl: url})}
              accept="image/*"
              placeholder={t('thumbnailImageUrlPlaceholder') || 'https://example.com/image.jpg'}
              mediaType="image"
            />
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="affiliate-active"
                checked={affiliateFormData.isActive}
                onChange={(e) => setAffiliateFormData({...affiliateFormData, isActive: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="affiliate-active" className="cursor-pointer">
                {t('activeVisibleToUsers')}
              </Label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={createAffiliateProductMutation.isPending || updateAffiliateProductMutation.isPending}
                className="flex-1"
              >
                {editingAffiliate ? 
                  (updateAffiliateProductMutation.isPending ? t('updating') : t('updateProduct')) :
                  (createAffiliateProductMutation.isPending ? t('creating') : t('createProduct'))
                }
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setAffiliateDialogOpen(false);
                  setEditingAffiliate(null);
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('editCategory') : t('addCategory')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div>
              <Label htmlFor="category-name-en">{t('categoryNameEnglish')}</Label>
              <Input
                id="category-name-en"
                value={categoryFormData.nameEn}
                onChange={(e) => setCategoryFormData({...categoryFormData, nameEn: e.target.value})}
                placeholder="e.g., Supplements"
                required
              />
            </div>
            <div>
              <Label htmlFor="category-name-ar">{t('categoryNameArabic')}</Label>
              <Input
                id="category-name-ar"
                value={categoryFormData.nameAr}
                onChange={(e) => setCategoryFormData({...categoryFormData, nameAr: e.target.value})}
                placeholder="مثال: مكملات غذائية"
                required
              />
            </div>
            <div>
              <Label htmlFor="category-slug">{t('categorySlug')}</Label>
              <Input
                id="category-slug"
                value={categoryFormData.slug}
                onChange={(e) => setCategoryFormData({...categoryFormData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                placeholder={t('categorySlugPlaceholder')}
                required
              />
            </div>
            <div>
              <Label htmlFor="category-order">{t('displayOrder')} ({t('optional')})</Label>
              <Input
                id="category-order"
                type="number"
                min={0}
                value={categoryFormData.displayOrder}
                onChange={(e) => setCategoryFormData({
                  ...categoryFormData,
                  displayOrder: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0,
                })}
                placeholder={t('optional')}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="category-active"
                checked={categoryFormData.isActive}
                onChange={(e) => setCategoryFormData({...categoryFormData, isActive: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="category-active" className="cursor-pointer">
                {t('activeCategory')}
              </Label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                className="flex-1"
              >
                {editingCategory ? 
                  (updateCategoryMutation.isPending ? t('updating') : t('updateCategory')) :
                  (createCategoryMutation.isPending ? t('creating') : t('createCategory'))
                }
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setCategoryDialogOpen(false);
                  setEditingCategory(null);
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shop Product Dialog */}
      <Dialog open={shopProductDialogOpen} onOpenChange={setShopProductDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingShopProduct ? (t('editShopProduct') || 'Edit Shop Product') : (t('addShopProduct') || 'Add Shop Product')}
            </DialogTitle>
            <DialogDescription>
              {t('addUpdateShopProducts') || 'Add or update purchasable products in your store'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleShopProductSubmit} className="space-y-4">
            <div>
              <Label htmlFor="shop-name">{t('productName') || 'Product Name'} <span className="text-red-500">*</span></Label>
              <Input
                id="shop-name"
                value={shopProductFormData.name}
                onChange={(e) => setShopProductFormData({...shopProductFormData, name: e.target.value})}
                placeholder={t('productNamePlaceholder') || 'Enter product name'}
                required
              />
            </div>
            <div>
              <Label htmlFor="shop-description">{t('description')} <span className="text-red-500">*</span></Label>
              <Textarea
                id="shop-description"
                value={shopProductFormData.description}
                onChange={(e) => setShopProductFormData({...shopProductFormData, description: e.target.value})}
                placeholder={t('productDescriptionPlaceholder') || 'Enter product description'}
                rows={3}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shop-price">{t('price')} (EGP) <span className="text-red-500">*</span></Label>
                <Input
                  id="shop-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={shopProductFormData.price > 0 ? shopProductFormData.price : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShopProductFormData({
                      ...shopProductFormData,
                      price: val === '' ? 0 : parseFloat(val) || 0,
                    });
                  }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="shop-stock">{t('stock') || 'Stock'} <span className="text-red-500">*</span></Label>
                <Input
                  id="shop-stock"
                  type="number"
                  min="1"
                  value={shopProductFormData.stock > 0 ? shopProductFormData.stock : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShopProductFormData({
                      ...shopProductFormData,
                      stock: val === '' ? 0 : parseInt(val, 10) || 0,
                    });
                  }}
                  placeholder="1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="shop-category">{t('category')} <span className="text-red-500">*</span></Label>
              <Input
                id="shop-category"
                value={shopProductFormData.category}
                onChange={(e) => setShopProductFormData({...shopProductFormData, category: e.target.value})}
                placeholder={t('categoryPlaceholder') || 'e.g., Supplements, Equipment'}
                required
              />
            </div>
            <MediaUpload
              label={t('imageUrl') || 'Image URL'}
              value={shopProductFormData.imageUrl}
              onChange={(url) => setShopProductFormData({...shopProductFormData, imageUrl: url})}
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              placeholder={t('imageUrlPlaceholder') || 'https://example.com/image.jpg'}
              mediaType="image"
              helperText={t('imageUploadHint')}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="shop-rating">{t('rating') || 'Rating'}</Label>
                <Input
                  id="shop-rating"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={shopProductFormData.rating}
                  onChange={(e) => setShopProductFormData({...shopProductFormData, rating: parseFloat(e.target.value) || 0})}
                  placeholder="0.0"
                />
              </div>
              <div>
                <Label htmlFor="shop-reviews">{t('reviewCount') || 'Review Count'}</Label>
                <Input
                  id="shop-reviews"
                  type="number"
                  min="0"
                  value={shopProductFormData.reviewCount}
                  onChange={(e) => setShopProductFormData({...shopProductFormData, reviewCount: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={createShopProductMutation.isPending || updateShopProductMutation.isPending}
                className="flex-1"
              >
                {editingShopProduct ? 
                  (updateShopProductMutation.isPending ? t('updating') : t('updateProduct')) :
                  (createShopProductMutation.isPending ? t('creating') : t('createProduct'))
                }
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShopProductDialogOpen(false);
                  setEditingShopProduct(null);
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Coach Product Dialog */}
      <Dialog open={coachProductDialogOpen} onOpenChange={setCoachProductDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingCoachProduct ? (t('editCoachProduct') || 'Edit Coach Product') : (t('addCoachProduct') || 'Add Coach Product')}
            </DialogTitle>
            <DialogDescription>
              {t('editCoachProductDesc') || 'Update coach product details'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingCoachProduct) {
              updateCoachProductMutation.mutate({
                id: editingCoachProduct.id,
                data: coachProductFormData
              });
            }
          }} className="space-y-4">
            <div>
              <Label htmlFor="coach-product-title">{t('productTitle') || 'Product Title'} *</Label>
              <Input
                id="coach-product-title"
                value={coachProductFormData.title}
                onChange={(e) => setCoachProductFormData({...coachProductFormData, title: e.target.value})}
                placeholder={t('productTitlePlaceholder') || 'Enter product title'}
                required
              />
            </div>
            <div>
              <Label htmlFor="coach-product-url">{t('productUrl') || 'Product URL'} *</Label>
              <Input
                id="coach-product-url"
                type="url"
                value={coachProductFormData.url}
                onChange={(e) => setCoachProductFormData({...coachProductFormData, url: e.target.value})}
                placeholder={t('productUrlPlaceholder') || 'https://example.com/product'}
                required
              />
            </div>
            <div>
              <Label htmlFor="coach-product-description">{t('description')}</Label>
              <Textarea
                id="coach-product-description"
                value={coachProductFormData.description}
                onChange={(e) => setCoachProductFormData({...coachProductFormData, description: e.target.value})}
                placeholder={t('briefProductDescription') || 'Enter product description'}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="coach-product-thumbnail">{t('thumbnailUrl') || 'Thumbnail URL'}</Label>
              <Input
                id="coach-product-thumbnail"
                type="url"
                value={coachProductFormData.thumbnailUrl}
                onChange={(e) => setCoachProductFormData({...coachProductFormData, thumbnailUrl: e.target.value})}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={updateCoachProductMutation.isPending}
                className="flex-1"
              >
                {updateCoachProductMutation.isPending ? t('updating') : t('updateProduct')}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setCoachProductDialogOpen(false);
                  setEditingCoachProduct(null);
                  setCoachProductFormData({ title: '', url: '', description: '', thumbnailUrl: '' });
                }}
                className="flex-1"
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Plan/Workout Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 
                (dialogType === 'workout' ? t('editWorkoutPlan') : t('editNutritionPlan')) :
                (dialogType === 'workout' ? t('addWorkout') : t('addNutritionPlan'))
              }
            </DialogTitle>
            <DialogDescription>
              {isEditing ? 
                `${dialogType === 'workout' ? t('editWorkoutPlanFor') : t('editNutritionPlanFor')} ${selectedUser?.firstName}` :
                `${dialogType === 'workout' ? t('createNewWorkoutPlan') : t('createNewNutritionPlan')} ${selectedUser?.firstName}`
              }
            </DialogDescription>
          </DialogHeader>

          {editingPlan && isEditing ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              const updateData: any = {
                title: formData.get('title'),
                description: formData.get('description'),
                weeklyFocus: formData.get('weeklyFocus'),
                goals: { ...editingPlan.goals }
              };

              if (dialogType === 'nutrition') {
                // Parse meals from textarea (split by newlines)
                const mealsText = formData.get('meals') as string;
                const meals = mealsText ? mealsText.split('\n').filter(meal => meal.trim()) : [];

                // Parse tips from textarea (split by newlines)
                const tipsText = formData.get('tips') as string;
                const tips = tipsText ? tipsText.split('\n').filter(tip => tip.trim()) : [];

                updateData.goals = {
                  ...editingPlan.goals,
                  calories: parseInt(formData.get('calories') as string),
                  protein: parseInt(formData.get('protein') as string),
                  carbs: parseInt(formData.get('carbs') as string),
                  fat: parseInt(formData.get('fat') as string),
                  meals: meals,
                  tips: tips,
                };
              } else {
                // Parse exercises and workout tips
                const exercisesText = formData.get('exercises') as string;
                const exercises = exercisesText ? exercisesText.split('\n').filter(exercise => exercise.trim()) : [];


                // Process detailed weekly schedule data
                const newWorkoutDays = parseInt(formData.get('workoutDays') as string) || 3;
                let weeklyScheduleData: any = {
                  focus: formData.get('weeklyFocus') as string || 'General Fitness',
                  workouts: []
                };

                // Build detailed workout schedule from form data
                for (let dayIndex = 0; dayIndex < newWorkoutDays; dayIndex++) {
                  const day = formData.get(`day-${dayIndex}`) as string;
                  const type = formData.get(`type-${dayIndex}`) as string;
                  const duration = formData.get(`duration-${dayIndex}`) as string;
                  const notes = formData.get(`notes-${dayIndex}`) as string;

                  // Collect all exercises for this day
                  const exercises = [];
                  let exerciseIndex = 0;

                  // Keep collecting exercises until we find empty ones
                  while (exerciseIndex < 10) { // Max 10 exercises per day
                    const exerciseName = formData.get(`exercise-${dayIndex}-${exerciseIndex}-name`) as string;
                    const sets = formData.get(`exercise-${dayIndex}-${exerciseIndex}-sets`) as string;
                    const reps = formData.get(`exercise-${dayIndex}-${exerciseIndex}-reps`) as string;

                    if (exerciseName && exerciseName.trim()) {
                      // If exerciseName already contains sets/reps (e.g., "Cable crunch for ABS – 3x15"), just use the raw name
                      // Otherwise, append sets/reps
                      const rawName = exerciseName.trim();
                      const hasSetsReps = /\d+\s*x\s*\d+/i.test(rawName);
                      if (hasSetsReps) {
                        exercises.push(rawName);
                      } else {
                        exercises.push(`${rawName} - ${sets || '3'}x${reps || '10'}`);
                      }
                    }
                    exerciseIndex++;
                  }

                  if (day) {
                    weeklyScheduleData.workouts.push({
                      day: day,
                      type: type || 'Full Body',
                      duration: duration || '45 min',
                      exercises: exercises,
                      notes: notes || ''
                    });
                  }
                }

                updateData.goals = {
                  ...editingPlan.goals,
                  workoutDays: parseInt(formData.get('workoutDays') as string),
                  workoutDuration: formData.get('workoutDuration'),
                  exercises: exercises,
                };

                // Always add weekly schedule to update data
                updateData.weeklySchedule = weeklyScheduleData;
              }

              updatePlanMutation.mutate({
                planId: editingPlan.id,
                updateData
              });
            }} className="space-y-4">
              <div>
                <Label htmlFor="edit-title">{t('planTitle')} <span className="text-red-500">*</span></Label>
                <Input 
                  id="edit-title" 
                  name="title" 
                  defaultValue={editingPlan.title}
                  required 
                />
              </div>
              <div>
                <Label htmlFor="edit-description">{t('description')} <span className="text-red-500">*</span></Label>
                <Textarea 
                  id="edit-description" 
                  name="description" 
                  defaultValue={editingPlan.description}
                  required 
                />
              </div>
              <div>
                <Label htmlFor="edit-weeklyFocus">{t('weeklyFocus')}</Label>
                <Input 
                  id="edit-weeklyFocus" 
                  name="weeklyFocus" 
                  defaultValue={editingPlan.weeklyFocus}
                />
              </div>

              {dialogType === 'nutrition' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-calories">{t('calories')}</Label>
                      <Input 
                        id="edit-calories" 
                        name="calories" 
                        type="number" 
                        defaultValue={editingPlan.goals?.calories}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-protein">{t('proteinG')}</Label>
                      <Input 
                        id="edit-protein" 
                        name="protein" 
                        type="number" 
                        defaultValue={editingPlan.goals?.protein}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-carbs">{t('carbsG')}</Label>
                      <Input 
                        id="edit-carbs" 
                        name="carbs" 
                        type="number" 
                        defaultValue={editingPlan.goals?.carbs}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-fat">{t('fatG')}</Label>
                      <Input 
                        id="edit-fat" 
                        name="fat" 
                        type="number" 
                        defaultValue={editingPlan.goals?.fat}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-meals">{t('mealPlan')}</Label>
                    <Textarea 
                      id="edit-meals" 
                      name="meals" 
                      defaultValue={editingPlan.goals?.meals ? editingPlan.goals.meals.join('\n') : ''}
                      placeholder={t('mealPlanPlaceholder')}
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-tips">{t('nutritionTipsLabel')}</Label>
                    <Textarea 
                      id="edit-tips" 
                      name="tips" 
                      defaultValue={editingPlan.goals?.tips ? editingPlan.goals.tips.join('\n') : ''}
                      placeholder={t('nutritionTipsPlaceholder')}
                      rows={4}
                    />
                  </div>
                </>

              ) : (
                <>
                  {/* Enhanced Workout Plan Editor */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-workoutDays">Workout Days/Week</Label>
                        <Input 
                          id="edit-workoutDays" 
                          name="workoutDays" 
                          type="number" 
                          min="1" 
                          max="7"
                          defaultValue={editingPlan.goals?.workoutDays || 3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-workoutDuration">Average Duration per Session</Label>
                        <Input 
                          id="edit-workoutDuration" 
                          name="workoutDuration" 
                          defaultValue={editingPlan.goals?.workoutDuration || '45 minutes'}
                          placeholder="e.g., 45 minutes"
                        />
                      </div>
                    </div>

                    {/* Weekly Schedule Builder */}
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <Label className="text-lg font-medium">Weekly Workout Schedule</Label>
                        <span className="text-sm text-gray-500">(Detailed exercise planning)</span>
                      </div>

                      {(() => {
                        const workoutDays = parseInt((document.getElementById('edit-workoutDays') as HTMLInputElement)?.value || editingPlan.goals?.workoutDays || '3');
                        const currentSchedule = editingPlan.weeklySchedule?.workouts || [];
                        const daysOfWeek = [
                          { value: 'Monday', label: t('monday') },
                          { value: 'Tuesday', label: t('tuesday') },
                          { value: 'Wednesday', label: t('wednesday') },
                          { value: 'Thursday', label: t('thursday') },
                          { value: 'Friday', label: t('friday') },
                          { value: 'Saturday', label: t('saturday') },
                          { value: 'Sunday', label: t('sunday') }
                        ];

                        // Create array for the number of workout days, filling with existing data if available
                        const workoutSchedule = Array.from({ length: Math.min(workoutDays, 7) }, (_, index) => 
                          currentSchedule[index] || {
                            day: daysOfWeek[index].value,
                            type: 'Full Body',
                            duration: '45 min',
                            exercises: []
                          }
                        );

                        return workoutSchedule.map((workout: any, dayIndex: number) => (
                          <div key={dayIndex} className="mb-6 p-4 border-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div>
                                <Label htmlFor={`day-${dayIndex}`} className="font-medium">{t('day')}</Label>
                                <select 
                                  id={`day-${dayIndex}`}
                                  name={`day-${dayIndex}`}
                                  defaultValue={workout.day}
                                  className="w-full px-3 py-2 border rounded-md bg-white"
                                >
                                  {daysOfWeek.map(day => (
                                    <option key={day.value} value={day.value}>{day.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <Label htmlFor={`type-${dayIndex}`} className="font-medium">Focus Area</Label>
                                <select 
                                  id={`type-${dayIndex}`}
                                  name={`type-${dayIndex}`}
                                  defaultValue={workout.type}
                                  className="w-full px-3 py-2 border rounded-md bg-white"
                                >
                                  <option value="Full Body">Full Body</option>
                                  <option value="Upper Body">Upper Body</option>
                                  <option value="Lower Body">Lower Body</option>
                                  <option value="Cardio">Cardio</option>
                                  <option value="Core">Core</option>
                                  <option value="Push">Push (Chest, Shoulders, Triceps)</option>
                                  <option value="Pull">Pull (Back, Biceps)</option>
                                  <option value="Legs">Legs</option>
                                  <option value="Rest/Active Recovery">Rest/Active Recovery</option>
                                </select>
                              </div>
                              <div>
                                <Label htmlFor={`duration-${dayIndex}`} className="font-medium">Duration</Label>
                                <Input 
                                  id={`duration-${dayIndex}`}
                                  name={`duration-${dayIndex}`}
                                  defaultValue={workout.duration}
                                  placeholder="e.g., 45 min"
                                  className="bg-white"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="font-medium mb-2 block">Exercise Details</Label>
                              <div className="space-y-3">
                                {(() => {
                                  const currentExercises = workout.exercises || [''];
                                  // Ensure at least 4 exercise slots, add more if needed
                                  const exerciseSlots = [...currentExercises];
                                  while (exerciseSlots.length < 4) exerciseSlots.push('');

                                  return exerciseSlots.map((exercise: string, exerciseIndex: number) => (
                                    <div key={exerciseIndex} className="grid grid-cols-9 gap-2 items-center bg-white p-3 rounded border">
                                      <div className="col-span-5">
                                        <Input 
                                          name={`exercise-${dayIndex}-${exerciseIndex}-name`}
                                          defaultValue={exercise.split(' - ')[0] || ''}
                                          placeholder={`Exercise ${exerciseIndex + 1} (e.g., Push-ups)`}
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="col-span-2">
                                        <Input 
                                          name={`exercise-${dayIndex}-${exerciseIndex}-sets`}
                                          defaultValue={exercise.split(' - ')[1]?.split('x')[0] || ''}
                                          placeholder="Sets"
                                          type="number"
                                          min="1"
                                          className="text-sm"
                                        />
                                      </div>
                                      <div className="col-span-2">
                                        <Input 
                                          name={`exercise-${dayIndex}-${exerciseIndex}-reps`}
                                          defaultValue={exercise.split(' - ')[1]?.split('x')[1] || ''}
                                          placeholder="Reps"
                                          className="text-sm"
                                        />
                                      </div>
                                    </div>
                                  ));
                                })()}
                              </div>

                              <div className="mt-3">
                                <Label htmlFor={`notes-${dayIndex}`} className="text-sm">Workout Notes/Tips</Label>
                                <Textarea 
                                  id={`notes-${dayIndex}`}
                                  name={`notes-${dayIndex}`}
                                  defaultValue={workout.notes || ''}
                                  placeholder="e.g., Focus on form, increase weight if too easy, warm up properly..."
                                  rows={2}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button 
                  type="button"
                  onClick={() => {
                    setEditingPlan(null);
                    setIsEditing(false);
                    setDialogOpen(false);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  {t('cancel')}
                </Button>
                <Button 
                  type="submit"
                  disabled={updatePlanMutation.isPending}
                  className="flex-1"
                >
                  {updatePlanMutation.isPending ? t('updating') : t('updatePlan')}
                </Button>
              </div>
            </form>
          ) : dialogType === 'nutrition' ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              // Parse meals and tips from create form
              const mealsText = formData.get('meals') as string;
              const meals = mealsText ? mealsText.split('\n').filter(meal => meal.trim()) : [];

              const tipsText = formData.get('tips') as string;
              const tips = tipsText ? tipsText.split('\n').filter(tip => tip.trim()) : [];

              createPlanMutation.mutate({
                userId: selectedUser.id,
                title: formData.get('title'),
                description: formData.get('description'),
                weeklyFocus: formData.get('weeklyFocus'),
                goals: {
                  calories: parseInt(formData.get('calories') as string),
                  protein: parseInt(formData.get('protein') as string),
                  carbs: parseInt(formData.get('carbs') as string),
                  fat: parseInt(formData.get('fat') as string),
                  meals: meals,
                  tips: tips,
                }
              });
            }} className="space-y-4">
              <div>
                <Label htmlFor="title">{t('planTitle')} <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" placeholder={t('planTitlePlaceholder')} required />
              </div>
              <div>
                <Label htmlFor="description">{t('description')} <span className="text-red-500">*</span></Label>
                <Textarea id="description" name="description" placeholder={t('planDescriptionPlaceholder')} required />
              </div>
              <div>
                <Label htmlFor="weeklyFocus">{t('weeklyFocus')}</Label>
                <Input id="weeklyFocus" name="weeklyFocus" placeholder={t('weeklyFocusPlaceholder')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="calories">{t('calories')}</Label>
                  <Input id="calories" name="calories" type="number" placeholder="2000" />
                </div>
                <div>
                  <Label htmlFor="protein">{t('proteinG')}</Label>
                  <Input id="protein" name="protein" type="number" placeholder="150" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="carbs">{t('carbsG')}</Label>
                  <Input id="carbs" name="carbs" type="number" placeholder="200" />
                </div>
                <div>
                  <Label htmlFor="fat">{t('fatG')}</Label>
                  <Input id="fat" name="fat" type="number" placeholder="70" />
                </div>
              </div>
              <div>
                <Label htmlFor="meals">{t('mealPlan')}</Label>
                <Textarea 
                  id="meals" 
                  name="meals" 
                  placeholder={t('mealPlanPlaceholder')}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="tips">{t('nutritionTipsLabel')}</Label>
                <Textarea 
                  id="tips" 
                  name="tips" 
                  placeholder={t('nutritionTipsPlaceholder')}
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createPlanMutation.isPending}>
                  {createPlanMutation.isPending ? t('creating') : t('createPlan')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              // Parse workout tips from create form
              const workoutTipsText = formData.get('workoutTips') as string;
              const workoutTips = workoutTipsText ? workoutTipsText.split('\n').filter(tip => tip.trim()) : [];

              // Build detailed workout schedule
              const newWorkoutDays = parseInt(formData.get('workoutDays') as string) || 3;
              const weeklyScheduleData: any = {
                focus: formData.get('weeklyFocus') as string || 'General Fitness',
                workouts: []
              };

              for (let dayIndex = 0; dayIndex < newWorkoutDays; dayIndex++) {
                const day = formData.get(`create-day-${dayIndex}`) as string;
                const type = formData.get(`create-type-${dayIndex}`) as string;
                const duration = formData.get(`create-duration-${dayIndex}`) as string;
                const notes = formData.get(`create-notes-${dayIndex}`) as string;

                const exercises = [];
                for (let exerciseIndex = 0; exerciseIndex < 10; exerciseIndex++) {
                  const exerciseName = formData.get(`create-exercise-${dayIndex}-${exerciseIndex}-name`) as string;
                  const sets = formData.get(`create-exercise-${dayIndex}-${exerciseIndex}-sets`) as string;
                  const reps = formData.get(`create-exercise-${dayIndex}-${exerciseIndex}-reps`) as string;

                  if (exerciseName && exerciseName.trim()) {
                    exercises.push(`${exerciseName.trim()} - ${sets || '3'}x${reps || '10'}`);
                  }
                }

                if (day) {
                  weeklyScheduleData.workouts.push({
                    day: day,
                    type: type || 'Full Body',
                    duration: duration || '45 min',
                    exercises: exercises,
                    notes: notes || ''
                  });
                }
              }

              createPlanMutation.mutate({
                userId: selectedUser.id,
                title: formData.get('title'),
                description: formData.get('description'),
                weeklyFocus: formData.get('weeklyFocus'),
                goals: {
                  workoutDays: newWorkoutDays,
                  workoutDuration: formData.get('workoutDuration'),
                  exercises: [], // Keep for legacy compatibility
                  workoutTips: workoutTips,
                },
                weeklySchedule: weeklyScheduleData
              });
            }} className="space-y-4">
              {/* Enhanced Create Workout Plan Form */}
              <div className="space-y-6">
                <div>
                  <Label htmlFor="title">{t('planTitle')} <span className="text-red-500">*</span></Label>
                  <Input id="title" name="title" placeholder={t('strengthTrainingPlaceholder')} required />
                </div>
                <div>
                  <Label htmlFor="description">{t('description')} <span className="text-red-500">*</span></Label>
                  <Textarea id="description" name="description" placeholder={t('planDescriptionPlaceholder')} required />
                </div>
                <div>
                  <Label htmlFor="weeklyFocus">{t('weeklyFocus')}</Label>
                  <Input id="weeklyFocus" name="weeklyFocus" placeholder={t('weeklyFocusPlaceholder')} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="workoutDays">{t('workoutDaysWeek')}</Label>
                    <Input id="workoutDays" name="workoutDays" type="number" min="1" max="7" defaultValue="3" />
                  </div>
                  <div>
                    <Label htmlFor="workoutDuration">{t('averageDurationPerSession')}</Label>
                    <Input id="workoutDuration" name="workoutDuration" placeholder={t('avgDurationPlaceholder')} defaultValue="45 minutes" />
                  </div>
                </div>

                {/* Create Weekly Schedule Builder */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <Label className="text-lg font-medium">{t('createWeeklyWorkoutSchedule')}</Label>
                    <span className="text-sm text-gray-500">{t('planDetailedExercises')}</span>
                  </div>

                  {Array.from({ length: 3 }, (_, dayIndex) => {
                    const daysOfWeek = [
                      { value: 'Monday', label: t('monday') },
                      { value: 'Tuesday', label: t('tuesday') },
                      { value: 'Wednesday', label: t('wednesday') },
                      { value: 'Thursday', label: t('thursday') },
                      { value: 'Friday', label: t('friday') },
                      { value: 'Saturday', label: t('saturday') },
                      { value: 'Sunday', label: t('sunday') }
                    ];
                    return (
                      <div key={dayIndex} className="mb-6 p-4 border-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50">
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <Label htmlFor={`create-day-${dayIndex}`} className="font-medium">{t('day')}</Label>
                            <select 
                              id={`create-day-${dayIndex}`}
                              name={`create-day-${dayIndex}`}
                              defaultValue={daysOfWeek[dayIndex].value}
                              className="w-full px-3 py-2 border rounded-md bg-white"
                            >
                              {daysOfWeek.map(day => (
                                <option key={day.value} value={day.value}>{day.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label htmlFor={`create-type-${dayIndex}`} className="font-medium">{t('focusArea')}</Label>
                            <select 
                              id={`create-type-${dayIndex}`}
                              name={`create-type-${dayIndex}`}
                              defaultValue="Full Body"
                              className="w-full px-3 py-2 border rounded-md bg-white"
                            >
                              <option value="Full Body">{t('fullBody')}</option>
                              <option value="Upper Body">{t('upperBody')}</option>
                              <option value="Lower Body">{t('lowerBody')}</option>
                              <option value="Cardio">{t('cardio')}</option>
                              <option value="Core">{t('core')}</option>
                              <option value="Push">{t('push')}</option>
                              <option value="Pull">{t('pull')}</option>
                              <option value="Legs">{t('legs')}</option>
                            </select>
                          </div>
                          <div>
                            <Label htmlFor={`create-duration-${dayIndex}`} className="font-medium">{t('duration')}</Label>
                            <Input 
                              id={`create-duration-${dayIndex}`}
                              name={`create-duration-${dayIndex}`}
                              defaultValue="45 min"
                              placeholder={t('durationPlaceholder')}
                              className="bg-white"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="font-medium mb-2 block">{t('exerciseDetails')}</Label>
                          <div className="space-y-3">
                            {Array.from({ length: 4 }, (_, exerciseIndex) => (
                              <div key={exerciseIndex} className="grid grid-cols-9 gap-2 items-center bg-white p-3 rounded border">
                                <div className="col-span-5">
                                  <Input 
                                    name={`create-exercise-${dayIndex}-${exerciseIndex}-name`}
                                    placeholder={t('exercisePlaceholder').replace('{number}', String(exerciseIndex + 1))}
                                    className="text-sm"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input 
                                    name={`create-exercise-${dayIndex}-${exerciseIndex}-sets`}
                                    placeholder={t('sets')}
                                    type="number"
                                    min="1"
                                    defaultValue="3"
                                    className="text-sm"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input 
                                    name={`create-exercise-${dayIndex}-${exerciseIndex}-reps`}
                                    placeholder={t('reps')}
                                    defaultValue="10"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3">
                            <Label htmlFor={`create-notes-${dayIndex}`} className="text-sm">{t('workoutNotesTips')}</Label>
                            <Textarea 
                              id={`create-notes-${dayIndex}`}
                              name={`create-notes-${dayIndex}`}
                              placeholder={t('workoutNotesPlaceholder')}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <Label htmlFor="workoutTips">{t('generalWorkoutTips')}</Label>
                  <Textarea 
                    id="workoutTips" 
                    name="workoutTips" 
                    defaultValue={t('generalWorkoutTipsDefault')}
                    placeholder={t('generalWorkoutTipsPlaceholder')}
                    rows={4}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createPlanMutation.isPending}>
                  {createPlanMutation.isPending ? t('creating') : t('createPlan')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('addNewUser')}</DialogTitle>
            <DialogDescription>
              {t('createNewUserAccount')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">{t('firstName')} <span className="text-red-500">*</span></Label>
                <Input
                  id="firstName"
                  value={userFormData.firstName}
                  onChange={(e) => setUserFormData({...userFormData, firstName: e.target.value})}
                  placeholder={t('firstNamePlaceholder')}
                  required
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>
              <div>
                <Label htmlFor="lastName">{t('lastName')} <span className="text-red-500">*</span></Label>
                <Input
                  id="lastName"
                  value={userFormData.lastName}
                  onChange={(e) => setUserFormData({...userFormData, lastName: e.target.value})}
                  placeholder={t('lastNamePlaceholder')}
                  required
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">البريد الإلكتروني <span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                placeholder="example@email.com"
                required
                dir="ltr"
              />
            </div>

            <div>
              <Label htmlFor="whatsappWithCode">{t('phoneNumber')}</Label>
              <Input
                id="whatsappWithCode"
                type="tel"
                value={userFormData.whatsappWithCode}
                onChange={(e) => setUserFormData({...userFormData, whatsappWithCode: e.target.value})}
                placeholder="201234567890"
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
              <p className="text-xs text-gray-500 mt-1" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                {language === 'ar' 
                  ? 'اكتب كود الدولة بدون 00 أو + ثم رقم الواتساب (اختياري - مثال: 201234567890 لمصر)'
                  : 'Enter country code without 00 or + then WhatsApp number (optional - e.g., 201234567890)'}
              </p>
            </div>
            <div>
              <Label htmlFor="password">{t('password')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showCreatePassword ? "text" : "password"}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                  placeholder={t('enterPassword')}
                  required
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                  className={language === 'ar' ? 'pl-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700`}
                >
                  {showCreatePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="role">{t('role')} <span className="text-red-500">*</span></Label>
              <Select value={userFormData.role} onValueChange={(value) => setUserFormData({...userFormData, role: value})}>
                <SelectTrigger dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <SelectValue placeholder={t('selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t('userRole')}</SelectItem>
                  <SelectItem value="coach">{t('coachRole')}</SelectItem>
                  <SelectItem value="gym">{t('gymRole')}</SelectItem>
                  <SelectItem value="visitor">{t('visitorRole')}</SelectItem>
                  <SelectItem value="admin">{t('adminRole')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? t('creating') : t('createUser')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('editUserProfile')}</DialogTitle>
            <DialogDescription>
              {t('updateUserProfileInfo')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUserSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">{t('firstName')} <span className="text-red-500">*</span></Label>
                <Input
                  id="editFirstName"
                  value={editUserFormData.firstName}
                  onChange={(e) => setEditUserFormData({...editUserFormData, firstName: e.target.value})}
                  placeholder={t('firstNamePlaceholder')}
                  required
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>
              <div>
                <Label htmlFor="editLastName">{t('lastName')} <span className="text-red-500">*</span></Label>
                <Input
                  id="editLastName"
                  value={editUserFormData.lastName}
                  onChange={(e) => setEditUserFormData({...editUserFormData, lastName: e.target.value})}
                  placeholder={t('lastNamePlaceholder')}
                  required
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="editEmail">البريد الإلكتروني</Label>
              <Input
                id="editEmail"
                type="email"
                value={editUserFormData.email}
                onChange={(e) => setEditUserFormData({...editUserFormData, email: e.target.value})}
                placeholder="example@email.com"
                dir="ltr"
              />
            </div>

            <div>
              <Label htmlFor="editWhatsappWithCode">{t('whatsappNumber')}</Label>
              <Input
                id="editWhatsappWithCode"
                type="tel"
                value={editUserFormData.whatsappWithCode}
                onChange={(e) => setEditUserFormData({...editUserFormData, whatsappWithCode: e.target.value})}
                placeholder={t('whatsappNumberPlaceholder')}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={editUserMutation.isPending}>
                {editUserMutation.isPending ? t('updating') : t('updateUser')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditUserDialogOpen(false)}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('deleteUserTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteUserConfirmation')}
            </DialogDescription>
          </DialogHeader>
          {userToDelete && (
            <div className="py-4">
              <p className="text-sm text-gray-600">
                <strong>{t('userLabel')}:</strong> {userToDelete.firstName} {userToDelete.lastName}
              </p>
              {/* Email removed from delete confirmation */}
            </div>
          )}
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? t('deleting') : t('deleteUser')}
            </Button>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              {t('cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generic Confirmation Dialog (localized) */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, message: '' });
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('areYouAbsolutelySure')}</DialogTitle>
            <DialogDescription>{confirmDialog.message}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                confirmDialog.onConfirm?.();
                setConfirmDialog({ open: false, message: '' });
              }}
            >
              {t('ok')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, message: '' })}
            >
              {t('cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('assignRoleTitle')}</DialogTitle>
            <DialogDescription>
              {t('assignRoleDescription')}
            </DialogDescription>
          </DialogHeader>
          {selectedUserForRole && (
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">
                <strong>{t('userLabel')}:</strong> {selectedUserForRole.firstName} {selectedUserForRole.lastName}
              </p>
              <div className="text-sm text-gray-600 mb-4 flex items-center">
                <strong>{t('currentRole')}:</strong> 
                <Badge 
                  className={`ml-2 ${
                    selectedUserForRole.role === 'admin' || selectedUserForRole.role === 'super_admin'
                      ? 'bg-red-100 text-red-800' 
                      : selectedUserForRole.role === 'coach' 
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {selectedUserForRole.role === 'super_admin'
                    ? 'Super Admin'
                    : selectedUserForRole.role === 'admin' 
                    ? t('adminRole') 
                    : selectedUserForRole.role === 'coach' 
                    ? t('coachRole')
                    : selectedUserForRole.role === 'gym'
                    ? t('gymRole')
                    : t('userRole')}
                </Badge>
              </div>
              <form onSubmit={handleRoleUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="roleSelect">{t('newRole')}</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectRole')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t('userRole')}</SelectItem>
                      <SelectItem value="coach">{t('coachRole')}</SelectItem>
                      <SelectItem value="gym">{t('gymRole')}</SelectItem>
                      <SelectItem value="admin">{t('adminRole')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    disabled={updateUserRoleMutation.isPending || newRole === selectedUserForRole.role}
                  >
                    {updateUserRoleMutation.isPending ? t('updating') : t('updateRole')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setRoleDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Coach Dialog */}
      <Dialog open={coachAssignDialogOpen} onOpenChange={setCoachAssignDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('assignCoachDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('assignCoachDialogDescription')} {selectedUserForCoach?.firstName} {selectedUserForCoach?.lastName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCoachAssignment} className="space-y-4">
            <div>
              <Label htmlFor="coach">{t('coachLabel')}</Label>
              <Select value={selectedCoachId} onValueChange={setSelectedCoachId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCoachPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGN">
                    <span className="text-muted-foreground">{t('noCoachUnassign')}</span>
                  </SelectItem>
                  {coaches.filter(coach => coach.role === 'coach').map(coach => (
                    <SelectItem key={coach.id} value={coach.id.toString()}>
                      {coach.firstName} {coach.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={assignCoachMutation.isPending}>
                {assignCoachMutation.isPending ? t('assigning') : t('assignCoach')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCoachAssignDialogOpen(false)}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detailed Trainee View Modal */}
      <Dialog open={detailViewOpen} onOpenChange={setDetailViewOpen}>
        <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {detailViewUser ? `${detailViewUser.firstName} ${detailViewUser.lastName} - ${t('detailedView')}` : t('traineeDetails')}
            </DialogTitle>
            <DialogDescription>
              {t('comprehensiveReadonlyView')}
            </DialogDescription>
          </DialogHeader>

          {detailViewUser && (
            <div className="py-6 space-y-6">
              {/* User Info Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('traineeInformation')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('name')}</Label>
                      <p className="text-sm font-semibold">{detailViewUser.firstName} {detailViewUser.lastName}</p>
                    </div>
                    {/* Email removed from details */}
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('phone')}</Label>
                      <p className="text-sm">{detailViewUser.phoneNumber || t('notProvided')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('role')}</Label>
                      <Badge variant="outline" className="text-xs">
                        {detailViewUser.role || t('user')}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('fitnessGoal')}</Label>
                      <p className="text-sm">{detailViewUser.fitnessGoal ? (() => {
                        const goalMap: Record<string, string> = {
                          'weight_loss': t('weightLoss'),
                          'weight_gain': t('weightGain'),
                          'bulking': t('bulking'),
                          'cutting': t('cutting')
                        };
                        return goalMap[detailViewUser.fitnessGoal] || detailViewUser.fitnessGoal;
                      })() : t('notSet')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('weightAndHeight')}</Label>
                      <p className="text-sm">{detailViewUser.weight ? `${detailViewUser.weight}kg` : t('notSet')} / {detailViewUser.height ? `${detailViewUser.height}cm` : t('notSet')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('age')}</Label>
                      <p className="text-sm">{detailViewUser.age || t('notSet')}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('subscription')}</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant={(() => {
                          const status = getSubscriptionStatus(
                            detailViewUser.subscriptionType,
                            detailViewUser.subscriptionStartDate,
                            detailViewUser.subscriptionEndDate
                          );
                          switch (status) {
                            case 'active': return 'default';
                            case 'expired': return 'destructive';
                            case 'suspended': return 'secondary';
                            case 'none':
                            default: return 'outline';
                          }
                        })()} className={(() => {
                          const status = getSubscriptionStatus(
                            detailViewUser.subscriptionType,
                            detailViewUser.subscriptionStartDate,
                            detailViewUser.subscriptionEndDate
                          );
                          return status === 'suspended' ? 'text-xs bg-orange-500 text-white' : 'text-xs';
                        })()}>
                          {(() => {
                            const status = getSubscriptionStatus(
                              detailViewUser.subscriptionType,
                              detailViewUser.subscriptionStartDate,
                              detailViewUser.subscriptionEndDate
                            );
                            switch (status) {
                              case 'active': return t('active');
                              case 'expired': return t('expired');
                              case 'suspended': return t('suspended');
                              case 'none':
                              default: return t('none');
                            }
                          })()}
                        </Badge>
                        {detailViewUser.subscriptionType && (
                          <span className="text-xs text-gray-500">({detailViewUser.subscriptionType.replace('_', ' ')})</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Logs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    {t('activityLog')}
                  </CardTitle>
                  <div className="flex gap-2 items-center justify-end">
                    <Select value={activityFilter} onValueChange={setActivityFilter}>
                      <SelectTrigger className="w-48">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allActivities')}</SelectItem>
                        <SelectItem value="meals">{t('meals')}</SelectItem>
                        <SelectItem value="workouts">{t('workouts')}</SelectItem>
                        <SelectItem value="progress">{t('progress')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
                      <TabsTrigger value="meals">{t('meals')}</TabsTrigger>
                      <TabsTrigger value="workouts">{t('workouts')}</TabsTrigger>
                      <TabsTrigger value="progress">{t('progress')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <UtensilsCrossed className="w-5 h-5 text-green-500" />
                              <div>
                                <p className="text-sm font-medium">{t('totalMeals')}</p>
                                <p className="text-2xl font-bold">{traineeMeals.length}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Dumbbell className="w-5 h-5 text-blue-500" />
                              <div>
                                <p className="text-sm font-medium">{t('workoutSessions')}</p>
                                <p className="text-2xl font-bold">{traineeWorkoutSessions.length}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Target className="w-5 h-5 text-orange-500" />
                              <div>
                                <p className="text-sm font-medium">{t('progressEntries')}</p>
                                <p className="text-2xl font-bold">{traineeProgress.length}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Recent Activity Timeline */}
                      <div className="space-y-3">
                        <h3 className="font-medium">{t('recentActivity')}</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {(() => {
                            // Combine all activities for timeline
                            let allActivities = [
                              ...traineeMeals.map((meal: any) => ({
                                type: 'meals',
                                id: meal.id,
                                date: meal.date,
                                content: `${t('addedMeal')}: ${meal.name} (${meal.calories} cal)`,
                                icon: UtensilsCrossed,
                                color: 'text-green-500'
                              })),
                              ...traineeWorkoutSessions.map((session: any) => ({
                                type: 'workouts',
                                id: session.id,
                                date: session.completedAt,
                                content: `Completed workout session (${session.duration} minutes)`,
                                icon: Dumbbell,
                                color: 'text-blue-500'
                              })),
                              ...traineeProgress.map((prog: any) => ({
                                type: 'progress',
                                id: prog.id,
                                date: prog.date,
                                content: `${t('weightUpdate')}: ${prog.weight}kg`,
                                icon: Target,
                                color: 'text-orange-500'
                              }))
                            ];

                            // Apply filter
                            if (activityFilter !== 'all') {
                              allActivities = allActivities.filter(activity => activity.type === activityFilter);
                            }

                            // Sort and limit
                            allActivities = allActivities
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .slice(0, 10);

                            if (allActivities.length === 0) {
                              return (
                                <p className="text-center text-gray-500 py-8">
                                  {t('noActivitiesFound')}
                                </p>
                              );
                            }

                            return allActivities.map((activity, index) => {
                              const IconComponent = activity.icon;
                              const uniqueKey = `${activity.type}-${activity.id || index}-${activity.date}`;
                              return (
                                <div key={uniqueKey} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                  <IconComponent className={`w-4 h-4 ${activity.color}`} />
                                  <div className="flex-1">
                                    <p className="text-sm">{activity.content}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(activity.date).toLocaleString()}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {activity.type}
                                  </Badge>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="meals" className="space-y-4">
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {traineeMeals.map((meal: any) => (
                          <div key={meal.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <UtensilsCrossed className="w-4 h-4 text-green-500" />
                                  <h4 className="font-medium">{meal.name}</h4>
                                </div>
                                <p className="text-sm text-gray-600">{meal.description}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-orange-500">{meal.calories}</span> cal
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-blue-500">{meal.proteins}</span>g protein
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-green-500">{meal.carbs}</span>g carbs
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold text-purple-500">{meal.fats}</span>g fat
                                  </span>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-xs text-gray-500">
                                  {formatInAppTz(new Date(meal.date), 'MMM d, yyyy')}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatInAppTz(new Date(meal.date), 'h:mm a')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {traineeMeals.length === 0 && (
                          <p className="text-center text-gray-500 py-8">{t('noMealsRecorded')}</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="workouts" className="space-y-4">
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {traineeWorkoutSessions.map((session: any) => (
                          <div key={session.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Dumbbell className="w-4 h-4 text-blue-500" />
                                  <h4 className="font-medium">{t('workoutSession')}</h4>
                                </div>
                                <div className="flex flex-wrap gap-3 text-sm text-gray-600 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {session.duration} min
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    {session.caloriesBurned} {t('calBurned')}
                                  </span>
                                </div>
                                {session.notes && (
                                  <p className="text-xs text-gray-500 mt-2">💡 {session.notes}</p>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-xs text-gray-500">
                                  {new Date(session.completedAt).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(session.completedAt).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {traineeWorkoutSessions.length === 0 && (
                          <p className="text-center text-gray-500 py-8">{t('noWorkoutSessionsRecorded')}</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="progress" className="space-y-4">
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {traineeProgress.map((prog: any) => (
                          <div key={prog.id} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{t('progressUpdate')}</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-1">
                                  <span>{t('weight')}: {prog.weight}kg</span>
                                  <span>{t('bodyFat')}: {prog.bodyFat}%</span>
                                  <span>{t('muscleMass')}: {prog.muscleMass}kg</span>
                                  <span>{t('waterWeight')}: {prog.waterWeight}kg</span>
                                </div>
                                {prog.notes && (
                                  <p className="text-xs text-gray-500 mt-1">{t('notes')}: {prog.notes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">
                                  {new Date(prog.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {traineeProgress.length === 0 && (
                          <p className="text-center text-gray-500 py-8">{t('noProgressEntriesRecorded')}</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Daily Stats Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {t('dailyStatisticsSummary')}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500">
                    {t('trackDailyNutritionProgress')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {traineeDailyStats.map((stats: any) => {
                      const completionPercentage = stats.caloriesGoal > 0 
                        ? Math.round((stats.calories / stats.caloriesGoal) * 100) 
                        : 0;
                      
                      return (
                        <div key={stats.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarDays className="w-4 h-4 text-blue-500" />
                              <p className="text-sm font-medium">
                                {new Date(stats.date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                              <div className="flex flex-col">
                                <span className="text-gray-500">{t('calories')}</span>
                                <span className="font-semibold">{stats.calories}/{stats.caloriesGoal}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500">{t('protein')}</span>
                                <span className="font-semibold">{stats.protein}g</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500">{t('carbs')}</span>
                                <span className="font-semibold">{stats.carbs || 0}g</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500">{t('fats')}</span>
                                <span className="font-semibold">{stats.fats || 0}g</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <Badge 
                              variant={completionPercentage >= 90 ? "default" : completionPercentage >= 70 ? "secondary" : "outline"} 
                              className="text-xs"
                            >
                              {completionPercentage}%
                            </Badge>
                            <p className="text-xs text-gray-500 mt-1">{t('complete')}</p>
                          </div>
                        </div>
                      );
                    })}
                    {traineeDailyStats.length === 0 && (
                      <p className="text-center text-gray-500 py-8">{t('noDailyStatisticsAvailable')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Nutrition Plans */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5" />
                    {t('nutritionPlan')}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500">
                    {t('currentNutritionPlanGoals')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {detailViewUserPlansLoading ? (
                    <div className="text-sm text-gray-500">{t('loadingNutritionPlan')}</div>
                  ) : (() => {
                    // Filter plans with nutrition data
                    const nutritionPlans = detailViewUserPlans.filter((p: any) => {
                      const goals = p?.goals;
                      if (!goals) return false;
                      return goals.calories !== undefined || goals.protein !== undefined || 
                             goals.carbs !== undefined || goals.fat !== undefined ||
                             (Array.isArray(goals.meals) && goals.meals.length > 0);
                    });
                    const plan = nutritionPlans[0]; // Get most recent
                    
                    return !plan ? (
                      <div className="text-sm text-gray-500">{t('noNutritionPlanAssigned')}</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="border rounded p-3 bg-gray-50">
                          <div className="font-semibold">{plan.title}</div>
                          <div className="text-xs text-gray-500">{t('planId')}: {plan.id} · {t('created')} {plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</div>
                          <div className="text-sm text-gray-600 mt-1">{plan.description}</div>

                          {plan?.goals && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Calories & Macros */}
                              <div className="bg-white rounded border p-3">
                                <div className="text-xs text-gray-500">{t('totalDailyCalories')}</div>
                                <div className="text-lg font-semibold">{plan.goals.calories ?? '—'}</div>
                                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                  <div><span className="text-xs text-gray-500">{t('protein')}</span><div className="font-medium">{plan.goals.protein ?? '—'}g</div></div>
                                  <div><span className="text-xs text-gray-500">{t('carbs')}</span><div className="font-medium">{plan.goals.carbs ?? '—'}g</div></div>
                                  <div><span className="text-xs text-gray-500">{t('fat')}</span><div className="font-medium">{plan.goals.fat ?? '—'}g</div></div>
                                </div>
                              </div>

                              {/* Example Meals */}
                              <div className="bg-white rounded border p-3 md:col-span-2">
                                <div className="font-medium mb-2">{t('exampleMeals')}</div>
                                {(() => {
                                  const meals: string[] = Array.isArray(plan.goals.meals) ? plan.goals.meals : [];
                                  const groups: Record<string, string[]> = {};
                                  for (const m of meals) {
                                    const parts = String(m).split(":");
                                    const key = parts[0]?.trim().toLowerCase() || 'meal';
                                    const rest = parts.slice(1).join(":").trim();
                                    if (!groups[key]) groups[key] = [];
                                    groups[key].push(rest || parts[0]);
                                  }
                                  const order = ['breakfast','lunch','dinner','snacks'];
                                  const keys = Object.keys(groups).sort((a,b)=>{
                                    const ia = order.indexOf(a); const ib = order.indexOf(b);
                                    if (ia === -1 && ib === -1) return a.localeCompare(b);
                                    if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
                                  });
                                  return keys.length ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {keys.map(k => (
                                        <div key={k} className="border rounded p-2">
                                          <div className="text-sm font-semibold capitalize">{t(k)}</div>
                                          <ul className="mt-1 list-disc ml-5 text-sm">
                                            {groups[k].map((it, idx) => <li key={idx}>{it}</li>)}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500">{t('noMealsProvided')}</div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Tips & Recommendations */}
                          {Array.isArray(plan?.goals?.tips) && plan.goals.tips.length > 0 && (
                            <div className="mt-3 bg-white rounded border p-3">
                              <div className="font-medium mb-2">{t('tipsAndRecommendations')}</div>
                              <ul className="list-disc ml-5 text-sm">
                                {plan.goals.tips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Workout Plan */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5" />
                    {t('workoutPlan')}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500">
                    {t('currentWorkoutScheduleExercises')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {detailViewUserPlansLoading ? (
                    <div className="text-sm text-gray-500">Loading workout plan...</div>
                  ) : (() => {
                    // Filter plans with workout data
                    const workoutPlans = detailViewUserPlans.filter((p: any) => {
                      const schedule = p?.weeklySchedule;
                      if (!schedule) return false;
                      return schedule.workouts && Array.isArray(schedule.workouts) && schedule.workouts.length > 0;
                    });
                    const latestPlan = workoutPlans[0]; // Get most recent
                    const workoutPlan = latestPlan?.weeklySchedule;
                    
                    return !workoutPlan ? (
                      <div className="text-sm text-gray-500">{t('noWorkoutPlanAssigned')}</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="border rounded p-3 bg-gray-50">
                          <div className="font-semibold">{latestPlan.title}</div>
                          <div className="text-xs text-gray-500">{t('planId')}: {latestPlan.id} · {t('created')} {latestPlan.createdAt ? new Date(latestPlan.createdAt).toLocaleString() : '—'}</div>
                          <div className="text-sm text-gray-600 mt-1">{latestPlan.description}</div>

                          <div className="mt-3 bg-blue-50 p-3 rounded">
                            <div className="font-medium">{t('focus')}</div>
                            <div className="text-sm">{workoutPlan.focus}</div>
                            <div className="flex gap-4 text-sm mt-1 text-blue-700">
                              <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{latestPlan?.goals?.workoutDays || 0} {t('daysPerWeek')}</span>
                              <span className="flex items-center gap-1"><Activity className="h-4 w-4" />{detailViewUser.fitnessGoal || '—'}</span>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {workoutPlan.workouts?.map((w: any, i: number) => (
                              <div key={i} className="p-3 bg-white rounded border">
                                <div className="flex justify-between">
                                  <div>
                                    <div className="font-medium">{w.day}</div>
                                    <div className="text-xs text-blue-700">{w.type}</div>
                                  </div>
                                  <div className="text-sm text-gray-600">{w.duration}</div>
                                </div>
                                <div className="mt-2 text-xs text-gray-700 space-y-1">
                                  {w.exercises?.map((ex: string, idx: number) => (
                                    <div key={idx}>• {ex}</div>
                                  ))}
                                </div>
                                {w.notes && (
                                  <div className="mt-2 text-xs text-gray-600 italic">{t('note')}: {w.notes}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Subscription Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    {t('subscriptionDetails')}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-500">
                    {t('currentSubscriptionStatusInfo')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="text-xs text-gray-600">{t('currentPlan')}</div>
                      <div className="font-semibold text-sm">{detailViewUser.subscriptionType || t('none')}</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <div className="text-xs text-gray-600">{t('startDate')}</div>
                      <div className="font-semibold text-sm">{detailViewUser.subscriptionStartDate ? new Date(detailViewUser.subscriptionStartDate).toLocaleDateString() : '—'}</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded">
                      <div className="text-xs text-gray-600">{t('endDate')}</div>
                      <div className="font-semibold text-sm">{detailViewUser.subscriptionEndDate ? new Date(detailViewUser.subscriptionEndDate).toLocaleDateString() : '—'}</div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-gray-50 rounded">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{t('status')}</div>
                      <Badge variant={(() => {
                        const status = getSubscriptionStatus(
                          detailViewUser.subscriptionType,
                          detailViewUser.subscriptionStartDate,
                          detailViewUser.subscriptionEndDate
                        );
                        switch (status) {
                          case 'active': return 'default';
                          case 'expired': return 'destructive';
                          case 'suspended': return 'secondary';
                          case 'none':
                          default: return 'outline';
                        }
                      })()} className={(() => {
                        const status = getSubscriptionStatus(
                          detailViewUser.subscriptionType,
                          detailViewUser.subscriptionStartDate,
                          detailViewUser.subscriptionEndDate
                        );
                        return status === 'suspended' ? 'bg-orange-500 text-white' : '';
                      })()}>
                        {(() => {
                          const status = getSubscriptionStatus(
                            detailViewUser.subscriptionType,
                            detailViewUser.subscriptionStartDate,
                            detailViewUser.subscriptionEndDate
                          );
                          switch (status) {
                            case 'active': return t('active');
                            case 'expired': return t('expired');
                            case 'suspended': return t('suspended');
                            case 'none':
                            default: return t('none');
                          }
                        })()}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminDashboard;
