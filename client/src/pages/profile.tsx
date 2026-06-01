import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, normalizeDigitsUniversal } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, UserPlan, UserWorkout, Workout, CoachInfo } from "@shared/schema";
import { TranslationKey } from "@/lib/translations-data";
import { Loader2, User as UserIcon, Target, Activity, Apple, Clock, Dumbbell, Calendar, CheckCircle, Circle } from "lucide-react";
import { useLanguage } from '@/context/LanguageContext';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import { getSubscriptionStatus } from "@shared/subscriptionUtils";
import { Link } from "wouter";
import CoachPublicProfile from "@/components/coach/CoachPublicProfile";
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import { useGuestRestriction } from "@/hooks/use-guest-restriction";





export default function Profile() {
  const { t } = useLanguage();
  const { isGuest, blockAction } = useGuestRestriction();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [guestSnapshot] = useState(() => {
    try {
      const raw = localStorage.getItem('guestUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const isGuestMode = isGuest || Boolean(guestSnapshot);

  // Get user ID from URL params or localStorage
  const [userId, setUserId] = useState<number | null>(() => {
    // Check URL params first for admin viewing other users or viewing coach profile
    const urlParams = new URLSearchParams(window.location.search);
    const coachIdParam = urlParams.get('coachId');
    const userIdParam = urlParams.get('userId');
    
    if (coachIdParam) {
      return parseInt(coachIdParam);
    }
    if (userIdParam) {
      return parseInt(userIdParam);
    }

    // Fallback to current user from localStorage
    const savedUserJson = localStorage.getItem('currentUser');
    if (savedUserJson) {
      const savedUser = JSON.parse(savedUserJson);
      return savedUser.id;
    }
    const guestUserJson = localStorage.getItem('guestUser');
    if (guestUserJson) {
      const guestUser = JSON.parse(guestUserJson);
      return guestUser.id;
    }
    return null;
  });

  // Update userId when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const coachIdParam = urlParams.get('coachId');
    const userIdParam = urlParams.get('userId');
    
    if (coachIdParam) {
      setUserId(parseInt(coachIdParam));
    } else if (userIdParam) {
      setUserId(parseInt(userIdParam));
    } else {
      // If no params, use current user
      const savedUserJson = localStorage.getItem('currentUser');
      if (savedUserJson) {
        const savedUser = JSON.parse(savedUserJson);
        setUserId(savedUser.id);
      } else {
        const guestUserJson = localStorage.getItem('guestUser');
        if (guestUserJson) {
          const guestUser = JSON.parse(guestUserJson);
          setUserId(guestUser.id);
        }
      }
    }
  }, [window.location.search]); // Re-run when URL search params change

  // Try to get fresh user data from server
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Error fetching user: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!userId && !isGuestMode,
    retry: false,
  });

  // Debug: Log user data to see what's being received
  useEffect(() => {
    if (user) {
      console.log('Profile page - User data received:', user);
      console.log('Subscription data:', {
        subscriptionType: user.subscriptionType,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate
      });
    }
  }, [user]);

  // Fetch coach info if user is a coach
  const { data: coachInfo, isLoading: coachInfoLoading } = useQuery<CoachInfo>({
    queryKey: ['/api/coach/info', userId],
    queryFn: async () => {
      // Check if viewing another user
      const urlParams = new URLSearchParams(window.location.search);
      const coachIdParam = urlParams.get('coachId');
      const userIdParam = urlParams.get('userId');
      
      if ((coachIdParam || userIdParam) && user?.role === 'coach') {
        // Use public endpoint when viewing another coach's profile
        const targetId = coachIdParam || userIdParam;
        const res = await fetch(`/api/coach/info/public/${targetId}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch coach info');
        return res.json();
      } else if (user?.role === 'coach') {
        // Use authenticated endpoint for own profile
        const res = await apiRequest('GET', '/api/coach/info');
        return res.json();
      }
      return null;
    },
    enabled: !!user && user.role === 'coach' && !isGuestMode,
    retry: false,
  });

  // Fetch user's personalized plan from coach/admin
  const { data: userPlan, isLoading: userPlanLoading, error: userPlanError } = useQuery<UserPlan>({
    queryKey: ["/api/user-plans", { latest: true }],
    enabled: !isGuestMode,
    retry: false,
  });

  // Normalize goals JSON to a typed-friendly structure
  const goalsData = (userPlan?.goals ?? null) as any;
  const hasMeals = !!(goalsData && Array.isArray(goalsData.meals));
  const hasTips = !!(goalsData && Array.isArray(goalsData.tips));



  // Fetch user's scheduled workouts
  const { data: userWorkouts } = useQuery<UserWorkout[]>({
    queryKey: ["/api/user-workouts"],
    enabled: !isGuestMode,
    retry: false,
  });

  // Fetch all workouts to get workout details
  const { data: allWorkouts } = useQuery<Workout[]>({
    queryKey: ["/api/workouts"],
    enabled: !isGuestMode,
    retry: false,
  });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
  // email removed
    phoneNumber: "",
    whatsappWithCode: "",
    city: "",
    country: "",
    gender: "",
    religion: "",
    age: "",
    height: "",
    weight: "",
    goalWeight: "",
    shoulderWidth: "",
    chestWidth: "",
    waistWidth: "",
    hipWidth: "",
    hasInbody: false,
    fitnessGoal: "",
    trainingLevel: "",
    trainingDaysPerWeek: "",
    preferredWorkoutTime: "",
    preferredProgram: "",
    medicalHistory: false,
    medicalHistoryDetails: "",
    workIntensity: "",
    workoutLocation: "",
    inbodyDocument: "",
    dailyMeals: "",
    preferredCarbs: "",
    preferredProteins: "",
    preferredLegumes: "",
    preferredVegetables: "",
    preferredDairy: "",
    preferredFats: "",
    preferredFruits: "",
    hasAllergies: false,
    allergyDetails: "",
    wantsSupplements: false,
    previousTrainer: false,
    dailyRoutine: "",
    exerciseHistory: "",
    wakeUpTime: "",
    breakfastTime: "",
    breakfastDetails: "",
    lunchTime: "",
    lunchDetails: "",
    dinnerTime: "",
    dinnerDetails: "",
    lunchHasProtein: true,
    workType: "",
    workHours: "",
    hasKitchenScale: false,
    howFoundUs: "",
    activityLevel: "",
    bio: "",
  });

  // Set form data when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        username: user.username || "",
  // email removed
        phoneNumber: user.phoneNumber || "",
        whatsappWithCode: user.whatsappWithCode || "",
        city: user.city || "",
        country: user.country || "",
        gender: user.gender || "",
        religion: user.religion || "",
        age: user.age?.toString() || "",
        height: user.height?.toString() || "",
        weight: user.weight?.toString() || "",
        goalWeight: user.goalWeight?.toString() || "",
        shoulderWidth: user.shoulderWidth?.toString() || "",
        chestWidth: user.chestWidth?.toString() || "",
        waistWidth: user.waistWidth?.toString() || "",
        hipWidth: user.hipWidth?.toString() || "",
        hasInbody: user.hasInbody || false,
        fitnessGoal: user.fitnessGoal || "",
        trainingLevel: user.trainingLevel || "",
        trainingDaysPerWeek: user.trainingDaysPerWeek?.toString() || "",
        preferredWorkoutTime: user.preferredWorkoutTime || "",
        preferredProgram: user.preferredProgram || "",
        medicalHistory: user.medicalHistory || false,
        medicalHistoryDetails: user.medicalHistoryDetails || "",
        workIntensity: user.workIntensity || "",
        workoutLocation: user.workoutLocation || "",
        inbodyDocument: user.inbodyDocument || "",
        dailyMeals: user.dailyMeals?.toString() || "",
        preferredCarbs: user.preferredCarbs || "",
        preferredProteins: user.preferredProteins || "",
        preferredLegumes: user.preferredLegumes || "",
        preferredVegetables: user.preferredVegetables || "",
        preferredDairy: user.preferredDairy || "",
        preferredFats: user.preferredFats || "",
        preferredFruits: user.preferredFruits || "",
        hasAllergies: user.hasAllergies || false,
        allergyDetails: user.allergyDetails || "",
        wantsSupplements: user.wantsSupplements || false,
        previousTrainer: user.previousTrainer || false,
        dailyRoutine: user.dailyRoutine || "",
        exerciseHistory: user.exerciseHistory || "",
        wakeUpTime: user.wakeUpTime || "",
        breakfastTime: user.breakfastTime || "",
        breakfastDetails: user.breakfastDetails || "",
        lunchTime: user.lunchTime || "",
        lunchDetails: user.lunchDetails || "",
        dinnerTime: user.dinnerTime || "",
        dinnerDetails: user.dinnerDetails || "",
        lunchHasProtein: user.lunchHasProtein || true,
        workType: user.workType || "",
        workHours: user.workHours || "",
        hasKitchenScale: user.hasKitchenScale || false,
        howFoundUs: user.howFoundUs || "",
        activityLevel: user.activityLevel || "",
        bio: user.bio || "",
      });
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const updateData = {
        ...data,
        age: data.age ? parseInt(data.age) : null,
        height: data.height ? parseFloat(data.height) : null,
        weight: data.weight ? parseFloat(data.weight) : null,
        goalWeight: data.goalWeight ? parseFloat(data.goalWeight) : null,
      };

      const response = await fetch(`/api/users/${user?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: async (updatedUser) => {
      toast({
        title: t('profileUpdated'),
        description: t('profileUpdatedSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

      // Auto-generate personalized plan if user has essential data
      if (updatedUser.weight && updatedUser.height && updatedUser.age && updatedUser.fitnessGoal) {
        try {
          const planResponse = await apiRequest("POST", `/api/users/${updatedUser.id}/generate-plan`);

          if (planResponse.ok) {
            toast({
              title: t('planGenerated'),
              description: t('planGeneratedSuccess'),
            });
            // Refresh plan data
            queryClient.invalidateQueries({ queryKey: ["/api/user-plans"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user-workouts"] });
          }
        } catch (error) {
          console.error("Error generating plan:", error);
        }
      }
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: t('failedToUpdateProfile'),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuestMode) {
      blockAction();
      return;
    }
    updateProfileMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isGuestMode) {
    return (
      <div className="container mx-auto p-6 max-w-3xl min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>الملف الشخصي في وضع الزائر</CardTitle>
            <CardDescription>
              يمكنك استعراض الصفحة فقط. تعديل البيانات متاح بعد إنشاء حساب.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="font-medium">{guestSnapshot?.firstName || 'زائر'} {guestSnapshot?.lastName || ''}</p>
              <p className="text-sm text-muted-foreground">{guestSnapshot?.guestPreviewRole === 'coach' ? 'تجربة المدرب' : 'تجربة المتدرب'}</p>
            </div>
            <Button className="bg-red-900 hover:bg-red-800" onClick={blockAction}>إنشاء حساب للتعديل</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if viewing another user's profile
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isViewingOtherUser = userId !== currentUser.id;

  // If user is a coach, show public profile
  if (user?.role === 'coach') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {isViewingOtherUser 
                ? `${user.firstName || ''} ${user.lastName || ''}'s Profile`
                : (t('profileAndSettings') || 'Profile & Settings')
              }
            </h1>
            <p className="text-muted-foreground">
              {isViewingOtherUser
                ? `Viewing ${user.firstName || ''} ${user.lastName || ''}'s profile`
                : (t('yourPublicProfile') || 'Your public profile information')
              }
            </p>
          </div>
          {!isViewingOtherUser && (
            <Link href="/coach">
              <Button variant="outline">
                {t('editProfileSettings') || 'Edit Profile Settings'}
              </Button>
            </Link>
          )}
        </div>
        <CoachPublicProfile 
          user={user} 
          coachInfo={coachInfo || null} 
          isLoading={coachInfoLoading}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl relative min-h-screen">
      <AnimatedBackground />
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {isViewingOtherUser ? `${user?.firstName}'s Profile` : t('profileSettings')}
        </h1>
        <p className="text-muted-foreground">
          {isViewingOtherUser 
            ? `Viewing ${user?.firstName} ${user?.lastName}'s profile`
            : t('managePersonalInfo')
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('personalInfo') || 'Personal Information'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">{t('firstName')}</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  placeholder={t('enterFirstName')}
                />
              </div>
              <div>
                <Label htmlFor="lastName">{t('lastName')}</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  placeholder={t('enterLastName')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">{t('username') || 'Username'}</Label>
                <Input
                  id="username"
                  value={formData.username}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="whatsappWithCode">{t('whatsappNumber')}</Label>
                <Input
                  id="whatsappWithCode"
                  value={formData.whatsappWithCode}
                  onChange={(e) => handleInputChange("whatsappWithCode", normalizeDigitsUniversal(e.target.value))}
                  placeholder={t('whatsappNumber')}
                  inputMode="tel"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">{t('city')}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange("city", e.target.value)}
                  placeholder={t('city')}
                />
              </div>
              <div>
                <Label htmlFor="country">{t('country')}</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleInputChange("country", e.target.value)}
                  placeholder={t('country')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">{t('accountType') || 'Account type'}</Label>
                <Input
                  id="role"
                  value={user?.role === 'user' ? t('userClient') : user?.role === 'coach' ? t('coachTrainer') : user?.role || 'Unknown'}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('accountTypeCannotChange')}
                </p>
              </div>
              <div className="flex items-end">
                <Link href="/reset" className="text-sm text-primary underline hover:text-primary/80 inline-flex items-center gap-1">
                  {t('changePassword')}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="gender">{t('gender')}</Label>
                <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectGender')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t('male')}</SelectItem>
                    <SelectItem value="female">{t('female')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="religion">{t('religion')}</Label>
                <Select value={formData.religion} onValueChange={(value) => handleInputChange("religion", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectReligion')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="muslim">{t('muslim')}</SelectItem>
                    <SelectItem value="christian">{t('christian')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="age">{t('age')}</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleInputChange("age", normalizeDigitsUniversal(e.target.value))}
                  placeholder={t('enterAge')}
                  min="13"
                  max="120"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('howFoundUs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="howFoundUs">{t('howFoundUs')}</Label>
            <Select value={formData.howFoundUs} onValueChange={(value) => handleInputChange("howFoundUs", value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectPlatform')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook">{t('facebook')}</SelectItem>
                <SelectItem value="instagram">{t('instagram')}</SelectItem>
                <SelectItem value="youtube">{t('youtube')}</SelectItem>
                <SelectItem value="tiktok">{t('tiktok')}</SelectItem>
                <SelectItem value="whatsapp">{t('whatsapp')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Physical Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('physicalMetrics')}
            </CardTitle>
            <CardDescription>
              {t('currentMeasurementsAndActivity')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="height">{t('heightCm')}</Label>
                <Input
                  id="height"
                  type="number"
                  value={formData.height}
                  onChange={(e) => handleInputChange("height", normalizeDigitsUniversal(e.target.value))}
                  placeholder={t('enterHeightCm')}
                  min="100"
                  max="300"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="weight">{t('currentWeightKg')}</Label>
                <Input
                  id="weight"
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleInputChange("weight", normalizeDigitsUniversal(e.target.value))}
                  placeholder={t('enterCurrentWeightKg')}
                  min="30"
                  max="500"
                  step="0.1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="shoulderWidth">{t('shoulderWidthCm')}</Label>
                <Input
                  id="shoulderWidth"
                  type="number"
                  value={formData.shoulderWidth}
                  onChange={(e) => handleInputChange("shoulderWidth", normalizeDigitsUniversal(e.target.value))}
                  placeholder={t('exampleMeasurement')}
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="chestWidth">{t('chestWidthCm')}</Label>
                <Input
                  id="chestWidth"
                  type="number"
                  value={formData.chestWidth}
                  onChange={(e) => handleInputChange("chestWidth", normalizeDigitsUniversal(e.target.value))}
                  placeholder={t('exampleMeasurement')}
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="waistWidth">{t('waistWidthCm')}</Label>
                <Input
                  id="waistWidth"
                  type="number"
                  value={formData.waistWidth}
                  onChange={(e) => handleInputChange("waistWidth", normalizeDigitsUniversal(e.target.value))}
                  placeholder={t('exampleMeasurement')}
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="hipWidth">{t('hipWidthCm')}</Label>
                <Input
                  id="hipWidth"
                  type="number"
                  value={formData.hipWidth}
                  onChange={(e) => handleInputChange("hipWidth", e.target.value)}
                  placeholder={t('exampleMeasurement')}
                  step="0.1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="activityLevel">{t('activityLevel')}</Label>
              <Select value={formData.activityLevel} onValueChange={(value) => handleInputChange("activityLevel", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectActivityLevel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">{t('sedentary')}</SelectItem>
                  <SelectItem value="lightly-active">{t('lightlyActive')}</SelectItem>
                  <SelectItem value="moderately-active">{t('moderatelyActive')}</SelectItem>
                  <SelectItem value="very-active">{t('veryActive')}</SelectItem>
                  <SelectItem value="extremely-active">{t('extraActive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h5 className="font-medium">{t('photosAndInbody')}</h5>
              <p className="text-sm text-muted-foreground">
                {t('uploadPhotosInstruction')}
              </p>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>{t('frontPhoto')}</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{t('backPhoto')}</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{t('sidePhoto')}</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>{t('haveInbodyMeasurement')}</Label>
                  <Select value={formData.hasInbody ? "true" : "false"} onValueChange={(value) => handleInputChange("hasInbody", value === "true")}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectOption')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">{t('yes')}</SelectItem>
                      <SelectItem value="false">{t('no')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t('inbodyDocument')}</Label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('uploadInbodyDoc')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Health Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('healthInformation')}
            </CardTitle>
            <CardDescription>
              {t('healthBackgroundWorkActivity')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t('medicalHistoryQuestion')}</Label>
              <Select value={formData.medicalHistory ? "true" : "false"} onValueChange={(value) => handleInputChange("medicalHistory", value === "true")}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectOption')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{t('yes')}</SelectItem>
                  <SelectItem value="false">{t('no')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('medicalHistoryDetails')}</Label>
              <Textarea
                value={formData.medicalHistoryDetails}
                onChange={(e) => handleInputChange("medicalHistoryDetails", e.target.value)}
                placeholder={t('describeMedicalConditions')}
                rows={3}
              />
            </div>

            <div>
              <Label>{t('workNatureQuestion')}</Label>
              <Select value={formData.workIntensity} onValueChange={(value) => handleInputChange("workIntensity", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectIntensity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t('intensityEasy')}</SelectItem>
                  <SelectItem value="moderate">{t('intensityMedium')}</SelectItem>
                  <SelectItem value="hard">{t('intensityHard')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Training Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              {t('trainingExperience')}
            </CardTitle>
            <CardDescription>
              {t('trainingBackgroundPreferences')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="trainingLevel">{t('trainingLevel')}</Label>
                <Select value={formData.trainingLevel} onValueChange={(value) => handleInputChange("trainingLevel", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectLevel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t('beginner')}</SelectItem>
                    <SelectItem value="intermediate">{t('intermediate')}</SelectItem>
                    <SelectItem value="advanced">{t('advanced')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="trainingDaysPerWeek">{t('trainingDaysPerWeek')}</Label>
                <Select value={formData.trainingDaysPerWeek} onValueChange={(value) => handleInputChange("trainingDaysPerWeek", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectDays')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="2">2 days</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="4">4 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                    <SelectItem value="6">6 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="preferredWorkoutTime">{t('preferredWorkoutTime')}</Label>
                <Select value={formData.preferredWorkoutTime} onValueChange={(value) => handleInputChange("preferredWorkoutTime", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectTime')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">{t('morning')}</SelectItem>
                    <SelectItem value="midday">{t('midDay')}</SelectItem>
                    <SelectItem value="evening">{t('evening')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferredProgram">{t('preferredProgram')}</Label>
                <Select value={formData.preferredProgram} onValueChange={(value) => handleInputChange("preferredProgram", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectProgram')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bro_split">{t('broSplit')}</SelectItem>
                    <SelectItem value="push_pull_legs">{t('pushPullLegs')}</SelectItem>
                    <SelectItem value="upper_lower">{t('upperLower')}</SelectItem>
                    <SelectItem value="random">{t('randomSystem')}</SelectItem>
                    <SelectItem value="dont_know">{t('dontKnow')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="workIntensity">{t('workIntensity')}</Label>
                <Select value={formData.workIntensity} onValueChange={(value) => handleInputChange("workIntensity", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectIntensity')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">{t('comfortable')}</SelectItem>
                    <SelectItem value="moderate">{t('moderate')}</SelectItem>
                    <SelectItem value="intense">{t('intense')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workoutLocation">{t('workoutLocation')}</Label>
                <Select value={formData.workoutLocation} onValueChange={(value) => handleInputChange("workoutLocation", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectLocation')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gym">{t('gymLocation')}</SelectItem>
                    <SelectItem value="home">{t('homeLocation')}</SelectItem>
                    <SelectItem value="both">{t('bothLocations')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="exerciseHistory">{t('exerciseHistory')}</Label>
              <Textarea
                id="exerciseHistory"
                value={formData.exerciseHistory}
                onChange={(e) => handleInputChange("exerciseHistory", e.target.value)}
                placeholder={t('exerciseHistoryPlaceholder')}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="dailyRoutine">{t('dailyRoutine')}</Label>
              <Textarea
                id="dailyRoutine"
                value={formData.dailyRoutine}
                onChange={(e) => handleInputChange("dailyRoutine", e.target.value)}
                placeholder={t('dailyRoutinePlaceholder')}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fitness Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t("fitnessGoals")}
            </CardTitle>
            <CardDescription>
              {t("whatAreYouTryingToAchieve")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="goalWeight">{t("goalWeight")}</Label>
              <Input
                id="goalWeight"
                type="number"
                value={formData.goalWeight}
                onChange={(e) => handleInputChange("goalWeight", e.target.value)}
                placeholder={t('enterGoalWeightKg')}
                min="30"
                max="500"
                step="0.1"
              />
            </div>

            <div>
              <Label htmlFor="fitnessGoal">{t("primaryFitnessGoal")}</Label>
              <Select value={formData.fitnessGoal} onValueChange={(value) => handleInputChange("fitnessGoal", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectPrimaryGoal')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight loss">{t('weightLoss')}</SelectItem>
                  <SelectItem value="muscle gain">{t('muscleGain')}</SelectItem>
                  <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                  <SelectItem value="general fitness">{t('generalFitness')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="bio">{t("personalBio")}</Label>
              <Textarea
                id="bio"
                value={formData.bio || ""}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                placeholder={t('tellUsAboutYourselfBio')}
                rows={4}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {t('bioPlaceholder')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Nutrition Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="h-5 w-5" />
              {t('nutritionPreferences')}
            </CardTitle>
            <CardDescription>
              {t('dietaryChoicesHabits')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dailyMeals">{t('numberOfMealsPerDay')}</Label>
                <Input
                  id="dailyMeals"
                  type="number"
                  value={formData.dailyMeals}
                  onChange={(e) => handleInputChange("dailyMeals", e.target.value)}
                  placeholder={t('examplePlaceholder3')}
                  min="1"
                  max="7"
                />
              </div>
              <div>
                <Label htmlFor="preferredCarbs">{t('preferredCarbohydratesShort')}</Label>
                <Input
                  id="preferredCarbs"
                  value={formData.preferredCarbs}
                  onChange={(e) => handleInputChange("preferredCarbs", e.target.value)}
                  placeholder={t('exampleOatsRiceQuinoa')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferredProteins">{t('preferredProteinsShort')}</Label>
                <Input
                  id="preferredProteins"
                  value={formData.preferredProteins}
                  onChange={(e) => handleInputChange("preferredProteins", e.target.value)}
                  placeholder={t('exampleChickenFishLentils')}
                />
              </div>
              <div>
                <Label htmlFor="preferredLegumes">{t('preferredLegumesShort')}</Label>
                <Input
                  id="preferredLegumes"
                  value={formData.preferredLegumes}
                  onChange={(e) => handleInputChange("preferredLegumes", e.target.value)}
                  placeholder={t('exampleBeansChickpeasPeas')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferredVegetables">{t('preferredVegetablesShort')}</Label>
                <Input
                  id="preferredVegetables"
                  value={formData.preferredVegetables}
                  onChange={(e) => handleInputChange("preferredVegetables", e.target.value)}
                  placeholder={t('exampleBroccoliSpinachCarrots')}
                />
              </div>
              <div>
                <Label htmlFor="preferredDairy">{t('preferredDairyShort')}</Label>
                <Input
                  id="preferredDairy"
                  value={formData.preferredDairy}
                  onChange={(e) => handleInputChange("preferredDairy", e.target.value)}
                  placeholder={t('exampleYogurtMilkCheese')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferredFats">{t('preferredFatsShort')}</Label>
                <Input
                  id="preferredFats"
                  value={formData.preferredFats}
                  onChange={(e) => handleInputChange("preferredFats", e.target.value)}
                  placeholder={t('exampleAvocadoNutsOliveOil')}
                />
              </div>
              <div>
                <Label htmlFor="preferredFruits">{t('preferredFruitsShort')}</Label>
                <Input
                  id="preferredFruits"
                  value={formData.preferredFruits}
                  onChange={(e) => handleInputChange("preferredFruits", e.target.value)}
                  placeholder={t('exampleBerriesApplesBananas')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t('doYouHaveAllergies')}</Label>
                <Select value={formData.hasAllergies ? "true" : "false"} onValueChange={(value) => handleInputChange("hasAllergies", value === "true")}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectOption')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t('yes')}</SelectItem>
                    <SelectItem value="false">{t('no')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.hasAllergies && (
                <div>
                  <Label>{t('allergyDetails')}</Label>
                  <Input
                    id="allergyDetails"
                    value={formData.allergyDetails}
                    onChange={(e) => handleInputChange("allergyDetails", e.target.value)}
                    placeholder={t('examplePeanutsShellfish')}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>{t('doYouWantSupplements')}</Label>
              <Select value={formData.wantsSupplements ? "true" : "false"} onValueChange={(value) => handleInputChange("wantsSupplements", value === "true")}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectOption')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">{t('yes')}</SelectItem>
                  <SelectItem value="false">{t('no')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>


        {/* Save Changes Button */}
        {!isViewingOtherUser && (
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updateProfileMutation.isPending}
              className="min-w-32"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('saving')}
                </>
              ) : (
                t('saveChanges') as string
              )}
            </Button>
          </div>
        )}

        {/* Workout plan moved to /workouts page */}

        {/* Nutrition plan moved to /nutrition page */}

        {/* Subscription Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("subscriptionInformation")}
            </CardTitle>
            <CardDescription>
              {t("currentSubscriptionStatus")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>{t("subscriptionType")}</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">
                  {user?.subscriptionType ? (
                    <span>
                      {(() => {
                        const match = user.subscriptionType.match(/^(\d+(?:\.\d+)?)(?:_months?)?$/);
                        if (match) {
                          const months = parseFloat(match[1]);
                          return months === 1 ? t('monthPlan', { months }) : t('monthsPlan', { months });
                        }
                        return user.subscriptionType.replace('_', ' ') + ' Plan';
                      })()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('noActiveSubscription')}</span>
                  )}
                </div>
              </div>

              <div>
                <Label>{t("startDate")}</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">
                  {user?.subscriptionStartDate ? (
                    new Date(user.subscriptionStartDate).toLocaleDateString()
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>

              <div>
                <Label>{t("endDate")}</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">
                  {user?.subscriptionEndDate ? (
                    new Date(user.subscriptionEndDate).toLocaleDateString()
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>

              <div>
                <Label>{t("status")}</Label>
                <div className="mt-1 p-2 bg-gray-50 rounded border">
                  {user?.subscriptionType ? (
                    (() => {
                      const status = getSubscriptionStatus(user.subscriptionType, user.subscriptionStartDate, user.subscriptionEndDate);
                      switch (status) {
                        case 'active':
                          return (
                            <div>
                              <span className="text-green-600 font-medium">{t('active')}</span>
                              {user.subscriptionEndDate && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {(() => {
                                    const daysRemaining = Math.ceil((new Date(user.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    return t('daysRemaining', { days: daysRemaining });
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        case 'expired':
                          return (
                            <div>
                              <span className="text-red-600 font-medium">{t('expired')}</span>
                              {user.subscriptionEndDate && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {(() => {
                                    const daysExpired = Math.ceil((new Date().getTime() - new Date(user.subscriptionEndDate).getTime()) / (1000 * 60 * 60 * 24));
                                    return t('expiredDaysAgo', { days: daysExpired });
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        case 'suspended':
                          return <span className="text-orange-600 font-medium">{t('suspendedStartAfterEnd')}</span>;
                        case 'none':
                        default:
                          return <span className="text-muted-foreground">{t('noActiveSubscription')}</span>;
                      }
                    })()
                  ) : (
                    <span className="text-muted-foreground">No subscription</span>
                  )}
                </div>
              </div>
            </div>


          </CardContent>
        </Card>

        {/* Workout plan placeholder removed; see /workouts */}

      </form>

      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />
    </div>
  );
}