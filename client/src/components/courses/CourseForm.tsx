import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { insertCourseSchema, type Course } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { MediaUpload } from "@/components/ui/media-upload";

const formSchema = insertCourseSchema.omit({ instructorId: true });

type FormData = z.infer<typeof formSchema>;

interface CourseFormProps {
  course?: Course | null;
  onSuccess: () => void;
}

export function CourseForm({ course, onSuccess }: CourseFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isEditing = !!course;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: course?.title || "",
      titleAr: course?.titleAr || "",
      description: course?.description || "",
      descriptionAr: course?.descriptionAr || "",
      category: course?.category || "fitness",
      level: course?.level || "beginner",
      duration: course?.duration || undefined,
      thumbnailUrl: course?.thumbnailUrl || "",
      previewVideoUrl: course?.previewVideoUrl || "",
      price: course?.price || 0,
      currency: course?.currency || "USD",
      isFree: course?.isFree || false,
      tags: course?.tags || [],
      status: course?.status || "draft",
      featured: course?.featured || false,
      certificateEnabled: course?.certificateEnabled || false,
      certificateTemplate: course?.certificateTemplate || "",
      publishedAt: course?.publishedAt || undefined,
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing && course?.id ? `/api/courses/${course.id}` : '/api/courses';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          instructorId: user?.id
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      toast({
        title: isEditing ? t("courseUpdatedSuccess") : t("courseCreatedSuccess")
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: t("error"),
        description: isEditing ? t("failedToUpdateCourse") : t("failedToCreateCourse"),
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("courseTitle")}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("courseTitle")} (EN)</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="Course Title"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="titleAr">{t("courseTitleAr")}</Label>
            <Input
              id="titleAr"
              {...form.register("titleAr")}
              placeholder="عنوان الدورة"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="description">{t("courseDescription")} (EN)</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Course description..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descriptionAr">{t("courseDescriptionAr")}</Label>
            <Textarea
              id="descriptionAr"
              {...form.register("descriptionAr")}
              placeholder="وصف الدورة..."
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Course Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("category")}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">{t("courseCategory")}</Label>
            <Select value={form.watch("category")} onValueChange={(value) => form.setValue("category", value, { shouldDirty: true, shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fitness">{t("courseFitness")}</SelectItem>
                <SelectItem value="nutrition">{t("nutrition")}</SelectItem>
                <SelectItem value="wellness">{t("courseWellness")}</SelectItem>
                <SelectItem value="business">{t("courseBusiness")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">{t("courseLevel")}</Label>
            <Select value={form.watch("level")} onValueChange={(value) => form.setValue("level", value, { shouldDirty: true, shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">{t("courseBeginnerLevel")}</SelectItem>
                <SelectItem value="intermediate">{t("courseIntermediateLevel")}</SelectItem>
                <SelectItem value="advanced">{t("courseAdvancedLevel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">{t("courseDuration")}</Label>
            <Input
              id="duration"
              type="number"
              {...form.register("duration", { valueAsNumber: true })}
              placeholder="10"
            />
          </div>
        </div>
      </div>

      {/* Media */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Media</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MediaUpload
            label={t("courseThumbnail") || "Course Thumbnail"}
            value={form.watch("thumbnailUrl") || ""}
            onChange={(url) => form.setValue("thumbnailUrl", url)}
            accept="image/*"
            placeholder="https://..."
            mediaType="image"
          />

          <MediaUpload
            label={t("coursePreviewVideo") || "Preview Video"}
            value={form.watch("previewVideoUrl") || ""}
            onChange={(url) => form.setValue("previewVideoUrl", url)}
            accept="video/*"
            placeholder="https://..."
            mediaType="video"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("coursePrice")}</h3>
        
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="isFree"
            checked={form.watch("isFree")}
            onCheckedChange={(checked) => form.setValue("isFree", checked, { shouldDirty: true, shouldValidate: true })}
          />
          <Label htmlFor="isFree">{t("courseFree")}</Label>
        </div>

        {!form.watch("isFree") && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">{t("coursePrice")}</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...form.register("price", { valueAsNumber: true })}
                placeholder="99.99"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">{t("courseCurrency")}</Label>
              <Select value={form.watch("currency")} onValueChange={(value) => form.setValue("currency", value, { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EGP">EGP</SelectItem>
                  <SelectItem value="SAR">SAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Publishing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("courseStatus")}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">{t("courseStatus")}</Label>
            <Select value={form.watch("status")} onValueChange={(value) => form.setValue("status", value, { shouldDirty: true, shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("courseDraft")}</SelectItem>
                <SelectItem value="published">{t("coursePublished")}</SelectItem>
                <SelectItem value="archived">{t("courseArchived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="featured"
                checked={form.watch("featured")}
                onCheckedChange={(checked) => form.setValue("featured", checked, { shouldDirty: true, shouldValidate: true })}
              />
              <Label htmlFor="featured">{t("courseFeatured")}</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="certificateEnabled"
                checked={form.watch("certificateEnabled")}
                onCheckedChange={(checked) => form.setValue("certificateEnabled", checked, { shouldDirty: true, shouldValidate: true })}
              />
              <Label htmlFor="certificateEnabled">{t("certificateEnabled")}</Label>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button 
          type="submit" 
          disabled={createMutation.isPending}
          className="flex-1"
        >
          {createMutation.isPending 
            ? (isEditing ? t("updating") : t("creating")) 
            : (isEditing ? t("update") : t("save"))
          }
        </Button>
        <Button type="button" variant="outline" onClick={onSuccess}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
