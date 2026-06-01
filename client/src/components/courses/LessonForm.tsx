import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MediaUpload } from "@/components/ui/media-upload";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import type { Lesson } from "@shared/schema";

interface LessonFormProps {
  courseId: number;
  lesson?: Lesson | null;
  onSuccess: () => void;
}

interface LessonFormData {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  content?: string;
  contentAr?: string;
  type: string;
  duration?: number;
  videoUrl?: string;
  isPreview: boolean;
  status: string;
  orderIndex: number;
}

export function LessonForm({ courseId, lesson, onSuccess }: LessonFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<LessonFormData>({
    defaultValues: lesson ? {
      title: lesson.title,
      titleAr: lesson.titleAr || "",
      description: lesson.description || "",
      descriptionAr: lesson.descriptionAr || "",
      content: lesson.content || "",
      contentAr: lesson.contentAr || "",
      type: lesson.type,
      duration: lesson.duration || undefined,
      videoUrl: lesson.videoUrl || "",
      isPreview: lesson.isPreview || false,
      status: lesson.status,
      orderIndex: lesson.orderIndex || 0,
    } : {
      title: "",
      titleAr: "",
      description: "",
      descriptionAr: "",
      content: "",
      contentAr: "",
      type: "article",
      duration: undefined,
      videoUrl: "",
      isPreview: false,
      status: "draft",
      orderIndex: 0,
    }
  });

  const lessonType = watch("type");
  const isPreview = watch("isPreview");

  const saveMutation = useMutation({
    mutationFn: async (data: LessonFormData) => {
      const url = lesson 
        ? `/api/lessons/${lesson.id}`
        : `/api/courses/${courseId}/lessons`;
      
      const response = await fetch(url, {
        method: lesson ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save lesson");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/lessons`] });
      toast({ 
        title: lesson 
          ? t("lessonUpdatedSuccess") || "Lesson updated successfully"
          : t("lessonCreatedSuccess") || "Lesson created successfully"
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ 
        title: lesson 
          ? t("failedToUpdateLesson") || "Failed to update lesson"
          : t("failedToCreateLesson") || "Failed to create lesson",
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const onSubmit = (data: LessonFormData) => {
    if (data.type === "video" && !data.videoUrl?.trim()) {
      toast({
        title: t("error"),
        description: t("videoUrlIsRequired") || "Video URL is required",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Lesson Type */}
      <div className="space-y-2">
        <Label htmlFor="type">{t("lessonType") || "Lesson Type"}</Label>
        <Select 
          value={watch("type")} 
          onValueChange={(value) => setValue("type", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">{t("lessonTypeVideo") || "Video"}</SelectItem>
            <SelectItem value="article">{t("lessonTypeArticle") || "Article"}</SelectItem>
            <SelectItem value="quiz">{t("lessonTypeQuiz") || "Quiz"}</SelectItem>
            <SelectItem value="assignment">{t("lessonTypeAssignment") || "Assignment"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Title (English) */}
      <div className="space-y-2">
        <Label htmlFor="title">{t("lessonTitle") || "Lesson Title"} (English) *</Label>
        <Input
          id="title"
          {...register("title", { required: "Title is required" })}
          placeholder={t("enterLessonTitle") || "Enter lesson title"}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Title (Arabic) */}
      <div className="space-y-2">
        <Label htmlFor="titleAr">{t("lessonTitle") || "Lesson Title"} (العربية)</Label>
        <Input
          id="titleAr"
          {...register("titleAr")}
          placeholder={t("enterLessonTitleAr") || "أدخل عنوان الدرس"}
          dir="rtl"
        />
      </div>

      {/* Description (English) */}
      <div className="space-y-2">
        <Label htmlFor="description">{t("lessonDescription") || "Description"} (English)</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder={t("enterLessonDescription") || "Brief description of the lesson"}
          rows={3}
        />
      </div>

      {/* Description (Arabic) */}
      <div className="space-y-2">
        <Label htmlFor="descriptionAr">{t("lessonDescription") || "Description"} (العربية)</Label>
        <Textarea
          id="descriptionAr"
          {...register("descriptionAr")}
          placeholder={t("enterLessonDescriptionAr") || "وصف مختصر للدرس"}
          dir="rtl"
          rows={3}
        />
      </div>

      {/* Video URL (only for video type) */}
      {lessonType === "video" && (
        <div className="space-y-2">
          <MediaUpload
            label={t("videoUrl") || "Video URL"}
            value={watch("videoUrl") || ""}
            onChange={(url) => setValue("videoUrl", url, { shouldDirty: true, shouldValidate: true })}
            accept="video/*"
            mediaType="video"
            placeholder="https://..."
          />
          <input type="hidden" {...register("videoUrl")} />
          <p className="text-xs text-muted-foreground">
            {t("contentMediaVideoHint") || "Upload a video file or paste a valid video URL"}
          </p>
        </div>
      )}

      {/* Content (English) - for article type */}
      {(lessonType === "article" || lessonType === "assignment") && (
        <div className="space-y-2">
          <Label htmlFor="content">{t("lessonContent") || "Content"} (English)</Label>
          <Textarea
            id="content"
            {...register("content")}
            placeholder={t("enterLessonContent") || "Enter the lesson content"}
            rows={8}
          />
        </div>
      )}

      {/* Content (Arabic) - for article type */}
      {(lessonType === "article" || lessonType === "assignment") && (
        <div className="space-y-2">
          <Label htmlFor="contentAr">{t("lessonContent") || "Content"} (العربية)</Label>
          <Textarea
            id="contentAr"
            {...register("contentAr")}
            placeholder={t("enterLessonContentAr") || "أدخل محتوى الدرس"}
            dir="rtl"
            rows={8}
          />
        </div>
      )}

      {/* Duration */}
      <div className="space-y-2">
        <Label htmlFor="duration">{t("lessonDuration") || "Duration (minutes)"}</Label>
        <Input
          id="duration"
          type="number"
          {...register("duration", { valueAsNumber: true })}
          placeholder="30"
          min="0"
        />
      </div>

      {/* Order Index */}
      <div className="space-y-2">
        <Label htmlFor="orderIndex">{t("lessonOrder") || "Order"}</Label>
        <Input
          id="orderIndex"
          type="number"
          {...register("orderIndex", { valueAsNumber: true })}
          placeholder="0"
          min="0"
        />
        <p className="text-xs text-muted-foreground">
          {t("lessonOrderHint") || "Lower numbers appear first"}
        </p>
      </div>

      {/* Is Preview */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="isPreview">{t("previewLesson") || "Preview Lesson"}</Label>
          <p className="text-sm text-muted-foreground">
            {t("previewLessonHint") || "Allow viewing without enrollment"}
          </p>
        </div>
        <Switch
          id="isPreview"
          checked={isPreview}
          onCheckedChange={(checked) => setValue("isPreview", checked)}
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">{t("status")}</Label>
        <Select 
          value={watch("status")} 
          onValueChange={(value) => setValue("status", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">{t("courseDraft") || "Draft"}</SelectItem>
            <SelectItem value="published">{t("coursePublished") || "Published"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          disabled={saveMutation.isPending}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t("saving") : (lesson ? t("updateLesson") || "Update Lesson" : t("createLesson") || "Create Lesson")}
        </Button>
      </div>
    </form>
  );
}
