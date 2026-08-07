import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Plus, ArrowLeft, Edit, Trash2, Video, FileText, ClipboardList, FileCheck, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/LanguageContext";
import { LessonForm } from "@/components/courses/LessonForm";
import type { Course, Lesson } from "@shared/schema";
import { isPlatformAdminRole } from "@shared/roleAccess";

export default function ManageLessonsPage() {
  const [, params] = useRoute("/manage-courses/:id/lessons");
  const courseId = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();

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
    enabled: !!courseId && !!user
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
    enabled: !!courseId && !!user
  });

  // Delete lesson mutation
  const deleteLesson = useMutation({
    mutationFn: async (lessonId: number) => {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to delete lesson");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/lessons`] });
      toast({ title: t("lessonDeleted") || "Lesson deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: t("failedToDeleteLesson") || "Failed to delete lesson", 
        variant: "destructive" 
      });
    }
  });

  const handleDelete = (lesson: Lesson) => {
    if (confirm(`${t("confirmDeleteLesson") || "Delete this lesson"}?\n\n"${lesson.title}"?`)) {
      deleteLesson.mutate(lesson.id);
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

  const getLessonTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      video: "bg-red-500",
      article: "bg-blue-500",
      quiz: "bg-green-500",
      assignment: "bg-purple-500"
    };
    return colors[type] || "bg-gray-500";
  };

  if (!user || (!isPlatformAdminRole(user.role) && user.role !== "coach")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t("accessDeniedCoachAdmin")}
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="space-y-6 p-4 lg:p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/manage-courses")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {t("manageLessons") || "Manage Lessons"}
            </h1>
            {course && (
              <p className="text-sm text-muted-foreground mt-1">
                {course.title}
              </p>
            )}
          </div>
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedLesson(null)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("addLesson") || "Add Lesson"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedLesson 
                  ? t("editLesson") || "Edit Lesson"
                  : t("addNewLesson") || "Add New Lesson"
                }
              </DialogTitle>
            </DialogHeader>
            {courseId && (
              <LessonForm
                courseId={courseId}
                lesson={selectedLesson}
                onSuccess={() => setShowForm(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Course Info Card */}
      {course && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("category")}</p>
                <p className="font-medium capitalize">{course.category}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("level")}</p>
                <p className="font-medium capitalize">{course.level}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("totalLessons") || "Total Lessons"}</p>
                <p className="font-medium">{lessons.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("status")}</p>
                <Badge variant={course.status === "published" ? "default" : "secondary"}>
                  {course.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lessons List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              {t("noLessons") || "No lessons yet"}
            </h3>
            <p>{t("createFirstLesson") || "Create your first lesson to get started"}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson: Lesson, index: number) => (
            <Card 
              key={lesson.id} 
              className="group hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Drag Handle */}
                  <div className="mt-2 cursor-move opacity-0 group-hover:opacity-50 transition-opacity">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Lesson Number */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold flex-shrink-0 mt-1">
                    {index + 1}
                  </div>

                  {/* Lesson Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`${getLessonTypeColor(lesson.type)} p-2 rounded-lg text-white flex-shrink-0`}>
                        {getLessonIcon(lesson.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate">
                          {lesson.title}
                        </h3>
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {lesson.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {lesson.type}
                      </Badge>
                      {lesson.duration && (
                        <Badge variant="secondary">
                          {lesson.duration} {t("minutes") || "min"}
                        </Badge>
                      )}
                      {lesson.isPreview && (
                        <Badge className="bg-green-500">
                          {t("preview") || "Preview"}
                        </Badge>
                      )}
                      <Badge variant={lesson.status === "published" ? "default" : "secondary"}>
                        {lesson.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedLesson(lesson);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      <span>{t("edit") || "Edit"}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(lesson)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                      <span>{t("delete") || "Delete"}</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
