import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from 'wouter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequiredLabel } from '@/components/ui/required-mark';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User as UserIcon, Video as VideoIcon, ExternalLink, Plus, Trash2, Edit, FileBadge2, Eye, Clock, Activity, Sparkles, Info, ShoppingBag, Dumbbell, UtensilsCrossed, Target, TrendingUp, CalendarDays, Filter, X, Megaphone, Phone, UserCog } from 'lucide-react';
import { User, ContentLibrary, CoachProduct } from '@shared/schema';
import { getSubscriptionStatus } from '@shared/subscriptionUtils';
import { normalizeDigitsUniversal } from '@/lib/utils';
import { formatInAppTz } from '@/lib/timezone';
import { useToast } from '@/hooks/use-toast';
import BlogManager from "@/components/blog/BlogManager";
import { MediaUpload } from '@/components/ui/media-upload';
import { AdBanner } from '@/components/ads/AdBanner';
import { useGuestRestriction } from '@/hooks/use-guest-restriction';
import { isPlatformAdminRole } from '@shared/roleAccess';

export default function CoachPage() {
  const { user } = useAuth();
  const { isGuest, blockAction } = useGuestRestriction();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  // Simple role gate
  if (!user) return null;
  if (user.role !== 'coach' && !isPlatformAdminRole(user.role)) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('accessDeniedTitle') || 'Access denied'}</CardTitle>
          </CardHeader>
          <CardContent>
            {t('accessDeniedGeneric') || "You don't have permission to view this page."}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="p-6">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>هذه هي لوحة تحكم المدرب</CardTitle>
            <CardDescription>
              يمكنك بعد إنشاء حساب مدرب إدارة المتدربين، إنشاء الدورات، إصدار الشهادات، ومتابعة الأداء.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• هذه قائمة عملائك ستظهر هنا بعد ربط المتدربين بحسابك.</p>
              <p>• ستتمكن من إنشاء خطط تدريب وغذاء وتتبع التقدم.</p>
              <p>• ستظهر أدوات الفيديو والشهادات وإدارة المحتوى في هذه الصفحة.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="bg-red-900 hover:bg-red-800" onClick={() => navigate('/signup')}>إنشاء حساب</Button>
              <Button variant="outline" onClick={blockAction}>تسجيل الدخول</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // State declarations - must come before queries that use them
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailViewUser, setDetailViewUser] = useState<any>(null);
  const [activityFilter, setActivityFilter] = useState('all');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Users assigned to this coach
  const { data: myUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/coach/my-users'],
  });

  const trimmedSearch = userSearchQuery.trim();
  const { data: traineeSearchResults = [], isLoading: traineeSearchLoading } = useQuery<User[]>({
    queryKey: ['/api/users', 'coach-trainee-search', trimmedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: trimmedSearch,
        limit: '50',
        page: '1',
      });
      const res = await apiRequest('GET', `/api/users?${params.toString()}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json.data || []);
      return rows.filter((u: User) => {
        if (u.role === 'coach' || u.role === 'admin' || u.role === 'super_admin' || u.role === 'gym') return false;
        return !u.coachId || u.coachId === user?.id;
      });
    },
    enabled: trimmedSearch.length >= 2,
  });

  const coachClaimTraineeMutation = useMutation({
    mutationFn: async (traineeId: number) => {
      const res = await apiRequest('PATCH', `/api/coach/users/${traineeId}/assign`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || t('failedToAssignCoach'));
      }
      return res.json();
    },
    onSuccess: (claimed) => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/my-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', 'coach-trainee-search'] });
      setSelectedUser(claimed);
      toast({ title: t('coachAssignedSuccess') });
    },
    onError: (e: any) => {
      toast({ title: t('failedToAssignCoach'), description: e?.message || t('pleaseTryAgain'), variant: 'destructive' });
    },
  });

  const isGlobalSearch = trimmedSearch.length >= 2;
  const displayedUsers = useMemo(() => {
    if (isGlobalSearch) return traineeSearchResults;
    const q = trimmedSearch.toLowerCase();
    return myUsers.filter((u) => {
      if (!q) return true;
      const full = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const contact = ((u as any).whatsappWithCode || '').toLowerCase();
      return full.includes(q) || contact.includes(q);
    });
  }, [isGlobalSearch, traineeSearchResults, myUsers, trimmedSearch]);
  const listLoading = isGlobalSearch ? traineeSearchLoading : usersLoading;

  // Coach videos
  const { data: myVideos = [], isLoading: videosLoading } = useQuery<ContentLibrary[]>({
    queryKey: ['/api/coach/videos'],
  });

  // Coach certificates (course-based)
  const { data: myCerts = [], isLoading: certsLoading } = useQuery({
    queryKey: ['/api/coach/certificates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/coach/certificates');
      return res.json();
    }
  });

  // Issued certificates (all issuances for coach's courses)
  const { data: issuedCertificates = [], isLoading: issuedCertsLoading } = useQuery({
    queryKey: ['/api/coach/all-issued-certificates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/coach/all-issued-certificates');
      return res.json();
    }
  });

  // Coach courses (for dropdown)
  const { data: myCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['/api/coach/courses', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/coach/courses');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }

      if (user?.id) {
        const fallbackRes = await apiRequest('GET', `/api/courses?instructorId=${user.id}`);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          if (Array.isArray(fallbackData) && fallbackData.length > 0) {
            return fallbackData;
          }
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load courses');
      }

      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const formatCertUserLabel = (enrollment: any) => {
    const name = `${enrollment.user?.firstName || ''} ${enrollment.user?.lastName || ''}`.trim();
    const username = enrollment.user?.username ? ` (${enrollment.user.username})` : '';
    const assignedSuffix = enrollment.isAssignedTrainee
      ? ` — ${t('assignedTraineeBadge') || 'Assigned trainee'}`
      : '';
    return `${name || enrollment.user?.email || ''}${username}${assignedSuffix}`;
  };

  // Coach info
  const { data: coachInfo, isLoading: infoLoading } = useQuery({
    queryKey: ['/api/coach/info'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/coach/info');
      return res.json();
    }
  });

  // Fetch detailed trainee activity data when detail view is open
  const { data: traineeProgress = [], isLoading: traineeProgressLoading } = useQuery({
    queryKey: ['/api/admin/trainee-progress', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-progress/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailOpen,
  });

  const { data: traineeMeals = [], isLoading: traineeMealsLoading } = useQuery({
    queryKey: ['/api/admin/trainee-meals', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-meals/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailOpen,
  });

  const { data: traineeWorkoutSessions = [], isLoading: traineeWorkoutSessionsLoading } = useQuery({
    queryKey: ['/api/admin/trainee-workout-sessions', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-workout-sessions/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailOpen,
  });

  const { data: traineeDailyStats = [], isLoading: traineeDailyStatsLoading } = useQuery({
    queryKey: ['/api/admin/trainee-daily-stats', detailViewUser?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/trainee-daily-stats/${detailViewUser?.id}`);
      return await response.json();
    },
    enabled: !!detailViewUser?.id && detailOpen,
  });

  const [infoForm, setInfoForm] = useState({
    aboutMe: '',
    qualifications: '',
    certificateImages: [] as string[],
    trainingApproach: '',
    successStories: '',
    servicesAndPrograms: '',
    contact: '',
  });


  // Update form when data is loaded
  useEffect(() => {
    if (coachInfo) {
      setInfoForm({
        aboutMe: coachInfo.aboutMe || '',
        qualifications: coachInfo.qualifications || '',
        certificateImages: coachInfo.certificateImages || [],
        trainingApproach: coachInfo.trainingApproach || '',
        successStories: coachInfo.successStories || '',
        servicesAndPrograms: coachInfo.servicesAndPrograms || '',
        contact: coachInfo.contact || '',
      });
    }
  }, [coachInfo]);

  // Video form state
  const [videoForm, setVideoForm] = useState({
    id: 0,
    title: '',
    url: '',
    category: 'tutorial',
    description: '',
    thumbnailUrl: '',
    tags: '' as string | string[],
    duration: '' as number | string,
  });
  const [isEditing, setIsEditing] = useState(false);
  // Certificate form state (for course certificates)
  const [certForm, setCertForm] = useState({ 
    id: 0, 
    courseId: 0,
    title: '', 
    titleAr: '',
    description: '',
    descriptionAr: '',
    templateUrl: '',
    issueAutomatically: false,
    issueUponCompletion: true
  });
  const [certEditing, setCertEditing] = useState(false);
  const [selectedCertForIssuance, setSelectedCertForIssuance] = useState<any>(null);
  const [selectedUsersForIssuance, setSelectedUsersForIssuance] = useState<number[]>([]);
  const [issuanceNotesDialog, setIssuanceNotesDialog] = useState('');
  const [issuanceDialogOpen, setIssuanceDialogOpen] = useState(false);

  // Manual certificate creation state
  const [manualCertCourseId, setManualCertCourseId] = useState<number>(0);
  const [manualCertUserId, setManualCertUserId] = useState<number>(0);

  // Get enrolled users for selected course in manual cert creation
  const { data: manualCertEnrolledUsers = [], isLoading: manualCertUsersLoading } = useQuery({
    queryKey: [`/api/courses/${manualCertCourseId}/enrolled-users`],
    enabled: !!manualCertCourseId && manualCertCourseId > 0,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/courses/${manualCertCourseId}/enrolled-users`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load users');
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Get enrolled users for selected course
  const { data: enrolledUsers = [], isLoading: enrolledUsersLoading } = useQuery({
    queryKey: [`/api/courses/${selectedCertForIssuance?.courseId}/enrolled-users`],
    enabled: !!selectedCertForIssuance?.courseId,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/courses/${selectedCertForIssuance?.courseId}/enrolled-users`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to load users');
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Get issuance history
  const { data: issuanceHistory = [], isLoading: issuanceHistoryLoading } = useQuery({
    queryKey: [`/api/coach/certificates/${selectedCertForIssuance?.id}/issuances`],
    enabled: !!selectedCertForIssuance?.id,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/coach/certificates/${selectedCertForIssuance?.id}/issuances`);
      return res.json();
    }
  });

  // Coach products
  const { data: myProducts = [], isLoading: productsLoading } = useQuery<CoachProduct[]>({
    queryKey: ['/api/coach/products'],
  });

  // Product form state
  const [productForm, setProductForm] = useState({ id: 0, title: '', url: '', description: '', thumbnailUrl: '' });
  const [productEditing, setProductEditing] = useState(false);

  // Users tab state (admin-like)
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [unassignConfirmOpen, setUnassignConfirmOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserFormData, setEditUserFormData] = useState({
    whatsappWithCode: '',
  });

  // Coach-scoped edit/delete mutations
  const coachEditUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: number, userData: any }) => {
      const payload = {
        whatsappWithCode: userData.whatsappWithCode,
        ...(userData.phoneNumber !== undefined ? { phoneNumber: userData.phoneNumber } : {}),
      };
      const res = await apiRequest('PATCH', `/api/coach/users/${userId}`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || t('failedToUpdateUser'));
      }
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/my-users'] });
      setEditUserDialogOpen(false);
      setEditingUser(null);
      // update selected user if matches
      if (selectedUser && updated.id === selectedUser.id) {
        setSelectedUser(updated);
      }
      toast({ title: t('contactUpdatedSuccessfully') });
    },
    onError: (e: any) => {
      toast({ title: t('updateFailed'), description: e?.message || t('pleaseTryAgain'), variant: 'destructive' });
    }
  });

  const coachUnassignUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('PATCH', `/api/coach/users/${userId}/unassign`, {});
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || t('failedToUnassignUser'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/my-users'] });
      setUnassignConfirmOpen(false);
      if (selectedUser && editingUser && selectedUser.id === editingUser.id) {
        setSelectedUser(null);
      }
      setEditingUser(null);
      toast({ title: t('userUnassignedSuccessfully') });
    },
    onError: (e: any) => {
      toast({ title: t('unassignFailed'), description: e?.message || t('pleaseTryAgain'), variant: 'destructive' });
    }
  });

  // Plan/workout editor state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'workout' | 'nutrition'>('workout');
  const [isPlanEditing, setIsPlanEditing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  // Mutations for plans
  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/user-plans', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      if (selectedUser?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/user-plans', selectedUser.id] });
        // Also invalidate the specific queries used by /nutrition and /workouts pages
        queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
        queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }, selectedUser.id] });
      }
      setPlanDialogOpen(false);
      setEditingPlan(null);
      setIsPlanEditing(false);
      toast({ title: 'Plan created successfully' });
    },
    onError: (e: any) => {
      toast({ title: t('failedToCreatePlan'), description: e?.message || t('pleaseTryAgain'), variant: 'destructive' });
    }
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, updateData }: { planId: number, updateData: any }) => {
      const response = await apiRequest('PATCH', `/api/user-plans/${planId}`, updateData);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || t('failedToUpdatePlan'));
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      if (selectedUser?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/user-plans', selectedUser.id] });
        // Also invalidate the specific queries used by /nutrition and /workouts pages
        queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
        queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }, selectedUser.id] });
      }
      setEditingPlan(null);
      setIsPlanEditing(false);
      setPlanDialogOpen(false);
      toast({ title: 'Plan updated successfully' });
    },
    onError: (e: any) => {
      toast({ title: t('failedToUpdatePlan'), description: e?.message || t('pleaseTryAgain'), variant: 'destructive' });
    }
  });

  // Listen for open dialog events from subcomponents
  // Using event to avoid prop drilling into nested functions defined below
  // Register once per render
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemo(() => {
    const handler = (e: any) => {
      const { user: targetUser, type, mode, plan } = e.detail || {};
      if (!targetUser) return;
      setSelectedUser(targetUser);
      setDialogType(type);
      setIsPlanEditing(mode === 'edit');
      setEditingPlan(plan || null);
      setPlanDialogOpen(true);
    };
    window.addEventListener('coach-plan-open', handler as any);
    return () => window.removeEventListener('coach-plan-open', handler as any);
  }, [setSelectedUser]);

  const resetForm = () => {
    setVideoForm({ id: 0, title: '', url: '', category: 'tutorial', description: '', thumbnailUrl: '', tags: '', duration: '' });
    setIsEditing(false);
  };

  // Reusable validation function for video form
  const validateVideoForm = () => {
    if (!videoForm.title?.trim()) {
      throw new Error(t('titleIsRequired'));
    }
    if (!videoForm.url?.trim()) {
      throw new Error(t('videoUrlIsRequired'));
    }
    if (!videoForm.category?.trim()) {
      throw new Error(t('categoryIsRequired'));
    }
  };

  const createVideo = useMutation({
    mutationFn: async () => {
      validateVideoForm();
      
      const payload: any = {
        title: videoForm.title,
        url: videoForm.url,
        category: videoForm.category,
        description: videoForm.description || undefined,
        thumbnailUrl: videoForm.thumbnailUrl || undefined,
        tags: typeof videoForm.tags === 'string' && videoForm.tags.trim() ? videoForm.tags.split(',').map(t => t.trim()) : [],
        duration: videoForm.duration ? Number(videoForm.duration) : undefined,
      };
      const res = await apiRequest('POST', '/api/coach/videos', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/videos'] });
      resetForm();
      toast({ title: t('videoAddedSuccessfully') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToAddVideo'), 
        description: error?.message || t('pleaseTryAgain'), 
        variant: 'destructive' 
      });
    }
  });

  const updateVideo = useMutation({
    mutationFn: async () => {
      validateVideoForm();
      
      const id = videoForm.id;
      const payload: any = {
        title: videoForm.title,
        url: videoForm.url,
        category: videoForm.category,
        description: videoForm.description || undefined,
        thumbnailUrl: videoForm.thumbnailUrl || undefined,
        tags: typeof videoForm.tags === 'string' && videoForm.tags.trim() ? videoForm.tags.split(',').map(t => t.trim()) : [],
        duration: videoForm.duration ? Number(videoForm.duration) : undefined,
        type: 'video',
      };
      const res = await apiRequest('PATCH', `/api/coach/videos/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/videos'] });
      resetForm();
      toast({ title: t('videoUpdatedSuccessfully') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateVideo'), 
        description: error?.message || t('pleaseTryAgain'), 
        variant: 'destructive' 
      });
    }
  });

  const deleteVideo = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/coach/videos/${id}`);
      return res.text();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/videos'] });
      toast({ title: t('videoDeletedSuccessfully') });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToDeleteVideo'), 
        description: error?.message || t('pleaseTryAgain'), 
        variant: 'destructive' 
      });
    }
  });

  const resetCert = () => { 
    setCertForm({ 
      id: 0, 
      courseId: 0,
      title: '', 
      titleAr: '',
      description: '',
      descriptionAr: '',
      templateUrl: '',
      issueAutomatically: false,
      issueUponCompletion: true
    }); 
    setCertEditing(false); 
  };

  const createCert = useMutation({
    mutationFn: async () => {
      if (!certForm.courseId) {
        throw new Error(t('selectCourse') || 'Please select a course');
      }
      if (!certForm.title.trim()) {
        throw new Error(t('courseCertificateTitle') || 'Title is required');
      }
      const payload = {
        courseId: certForm.courseId,
        title: certForm.title,
        titleAr: certForm.titleAr,
        description: certForm.description,
        descriptionAr: certForm.descriptionAr,
        templateUrl: certForm.templateUrl,
        issueAutomatically: certForm.issueAutomatically,
        issueUponCompletion: certForm.issueUponCompletion
      };
      const res = await apiRequest('POST', '/api/coach/certificates', payload);
      return res.json();
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/coach/certificates'] }); 
      resetCert(); 
      toast({ title: t('courseCreateCertificateSuccess') || 'Certificate created successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('courseCreateCertificateFailed') || 'Failed to create certificate', 
        description: error?.message || t('pleaseTryAgain'), 
        variant: 'destructive' 
      });
    }
  });

  const updateCert = useMutation({
    mutationFn: async () => {
      if (!certForm.title.trim()) {
        throw new Error(t('courseCertificateTitle') || 'Title is required');
      }
      const id = certForm.id;
      const payload = {
        title: certForm.title,
        titleAr: certForm.titleAr,
        description: certForm.description,
        descriptionAr: certForm.descriptionAr,
        templateUrl: certForm.templateUrl,
        issueAutomatically: certForm.issueAutomatically,
        issueUponCompletion: certForm.issueUponCompletion
      };
      const res = await apiRequest('PATCH', `/api/coach/certificates/${id}`, payload);
      return res.json();
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/coach/certificates'] }); 
      resetCert(); 
      toast({ title: t('courseUpdateCertificateSuccess') || 'Certificate updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('courseUpdateCertificateFailed') || 'Failed to update certificate', 
        description: error?.message || t('pleaseTryAgain'), 
        variant: 'destructive' 
      });
    }
  });

  const deleteCert = useMutation({
    mutationFn: async (id: number) => { 
      const res = await apiRequest('DELETE', `/api/coach/certificates/${id}`);
      return res.json();
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/coach/certificates'] }); 
      toast({ title: t('courseDeleteCertificateSuccess') || 'Certificate deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('courseDeleteCertificateFailed') || 'Failed to delete certificate', 
        description: error?.message || t('pleaseTryAgain'), 
        variant: 'destructive' 
      });
    }
  });

  const issueCert = useMutation({
    mutationFn: async () => {
      if (selectedUsersForIssuance.length === 0) {
        throw new Error(t('selectUsers') || 'Please select at least one user');
      }
      const payload = {
        userIds: selectedUsersForIssuance,
        notes: issuanceNotesDialog
      };
      const res = await apiRequest('POST', `/api/coach/certificates/${selectedCertForIssuance.id}/issue`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/coach/certificates/${selectedCertForIssuance.id}/issuances`] });
      setSelectedUsersForIssuance([]);
      setIssuanceNotesDialog('');
      setIssuanceDialogOpen(false);
      toast({ title: t('courseIssueCertificateSuccess') || 'Certificates issued successfully' });
    },
    onError: (error: any) => {
      toast({
        title: t('courseIssueCertificateFailed') || 'Failed to issue certificates',
        description: error?.message || t('pleaseTryAgain'),
        variant: 'destructive'
      });
    }
  });

  // Manual certificate creation mutation
  const createManualCertificate = useMutation({
    mutationFn: async () => {
      if (!manualCertCourseId) {
        throw new Error(t('selectCourse') || 'Please select a course');
      }
      if (!manualCertUserId) {
        throw new Error(t('selectUser') || 'Please select a user');
      }
      
      // Call the endpoint to manually issue certificate
      const res = await apiRequest('POST', `/api/coach/issue-certificate-to-user`, {
        courseId: manualCertCourseId,
        userId: manualCertUserId
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/certificates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/certificates'] });
      setManualCertCourseId(0);
      setManualCertUserId(0);
      toast({ 
        title: t('certificateCreatedSuccess') || 'Certificate created successfully',
        description: t('certificateCreatedDesc') || 'The certificate has been issued to the user'
      });
    },
    onError: (error: any) => {
      toast({
        title: t('certificateCreationFailed') || 'Failed to create certificate',
        description: error?.message || t('pleaseTryAgain'),
        variant: 'destructive'
      });
    }
  });

  const startEditCert = (c: any) => { 
    setCertForm({ 
      id: c.id, 
      courseId: c.courseId,
      title: c.title || '', 
      titleAr: c.titleAr || '',
      description: c.description || '',
      descriptionAr: c.descriptionAr || '',
      templateUrl: c.templateUrl || '',
      issueAutomatically: c.issueAutomatically || false,
      issueUponCompletion: c.issueUponCompletion !== false
    }); 
    setCertEditing(true); 
  };

  // Product mutations
  const resetProduct = () => { setProductForm({ id: 0, title: '', url: '', description: '', thumbnailUrl: '' }); setProductEditing(false); };
  const createProduct = useMutation({
    mutationFn: async () => {
      if (!productForm.title?.trim()) {
        throw new Error(t('titleRequired') || 'Title is required');
      }
      if (!productForm.url?.trim()) {
        throw new Error(t('productUrlRequired') || 'Product URL is required');
      }
      const payload: any = { title: productForm.title, url: productForm.url, description: productForm.description || undefined, thumbnailUrl: productForm.thumbnailUrl || undefined };
      const res = await apiRequest('POST', '/api/coach/products', payload);
      return res.json();
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/coach/products'] }); 
      resetProduct(); 
      toast({ title: t('productAddedSuccess') || 'Product added successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToAddProduct') || 'Failed to add product', 
        description: error?.message || t('pleaseTryAgain') || 'Please try again', 
        variant: 'destructive' 
      });
    }
  });
  const updateProduct = useMutation({
    mutationFn: async () => {
      if (!productForm.title?.trim()) {
        throw new Error(t('titleRequired') || 'Title is required');
      }
      if (!productForm.url?.trim()) {
        throw new Error(t('productUrlRequired') || 'Product URL is required');
      }
      const id = productForm.id;
      const payload: any = { title: productForm.title, url: productForm.url, description: productForm.description || undefined, thumbnailUrl: productForm.thumbnailUrl || undefined };
      const res = await apiRequest('PATCH', `/api/coach/products/${id}`, payload);
      return res.json();
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/coach/products'] }); 
      resetProduct(); 
      toast({ title: t('productUpdatedSuccess') || 'Product updated successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToUpdateProduct') || 'Failed to update product', 
        description: error?.message || t('pleaseTryAgain') || 'Please try again', 
        variant: 'destructive' 
      });
    }
  });
  const deleteProduct = useMutation({
    mutationFn: async (id: number) => { const res = await apiRequest('DELETE', `/api/coach/products/${id}`); return res.text(); },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['/api/coach/products'] }); 
      toast({ title: t('productDeletedSuccess') || 'Product deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: t('failedToDeleteProduct') || 'Failed to delete product', 
        description: error?.message || t('pleaseTryAgain') || 'Please try again', 
        variant: 'destructive' 
      });
    }
  });
  const startEditProduct = (p: CoachProduct) => { setProductForm({ id: p.id, title: p.title || '', url: p.url || '', description: p.description || '', thumbnailUrl: p.thumbnailUrl || '' }); setProductEditing(true); };

  // Coach info mutation
  const saveCoachInfo = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/coach/info', infoForm);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coach/info'] });
      toast({ title: t('coachInfoSavedSuccessfully') });
    },
    onError: (error: any) => {
      toast({
        title: t('failedToSaveInfo'),
        description: error?.message || t('pleaseTryAgain'),
        variant: 'destructive'
      });
    }
  });

  const startEdit = (v: ContentLibrary) => {
    // Map old category values to new valid ones
    const validCategories = ['tutorial', 'nutrition', 'flexibility', 'strength-training', 'cardio'];
    const categoryMap: Record<string, string> = {
      'workout': 'tutorial',
      'exercise': 'tutorial',
      'strength': 'strength-training',
    };
    
    let category = v.category || 'tutorial';
    // Use mapped value if category is not in valid list
    if (!validCategories.includes(category)) {
      category = categoryMap[category] || categoryMap[category.toLowerCase()] || 'tutorial';
    }
    
    setVideoForm({
      id: v.id,
      title: v.title || '',
      url: v.url || '',
      category,
      description: v.description || '',
      thumbnailUrl: v.thumbnailUrl || '',
      tags: (v.tags || []).join(', '),
      duration: v.duration || '',
    });
    setIsEditing(true);
  };

  return (
    <div className="p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/profile')}>
            {t('editProfile') || 'Edit Profile'}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Ad Banners */}
      <AdBanner />

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('accountSettings') || 'Account Settings'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{t('changePassword') || 'Change Password'}</p>
              <p className="text-sm text-muted-foreground">
                {t('updateYourPassword') || 'Update your account password'}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/reset')}>
              {t('changePassword') || 'Change Password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coach-specific referral/signup link */}
      <Card>
        <CardHeader>
          <CardTitle>{t('inviteLink') || 'Invite Link'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <Label htmlFor="invite-link" className="md:w-40">{t('signupUrl') || 'Signup URL'}</Label>
            <div className="flex-1 flex gap-2">
              <Input
                id="invite-link"
                readOnly
                value={`${window.location.origin}/signup?coachId=${user.id}`}
              />
              <Button
                type="button"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/signup?coachId=${user.id}`)}
              >
                {t('copy') || 'Copy'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="users">
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          <TabsList className="w-full sm:w-auto inline-flex">
            <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap"><UserIcon className="h-4 w-4"/> <span className="hidden sm:inline">{t('myTrainees')}</span><span className="sm:hidden">{t('myTrainees')}</span></TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap"><VideoIcon className="h-4 w-4"/> <span className="hidden sm:inline">{t('videoLibrary')}</span><span className="sm:hidden">{t('videoLibrary')}</span></TabsTrigger>
            <TabsTrigger value="certs" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap"><FileBadge2 className="h-4 w-4"/> <span className="hidden sm:inline">{t('certificates')}</span><span className="sm:hidden">{t('certificates')}</span></TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap"><ShoppingBag className="h-4 w-4"/> <span className="hidden sm:inline">{t('myProducts')}</span><span className="sm:hidden">{t('myProducts')}</span></TabsTrigger>
            <TabsTrigger value="blog" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap"><FileBadge2 className="h-4 w-4"/> <span className="hidden sm:inline">{t('blogPosts')}</span><span className="sm:hidden">{t('blogPosts')}</span></TabsTrigger>
            <TabsTrigger value="info" className="flex items-center gap-1 sm:gap-2 whitespace-nowrap"><Info className="h-4 w-4"/> <span className="hidden sm:inline">{t('profileAndSettings')}</span><span className="sm:hidden">{t('profileAndSettings')}</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Users list */}
            <Card className={`lg:col-span-1 ${isArabic ? 'lg:order-2' : 'lg:order-1'}`}>
              <CardHeader>
                <CardTitle>{t('myUsers') || 'My Users'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <Input
                    placeholder={t('searchByNameOrPhone') || 'Search by name or phone'}
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                  />
                </div>
                {listLoading ? (
                  <div>{t('loading') || 'Loading users…'}</div>
                ) : (
                  <div className="space-y-2">
                    {isGlobalSearch && displayedUsers.length > 0 && (
                      <div className="text-sm text-green-600 mb-2 font-medium">
                        {t('foundUsers')} {displayedUsers.length}
                      </div>
                    )}
                    {displayedUsers.map((u) => {
                      const isAssignedToMe = u.coachId === user?.id;
                      const canClaim = isGlobalSearch && !u.coachId;
                      return (
                        <div
                          key={u.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            selectedUser?.id === u.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                if (!isAssignedToMe && !canClaim) return;
                                setSelectedUser(u);
                              }}
                            >
                              <div className="font-medium">{u.firstName} {u.lastName}</div>
                              {(u as any).whatsappWithCode && (
                                <div className="text-xs text-gray-500">📞 {(u as any).whatsappWithCode}</div>
                              )}
                              {canClaim && (
                                <div className="text-xs text-blue-600 mt-1">{t('noCoachAssigned')}</div>
                              )}
                            </div>
                            <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto sm:grid-cols-3">
                              {canClaim ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 whitespace-nowrap justify-center col-span-2 sm:col-span-3"
                                  title={t('assignSelfAsCoach')}
                                  disabled={coachClaimTraineeMutation.isPending}
                                  onClick={() => coachClaimTraineeMutation.mutate(u.id)}
                                >
                                  <UserCog className="w-4 h-4" />
                                  <span>{t('assignSelfAsCoach')}</span>
                                </Button>
                              ) : isAssignedToMe ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 whitespace-nowrap justify-center"
                                    title={t('viewDetails')}
                                    onClick={() => {
                                      setDetailViewUser(u);
                                      setEditingUser(u);
                                      setDetailOpen(true);
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                    <span>{t('viewDetails') || t('view') || 'View'}</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 whitespace-nowrap justify-center"
                                    title={t('editContactInfo')}
                                    onClick={() => {
                                      setEditingUser(u);
                                      setEditUserFormData({
                                        whatsappWithCode: (u as any).whatsappWithCode || ''
                                      });
                                      setEditUserDialogOpen(true);
                                    }}
                                  >
                                    <Phone className="w-4 h-4" />
                                    <span>{t('editContactInfo')}</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title={t('unassign')}
                                    onClick={() => { setEditingUser(u); setUnassignConfirmOpen(true); }}
                                    className="h-8 whitespace-nowrap justify-center text-orange-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>{t('unassign') || 'Unassign'}</span>
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {displayedUsers.length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        {isGlobalSearch
                          ? `${t('noUserFoundMatching')} "${trimmedSearch}"`
                          : (t('noUsersAssignedYet') || 'No users assigned yet.')}
                        {!isGlobalSearch && (
                          <p className="text-xs mt-1">{t('useSearchToAddTrainee')}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User details */}
            <div className={`lg:col-span-2 ${isArabic ? 'lg:order-1' : 'lg:order-2'}`}>
              {selectedUser ? (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('traineeInformation')}</CardTitle>
                      <CardDescription>{t('coachLimitedTraineePermissions')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-gray-500">{t('name')}</div>
                          <div className="font-semibold text-sm">{selectedUser.firstName} {selectedUser.lastName}</div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-gray-500">{t('email') || 'Email'}</div>
                          <div className="font-semibold text-sm break-all">{(selectedUser as any).email || '—'}</div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-gray-500">{t('phone')}</div>
                          <div className="font-semibold text-sm">{(selectedUser as any).whatsappWithCode || '—'}</div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-gray-500">{t('subscription')}</div>
                          <div className="flex items-center gap-2">
                            <Badge variant={(() => {
                              const status = getSubscriptionStatus(
                                (selectedUser as any).subscriptionType,
                                (selectedUser as any).subscriptionStartDate,
                                (selectedUser as any).subscriptionEndDate,
                              );
                              if (status === 'active') return 'default';
                              if (status === 'expired') return 'destructive';
                              if (status === 'suspended') return 'secondary';
                              return 'outline';
                            })()}>
                              {(() => {
                                const status = getSubscriptionStatus(
                                  (selectedUser as any).subscriptionType,
                                  (selectedUser as any).subscriptionStartDate,
                                  (selectedUser as any).subscriptionEndDate,
                                );
                                if (status === 'active') return t('active');
                                if (status === 'expired') return t('expired');
                                if (status === 'suspended') return t('suspended');
                                return t('none');
                              })()}
                            </Badge>
                            <span className="text-xs text-gray-500">{(selectedUser as any).subscriptionType || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Tabs defaultValue="plans" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-3 h-auto">
                      <TabsTrigger value="plans" className="flex items-center gap-2 py-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        <span>{t('nutritionPlans')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="workouts" className="flex items-center gap-2 py-2">
                        <Dumbbell className="h-4 w-4" />
                        <span>{t('workouts')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="subscription" className="flex items-center gap-2 py-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>{t('subscription')}</span>
                      </TabsTrigger>
                    </TabsList>

                    <UserPlansSection user={selectedUser} />
                    <UserWorkoutsSection user={selectedUser} />
                    <UserSubscriptionSection user={selectedUser} />
                  </Tabs>
                </div>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-48">
                    <div className="text-center text-gray-500">
                      {t('selectUserToManagePlans') || 'Select a user to manage their plans'}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="videos">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('myVideos') || 'My Videos'}</CardTitle>
              </CardHeader>
              <CardContent>
                {videosLoading ? (
                  <div>{t('loadingVideos') || 'Loading videos…'}</div>
                ) : (
                  <div className="space-y-3">
                    {myVideos.map(v => (
                      <div key={v.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{v.title}</div>
                          </div>
                          <div className="text-xs text-gray-500">{v.category} • {v.url}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(v)}><Edit className="h-4 w-4 mr-1"/> {t('edit') || 'Edit'}</Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteVideo.mutate(v.id)}><Trash2 className="h-4 w-4 mr-1"/> {t('delete') || 'Delete'}</Button>
                        </div>
                      </div>
                    ))}
                    {myVideos.length === 0 && (
                      <div className="text-sm text-gray-500">{t('noVideosYet') || 'No videos yet. Add your first one.'}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEditing ? (t('editVideo') || 'Edit Video') : (t('addVideo') || 'Add Video')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="title">{t('title') || 'Title'} <span className="text-red-500">*</span></Label>
                  <Input id="title" value={videoForm.title} onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div>
                  <MediaUpload
                    label={`${t('videoUrl') || 'Video URL'} *`}
                    value={videoForm.url}
                    onChange={(url) => setVideoForm(f => ({ ...f, url }))}
                    accept="video/*"
                    placeholder="https://..."
                    mediaType="video"
                  />
                </div>
                <div>
                  <Label htmlFor="category">{t('category') || 'Category'} <span className="text-red-500">*</span></Label>
                  <Select value={videoForm.category} onValueChange={(value) => setVideoForm(f => ({ ...f, category: value }))}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder={t('selectCategory') || 'Select a category'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tutorial">{t('tutorial') || 'Tutorial'}</SelectItem>
                      <SelectItem value="nutrition">{t('nutrition') || 'Nutrition'}</SelectItem>
                      <SelectItem value="flexibility">{t('flexibility') || 'Flexibility'}</SelectItem>
                      <SelectItem value="strength-training">{t('strengthTraining') || 'Strength Training'}</SelectItem>
                      <SelectItem value="cardio">{t('cardio') || 'Cardio'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <MediaUpload
                  label={t('thumbnailUrl') || 'Thumbnail URL'}
                  value={videoForm.thumbnailUrl}
                  onChange={(url) => setVideoForm(f => ({ ...f, thumbnailUrl: url }))}
                  accept="image/*"
                  placeholder="https://..."
                  mediaType="image"
                />
                <div>
                  <Label htmlFor="duration">{t('durationSeconds') || 'Duration (seconds)'}</Label>
                  <Input id="duration" value={videoForm.duration} onChange={e => setVideoForm(f => ({ ...f, duration: e.target.value }))} type="number" />
                </div>
                <div>
                  <Label htmlFor="tags">{t('tagsCommaSeparated') || 'Tags (comma separated)'}</Label>
                  <Input id="tags" value={typeof videoForm.tags === 'string' ? videoForm.tags : ''} onChange={e => setVideoForm(f => ({ ...f, tags: e.target.value }))} placeholder={t('tagsPlaceholder') || 'legs, chest, cardio'} />
                </div>
                <div>
                  <Label htmlFor="description">{t('description') || 'Description'}</Label>
                  <Input id="description" value={videoForm.description} onChange={e => setVideoForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button onClick={() => updateVideo.mutate()} disabled={updateVideo.isPending}>
                        <Edit className="h-4 w-4 mr-1"/> {updateVideo.isPending ? t('updating') : t('update')}
                      </Button>
                      <Button variant="outline" onClick={resetForm}>{t('cancel')}</Button>
                    </>
                  ) : (
                    <Button onClick={() => createVideo.mutate()} disabled={createVideo.isPending}>
                      <Plus className="h-4 w-4 mr-1"/> {createVideo.isPending ? (t('adding') || 'Adding...') : (t('addVideo') || 'Add Video')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

          <TabsContent value="certs">
            {/* Manual Certificate Creation Section */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{t('createCertificate') || 'Create Certificate'}</CardTitle>
                <CardDescription>{t('createCertificateDesc') || 'Manually create and issue a certificate to a user enrolled in your course'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="manual-cert-course">{t('selectCourse')} <span className="text-red-500">*</span></Label>
                    <Select 
                      value={manualCertCourseId?.toString() || ''} 
                      onValueChange={(val) => {
                        setManualCertCourseId(parseInt(val));
                        setManualCertUserId(0); // Reset user selection when course changes
                      }}
                    >
                      <SelectTrigger id="manual-cert-course">
                        <SelectValue placeholder={t('selectCourse')} />
                      </SelectTrigger>
                      <SelectContent>
                        {coursesLoading ? (
                          <div className="p-2 text-sm text-gray-500">{t('loading')}</div>
                        ) : myCourses.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">{t('noCourses')}</div>
                        ) : (
                          myCourses.map((course: any) => (
                            <SelectItem key={course.id} value={course.id.toString()}>
                              {course.title || course.titleAr}
                              {course.title && course.titleAr && ` | ${course.titleAr}`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="manual-cert-user">{t('selectUser')} <span className="text-red-500">*</span></Label>
                    <Select 
                      value={manualCertUserId?.toString() || ''} 
                      onValueChange={(val) => setManualCertUserId(parseInt(val))}
                      disabled={!manualCertCourseId || manualCertUsersLoading}
                    >
                      <SelectTrigger id="manual-cert-user">
                        <SelectValue placeholder={
                          !manualCertCourseId 
                            ? t('selectCourseFirst') || 'Select course first'
                            : manualCertUsersLoading 
                            ? t('loading')
                            : t('selectUser')
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {manualCertEnrolledUsers.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">
                            {t('noEnrolledUsersOrTrainees') || 'No enrolled users or assigned trainees for this course'}
                          </div>
                        ) : (
                          manualCertEnrolledUsers.map((enrollment: any) => (
                            <SelectItem key={enrollment.userId} value={enrollment.userId.toString()}>
                              {formatCertUserLabel(enrollment)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={() => createManualCertificate.mutate()}
                      disabled={!manualCertCourseId || !manualCertUserId || createManualCertificate.isPending}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {createManualCertificate.isPending 
                        ? (t('creating') || 'Creating...') 
                        : (t('createCertificate') || 'Create Certificate')
                      }
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-1">{t('note') || 'Note'}:</p>
                  <p>{t('manualCertNote') || 'The certificate will be automatically generated based on the course template and will be immediately available in the user\'s dashboard.'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Issued Certificates Section */}
            <Card>
              <CardHeader>
                <CardTitle>{t('issuedCertificates') || 'Issued Certificates'}</CardTitle>
                <CardDescription>{t('manageCertificates') || 'View all certificates issued for your courses'}</CardDescription>
              </CardHeader>
              <CardContent>
                {issuedCertsLoading ? (
                  <div>{t('loading')}</div>
                ) : issuedCertificates.length === 0 ? (
                  <div className="text-center py-8">
                    <FileBadge2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">{t('noCertificatesIssued')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issuedCertificates.map((cert: any) => (
                      <Card key={cert.id} className="border">
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-semibold">
                                  {cert.user?.firstName} {cert.user?.lastName}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {t('course')}: {cert.course?.title}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {t('issuedDate')}: {new Date(cert.issuedAt).toLocaleDateString()}
                                </div>
                                {cert.notes && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {cert.notes}
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline">
                                #{cert.id.toString().padStart(6, '0')}
                              </Badge>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button 
                                size="sm" 
                                className="bg-red-800 text-white hover:bg-red-900"
                                onClick={() => cert.certificateUrl && window.open(cert.certificateUrl, '_blank')}
                                disabled={!cert.certificateUrl}
                              >
                                <Eye className="h-4 w-4 mr-1"/> {t('viewCertificate') || 'View'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Issuance Dialog */}
            <Dialog open={issuanceDialogOpen} onOpenChange={setIssuanceDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t('issueCertificatesToUsers') || 'Issue Certificates to Users'}</DialogTitle>
                  <DialogDescription>{selectedCertForIssuance?.title}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Enrolled Users Selection */}
                  <div>
                    <Label>{t('selectUsersEnrolled') || 'Select enrolled users'} <span className="text-red-500">*</span></Label>
                    {enrolledUsersLoading ? (
                      <div className="text-sm text-gray-500">{t('loading')}</div>
                    ) : enrolledUsers.length === 0 ? (
                      <div className="text-sm text-gray-500">{t('noEnrolledUsersOrTrainees') || 'No enrolled users or assigned trainees for this course'}</div>
                    ) : (
                      <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                        {enrolledUsers.map((enrollment: any) => (
                          <div key={enrollment.userId} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`user-${enrollment.userId}`}
                              checked={selectedUsersForIssuance.includes(enrollment.userId)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsersForIssuance([...selectedUsersForIssuance, enrollment.userId]);
                                } else {
                                  setSelectedUsersForIssuance(selectedUsersForIssuance.filter(id => id !== enrollment.userId));
                                }
                              }}
                            />
                            <label htmlFor={`user-${enrollment.userId}`} className="flex-1 cursor-pointer text-sm">
                              {formatCertUserLabel(enrollment)}
                              {enrollment.user?.email ? ` (${enrollment.user.email})` : ''}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Issuance History */}
                  {issuanceHistoryLoading ? null : issuanceHistory.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-600">{t('previousIssuances') || 'Previously Issued'}</Label>
                      <div className="text-xs space-y-1">
                        {issuanceHistory.map((issuance: any) => (
                          <div key={issuance.id} className="text-gray-600">
                            {issuance.user?.firstName} {issuance.user?.lastName} - {new Date(issuance.issuedAt).toLocaleDateString()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <Label htmlFor="issuance-notes">{t('notes')} {t('optional')}</Label>
                    <Textarea 
                      id="issuance-notes"
                      value={issuanceNotesDialog}
                      onChange={(e) => setIssuanceNotesDialog(e.target.value)}
                      rows={2}
                      placeholder={t('addNotesForIssuance') || 'Add any notes for this issuance...'}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => issueCert.mutate()} disabled={issueCert.isPending || selectedUsersForIssuance.length === 0} className="flex-1">
                      {issueCert.isPending ? t('issuing') : t('issue')} {selectedUsersForIssuance.length > 0 && `(${selectedUsersForIssuance.length})`}
                    </Button>
                    <Button variant="outline" onClick={() => setIssuanceDialogOpen(false)} className="flex-1">{t('cancel')}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

        <TabsContent value="products">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('myProducts')}</CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div>Loading products…</div>
                ) : (
                  <div className="space-y-3">
                    {myProducts.map(p => (
                      <div key={p.id} className="border rounded-lg p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm sm:text-base break-words">{p.title}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                                {p.url}
                              </a>
                            </div>
                            {p.description && (
                              <div className="text-sm text-gray-600 mt-2 break-words">{p.description}</div>
                            )}
                          </div>
                          <div className="flex gap-2 sm:flex-col sm:gap-1 w-full sm:w-auto">
                            <Button size="sm" variant="outline" onClick={() => startEditProduct(p)} className="flex-1 sm:flex-initial sm:w-full">
                              <Edit className="h-4 w-4 sm:mr-1"/>
                              <span>{t('edit')}</span>
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteProduct.mutate(p.id)} className="flex-1 sm:flex-initial sm:w-full">
                              <Trash2 className="h-4 w-4 sm:mr-1"/>
                              <span>{t('delete')}</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {myProducts.length === 0 && (
                      <div className="text-sm text-gray-500">No products added yet. Add your first product recommendation.</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{productEditing ? (t('editProduct') || 'Edit Product') : (t('addProduct') || 'Add Product')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="p-title" className="text-sm font-medium">{t('productTitle') || 'Title'} <span className="text-red-500">*</span></Label>
                  <Input id="p-title" value={productForm.title} onChange={e => setProductForm(f => ({ ...f, title: e.target.value }))} placeholder={t('productNamePlaceholder') || 'Product name'} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="p-url" className="text-sm font-medium">{t('productUrl') || 'Product URL'} <span className="text-red-500">*</span></Label>
                  <Input id="p-url" value={productForm.url} onChange={e => setProductForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="mt-1.5" />
                </div>
                <MediaUpload
                  label={`${t('productThumbnail') || 'Thumbnail URL'} (${t('optional') || 'optional'})`}
                  value={productForm.thumbnailUrl}
                  onChange={(url) => setProductForm(f => ({ ...f, thumbnailUrl: url }))}
                  accept="image/*"
                  placeholder="https://..."
                  mediaType="image"
                />
                <div>
                  <Label htmlFor="p-desc" className="text-sm font-medium">{t('description') || 'Description'}</Label>
                  <Textarea id="p-desc" value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} placeholder={t('productDescriptionPlaceholder') || 'Why do you recommend this product?'} rows={3} className="mt-1.5" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  {productEditing ? (
                    <>
                      <Button onClick={() => updateProduct.mutate()} className="w-full sm:w-auto"><Edit className="h-4 w-4 mr-1"/> {t('update')}</Button>
                      <Button variant="outline" onClick={resetProduct} className="w-full sm:w-auto">{t('cancel')}</Button>
                    </>
                  ) : (
                    <Button onClick={() => createProduct.mutate()} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1"/> {t('addProduct') || 'Add Product'}</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="blog">
          <BlogManager mode="coach" />
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>{t('coachInformation') || 'Coach Information'}</CardTitle>
              <CardDescription className="mt-2">{t('updateProfessionalInfo') || 'Update your professional information visible to clients'}</CardDescription>
            </CardHeader>
            <CardContent>
              {infoLoading ? (
                <div>{t('loadingInfo') || 'Loading info…'}</div>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  saveCoachInfo.mutate();
                }} className="space-y-5">
                  <div>
                    <Label htmlFor="aboutMe" className="text-sm font-medium">{t('aboutMe') || 'About Me'}</Label>
                    <Textarea
                      id="aboutMe"
                      value={infoForm.aboutMe}
                      onChange={e => setInfoForm(f => ({ ...f, aboutMe: e.target.value }))}
                      placeholder={t('aboutMePlaceholder') || 'Tell your users about yourself...'}
                      rows={4}
                      className="mt-1.5 resize-y min-h-[100px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="qualifications" className="text-sm font-medium">{t('qualifications') || 'Qualifications'}</Label>
                    <Textarea
                      id="qualifications"
                      value={infoForm.qualifications}
                      onChange={e => setInfoForm(f => ({ ...f, qualifications: e.target.value }))}
                      placeholder={t('qualificationsPlaceholder') || 'List your certifications, degrees, and qualifications...'}
                      rows={4}
                      className="mt-1.5 resize-y min-h-[100px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="trainingApproach" className="text-sm font-medium">{t('trainingApproach') || 'Training Approach'}</Label>
                    <Textarea
                      id="trainingApproach"
                      value={infoForm.trainingApproach}
                      onChange={e => setInfoForm(f => ({ ...f, trainingApproach: e.target.value }))}
                      placeholder={t('trainingApproachPlaceholder') || 'Describe your training philosophy and methods...'}
                      rows={4}
                      className="mt-1.5 resize-y min-h-[100px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="successStories" className="text-sm font-medium">{t('successStories') || 'Success Stories'}</Label>
                    <Textarea
                      id="successStories"
                      value={infoForm.successStories}
                      onChange={e => setInfoForm(f => ({ ...f, successStories: e.target.value }))}
                      placeholder={t('successStoriesPlaceholder') || 'Share testimonials and success stories from your clients...'}
                      rows={4}
                      className="mt-1.5 resize-y min-h-[100px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="servicesAndPrograms" className="text-sm font-medium">{t('servicesAndPrograms') || 'Services and Programs'}</Label>
                    <Textarea
                      id="servicesAndPrograms"
                      value={infoForm.servicesAndPrograms}
                      onChange={e => setInfoForm(f => ({ ...f, servicesAndPrograms: e.target.value }))}
                      placeholder={t('servicesAndProgramsPlaceholder') || 'Describe the services and programs you offer...'}
                      rows={4}
                      className="mt-1.5 resize-y min-h-[100px]"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact" className="text-sm font-medium">{t('contactInformation') || 'Contact Information'}</Label>
                    <Textarea
                      id="contact"
                      value={infoForm.contact}
                      onChange={e => setInfoForm(f => ({ ...f, contact: e.target.value }))}
                      placeholder={t('contactPlaceholder') || 'Provide contact details (email, phone, social media, etc.)...'}
                      rows={3}
                      className="mt-1.5 resize-y min-h-[80px]"
                    />
                  </div>
                  
                  <Button type="submit" disabled={saveCoachInfo.isPending} className="w-full sm:w-auto">
                    {saveCoachInfo.isPending ? (t('saving') || 'Saving...') : (t('saveInformation') || 'Save Information')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('editContactInfo')}</DialogTitle>
            <DialogDescription>{t('coachEditContactDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingUser) return;
            coachEditUserMutation.mutate({ userId: editingUser.id, userData: editUserFormData });
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">{t('firstName')}</Label>
                <Input id="editFirstName" value={editingUser?.firstName || ''} readOnly disabled />
              </div>
              <div>
                <Label htmlFor="editLastName">{t('lastName')}</Label>
                <Input id="editLastName" value={editingUser?.lastName || ''} readOnly disabled />
              </div>
            </div>
            <div>
              <Label htmlFor="editEmail">{t('email') || 'Email'}</Label>
              <Input id="editEmail" value={(editingUser as any)?.email || ''} readOnly disabled />
            </div>
            <div>
              <Label htmlFor="editWhatsapp">{t('whatsappNumber')}</Label>
              <Input id="editWhatsapp" value={editUserFormData.whatsappWithCode} onChange={(e) => setEditUserFormData({ whatsappWithCode: e.target.value })} placeholder="201234567890" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={coachEditUserMutation.isPending}>{coachEditUserMutation.isPending ? t('updating') : t('update')}</Button>
              <Button type="button" variant="outline" onClick={() => setEditUserDialogOpen(false)}>{t('cancel')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unassign User Dialog */}
      <Dialog open={unassignConfirmOpen} onOpenChange={setUnassignConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('unassignUser')}</DialogTitle>
            <DialogDescription>{t('removeCoachAssignment')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm">{t('user')}: {editingUser?.firstName} {editingUser?.lastName}</div>
            {/* Email removed from unassign dialog */}
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" onClick={() => editingUser && coachUnassignUserMutation.mutate(editingUser.id)} disabled={coachUnassignUserMutation.isPending}>
              {coachUnassignUserMutation.isPending ? t('unassigning') : t('unassign')}
            </Button>
            <Button variant="outline" onClick={() => setUnassignConfirmOpen(false)}>{t('cancel')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detailed Trainee View Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
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
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('phone')}</Label>
                      <p className="text-sm">{detailViewUser.whatsappWithCode || t('notProvided')}</p>
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
                                  No {activityFilter === 'all' ? 'activities' : activityFilter} found
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
                                  <h4 className="font-medium">Workout Session</h4>
                                </div>
                                <div className="flex flex-wrap gap-3 text-sm text-gray-600 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {session.duration} min
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    {session.caloriesBurned} cal burned
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
                                  <span>Weight: {prog.weight}kg</span>
                                  <span>Body Fat: {prog.bodyFat}%</span>
                                  <span>Muscle Mass: {prog.muscleMass}kg</span>
                                  <span>Water: {prog.waterWeight}kg</span>
                                </div>
                                {prog.notes && (
                                  <p className="text-xs text-gray-500 mt-1">Notes: {prog.notes}</p>
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
                                <span className="text-gray-500">Calories</span>
                                <span className="font-semibold">{stats.calories}/{stats.caloriesGoal}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500">Protein</span>
                                <span className="font-semibold">{stats.protein}g</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500">Carbs</span>
                                <span className="font-semibold">{stats.carbs || 0}g</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-gray-500">Fats</span>
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
                      <p className="text-center text-gray-500 py-8">No daily statistics available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Plan / Workout Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isPlanEditing
                ? (dialogType === 'workout' ? t('editWorkoutPlan') : t('editNutritionPlan'))
                : (dialogType === 'workout' ? t('createNewWorkoutPlan') : t('createNewNutritionPlan'))}
            </DialogTitle>
            <DialogDescription>
              {selectedUser
                ? `${isPlanEditing ? t('updatePlan') : t('createPlan')} ${dialogType === 'workout' ? t('workoutPlan') : t('nutritionPlans')} ${t('for')} ${selectedUser.firstName}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {dialogType === 'nutrition' ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!selectedUser) return;
              const formData = new FormData(e.currentTarget);

              const mealsText = formData.get('meals') as string;
              const meals = mealsText ? mealsText.split('\n').filter(m => m.trim()) : [];
              const tipsText = formData.get('tips') as string;
              const tips = tipsText ? tipsText.split('\n').filter(t => t.trim()) : [];

              const payload: any = {
                title: formData.get('title'),
                description: formData.get('description'),
                weeklyFocus: formData.get('weeklyFocus'),
                goals: {
                  calories: formData.get('calories') ? parseInt(formData.get('calories') as string) : undefined,
                  protein: formData.get('protein') ? parseInt(formData.get('protein') as string) : undefined,
                  carbs: formData.get('carbs') ? parseInt(formData.get('carbs') as string) : undefined,
                  fat: formData.get('fat') ? parseInt(formData.get('fat') as string) : undefined,
                  meals,
                  tips
                }
              };

              if (isPlanEditing && editingPlan) {
                updatePlanMutation.mutate({ planId: editingPlan.id, updateData: payload });
              } else {
                createPlanMutation.mutate({ userId: selectedUser.id, ...payload });
              }
            }} className="space-y-4">
              <div>
                <Label htmlFor="title">{t('planTitle')} <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" defaultValue={editingPlan?.title || ''} required />
              </div>
              <div>
                <Label htmlFor="description">{t('planDescription')} <span className="text-red-500">*</span></Label>
                <Textarea id="description" name="description" defaultValue={editingPlan?.description || ''} required />
              </div>
              <div>
                <Label htmlFor="weeklyFocus">{t('weeklyFocus')}</Label>
                <Input id="weeklyFocus" name="weeklyFocus" defaultValue={editingPlan?.weeklyFocus || ''} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="calories">{t('calories')} <span className="text-red-500">*</span></Label>
                  <Input id="calories" name="calories" type="number" min="1" defaultValue={editingPlan?.goals?.calories || ''} required />
                </div>
                <div>
                  <Label htmlFor="protein">{t('proteinG')} <span className="text-red-500">*</span></Label>
                  <Input id="protein" name="protein" type="number" min="1" defaultValue={editingPlan?.goals?.protein || ''} required />
                </div>
                <div>
                  <Label htmlFor="carbs">{t('carbsG')} <span className="text-red-500">*</span></Label>
                  <Input id="carbs" name="carbs" type="number" min="0" defaultValue={editingPlan?.goals?.carbs || ''} required />
                </div>
                <div>
                  <Label htmlFor="fat">{t('fatG')} <span className="text-red-500">*</span></Label>
                  <Input id="fat" name="fat" type="number" min="0" defaultValue={editingPlan?.goals?.fat || ''} required />
                </div>
              </div>
              <div>
                <Label htmlFor="meals">{t('mealPlan')}</Label>
                <Textarea id="meals" name="meals" defaultValue={editingPlan?.goals?.meals?.join('\n') || ''} rows={4} />
              </div>
              <div>
                <Label htmlFor="tips">{t('nutritionTipsLabel')}</Label>
                <Textarea id="tips" name="tips" defaultValue={editingPlan?.goals?.tips?.join('\n') || ''} rows={4} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
                  {isPlanEditing
                    ? (updatePlanMutation.isPending ? t('updating') : t('updatePlan'))
                    : (createPlanMutation.isPending ? t('creating') : t('createPlan'))}
                </Button>
                <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)}>{t('cancel')}</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!selectedUser) return;
              const formData = new FormData(e.currentTarget);

              const newWorkoutDays = parseInt((formData.get('workoutDays') as string) || '3');
              const weeklySchedule: any = {
                focus: (formData.get('weeklyFocus') as string) || 'General Fitness',
                workouts: []
              };
              const daysOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
              for (let i = 0; i < Math.min(newWorkoutDays, 7); i++) {
                const day = formData.get(`day-${i}`) as string || daysOfWeek[i];
                const type = formData.get(`type-${i}`) as string || 'Full Body';
                const duration = formData.get(`duration-${i}`) as string || '45 min';
                const notes = formData.get(`notes-${i}`) as string || '';
                const exercises: string[] = [];
                for (let j = 0; j < 6; j++) {
                  const name = (formData.get(`ex-${i}-${j}-name`) as string) || '';
                  const sets = (formData.get(`ex-${i}-${j}-sets`) as string) || '';
                  const reps = (formData.get(`ex-${i}-${j}-reps`) as string) || '';
                  if (name.trim()) {
                    const hasSetsReps = /\d+\s*x\s*\d+/i.test(name);
                    exercises.push(hasSetsReps ? name.trim() : `${name.trim()} - ${sets || '3'}x${reps || '10'}`);
                  }
                }
                weeklySchedule.workouts.push({ day, type, duration, exercises, notes });
              }

              const payload: any = {
                title: formData.get('title'),
                description: formData.get('description'),
                weeklyFocus: formData.get('weeklyFocus'),
                goals: {
                  workoutDays: newWorkoutDays,
                  workoutDuration: formData.get('workoutDuration') || '45 minutes',
                  exercises: []
                },
                weeklySchedule
              };

              if (isPlanEditing && editingPlan) {
                updatePlanMutation.mutate({ planId: editingPlan.id, updateData: payload });
              } else {
                createPlanMutation.mutate({ userId: selectedUser.id, ...payload });
              }
            }} className="space-y-4">
              <div>
                <Label htmlFor="title">{t('planTitle')} <span className="text-red-500">*</span></Label>
                <Input id="title" name="title" defaultValue={editingPlan?.title || ''} required />
              </div>
              <div>
                <Label htmlFor="description">{t('planDescription')} <span className="text-red-500">*</span></Label>
                <Textarea id="description" name="description" defaultValue={editingPlan?.description || ''} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workoutDays">{t('workoutDaysPerWeek')} <span className="text-red-500">*</span></Label>
                  <Input id="workoutDays" name="workoutDays" type="number" min="1" max="7" defaultValue={editingPlan?.goals?.workoutDays || 3} required />
                </div>
                <div>
                  <Label htmlFor="workoutDuration">{t('averageDuration')}</Label>
                  <Input id="workoutDuration" name="workoutDuration" defaultValue={editingPlan?.goals?.workoutDuration || '45 minutes'} />
                </div>
              </div>
              <div>
                <Label htmlFor="weeklyFocus">{t('weeklyFocus')}</Label>
                <Input id="weeklyFocus" name="weeklyFocus" defaultValue={editingPlan?.weeklyFocus || ''} />
              </div>

              {(() => {
                const days = editingPlan?.goals?.workoutDays || 3;
                const items = [] as any[];
                const current = editingPlan?.weeklySchedule?.workouts || [];
                const daysOfWeek = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
                for (let i = 0; i < Math.min(days, 7); i++) {
                  const w = current[i] || { day: daysOfWeek[i], type: 'Full Body', duration: '45 min', exercises: [], notes: '' };
                  items.push(
                    <div key={i} className="p-3 border-2 rounded-md bg-gray-50 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label htmlFor={`day-${i}`}>{t('day')}</Label>
                          <select id={`day-${i}`} name={`day-${i}`} defaultValue={w.day} className="w-full border rounded px-2 py-1">
                            {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor={`type-${i}`}>{t('focus')}</Label>
                          <select id={`type-${i}`} name={`type-${i}`} defaultValue={w.type} className="w-full border rounded px-2 py-1">
                            <option value="Full Body">Full Body</option>
                            <option value="Upper Body">Upper Body</option>
                            <option value="Lower Body">Lower Body</option>
                            <option value="Cardio">Cardio</option>
                            <option value="Core">Core</option>
                            <option value="Push">Push</option>
                            <option value="Pull">Pull</option>
                            <option value="Legs">Legs</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor={`duration-${i}`}>{t('duration')}</Label>
                          <Input id={`duration-${i}`} name={`duration-${i}`} defaultValue={w.duration} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <div key={j} className="grid grid-cols-9 gap-2 items-center bg-white p-2 rounded border">
                            <div className="col-span-5">
                              <Input name={`ex-${i}-${j}-name`} defaultValue={w.exercises?.[j]?.split(' - ')[0] || ''} placeholder={`${t('exercise')} ${j + 1}`} />
                            </div>
                            <div className="col-span-2">
                              <Input name={`ex-${i}-${j}-sets`} defaultValue={w.exercises?.[j]?.split(' - ')[1]?.split('x')[0] || ''} placeholder={t('sets')} type="number" min="1" />
                            </div>
                            <div className="col-span-2">
                              <Input name={`ex-${i}-${j}-reps`} defaultValue={w.exercises?.[j]?.split(' - ')[1]?.split('x')[1] || ''} placeholder={t('reps')} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label htmlFor={`notes-${i}`}>{t('notes')}</Label>
                        <Textarea id={`notes-${i}`} name={`notes-${i}`} defaultValue={w.notes || ''} rows={2} />
                      </div>
                    </div>
                  );
                }
                return <div className="space-y-3">{items}</div>;
              })()}

              <div className="flex gap-2">
                <Button type="submit" disabled={createPlanMutation.isPending || updatePlanMutation.isPending}>
                  {isPlanEditing
                    ? (updatePlanMutation.isPending ? t('updating') : t('updatePlan'))
                    : (createPlanMutation.isPending ? t('creating') : t('createPlan'))}
                </Button>
                <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)}>{t('cancel')}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Hooks must be inside component; add coach-scoped edit/delete mutations below component using React hooks signature

