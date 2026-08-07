import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { insertContentLibrarySchema, type ContentLibrary, type ContentCategory } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/context/LanguageContext";
import { MediaUpload } from "@/components/ui/media-upload";
import { Plus } from "lucide-react";

// Create form schema function that takes translation function
const createFormSchema = (t: (key: string) => string) => insertContentLibrarySchema.omit({ coachId: true }).extend({
  tags: z.string().optional().transform(val => val ? val.split(',').map(tag => tag.trim()) : []),
  url: z.string().url({ message: t("invalidUrl") })
});

type FormData = z.infer<ReturnType<typeof createFormSchema>>;

function RequiredMark() {
  return <span className="text-red-500">*</span>;
}

interface ContentLibraryFormProps {
  content?: ContentLibrary | null;
  onSuccess: () => void;
}

// Helper function to extract YouTube video ID from URL
const extractYouTubeVideoId = (url: string): string | null => {
  const regexes = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const regex of regexes) {
    const match = url.match(regex);
    if (match) return match[1];
  }
  return null;
};

// Helper function to get YouTube thumbnail URL
const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

// Helper function to convert YouTube URL to embed format
const convertToEmbedUrl = (url: string): string => {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://youtube.com/embed/${videoId}` : url;
};

const isYouTubeUrl = (url: string): boolean => {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
};

