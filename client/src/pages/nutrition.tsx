import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DailyStats, Meal, UserPlan } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from '@/components/ui/swipeable-tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash, PlusCircle, Edit, Apple, CheckCircle, Plus, UtensilsCrossed, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import MealForm from '@/components/nutrition/MealForm';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { dateStringForToday, formatInAppTz, formatInAppTzWithOptions, parseDateStringInAppTz, datetimeLocalToUtcIso, utcIsoToDatetimeLocal } from '@/lib/timezone';
import { useLanguage } from '@/context/LanguageContext';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import AnimatedBackground from "@/components/layout/AnimatedBackground";

const Nutrition: React.FC = () => {
  const { t, language } = useLanguage();
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(dateStringForToday());
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const { toast } = useToast();

  // Get current user role from localStorage for coach-specific features
  const currentUserRole = (() => {
    try {
      const cu = localStorage.getItem('currentUser');
      return cu ? JSON.parse(cu).role : null;
    } catch { return null; }
  })();

  // Coach assign nutrition plan state
  const [showCoachNutritionDialog, setShowCoachNutritionDialog] = useState(false);
  const [coachNutritionTraineeId, setCoachNutritionTraineeId] = useState<string>('');
  const [coachNutritionForm, setCoachNutritionForm] = useState({
    title: '',
    description: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    meals: '',
    tips: '',
  });
  const [viewNutritionPlan, setViewNutritionPlan] = useState<any | null>(null);
  const [editingNutritionPlan, setEditingNutritionPlan] = useState<any | null>(null);

  const resetCoachNutritionDialog = () => {
    setShowCoachNutritionDialog(false);
    setEditingNutritionPlan(null);
    setCoachNutritionTraineeId('');
    setCoachNutritionForm({
      title: '',
      description: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      meals: '',
      tips: '',
    });
  };

  const openCreateNutritionDialog = () => {
    setEditingNutritionPlan(null);
    setCoachNutritionTraineeId('');
    setCoachNutritionForm({
      title: '',
      description: '',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      meals: '',
      tips: '',
    });
    setShowCoachNutritionDialog(true);
  };

  const openEditNutritionDialog = (plan: any) => {
    setEditingNutritionPlan(plan);
    setCoachNutritionTraineeId(String(plan.user_id ?? plan.userId ?? ''));
    setCoachNutritionForm({
      title: plan.title ?? '',
      description: plan.description ?? '',
      calories: plan.goals?.calories != null ? String(plan.goals.calories) : '',
      protein: plan.goals?.protein != null ? String(plan.goals.protein) : '',
      carbs: plan.goals?.carbs != null ? String(plan.goals.carbs) : '',
      fat: plan.goals?.fat != null ? String(plan.goals.fat) : '',
      meals: Array.isArray(plan.goals?.meals) ? plan.goals.meals.join('\n') : '',
      tips: Array.isArray(plan.goals?.tips) ? plan.goals.tips.join('\n') : '',
    });
    setShowCoachNutritionDialog(true);
  };

  // Fetch daily stats for the selected date
  const { data: dailyStats, isLoading: isLoadingStats } = useQuery<DailyStats>({
    queryKey: ['/api/daily-stats', selectedDate],
    queryFn: async () => {
      const currentUser = localStorage.getItem('currentUser');
      const userId = currentUser ? JSON.parse(currentUser).id : null;
      
      const headers: Record<string, string> = {};
      if (userId) {
        headers["x-user-id"] = userId.toString();
      }
      
      const res = await fetch(`/api/daily-stats?date=${selectedDate}`, {
        credentials: 'include',
        headers,
      });
      
      if (!res.ok) throw new Error('Failed to fetch daily stats');
      return res.json();
    },
  });

  // Fetch meals for the selected date
  const { data: meals, isLoading: isLoadingMeals } = useQuery<Meal[]>({
    queryKey: ['/api/meals', selectedDate],
    queryFn: async () => {
      const currentUser = localStorage.getItem('currentUser');
      const userId = currentUser ? JSON.parse(currentUser).id : null;
      
      const headers: Record<string, string> = {};
      if (userId) {
        headers["x-user-id"] = userId.toString();
      }
      
      const res = await fetch(`/api/meals?date=${selectedDate}`, {
        credentials: 'include',
        headers,
      });
      
      if (!res.ok) throw new Error('Failed to fetch meals');
      return res.json();
    },
  });

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleDeleteMeal = async (mealId: number) => {
    try {
      await apiRequest("DELETE", `/api/meals/${mealId}`);
      toast({
        title: t("success"),
        description: t("mealDeleted"),
      });
      // Invalidate all queries that start with these paths
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          return Array.isArray(queryKey) && 
                 (queryKey[0] === '/api/meals' || queryKey[0] === '/api/daily-stats');
        }
      });
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast({
        title: t("error"),
        description: t("failedToDelete"),
        variant: "destructive",
      });
    }
  };

  const handleEditMeal = (meal: Meal) => {
    console.log('[Nutrition] handleEditMeal called', { mealId: meal.id });
    setEditingMeal(meal);
    setIsAddMealOpen(true);
  };

  const handleCloseDialog = () => {
    console.log('[Nutrition] handleCloseDialog called');
    // Add small delay to let React Hook Form cleanup complete
    setTimeout(() => {
      console.log('[Nutrition] Closing dialog after delay');
      setIsAddMealOpen(false);
      // Use a small delay to ensure Dialog animation completes before clearing state
      setTimeout(() => {
        console.log('[Nutrition] Clearing editingMeal state');
        setEditingMeal(null);
      }, 100);
    }, 50);
  };

  const handleDialogOpenChange = (open: boolean) => {
    console.log('[Nutrition] handleDialogOpenChange called', { open });
    if (!open) {
      handleCloseDialog();
    } else {
      setIsAddMealOpen(true);
    }
  };

  // Fetch coach's trainees (only for coaches/admins)
  const { data: myNutrTrainees = [] } = useQuery<any[]>({
    queryKey: ['/api/coach/my-users'],
    enabled: currentUserRole === 'coach' || currentUserRole === 'admin' || currentUserRole === 'super_admin',
  });

  // Fetch all plans assigned by this coach (nutrition = plans with goals.calories)
  const { data: assignedNutritionPlans = [], refetch: refetchAssignedNutrition } = useQuery<any[]>({
    queryKey: ['/api/coach/assigned-plans', 'nutrition'],
    enabled: currentUserRole === 'coach' || currentUserRole === 'admin' || currentUserRole === 'super_admin',
    queryFn: async () => {
      const res = await fetch('/api/coach/assigned-plans', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      // Filter to plans that have nutrition goals (calories set)
      return data.filter((p: any) => p.goals && (p.goals.calories || p.goals.protein || p.goals.carbs || p.goals.fat));
    },
  });

  // Delete assigned plan mutation
  const deleteNutritionPlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const res = await fetch(`/api/user-plans/${planId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to delete plan'); }
    },
    onSuccess: () => { refetchAssignedNutrition(); toast({ title: t('success'), description: t('planDeleted') || 'Plan deleted.' }); },
    onError: (e: any) => toast({ title: t('error'), description: e.message, variant: 'destructive' }),
  });
  const coachAssignNutritionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/user-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to assign nutrition plan');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      setShowCoachNutritionDialog(false);
      setCoachNutritionTraineeId('');
      setCoachNutritionForm({ title: '', description: '', calories: '', protein: '', carbs: '', fat: '', meals: '', tips: '' });
      toast({ title: t('success'), description: t('nutritionPlanCreatedSuccess') });
    },
    onError: (err: any) => {
      toast({ title: t('error'), description: err.message || 'Failed to assign plan', variant: 'destructive' });
    },
  });

  const coachUpdateNutritionMutation = useMutation({
    mutationFn: async ({ planId, data }: { planId: number; data: any }) => {
      const response = await fetch(`/api/user-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update nutrition plan');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-plans'] });
      refetchAssignedNutrition();
      resetCoachNutritionDialog();
      toast({ title: t('success'), description: t('planUpdated') || 'Plan updated successfully.' });
    },
    onError: (err: any) => {
      toast({ title: t('error'), description: err.message || 'Failed to update plan', variant: 'destructive' });
    },
  });

  // Fetch user's personalized plan (latest)
  const { data: userPlan } = useQuery<UserPlan>({
    queryKey: ["/api/user-plans", { latest: true }],
    retry: false,
    queryFn: async () => {
      const currentUser = localStorage.getItem('currentUser');
      const userId = currentUser ? JSON.parse(currentUser).id : null;
      const headers: Record<string, string> = {};
      if (userId) headers["x-user-id"] = userId.toString();
      const res = await fetch(`/api/user-plans?latest=true`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Failed to fetch user plan');
      return res.json();
    },
  });

  const goalsData = (userPlan?.goals ?? null) as any;
  const hasMeals = !!(goalsData && Array.isArray(goalsData.meals));
  const hasTips = !!(goalsData && Array.isArray(goalsData.tips));

  // Group meals by type
  const mealsByType = Array.isArray(meals) ? meals.reduce<Record<string, Meal[]>>((acc, meal) => {
    if (!acc[meal.type]) {
      acc[meal.type] = [];
    }
    acc[meal.type].push(meal);
    return acc;
  }, {}) : {};

  // Calculate totals for each type
  const calculateTotals = (mealList: Meal[]) => {
    return mealList.reduce((acc, meal) => {
      return {
        calories: acc.calories + meal.calories,
        proteins: acc.proteins + meal.proteins,
        carbs: acc.carbs + meal.carbs,
        fats: acc.fats + meal.fats,
        fiber: acc.fiber + (meal.fiber || 0),
      };
    }, { calories: 0, proteins: 0, carbs: 0, fats: 0, fiber: 0 });
  };

  return (
    <section className="p-4 md:p-6 lg:p-8 relative min-h-screen">
      <AnimatedBackground />
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">{t("nutrition")}</h2>
          <p className="text-gray-600">{t("trackMealsNutrition")}</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center">
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="border rounded-md p-2 mr-4"
          />
          <Dialog open={isAddMealOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t("addMeal")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto w-full mx-4">
              <DialogHeader>
                <DialogTitle>{editingMeal ? t("editMeal") : t("addMeal")}</DialogTitle>
                <DialogDescription>
                  {editingMeal ? t("updateMealDetails") : t("enterMealDetails")}
                </DialogDescription>
              </DialogHeader>
              <MealForm 
                key={editingMeal ? `edit-${editingMeal.id}` : 'new-meal'}
                onSuccess={handleCloseDialog} 
                onCancel={handleCloseDialog}
                defaultValues={editingMeal ? { ...editingMeal, fiber: editingMeal.fiber || 0, foodItems: editingMeal.foodItems || [] } : { date: datetimeLocalToUtcIso(`${selectedDate}T${utcIsoToDatetimeLocal(new Date().toISOString()).split('T')[1]}`) }}
                isEditing={!!editingMeal}
                mealId={editingMeal?.id}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Coach Tools: Assign Nutrition Plan (only for coaches/admins) */}
      {(currentUserRole === 'coach' || currentUserRole === 'admin' || currentUserRole === 'super_admin') && (
        <div className="mb-6">
          <Card className="border-green-200 bg-green-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-green-600" />
                  {t('coachTraineeTools')}
                </div>
                <Button size="sm" onClick={openCreateNutritionDialog} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t('assignNutritionPlan')}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              {assignedNutritionPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{t('noAssignedNutritionPlans') || 'No nutrition plans assigned yet.'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">{t('trainee') || 'Trainee'}</th>
                        <th className="pb-2 pr-3 font-medium">{t('planTitle') || 'Plan'}</th>
                        <th className="pb-2 pr-3 font-medium hidden sm:table-cell">{t('calories') || 'Calories'}</th>
                        <th className="pb-2 pr-3 font-medium hidden sm:table-cell">{t('protein') || 'Protein'}</th>
                        <th className="pb-2 pr-3 font-medium hidden md:table-cell">{t('carbs') || 'Carbs'}</th>
                        <th className="pb-2 pr-3 font-medium hidden md:table-cell">{t('created') || 'Created'}</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedNutritionPlans.map((plan: any) => (
                        <tr key={plan.id} className="border-b last:border-0 hover:bg-green-50/60">
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-green-600 shrink-0" />
                              <span className="font-medium truncate max-w-[100px]">
                                {plan.trainee_first_name && plan.trainee_last_name
                                  ? `${plan.trainee_first_name} ${plan.trainee_last_name}`
                                  : plan.trainee_username || `User #${plan.user_id ?? plan.userId}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <span className="truncate max-w-[120px] block">{plan.title}</span>
                          </td>
                          <td className="py-2 pr-3 hidden sm:table-cell">
                            {plan.goals?.calories ? <span className="font-medium">{plan.goals.calories} kcal</span> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 pr-3 hidden sm:table-cell">
                            {plan.goals?.protein ? `${plan.goals.protein}g` : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell">
                            {plan.goals?.carbs ? `${plan.goals.carbs}g` : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground text-xs">
                            {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewNutritionPlan(plan)}
                                className="h-7 px-2 text-xs"
                              >
                                {t('view') || 'View'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditNutritionDialog(plan)}
                                className="h-7 px-2 text-xs"
                              >
                                {t('edit') || 'Edit'}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteNutritionPlanMutation.mutate(plan.id)}
                                disabled={deleteNutritionPlanMutation.isPending}
                                className="h-7 px-2 text-xs"
                              >
                                {t('delete') || 'Delete'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 border-t border-green-200/70 pt-2 text-xs text-muted-foreground">
                {language === 'ar' ? (
                  <p>
                    للحصول على تحكم كامل انتقل إلى{' '}
                    <a href="/coach" className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">coach</a>
                  </p>
                ) : (
                  <p>
                    For Full Control Go to{' '}
                    <a href="/coach" className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">Coach</a>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Nutrition Summary */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("nutritionSummaryFor")} {formatInAppTzWithOptions(parseDateStringInAppTz(selectedDate), 'MMMM d, yyyy', language === 'ar' ? { locale: arSA } : undefined)}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
            ) : dailyStats ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t("calories")}</p>
                  <p className="text-xl font-semibold">{dailyStats.calories || 0} / {dailyStats.caloriesGoal || 0}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${
                        ((dailyStats.calories || 0) / (dailyStats.caloriesGoal || 1)) > 1.15 
                          ? 'bg-red-500' 
                          : ((dailyStats.calories || 0) / (dailyStats.caloriesGoal || 1)) > 1.0 
                            ? 'bg-orange-500' 
                            : 'bg-blue-500'
                      }`} 
                      style={{ width: `${Math.min(100, ((dailyStats.calories || 0) / (dailyStats.caloriesGoal || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t("protein")}</p>
                  <p className="text-xl font-semibold">{Math.round(dailyStats.protein || 0)}{t("grams")} / {dailyStats.proteinGoal || 0}{t("grams")}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${
                        ((dailyStats.protein || 0) / (dailyStats.proteinGoal || 1)) > 1.15 
                          ? 'bg-red-500' 
                          : ((dailyStats.protein || 0) / (dailyStats.proteinGoal || 1)) > 1.0 
                            ? 'bg-orange-500' 
                            : 'bg-blue-500'
                      }`} 
                      style={{ width: `${Math.min(100, ((dailyStats.protein || 0) / (dailyStats.proteinGoal || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t("carbs")}</p>
                  <p className="text-xl font-semibold">{Math.round(dailyStats.carbs || 0)}{t("grams")} / {dailyStats.carbsGoal || 0}{t("grams")}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${
                        ((dailyStats.carbs || 0) / (dailyStats.carbsGoal || 1)) > 1.15 
                          ? 'bg-red-500' 
                          : ((dailyStats.carbs || 0) / (dailyStats.carbsGoal || 1)) > 1.0 
                            ? 'bg-orange-500' 
                            : 'bg-blue-500'
                      }`} 
                      style={{ width: `${Math.min(100, ((dailyStats.carbs || 0) / (dailyStats.carbsGoal || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t("fat")}</p>
                  <p className="text-xl font-semibold">{Math.round(dailyStats.fat || 0)}{t("grams")} / {dailyStats.fatGoal || 0}{t("grams")}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${
                        ((dailyStats.fat || 0) / (dailyStats.fatGoal || 1)) > 1.15 
                          ? 'bg-red-500' 
                          : ((dailyStats.fat || 0) / (dailyStats.fatGoal || 1)) > 1.0 
                            ? 'bg-orange-500' 
                            : 'bg-blue-500'
                      }`} 
                      style={{ width: `${Math.min(100, ((dailyStats.fat || 0) / (dailyStats.fatGoal || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-500">{t("fiber")}</p>
                  <p className="text-xl font-semibold">{Math.round(dailyStats.fiber || 0)}{t("grams")} / {dailyStats.fiberGoal || 0}{t("grams")}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className={`h-2 rounded-full ${
                        ((dailyStats.fiber || 0) / (dailyStats.fiberGoal || 1)) > 1.15 
                          ? 'bg-red-500' 
                          : ((dailyStats.fiber || 0) / (dailyStats.fiberGoal || 1)) > 1.0 
                            ? 'bg-orange-500' 
                            : 'bg-blue-500'
                      }`} 
                      style={{ width: `${Math.min(100, ((dailyStats.fiber || 0) / (dailyStats.fiberGoal || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500">{t("noNutritionData")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personalized Nutrition Plan (moved from /profile) */}
      <div className="mb-8">
        {userPlan && (hasMeals || hasTips) ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                {t("personalizedNutritionPlan")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasMeals && (
                <div>
                  <h4 className="font-semibold mb-3">{t("suggestedMeals")}</h4>
                  <div className="space-y-2">
                    {(goalsData.meals as string[]).map((meal: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                        <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
                        <span className="text-sm">{meal}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasTips && (
                <div>
                  <h4 className="font-semibold mb-3">{t("nutritionTips")}</h4>
                  <div className="space-y-2">
                    {(goalsData.tips as string[]).map((tip: string, index: number) => (
                      <div key={index} className="flex items-start gap-2 p-2 bg-green-50 rounded">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" />
                {t("personalizedNutritionPlan")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Apple className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">{t("noNutritionPlanAssignedNutrition")}</p>
                <p>{t("coachWillCreateNutritionPlan")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meals Log */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">{t("mealsLog")}</h3>
        {isLoadingMeals ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : meals && meals.length > 0 ? (
          <SwipeableTabs defaultValue="breakfast">
            <SwipeableTabsList className="mb-4">
              <SwipeableTabsTrigger value="breakfast">🌅 {t("breakfast")}</SwipeableTabsTrigger>
              <SwipeableTabsTrigger value="lunch">☀️ {t("lunch")}</SwipeableTabsTrigger>
              <SwipeableTabsTrigger value="dinner">🌙 {t("dinner")}</SwipeableTabsTrigger>
              <SwipeableTabsTrigger value="snack">🍎 {t("snacks")}</SwipeableTabsTrigger>
            </SwipeableTabsList>
            
            {["breakfast", "lunch", "dinner", "snack"].map((type) => (
              <SwipeableTabsContent key={type} value={type}>
                {mealsByType[type] && mealsByType[type].length > 0 ? (
                  <>
                    {mealsByType[type].map((meal) => (
                      <Card key={meal.id} className="mb-4">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{meal.name}</h4>
                              <p className="text-sm text-gray-500">
                                {formatInAppTz(new Date(meal.date), 'h:mm a')} · {meal.calories} {t("calories")}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" onClick={() => handleEditMeal(meal)}>
                                <Edit className="h-4 w-4" />
                                <span>{t("edit") || "Edit"}</span>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteMeal(meal.id)}>
                                <Trash className="h-4 w-4 text-red-500" />
                                <span>{t("delete") || "Delete"}</span>
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-gray-500">{t("protein")}</p>
                              <p className="font-medium">{meal.proteins}{t("grams")}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{t("carbs")}</p>
                              <p className="font-medium">{meal.carbs}{t("grams")}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{t("fat")}</p>
                              <p className="font-medium">{meal.fats}{t("grams")}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">{t("fiber")}</p>
                              <p className="font-medium">{meal.fiber || 0}{t("grams")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {/* Meal type summary */}
                    {mealsByType[type] && mealsByType[type].length > 0 && (
                      <Card className="bg-gray-50">
                        <CardContent className="p-4">
                          <h4 className="font-medium">{t("totalFor")} {type}</h4>
                          <div className="grid grid-cols-4 gap-4 mt-2">
                            {(() => {
                              const totals = calculateTotals(mealsByType[type]);
                              return (
                                <>
                                  <div>
                                    <p className="text-xs text-gray-500">{t("calories")}</p>
                                    <p className="font-medium">{totals.calories}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">{t("protein")}</p>
                                    <p className="font-medium">{Math.round(totals.proteins)}g</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">{t("carbs")}</p>
                                    <p className="font-medium">{Math.round(totals.carbs)}g</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">{t("fat")}</p>
                                    <p className="font-medium">{Math.round(totals.fats)}g</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">{t("noMealsOfType").replace('{type}', type)}</p>
                  </div>
                )}
              </SwipeableTabsContent>
            ))}
          </SwipeableTabs>
        ) : (
          <div className="text-center py-10 bg-gray-50 rounded-lg">
            <p className="text-gray-500">{t("noMealsLogged")}</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setEditingMeal(null);
                setIsAddMealOpen(true);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("addYourFirstMeal")}
            </Button>
          </div>
        )}
      </div>
      
      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />

      {/* Coach Assign Nutrition Plan Dialog */}
      {(currentUserRole === 'coach' || currentUserRole === 'admin' || currentUserRole === 'super_admin') && (
        <Dialog
          open={showCoachNutritionDialog}
          onOpenChange={(open) => {
            if (!open) {
              resetCoachNutritionDialog();
              return;
            }
            setShowCoachNutritionDialog(true);
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                {editingNutritionPlan ? (t('edit') || 'Edit') : t('assignNutritionPlan')}
              </DialogTitle>
              <DialogDescription>
                {editingNutritionPlan
                  ? (t('personalizedNutritionPlan') || 'Update personalized nutrition plan')
                  : t('personalizedNutritionPlan')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('selectTrainee')}</Label>
                <Select
                  value={coachNutritionTraineeId}
                  onValueChange={setCoachNutritionTraineeId}
                  disabled={!!editingNutritionPlan}
                >
                  <SelectTrigger><SelectValue placeholder={t('selectTrainee')} /></SelectTrigger>
                  <SelectContent>
                    {myNutrTrainees.map((tr: any) => (
                      <SelectItem key={tr.id} value={String(tr.id)}>
                        {tr.firstName} {tr.lastName} ({tr.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nPlanTitle">{t('planTitle')}</Label>
                <Input id="nPlanTitle" value={coachNutritionForm.title} onChange={e => setCoachNutritionForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nPlanDesc">{t('planDescription')}</Label>
                <Input id="nPlanDesc" value={coachNutritionForm.description} onChange={e => setCoachNutritionForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="nCalories">{t('calories')}</Label>
                  <Input id="nCalories" type="number" value={coachNutritionForm.calories} onChange={e => setCoachNutritionForm(f => ({ ...f, calories: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nProtein">{t('proteinG')}</Label>
                  <Input id="nProtein" type="number" value={coachNutritionForm.protein} onChange={e => setCoachNutritionForm(f => ({ ...f, protein: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nCarbs">{t('carbsG')}</Label>
                  <Input id="nCarbs" type="number" value={coachNutritionForm.carbs} onChange={e => setCoachNutritionForm(f => ({ ...f, carbs: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nFat">{t('fatG')}</Label>
                  <Input id="nFat" type="number" value={coachNutritionForm.fat} onChange={e => setCoachNutritionForm(f => ({ ...f, fat: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nMeals">{t('mealPlan')}</Label>
                <Textarea id="nMeals" value={coachNutritionForm.meals} onChange={e => setCoachNutritionForm(f => ({ ...f, meals: e.target.value }))} rows={4} placeholder="Breakfast: oatmeal with banana&#10;Lunch: grilled chicken + rice&#10;Dinner: salmon + veggies" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nTips">{t('nutritionTipsLabel')}</Label>
                <Textarea id="nTips" value={coachNutritionForm.tips} onChange={e => setCoachNutritionForm(f => ({ ...f, tips: e.target.value }))} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetCoachNutritionDialog}>{t('cancel')}</Button>
              <Button
                disabled={
                  !coachNutritionTraineeId ||
                  !coachNutritionForm.title.trim() ||
                  coachAssignNutritionMutation.isPending ||
                  coachUpdateNutritionMutation.isPending
                }
                onClick={() => {
                  const payload = {
                    userId: parseInt(coachNutritionTraineeId),
                    title: coachNutritionForm.title.trim(),
                    description: coachNutritionForm.description.trim() || coachNutritionForm.title.trim(),
                    goals: {
                      calories: coachNutritionForm.calories ? parseInt(coachNutritionForm.calories) : undefined,
                      protein: coachNutritionForm.protein ? parseInt(coachNutritionForm.protein) : undefined,
                      carbs: coachNutritionForm.carbs ? parseInt(coachNutritionForm.carbs) : undefined,
                      fat: coachNutritionForm.fat ? parseInt(coachNutritionForm.fat) : undefined,
                      meals: coachNutritionForm.meals ? coachNutritionForm.meals.split('\n').filter(m => m.trim()) : [],
                      tips: coachNutritionForm.tips ? coachNutritionForm.tips.split('\n').filter(t => t.trim()) : [],
                    },
                  };

                  if (editingNutritionPlan?.id) {
                    coachUpdateNutritionMutation.mutate({ planId: editingNutritionPlan.id, data: payload });
                    return;
                  }

                  coachAssignNutritionMutation.mutate(payload);
                }}
              >
                {(coachAssignNutritionMutation.isPending || coachUpdateNutritionMutation.isPending)
                  ? '...'
                  : (editingNutritionPlan ? (t('save') || 'Save') : t('assignNutritionPlan'))}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Assigned Nutrition Plan Dialog */}
      {(currentUserRole === 'coach' || currentUserRole === 'admin' || currentUserRole === 'super_admin') && (
        <Dialog open={!!viewNutritionPlan} onOpenChange={(open) => !open && setViewNutritionPlan(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewNutritionPlan?.title || (t('planDetails') || 'Plan Details')}</DialogTitle>
              <DialogDescription>{viewNutritionPlan?.description || ''}</DialogDescription>
            </DialogHeader>

            {viewNutritionPlan && (
              <div className="space-y-4 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground">{t('calories') || 'Calories'}:</span>{' '}
                    {viewNutritionPlan.goals?.calories ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('protein') || 'Protein'}:</span>{' '}
                    {viewNutritionPlan.goals?.protein ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('carbs') || 'Carbs'}:</span>{' '}
                    {viewNutritionPlan.goals?.carbs ?? '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('fat') || 'Fat'}:</span>{' '}
                    {viewNutritionPlan.goals?.fat ?? '—'}
                  </div>
                </div>

                {Array.isArray(viewNutritionPlan.goals?.meals) && viewNutritionPlan.goals.meals.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">{t('mealPlan') || 'Meal Plan'}</p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      {viewNutritionPlan.goals.meals.map((meal: string, idx: number) => (
                        <li key={idx}>{meal}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(viewNutritionPlan.goals?.tips) && viewNutritionPlan.goals.tips.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">{t('nutritionTipsLabel') || 'Tips'}</p>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      {viewNutritionPlan.goals.tips.map((tip: string, idx: number) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewNutritionPlan(null)}>{t('close') || 'Close'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
};

export default Nutrition;