// Sections as subcomponents (kept in same file for simplicity)
function UserPlansSection({ user }: { user: User }) {
  const { t } = useLanguage();
  const { data: userPlans = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/user-plans', user.id, 'nutrition'],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/user-plans/${user.id}`);
      const plans = await r.json();
      // Plans are already sorted by updatedAt DESC (newest first)
      // Filter plans with nutrition data and take the most recent one
      const nutritionPlans = plans.filter((p: any) => {
        const goals = p?.goals;
        if (!goals) return false;
        // Check if plan has nutrition-specific data
        return goals.calories !== undefined || goals.protein !== undefined || 
               goals.carbs !== undefined || goals.fat !== undefined ||
               (Array.isArray(goals.meals) && goals.meals.length > 0);
      });
      // Return the first (most recent) nutrition plan
      return nutritionPlans.length > 0 ? [nutritionPlans[0]] : [];
    },
    enabled: !!user?.id,
  });

  return (
    <TabsContent value="plans">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>{t('nutritionPlans')} {t('for')} {user.firstName}</CardTitle>
            <CoachPlansActions user={user} type="nutrition" />
          </div>
          <CardDescription>{t('latestNutritionPlanDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? t('loadingNutritionPlan') : userPlans.length > 0 ? (
            <div className="space-y-3">
              {userPlans.map((plan) => (
                <div key={plan.id} className="border rounded p-3 bg-gray-50 space-y-3">
                  <div className="min-w-0">
                    <div className="font-semibold break-words">{plan.title}</div>
                    <div className="text-xs text-gray-500 break-words">{t('planId')}: {plan.id} · {t('created')} {plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</div>
                    <div className="text-sm text-gray-600 mt-1 break-words">{plan.description}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{t('exampleMeals')}: {Array.isArray(plan?.goals?.meals) ? plan.goals.meals.length : 0}</Badge>
                      <Badge variant="secondary">{t('tipsAndRecommendations')}: {Array.isArray(plan?.goals?.tips) ? plan.goals.tips.length : 0}</Badge>
                    </div>
                  </div>
                  <div className="overflow-x-auto pb-1">
                    <CoachPlansActions user={user} type="nutrition" plan={plan} />
                  </div>

                  {/* Nutrition details */}
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
                          // Group by prefix before ':' e.g., "breakfast: eggs"
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
                                  <div className="text-sm font-semibold capitalize">{t(k as any)}</div>
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
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">{t('noPlansYet')}</div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function UserWorkoutsSection({ user }: { user: User }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [workoutText, setWorkoutText] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [focus, setFocus] = useState('');

  // Workouts are part of weeklySchedule in the plan, display basic card
  const { data: userPlans = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/user-plans', user.id, 'workout'],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/user-plans/${user.id}`);
      const plans = await r.json();
      // Plans are already sorted by updatedAt DESC (newest first)
      // Filter plans that have weeklySchedule with actual workout data
      const workoutPlans = plans.filter((p: any) => {
        const schedule = p?.weeklySchedule;
        if (!schedule) return false;
        // Check if weeklySchedule has valid structure
        return schedule.workouts && Array.isArray(schedule.workouts) && schedule.workouts.length > 0;
      });
      // Return the first (most recent) workout plan
      return workoutPlans.length > 0 ? [workoutPlans[0]] : [];
    },
    enabled: !!user?.id,
  });

  const quickAddMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/quick-add-workout', data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || t('failedToCreateWorkout'));
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: t('weeklyWorkoutScheduleCreated'),
      });
      setQuickAddOpen(false);
      setWorkoutText('');
      setPlanTitle('');
      setPlanDescription('');
      setFocus('');
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans', user.id, 'workout'] });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToCreateWorkout'),
        variant: 'destructive',
      });
    },
  });

  const handleQuickAdd = () => {
    if (!workoutText.trim()) {
      toast({
        title: t('error'),
        description: t('enterWorkoutDetails'),
        variant: 'destructive',
      });
      return;
    }

    quickAddMutation.mutate({
      userId: user.id,
      workoutText: workoutText.trim(),
      title: planTitle.trim() || undefined,
      description: planDescription.trim() || undefined,
      focus: focus.trim() || undefined,
    });
  };

  const latestPlan = userPlans[0];
  const workoutPlan = latestPlan?.weeklySchedule;

  return (
    <TabsContent value="workouts">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>{t('workoutPlan')} {t('for')} {user.firstName}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickAddOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('quickAdd')}
              </Button>
              <CoachPlansActions user={user} type="workout" />
            </div>
          </div>
          <CardDescription>Latest weekly schedule with day-by-day exercises</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-gray-500">{t('loadingWorkoutPlan')}</div>
          ) : !workoutPlan ? (
            <div className="text-sm text-gray-500">{t('noWeeklyScheduleCreated')}</div>
          ) : (
            <div className="space-y-3">
              <div className="border rounded p-3 bg-gray-50 space-y-3">
                <div className="min-w-0">
                  <div className="font-semibold break-words">{latestPlan.title}</div>
                  <div className="text-xs text-gray-500 break-words">{t('planId')}: {latestPlan.id} · {t('created')} {latestPlan.createdAt ? new Date(latestPlan.createdAt).toLocaleString() : '—'}</div>
                  <div className="text-sm text-gray-600 mt-1 break-words">{latestPlan.description}</div>
                </div>
                <div className="overflow-x-auto pb-1">
                  <CoachPlansActions user={user} type="workout" plan={latestPlan} />
                </div>

                <div className="mt-3 bg-blue-50 p-3 rounded">
                  <div className="font-medium">{t('focus')}</div>
                  <div className="text-sm">{workoutPlan.focus}</div>
                  <div className="flex gap-4 text-sm mt-1 text-blue-700">
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{latestPlan?.goals?.workoutDays || 0} {t('daysPerWeek')}</span>
                    <span className="flex items-center gap-1"><Activity className="h-4 w-4" />{(user as any).fitnessGoal || '—'}</span>
                    <span className="flex items-center gap-1"><Target className="h-4 w-4" />{Array.isArray(workoutPlan.workouts) ? workoutPlan.workouts.length : 0} {t('sessions') || 'sessions'}</span>
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
          )}
        </CardContent>
      </Card>

      {/* Quick Add Workout Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('quickAddWeeklyWorkoutFor')} {user.firstName}</DialogTitle>
            <DialogDescription>
              {t('quickAddWeeklyWorkoutDesc')}
              <span className="block mt-1 text-xs">{t('requiredFieldsMarked')}</span>
              <br />
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded mt-1 block">
                Legs
                <br />
                1-Squats 3x10
                <br />
                2-Leg Press 3x12
                <br />
                <br />
                Chest & Triceps
                <br />
                1-Bench Press 3x8
                <br />
                2-Tricep Dips 3x12
              </code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="planTitle">{t('planTitleOptional')}</Label>
              <Input
                id="planTitle"
                placeholder={t('planTitlePlaceholder')}
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="planDescription">{t('planDescriptionOptional')}</Label>
              <Input
                id="planDescription"
                placeholder={t('planDescriptionPlaceholder')}
                value={planDescription}
                onChange={(e) => setPlanDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="focus">{t('weeklyFocus')} ({t('optional')})</Label>
              <Input
                id="focus"
                placeholder={t('weeklyFocusPlaceholder')}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>
            <div>
              <RequiredLabel htmlFor="workoutText">{t('weeklyWorkoutSchedule')}</RequiredLabel>
              <Textarea
                id="workoutText"
                placeholder={t('weeklyWorkoutSchedulePlaceholder')}
                value={workoutText}
                onChange={(e) => setWorkoutText(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('quickAddWeeklyWorkoutTip')}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setQuickAddOpen(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleQuickAdd} disabled={quickAddMutation.isPending}>
                {quickAddMutation.isPending ? t('creating') : t('createWeeklyWorkoutSchedule')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}

function UserSubscriptionSection({ user }: { user: any }) {
  const { t } = useLanguage();
  const subscriptionStatus = getSubscriptionStatus(user.subscriptionType, user.subscriptionStartDate, user.subscriptionEndDate);

  return (
    <TabsContent value="subscription">
      <Card>
        <CardHeader>
          <CardTitle>{t('subscription')} {t('for')} {user.firstName}</CardTitle>
          <CardDescription>{t('subscriptionReadOnlyCoach')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-gray-600">{t('currentPlan')}</div>
              <div className="font-semibold text-sm">{user.subscriptionType ? user.subscriptionType.replace(/_/g, ' ') : t('none')}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-gray-600">{t('startDate')}</div>
              <div className="font-semibold text-sm">{user.subscriptionStartDate ? new Date(user.subscriptionStartDate).toLocaleDateString() : '—'}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <div className="text-xs text-gray-600">{t('endDate')}</div>
              <div className="font-semibold text-sm">{user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toLocaleDateString() : '—'}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded">
              <div className="text-xs text-gray-600">{t('status') || 'Status'}</div>
              <div className="mt-1">
                <Badge variant={subscriptionStatus === 'active' ? 'default' : subscriptionStatus === 'expired' ? 'destructive' : subscriptionStatus === 'suspended' ? 'secondary' : 'outline'}>
                  {subscriptionStatus === 'active'
                    ? t('active')
                    : subscriptionStatus === 'expired'
                    ? t('expired')
                    : subscriptionStatus === 'suspended'
                    ? t('suspended')
                    : t('none')}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

// Action buttons for plans (add/edit) – lives inside CoachPage scope via closures
function CoachPlansActions({ user, type, plan }: { user: any, type: 'workout' | 'nutrition', plan?: any }) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const showCreateActions = !plan;

  const shareActionLabel = language === 'ar' ? 'نشر' : (t('share') || 'Share');

  const buildPlanShareText = (selectedPlan: any) => {
    if (!selectedPlan) return '';
    const calories = selectedPlan?.goals?.calories ?? '—';
    const protein = selectedPlan?.goals?.protein ?? '—';
    const carbs = selectedPlan?.goals?.carbs ?? '—';
    const fat = selectedPlan?.goals?.fat ?? '—';
    const ownerName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    return [
      `${t('nutritionPlans') || 'Nutrition Plan'}: ${selectedPlan?.title || ''}`,
      selectedPlan?.description || '',
      `${t('totalDailyCalories') || 'Calories'}: ${calories}`,
      `${t('protein') || 'Protein'}: ${protein}g | ${t('carbs') || 'Carbs'}: ${carbs}g | ${t('fat') || 'Fat'}: ${fat}g`,
      ownerName ? `${t('for') || 'For'} ${ownerName}` : '',
    ].filter(Boolean).join('\n');
  };

  const sharePlanTo = async (platform: 'facebook' | 'instagram' | 'whatsapp') => {
    if (!plan) return;
    const shareTarget = `${window.location.origin}/coach`;
    const shareText = buildPlanShareText(plan);
    const encodedTarget = encodeURIComponent(shareTarget);
    const encodedText = encodeURIComponent(`${shareText}\n${shareTarget}`);

    if (platform === 'facebook') {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodedTarget}&quote=${encodeURIComponent(shareText)}`,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareTarget}`);
      toast({
        title: t('copied') || 'Copied',
        description: language === 'ar'
          ? 'تم نسخ نص الخطة. يمكنك نشره على إنستغرام الآن.'
          : 'Plan text copied. You can now share it on Instagram.',
      });
    } catch {
      toast({
        title: t('share') || 'Share',
        description: language === 'ar'
          ? 'تعذر نسخ النص تلقائيا.'
          : 'Could not copy text automatically.',
        variant: 'destructive',
      });
    }

    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  };

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const res = await apiRequest('DELETE', `/api/user-plans/${planId}`);
      if (res.status === 204) return { success: true };
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || t('failedToDeletePlan'));
      return body;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', user.id] });
      // Also invalidate the specific queries used by /nutrition and /workouts pages
      await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
      await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }, user.id] });
      toast({ title: t('success'), description: t('planDeletedSuccess') });
    },
    onError: (e: any) => {
      toast({ title: t('deleteFailed'), description: e?.message || t('pleaseTryAgain'), variant: 'destructive' });
    }
  });

  // Access state setters via a custom event to avoid prop drilling
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50/70 p-2">
      {showCreateActions && (
        <Button
          size="sm"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('coach-plan-open', { detail: { user, type, mode: 'create', plan: null } }));
          }}
          className="whitespace-nowrap"
        >
          <Plus className="w-4 h-4 sm:mr-1" /> <span>{t('add')}</span>
        </Button>
      )}
      {/* Only show Generate in nutrition section; it will generate both nutrition and workout plans */}
      {showCreateActions && type === 'nutrition' && (
        <Button
          variant="secondary"
          size="sm"
          className="whitespace-nowrap"
          onClick={async () => {
            try {
              setGenerating(true);
              
              // Create AbortController with 90 second timeout (longer than server timeout)
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 240000);
              
              const res = await apiRequest(
                'POST',
                '/api/coach/ai/generate-both',
                { userId: user.id },
                { signal: controller.signal }
              ).finally(() => clearTimeout(timeoutId));
              const out = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(out?.message || t('aiGenerationFailed'));
              }
              if (!out || (out.nutrition == null && out.workout == null)) {
                throw new Error(t('noPlansReturnedFromServer'));
              }
              if (out.usedLocalFallback) {
                toast({
                  title: t('note'),
                  description: t('aiUsedLocalFallback'),
                });
              }
              let n = out?.nutrition; let w = out?.workout;
              // If one side missing but API returned 201, try a quick one-off recovery by calling single endpoint
              if (!w) {
                try {
                  const wr = await apiRequest('POST', '/api/coach/ai/generate-plan', { userId: user.id, planType: 'workout' });
                  if (wr.ok) { w = await wr.json(); }
                } catch {}
              }
              if (!n) {
                try {
                  const nr = await apiRequest('POST', '/api/coach/ai/generate-plan', { userId: user.id, planType: 'nutrition' });
                  if (nr.ok) { const body = await nr.json(); n = body?.plan || body; }
                } catch {}
              }

              // Invalidate all user-plans queries to update coach view
              await queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
              await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', user.id] });
              await queryClient.invalidateQueries({ queryKey: ['/api/coach/my-users'] });
              
              // Also invalidate the specific queries used by /nutrition and /workouts pages
              // This ensures the plans automatically appear there without manual refresh
              await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
              await queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }, user.id] });

              const parts: string[] = [];
              if (n) parts.push(n?.title || t('nutritionPlanSaved'));
              if (w) parts.push(w?.title || t('workoutPlanSaved'));
              const description = parts.length ? parts.join(' + ') : t('plansCreatedSuccessfully');
              toast({ title: t('plansCreatedSuccessfully'), description });

              // Inform user if partial errors existed in original response
              const nErr = out?.errors?.nutrition; const wErr = out?.errors?.workout;
              if (nErr || wErr) {
                toast({
                  title: t('note'),
                  description: `${t('partialAiError')}: ${[nErr && t('nutrition'), wErr && t('workout')].filter(Boolean).join(' & ')} ${t('retriedAutomatically')}.`,
                });
              }
            } catch (e: any) {
              // Provide more specific error messages for different failure types
              let errorMessage = e?.message || t('pleaseTryAgain');
              if (e?.name === 'AbortError') {
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans', user.id] });
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }, user.id] });
                }, 10000);
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans', user.id] });
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }] });
                  queryClient.invalidateQueries({ queryKey: ['/api/user-plans', { latest: true }, user.id] });
                }, 40000);

                toast({
                  title: t('generationStillRunning'),
                  description: t('generationTakingLonger'),
                });
                return;
              } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
                errorMessage = t('aiGenerationTakingLonger');
              }
              toast({ title: t('aiGenerationFailed'), description: errorMessage, variant: 'destructive' });
            } finally {
              setGenerating(false);
            }
          }}
        >
          <Sparkles className="w-4 h-4 sm:mr-1" /> <span>{generating ? t('generating') : t('generateBoth')}</span>
        </Button>
      )}
      {plan && (
        <>
          {type === 'nutrition' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="w-4 h-4 sm:mr-1" /> <span>{t('preview') || 'Preview'}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setViewOpen(true)}
              >
                <Eye className="w-4 h-4 sm:mr-1" /> <span>{t('view') || 'View'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => sharePlanTo('facebook')}
              >
                <span>{shareActionLabel} Facebook</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => sharePlanTo('instagram')}
              >
                <span>{shareActionLabel} Instagram</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => sharePlanTo('whatsapp')}
              >
                <span>{shareActionLabel} WhatsApp</span>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('coach-plan-open', { detail: { user, type, mode: 'edit', plan } }));
            }}
          >
            <Edit className="w-4 h-4 sm:mr-1" /> <span>{t('edit')}</span>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => {
              if (!plan?.id) return;
              if (confirm(t('confirmDeletePlan'))) {
                deletePlanMutation.mutate(plan.id);
              }
            }}
            disabled={deletePlanMutation.isPending}
          >
            <Trash2 className="w-4 h-4 sm:mr-1" /> <span>{deletePlanMutation.isPending ? t('deleting') : t('delete')}</span>
          </Button>

          {type === 'nutrition' && (
            <>
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{t('preview') || 'Preview'}</DialogTitle>
                    <DialogDescription>{plan?.title}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-700">{plan?.description || '—'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border p-2">{t('totalDailyCalories') || 'Calories'}: {plan?.goals?.calories ?? '—'}</div>
                      <div className="rounded border p-2">{t('protein') || 'Protein'}: {plan?.goals?.protein ?? '—'}g</div>
                      <div className="rounded border p-2">{t('carbs') || 'Carbs'}: {plan?.goals?.carbs ?? '—'}g</div>
                      <div className="rounded border p-2">{t('fat') || 'Fat'}: {plan?.goals?.fat ?? '—'}g</div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t('view') || 'View'}</DialogTitle>
                    <DialogDescription>{plan?.title}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-700">{plan?.description || '—'}</p>
                    <div className="rounded border p-3 bg-gray-50 whitespace-pre-wrap">
                      {buildPlanShareText(plan)}
                    </div>
                    {Array.isArray(plan?.goals?.meals) && plan.goals.meals.length > 0 && (
                      <div>
                        <div className="font-medium mb-2">{t('exampleMeals') || 'Example meals'}</div>
                        <ul className="list-disc ml-5 space-y-1">
                          {plan.goals.meals.map((meal: string, idx: number) => <li key={idx}>{meal}</li>)}
                        </ul>
                      </div>
                    )}
                    {Array.isArray(plan?.goals?.tips) && plan.goals.tips.length > 0 && (
                      <div>
                        <div className="font-medium mb-2">{t('tipsAndRecommendations') || 'Tips'}</div>
                        <ul className="list-disc ml-5 space-y-1">
                          {plan.goals.tips.map((tip: string, idx: number) => <li key={idx}>{tip}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </>
      )}
    </div>
  );
}
