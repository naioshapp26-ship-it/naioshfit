import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Video, FileText, ClipboardList, FileCheck, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { getYouTubeEmbedUrl } from "@/lib/youtube-utils";
import { useGuestRestriction } from "@/hooks/use-guest-restriction";
import type { Lesson, Course } from "@shared/schema";

export default function LessonViewPage() {
  const [, params] = useRoute("/courses/:courseId/lessons/:lessonId");
  const courseId = params?.courseId ? parseInt(params.courseId) : null;
  const lessonId = params?.lessonId ? parseInt(params.lessonId) : null;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isGuest, blockAction } = useGuestRestriction();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">يستطيع الزائر مشاهدة قائمة الدروس فقط. للوصول للمحتوى، يرجى إنشاء حساب.</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => navigate(`/courses/${courseId}`)}>
                {language === "ar" ? "العودة إلى الدورة" : (t("backToCourse") || "Back to Course")}
              </Button>
              <Button variant="outline" onClick={blockAction}>
                إنشاء حساب
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch course details
  const { data: course } = useQuery({
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

  // Fetch lesson details
  const { data: lesson, isLoading } = useQuery({
    queryKey: [`/api/lessons/${lessonId}`],
    queryFn: async () => {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch lesson");
      return response.json() as Promise<Lesson>;
    },
    enabled: !!lessonId
  });

  // Check enrollment status
  const { data: enrollmentData, isLoading: enrollmentLoading } = useQuery({
    queryKey: [`/api/courses/${courseId}/enrollment-status`],
    queryFn: async () => {
      if (!user || !courseId) {
        return { isEnrolled: false };
      }
      const response = await fetch(`/api/courses/${courseId}/enrollment-status`, {
        credentials: 'include'
      });
      if (!response.ok) {
        return { isEnrolled: false };
      }
      const data = await response.json();
      return data;
    },
    enabled: !!user && !!courseId,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Fetch lesson progress
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: [`/api/lessons/${lessonId}/progress`],
    queryFn: async () => {
      if (!user || !lessonId) {
        return { completed: false };
      }
      const response = await fetch(`/api/lessons/${lessonId}/progress`, {
        credentials: 'include'
      });
      if (!response.ok) {
        return { completed: false };
      }
      return response.json();
    },
    enabled: !!user && !!lessonId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Mark lesson as complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/lessons/${lessonId}/complete`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to mark lesson as complete');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/lessons/${lessonId}/progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/enrollment-status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/lessons-progress`] });
      
      const successMsg = language === "ar" 
        ? "تم تحديد الدرس كمكتمل!" 
        : (t("lessonMarkedComplete") || "Lesson marked as complete!");
      
      toast({ title: successMsg });
      
      if (data.courseCompleted) {
        const completedMsg = language === "ar"
          ? "تهانينا! لقد أكملت الدورة بنجاح!"
          : (t("courseCompletedCongrats") || "Congratulations! You've completed the course!");
        toast({ title: completedMsg });
      }
    },
    onError: (error: Error) => {
      const errorMsg = language === "ar"
        ? "فشل تحديد الدرس كمكتمل"
        : (t("markCompleteFailed") || "Failed to mark lesson as complete");
      
      toast({
        title: errorMsg,
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="h-5 w-5" />;
      case "article": return <FileText className="h-5 w-5" />;
      case "quiz": return <ClipboardList className="h-5 w-5" />;
      case "assignment": return <FileCheck className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  // Show loading while checking lesson data or enrollment status
  if (isLoading || (user && enrollmentLoading) || (user && progressLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lesson || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t("lessonNotFound") || "Lesson not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has access (is enrolled or lesson is preview)
  const isEnrolled = enrollmentData?.isEnrolled || false;
  const hasAccess = lesson.isPreview || isEnrolled;

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              {language === "ar" 
                ? "يجب التسجيل في هذه الدورة للوصول إلى هذا الدرس"
                : (t("enrollToAccess") || "You need to enroll in this course to access this lesson")
              }
            </p>
            <Button onClick={() => navigate(`/courses/${courseId}`)}>
              {language === "ar" ? "العودة إلى الدورة" : (t("backToCourse") || "Back to Course")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/courses/${courseId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold truncate">
                {course.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getLessonIcon(lesson.type)}
                <span>
                  {language === "ar" && lesson.titleAr ? lesson.titleAr : lesson.title}
                </span>
              </div>
            </div>
            {lesson.isPreview && (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                {t("preview") || "Preview"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 lg:p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              {getLessonIcon(lesson.type)}
              <CardTitle className="text-2xl">
                {language === "ar" && lesson.titleAr ? lesson.titleAr : lesson.title}
              </CardTitle>
            </div>
            {lesson.description && (
              <p className="text-muted-foreground">
                {language === "ar" && lesson.descriptionAr ? lesson.descriptionAr : lesson.description}
              </p>
            )}
            {lesson.duration && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Clock className="h-4 w-4" />
                <span>{lesson.duration} {t("minutes") || "minutes"}</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Video Content */}
            {lesson.type === "video" && lesson.videoUrl && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  src={getYouTubeEmbedUrl(lesson.videoUrl)}
                  className="w-full h-full"
                  allowFullScreen
                  title={lesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}

            {/* Article/Quiz/Assignment Content */}
            {lesson.content && (
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap">
                  {language === "ar" && lesson.contentAr ? lesson.contentAr : lesson.content}
                </div>
              </div>
            )}

            {/* Completion Button (only for enrolled users) */}
            {isEnrolled && !lesson.isPreview && (
              <div className="flex justify-center pt-4">
                <Button 
                  size="lg"
                  onClick={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending || progressData?.completed}
                  variant={progressData?.completed ? "outline" : "default"}
                >
                  <CheckCircle className={`h-5 w-5 mr-2 ${progressData?.completed ? "fill-current" : ""}`} />
                  {progressData?.completed 
                    ? (language === "ar" ? "مكتمل" : (t("completed") || "Completed"))
                    : (language === "ar" ? "تحديد كمكتمل" : (t("markAsComplete") || "Mark as Complete"))
                  }
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
