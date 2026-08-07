import { AiAssistantPanel } from "@/components/epics/EpicWidgets";
import Messages from "@/pages/messages";
import { AiAgentChat } from "@/components/ai/AiAgentChat";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLanguage } from "@/context/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { UserPlan } from "@shared/schema";
import { Apple, Dumbbell, Calendar, Target } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function AiAssistantFeaturePage() {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  // Fetch user's latest nutrition plan
  const { data: nutritionPlan } = useQuery<UserPlan>({
    queryKey: ["/api/user-plans", { latest: true, planType: "nutrition" }],
    retry: false,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (user?.id) headers["x-user-id"] = user.id.toString();
      const res = await fetch(`/api/user-plans?latest=true&planType=nutrition`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  // Fetch user's latest workout plan
  const { data: workoutPlan } = useQuery<UserPlan>({
    queryKey: ["/api/user-plans", { latest: true, planType: "workout" }],
    retry: false,
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (user?.id) headers["x-user-id"] = user.id.toString();
      const res = await fetch(`/api/user-plans?latest=true&planType=workout`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

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

  const nutritionGoals = nutritionPlan?.goals as any;
  const workoutGoals = workoutPlan?.weeklySchedule as any;

  return (
    <div className="p-4 lg:p-8 space-y-4 min-h-screen">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">{t("featureAiTitle")}</h1>
        <p className="text-muted-foreground">{t("featureAiSubtitle")}</p>
      </div>
      
      <AiAssistantPanel />

      {/* Generated Plans Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Nutrition Plan Card */}
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Apple className="h-5 w-5 text-green-600" />
              <CardTitle>{language === 'ar' ? 'خطة التغذية' : 'Nutrition Plan'}</CardTitle>
            </div>
            <CardDescription>
              {nutritionPlan 
                ? (language === 'ar' ? 'خطتك الغذائية المخصصة' : 'Your personalized nutrition plan')
                : (language === 'ar' ? 'لم يتم إنشاء خطة بعد' : 'No plan generated yet')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nutritionPlan ? (
              <div className="space-y-4">
                {nutritionPlan.title && (
                  <div>
                    <h3 className="font-semibold text-lg">{nutritionPlan.title}</h3>
                    {nutritionPlan.description && (
                      <p className="text-sm text-muted-foreground mt-1">{nutritionPlan.description}</p>
                    )}
                  </div>
                )}
                
                {nutritionGoals?.meals && Array.isArray(nutritionGoals.meals) && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {language === 'ar' ? 'الوجبات اليومية' : 'Daily Meals'}
                    </h4>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2 pr-4">
                        {nutritionGoals.meals.map((meal: any, idx: number) => {
                          // Handle both string and object formats for backwards compatibility
                          const isString = typeof meal === 'string';
                          const mealName = isString ? `${language === 'ar' ? 'وجبة' : 'Meal'} ${idx + 1}` : (meal.name || `${language === 'ar' ? 'وجبة' : 'Meal'} ${idx + 1}`);
                          const mealItems = isString ? [meal] : (meal.items || []);
                          
                          return (
                            <div key={idx} className="p-3 bg-slate-50 rounded-lg border">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{mealName}</p>
                                  {!isString && meal.time && <p className="text-xs text-muted-foreground">{meal.time}</p>}
                                  {mealItems.length > 0 && (
                                    <ul className="text-sm mt-1 space-y-0.5">
                                      {mealItems.map((item: string, i: number) => (
                                        <li key={i} className="text-muted-foreground">• {item}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                {!isString && meal.calories && (
                                  <Badge variant="secondary" className="ml-2">
                                    {meal.calories} {language === 'ar' ? 'سعرة' : 'cal'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {nutritionGoals?.tips && Array.isArray(nutritionGoals.tips) && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      {language === 'ar' ? 'نصائح' : 'Tips'}
                    </h4>
                    <ul className="text-sm space-y-1">
                      {nutritionGoals.tips.map((tip: string, idx: number) => (
                        <li key={idx} className="text-muted-foreground">• {tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Apple className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>{language === 'ar' ? 'انقر على "مسودة الخطة" أعلاه لإنشاء خطة التغذية' : 'Click "Draft plan" above to generate your nutrition plan'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workout Plan Card */}
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-blue-600" />
              <CardTitle>{language === 'ar' ? 'خطة التمرين' : 'Workout Plan'}</CardTitle>
            </div>
            <CardDescription>
              {workoutPlan 
                ? (language === 'ar' ? 'جدول التمارين الأسبوعي' : 'Your weekly workout schedule')
                : (language === 'ar' ? 'لم يتم إنشاء خطة بعد' : 'No plan generated yet')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workoutPlan ? (
              <div className="space-y-4">
                {workoutPlan.title && (
                  <div>
                    <h3 className="font-semibold text-lg">{workoutPlan.title}</h3>
                    {workoutPlan.description && (
                      <p className="text-sm text-muted-foreground mt-1">{workoutPlan.description}</p>
                    )}
                  </div>
                )}
                
                {workoutGoals?.workouts && Array.isArray(workoutGoals.workouts) && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {language === 'ar' ? 'التمارين الأسبوعية' : 'Weekly Workouts'}
                    </h4>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2 pr-4">
                        {workoutGoals.workouts.map((workout: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-50 rounded-lg border">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-medium">{workout.day || `${language === 'ar' ? 'يوم' : 'Day'} ${idx + 1}`}</p>
                                {workout.type && <p className="text-xs text-muted-foreground">{workout.type}</p>}
                              </div>
                              {workout.duration && (
                                <Badge variant="secondary">{workout.duration}</Badge>
                              )}
                            </div>
                            {workout.exercises && Array.isArray(workout.exercises) && (
                              <ul className="text-sm space-y-0.5">
                                {workout.exercises.slice(0, 3).map((exercise: string, i: number) => (
                                  <li key={i} className="text-muted-foreground">• {exercise}</li>
                                ))}
                                {workout.exercises.length > 3 && (
                                  <li className="text-xs text-muted-foreground italic">
                                    +{workout.exercises.length - 3} {language === 'ar' ? 'تمارين أخرى' : 'more exercises'}
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {workoutGoals?.workoutTips && Array.isArray(workoutGoals.workoutTips) && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      {language === 'ar' ? 'نصائح التمرين' : 'Workout Tips'}
                    </h4>
                    <ul className="text-sm space-y-1">
                      {workoutGoals.workoutTips.map((tip: string, idx: number) => (
                        <li key={idx} className="text-muted-foreground">• {tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Dumbbell className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>{language === 'ar' ? 'انقر على "مسودة الخطة" أعلاه لإنشاء خطة التمارين' : 'Click "Draft plan" above to generate your workout plan'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chat Tabs */}
      <Tabs defaultValue="ai-agent" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai-agent">
            {t("aiAgentChat") || "AI Agent"}
          </TabsTrigger>
          <TabsTrigger value="messages">
            {t("featureAiChatTitle")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai-agent" className="mt-4">
          <div className="h-[600px]">
            <AiAgentChat />
          </div>
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <div className="rounded-lg border bg-white">
            <CardHeader>
              <CardTitle>{t("featureAiChatTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Messages />
            </CardContent>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
