import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, BookOpen, Star, Users, Clock, Play, CheckCircle, Lock, FileText, Video, ClipboardList, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import EmbeddedCheckout from "@/components/payments/EmbeddedCheckout";
import PublicHeader from "@/components/layout/PublicHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/LanguageContext";
import { useGuestRestriction } from "@/hooks/use-guest-restriction";
import type { Course, Lesson } from "@shared/schema";

export default function CourseDetailPage() {
  const [, params] = useRoute("/courses/:id");
  const courseId = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isGuest, blockAction } = useGuestRestriction();
  const { t, language } = useLanguage();
  const showPublicHeader = !user;
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<any>(null);
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentPublishableKey, setPaymentPublishableKey] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const isTenantSubdomain = useState(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    return parts.length > 2 && parts[0] !== "www";
  })[0];

  const buildTenantDownloadUrl = (url: string) => {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}download=1`;
  };

  const resetPaymentState = () => {
    setPaymentSessionId(null);
    setPaymentClientSecret(null);
    setPaymentPublishableKey(null);
    setPaymentLoading(false);
    setIsPaymentOpen(false);
  };

  const fetchPublishableKey = async () => {
    const response = await fetch("/api/stripe/publishable-key", { credentials: "include" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || "Failed to load payment configuration");
    }
    return payload.publishableKey as string;
  };

  const createCoursePaymentSession = async (courseId: number) => {
    const response = await fetch(`/api/courses/${courseId}/payment-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ returnUrl: window.location.href })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || "Failed to start payment");
    }
    return payload as { sessionId: string; clientSecret: string | null; checkoutUrl?: string | null };
  };

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: [`/api/courses/${courseId}`],
    queryFn: async () => {
      const response = await fetch(`/api/courses/${courseId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch course");
      return response.json() as Promise<Course>;
    },
    enabled: !!courseId
  });

  // Fetch lessons
  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: [`/api/courses/${courseId}/lessons`],
    queryFn: async () => {
      const response = await fetch(`/api/courses/${courseId}/lessons`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch lessons");
      return response.json();
    },
    enabled: !!courseId
  });

  // Fetch lesson progress for all lessons (for enrolled users)
  const { data: lessonsProgress = [] } = useQuery({
    queryKey: [`/api/courses/${courseId}/lessons-progress`],
    queryFn: async () => {
      if (!user || !courseId) return [];
      
      const lessonIds = lessons.map((l: Lesson) => l.id);
      if (lessonIds.length === 0) return [];
      
      // Fetch progress for each lesson
      const progressPromises = lessonIds.map(async (lessonId: number) => {
        try {
          const response = await fetch(`/api/lessons/${lessonId}/progress`, {
            credentials: 'include'
          });
          if (!response.ok) return { lessonId, completed: false };
          const data = await response.json();
          return { lessonId, ...data };
        } catch {
          return { lessonId, completed: false };
        }
      });
      
      return Promise.all(progressPromises);
    },
    enabled: !!user && !!courseId && lessons.length > 0 && !isGuest,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Create a map for quick lesson progress lookup
  const progressMap = new Map(
    lessonsProgress.map((p: any) => [p.lessonId, p.completed])
  );

  // Check enrollment status
  useQuery({
    queryKey: [`/api/courses/${courseId}/enrollment-status`],
    queryFn: async () => {
      if (!user || !courseId) {
        return false;
      }
      const response = await fetch(`/api/courses/${courseId}/enrollment-status`, {
        credentials: 'include'
      });
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      setIsEnrolled(data.isEnrolled);
      setEnrollmentData(data);
      return data.isEnrolled;
    },
    enabled: !!user && !!courseId && !isGuest,
    staleTime: 0, // Always refetch
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId?: string | null }) => {
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: sessionId ? JSON.stringify({ sessionId }) : undefined
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to enroll");
      }
      const data = await response.json();
      return data;
    },
    onSuccess: () => {
      setIsEnrolled(true);
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/enrollment-status`] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/enrollments'] });
      toast({ title: t("enrolledSuccess") || "Successfully enrolled in course!" });
      resetPaymentState();
    },
    onError: (error: Error) => {
      toast({ 
        title: t("enrollmentFailed") || "Enrollment failed", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Cancel enrollment mutation
  const cancelEnrollmentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/courses/${courseId}/unenroll`, {
        method: "POST",
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel enrollment");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsEnrolled(false);
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/enrollment-status`] });
      toast({ title: t("enrollmentCanceled") });
    },
    onError: (error: Error) => {
      toast({
        title: t("cancelEnrollmentFailed"), 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleEnrollClick = async () => {
    if (isGuest) {
      blockAction();
      return;
    }

    if (!course) {
      return;
    }

    if (isEnrolled) {
      cancelEnrollmentMutation.mutate();
      return;
    }

    if (course.isFree || !course.price || course.price <= 0) {
      enrollMutation.mutate({});
      return;
    }

    try {
      setPaymentLoading(true);
      const session = await createCoursePaymentSession(course.id);
      const publishableKey = await fetchPublishableKey();
      setPaymentSessionId(session.sessionId);
      setPaymentClientSecret(session.clientSecret || null);
      setPaymentPublishableKey(publishableKey);
      setIsPaymentOpen(true);
    } catch (error) {
      toast({
        title: t("enrollmentFailed") || "Enrollment failed",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-5 w-5" />;
      case "article": return <FileText className="h-5 w-5" />;
      case "quiz": return <ClipboardList className="h-5 w-5" />;
      case "assignment": return <FileCheck className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      fitness: "bg-blue-600",
      nutrition: "bg-green-600",
      wellness: "bg-purple-600",
      business: "bg-orange-600"
    };
    return colors[category] || "bg-gray-600";
  };

  const getLevelBadgeColor = (level: string) => {
    const colors: Record<string, string> = {
      beginner: "bg-green-600",
      intermediate: "bg-yellow-600",
      advanced: "bg-red-600"
    };
    return colors[level] || "bg-gray-600";
  };

  if (!courseId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            Invalid course ID
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = courseLoading || lessonsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="h-8 w-32 bg-muted rounded animate-pulse" />
          <div className="aspect-video bg-muted rounded-lg animate-pulse" />
          <div className="h-8 bg-muted rounded w-2/3 animate-pulse" />
          <div className="h-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t("courseNotFound") || "Course not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const publishedLessons = lessons.filter((l: Lesson) => l.status === "published");
  const previewLessons = publishedLessons.filter((l: Lesson) => l.isPreview);

  return (
    <div className="min-h-screen bg-slate-50">
      {showPublicHeader && (
        <div className="max-w-6xl mx-auto px-4 pt-8">
          <PublicHeader
            title={language === "ar" && course.titleAr ? course.titleAr : course.title}
            subtitle={language === "ar" && course.descriptionAr ? course.descriptionAr : course.description}
            backHref="/courses"
            backLabel={t("backToCourses")}
          />
        </div>
      )}
      {/* Header with background */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
        <div className="relative z-10 max-w-6xl mx-auto p-4 lg:p-8">
          {!showPublicHeader && (
            <Button 
              variant="ghost" 
              className="text-white hover:bg-black/30 mb-4"
              onClick={() => navigate("/courses")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("backToCourses") || "Back to Courses"}
            </Button>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className={`${getCategoryBadgeColor(course.category)} text-white`}>
                  {t(course.category as any) || course.category}
                </Badge>
                <Badge className={`${getLevelBadgeColor(course.level)} text-white`}>
                  {t(course.level as any) || course.level}
                </Badge>
                {course.featured && (
                  <Badge className="bg-yellow-500 text-white">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    {t("courseFeatured")}
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold mb-4">
                {language === "ar" && course.titleAr ? course.titleAr : course.title}
              </h1>
              
              <p className="text-lg text-white/90 mb-6">
                {language === "ar" && course.descriptionAr ? course.descriptionAr : course.description}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                {course.instructor && (
                  <div>
                    {t("by")} <span className="font-semibold">{course.instructor.firstName} {course.instructor.lastName}</span>
                  </div>
                )}
                {course.averageRating && course.averageRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{course.averageRating.toFixed(1)}</span>
                    <span className="text-white/70">({course.ratingCount || 0} {t("ratings") || "ratings"})</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{course.enrollmentCount || 0} {t("students") || "students"}</span>
                </div>
                {course.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{course.duration} {t("hours") || "hours"}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-white">
                <CardContent className="p-6">
                  {course.thumbnailUrl && (
                    <img 
                      src={course.thumbnailUrl} 
                      alt={course.title}
                      className="w-full rounded-lg mb-4"
                    />
                  )}
                  
                  <div className="text-center mb-4">
                    {course.isFree ? (
                      <div className="text-2xl font-bold text-green-600">
                        {t("courseFree")}
                      </div>
                    ) : course.price && course.price > 0 ? (
                      <div className="text-3xl font-bold text-gray-900">
                        {course.currency === "USD" ? "$" : course.currency} {course.price}
                      </div>
                    ) : null}
                  </div>

                  <Button 
                    className="w-full mb-3"
                    size="lg"
                    variant={isEnrolled ? "destructive" : "default"}
                    onClick={handleEnrollClick}
                    disabled={enrollMutation.isPending || cancelEnrollmentMutation.isPending || paymentLoading}
                  >
                    {enrollMutation.isPending || cancelEnrollmentMutation.isPending
                      ? (isEnrolled ? t("canceling") : t("enrolling"))
                      : (isEnrolled ? t("cancelEnrollment") : t("enrollNow"))
                    }
                  </Button>

                  {/* Certificate Section */}
                  {enrollmentData?.certificateIssued && enrollmentData?.certificateUrl && (
                    <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 mb-3">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                          <h3 className="font-bold text-lg text-green-900 mb-1">
                            {t("certificateEarned")}
                          </h3>
                          <p className="text-sm text-green-700 mb-3">
                            {t("congratulationsCertificate")}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 bg-red-800 text-white hover:bg-red-900"
                              onClick={() => window.open(enrollmentData.certificateUrl, '_blank')}
                            >
                              <FileCheck className="h-4 w-4 mr-2" />
                              {t("viewCertificate")}
                            </Button>
                            <Button
                              className="flex-1 bg-red-800 text-white hover:bg-red-900"
                              onClick={() => {
                                if (!enrollmentData.certificateUrl) return;
                                if (isTenantSubdomain) {
                                  window.open(buildTenantDownloadUrl(enrollmentData.certificateUrl), '_blank');
                                  return;
                                }
                                const link = document.createElement('a');
                                link.href = enrollmentData.certificateUrl;
                                link.download = `certificate-${course?.title || 'course'}.pdf`;
                                link.click();
                              }}
                            >
                              {t("downloadCertificate")}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {course.certificateEnabled && !enrollmentData?.certificateIssued && (
                    <div className="text-center text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 inline mr-1" />
                      {t("certificateIncluded") || "Certificate included"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* What you'll learn */}
            {course.content && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("whatYouWillLearn") || "What you'll learn"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">
                    {language === "ar" && course.contentAr ? course.contentAr : course.content}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Course Content/Curriculum */}
            <Card>
              <CardHeader>
                <CardTitle>{t("courseContent") || "Course Content"}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {publishedLessons.length} {t("courseLessons") || "lessons"}
                </p>
              </CardHeader>
              <CardContent>
                {publishedLessons.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    {t("noLessonsYet") || "No lessons available yet"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {publishedLessons.map((lesson: Lesson, index: number) => {
                      const isAccessible = !isGuest && (lesson.isPreview || isEnrolled);
                      const isCompleted = progressMap.get(lesson.id) || false;
                      console.log('[LESSON-ITEM]', {
                        lessonId: lesson.id,
                        title: lesson.title,
                        isPreview: lesson.isPreview,
                        isEnrolled,
                        isAccessible,
                        isCompleted
                      });
                      return (
                        <div
                          key={lesson.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            isCompleted
                              ? "bg-green-50 border-green-300 hover:bg-green-100 cursor-pointer transition-colors"
                              : isAccessible
                              ? "bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer transition-colors" 
                              : "bg-gray-50 border-gray-200"
                          } ${lesson.isPreview && !isCompleted ? "bg-green-50 border-green-200 hover:bg-green-100" : ""}`}
                          onClick={() => {
                            console.log('[LESSON-CLICK]', {
                              lessonId: lesson.id,
                              isAccessible,
                              navigating: isAccessible ? 'YES' : 'NO'
                            });
                            if (isGuest) {
                              blockAction();
                              return;
                            }

                            if (isAccessible) {
                              navigate(`/courses/${courseId}/lessons/${lesson.id}`);
                            }
                          }}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                            isCompleted 
                              ? "bg-green-600 text-white" 
                              : "bg-primary text-primary-foreground"
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getLessonIcon(lesson.type)}
                              <h4 className={`font-medium truncate ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                                {language === "ar" && lesson.titleAr ? lesson.titleAr : lesson.title}
                              </h4>
                              {isCompleted && (
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 ml-auto">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {t("completed") || "Completed"}
                                </Badge>
                              )}
                            </div>
                            {lesson.duration && (
                              <p className="text-xs text-muted-foreground">
                                {lesson.duration} {t("minutes") || "min"}
                              </p>
                            )}
                          </div>

                          {!isCompleted && (
                            <>
                              {lesson.isPreview ? (
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                  <Play className="h-3 w-3 mr-1" />
                                  {t("preview") || "Preview"}
                                </Badge>
                              ) : isEnrolled ? (
                                <Play className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Lock className="h-5 w-5 text-muted-foreground" />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Instructor Info */}
          <div className="lg:col-span-1">
            {course.instructor && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("instructor") || "Instructor"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    {course.instructor.profilePicture ? (
                      <img 
                        src={course.instructor.profilePicture} 
                        alt={`${course.instructor.firstName} ${course.instructor.lastName}`}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">
                        {course.instructor.firstName?.[0]}{course.instructor.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold">
                        {course.instructor.firstName} {course.instructor.lastName}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        @{course.instructor.username}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Dialog open={isPaymentOpen} onOpenChange={(open) => (open ? setIsPaymentOpen(true) : resetPaymentState())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("payWithStripe") || "Pay with Stripe"}</DialogTitle>
            <DialogDescription>
              {course
                ? `${course.title} • ${course.price?.toFixed(2)} ${course.currency || "USD"}`
                : t("processingPayment") || "Processing payment"}
            </DialogDescription>
          </DialogHeader>
          {paymentClientSecret && paymentPublishableKey ? (
            <EmbeddedCheckout
              clientSecret={paymentClientSecret}
              publishableKey={paymentPublishableKey}
              onComplete={async () => {
                if (!course || !paymentSessionId) {
                  return;
                }
                try {
                  await enrollMutation.mutateAsync({ sessionId: paymentSessionId });
                } catch (error) {
                  // Errors are handled by mutation
                }
              }}
            />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("processingPayment") || "Processing payment"}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