export function ContentLibraryForm({ content, onSuccess }: ContentLibraryFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const isEditing = !!content;
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");

  // Fetch categories from the API
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ContentCategory[]>({
    queryKey: ['/api/content-categories'],
    queryFn: async () => {
      const response = await fetch('/api/content-categories', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(createFormSchema(t)),
    defaultValues: {
      title: content?.title || "",
      type: content?.type || "video",
      url: content?.url || "",
      description: content?.description || "",
      category: content?.category || "",
      tags: content?.tags ? (Array.isArray(content.tags) ? content.tags : [content.tags]) : [],
      duration: content?.duration || undefined,
      thumbnailUrl: content?.thumbnailUrl || ""
    }
  });

  // Watch for URL changes to auto-populate thumbnail
  const watchedUrl = form.watch("url");
  const watchedType = form.watch("type");
  
  useEffect(() => {
    if (watchedType === "video" && watchedUrl && !isEditing && isYouTubeUrl(watchedUrl)) {
      const videoId = extractYouTubeVideoId(watchedUrl);
      if (videoId) {
        // Auto-populate thumbnail URL if not already set
        const currentThumbnail = form.getValues("thumbnailUrl");
        if (!currentThumbnail) {
          form.setValue("thumbnailUrl", getYouTubeThumbnail(videoId));
        }
        // Convert URL to embed format
        const embedUrl = convertToEmbedUrl(watchedUrl);
        if (embedUrl !== watchedUrl) {
          form.setValue("url", embedUrl);
        }
      }
    }
  }, [watchedUrl, watchedType, form, isEditing]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing && content?.id ? `/api/content-library/${content.id}` : '/api/content-library';
      const method = isEditing ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-library'] });
      toast({
        title: isEditing ? t("contentUpdatedSuccess") : t("contentCreatedSuccess")
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: t("error"),
        description: isEditing ? t("failedToUpdateContent") : t("failedToCreateContent"),
        variant: "destructive"
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch('/api/content-categories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (newCategory) => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-categories'] });
      toast({
        title: t("categoryCreatedSuccess") || "Category created successfully"
      });
      setShowCategoryDialog(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
      // Auto-select the newly created category
      form.setValue("category", newCategory.slug);
    },
    onError: () => {
      toast({
        title: t("error"),
        description: t("failedToCreateCategory") || "Failed to create category",
        variant: "destructive"
      });
    }
  });

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      toast({
        title: t("error"),
        description: t("categoryNameRequired") || "Category name is required",
        variant: "destructive"
      });
      return;
    }
    
    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      description: newCategoryDescription.trim() || undefined
    });
  };

  const onSubmit = (data: FormData) => {
    const payload: FormData = {
      ...data,
      thumbnailUrl: data.thumbnailUrl || (data.type === "image" ? data.url : ""),
    };
    createMutation.mutate(payload);
  };

  const onInvalid = () => {
    toast({
      title: t("error"),
      description: t("fillAllRequiredFields"),
      variant: "destructive",
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? t("editContent") : t("addNewContent")}</CardTitle>
        <CardDescription>
          {isEditing
            ? (t("updateContentMediaDetails") || "Update content details and media")
            : (t("addContentMediaDetails") || "Add image or video content with upload or URL")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("title")} <RequiredMark /></Label>
              <Input
                id="title"
                {...form.register("title")}
                placeholder={t("enterContentTitle")}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t("type")} <RequiredMark /></Label>
              <Select value={form.watch("type")} onValueChange={(value) => form.setValue("type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectContentType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">{t("video")}</SelectItem>
                  <SelectItem value="image">{t("image")}</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.type && (
                <p className="text-sm text-red-500">{form.formState.errors.type.message}</p>
              )}
            </div>
          </div>

          <MediaUpload
            label={`${t("contentMedia") || "Media (Image/Video)"} *`}
            value={watchedUrl || ""}
            onChange={(url) => form.setValue("url", url, { shouldValidate: true })}
            accept={watchedType === "video" ? "video/*" : "image/*"}
            mediaType={watchedType === "video" ? "video" : "image"}
            placeholder={watchedType === "video" ? "https://youtube.com/watch?v=..." : "https://example.com/image.jpg"}
          />
          <p className="text-xs text-gray-500">
            {watchedType === "video"
              ? (t("contentMediaVideoHint") || "Upload a video file or paste a valid video URL")
              : (t("contentMediaImageHint") || "Upload an image file or paste a valid image URL")}
          </p>
          {form.formState.errors.url && (
            <p className="text-sm text-red-500">{form.formState.errors.url.message}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder={t("describeTheContent")}
              rows={3}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">{t("category")} <RequiredMark /></Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryDialog(true)}
                className="h-auto py-1 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                {t("addCategory") || "Add Category"}
              </Button>
            </div>
            <Select 
              value={form.watch("category")} 
              onValueChange={(value) => form.setValue("category", value)}
              disabled={categoriesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectCategory")} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.slug}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category && (
              <p className="text-sm text-red-500">{form.formState.errors.category.message}</p>
            )}
          </div>

          <MediaUpload
            label={t("thumbnailUrlOptional") || "Thumbnail URL (Optional)"}
            value={form.watch("thumbnailUrl") || ""}
            onChange={(url) => form.setValue("thumbnailUrl", url)}
            accept="image/*"
            placeholder={t("contentThumbnailPlaceholder") || "Optional preview image URL"}
            mediaType="image"
          />
          <p className="text-xs text-gray-500">
            {watchedType === "video" && isYouTubeUrl(watchedUrl || "")
              ? (t("thumbnailAutoGenerated") || "YouTube thumbnails can be auto-generated")
              : (t("contentThumbnailHint") || "Optional: helps display a clean preview card")}
          </p>

          <div className="space-y-2">
            <Label htmlFor="tags">{t("tagsCommaSeparated")}</Label>
            <Input
              id="tags"
              {...form.register("tags")}
              placeholder={t("beginnerUpperBodyChest")}
            />
            {form.formState.errors.tags && (
              <p className="text-sm text-red-500">{form.formState.errors.tags.message}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending 
                ? (isEditing ? t("updating") : t("creating")) 
                : (isEditing ? t("updateContent") : t("createContent"))
              }
            </Button>
            <Button type="button" variant="outline" onClick={onSuccess}>
              {t("cancel")}
            </Button>
          </div>
        </form>

        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addNewCategory") || "Add New Category"}</DialogTitle>
              <DialogDescription>
                {t("createCategoryDescription") || "Create a new category for organizing your content"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="categoryName">{t("categoryName") || "Category Name"}</Label>
                <Input
                  id="categoryName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("enterCategoryName") || "Enter category name"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryDescription">{t("categoryDescription") || "Description (Optional)"}</Label>
                <Textarea
                  id="categoryDescription"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder={t("enterCategoryDescription") || "Enter category description"}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCategoryDialog(false);
                  setNewCategoryName("");
                  setNewCategoryDescription("");
                }}
                disabled={createCategoryMutation.isPending}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
              >
                {createCategoryMutation.isPending ? t("creating") : (t("create") || "Create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}