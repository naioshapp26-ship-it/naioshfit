import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2 } from "lucide-react";
import BlogEditor from "@/components/blog/BlogEditor";
import { MediaUpload } from "@/components/ui/media-upload";

export type BlogPost = {
  id: number;
  title: string;
  titleAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  content: string;
  contentAr?: string | null;
  status: "draft" | "published" | "archived";
  category: string;
  tags?: string[] | null;
  authorId: number;
  createdAt: string;
  publishedAt?: string | null;
  typeMetadata?: Record<string, any> | null;
};

interface BlogManagerProps {
  mode: "admin" | "coach";
}

const defaultForm = {
  title: "",
  titleAr: "",
  description: "",
  descriptionAr: "",
  content: "",
  contentAr: "",
  category: "general",
  status: "draft" as "draft" | "published" | "archived",
  tagsInput: "",
  coverMediaUrl: "",
  coverMediaType: "image" as "image" | "video",
};

export default function BlogManager({ mode }: BlogManagerProps) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      type: "blog",
      sort: "newest",
      limit: "50",
    };

    if (searchQuery) params.query = searchQuery;
    if (mode === "coach" && user?.id) params.authorId = String(user.id);
    if (mode === "admin" && statusFilter !== "all") params.status = statusFilter;

    return params;
  }, [mode, searchQuery, statusFilter, user?.id]);

  const { data, isLoading } = useQuery<{ items: BlogPost[] }>(
    {
      queryKey: ["/api/content", queryParams],
      enabled: !!user,
    }
  );

  const posts = data?.items ?? [];

  useEffect(() => {
    if (selectedPost) {
      const typeMetadata = (selectedPost.typeMetadata ?? {}) as Record<string, any>;
      const coverMediaUrl = typeof typeMetadata.coverMediaUrl === "string" ? typeMetadata.coverMediaUrl : "";
      const coverMediaType = typeMetadata.coverMediaType === "video" ? "video" : "image";

      setForm({
        title: selectedPost.title || "",
        titleAr: selectedPost.titleAr || "",
        description: selectedPost.description || "",
        descriptionAr: selectedPost.descriptionAr || "",
        content: selectedPost.content || "",
        contentAr: selectedPost.contentAr || "",
        category: selectedPost.category || "general",
        status: selectedPost.status || "draft",
        tagsInput: Array.isArray(selectedPost.tags) ? selectedPost.tags.join(", ") : "",
        coverMediaUrl,
        coverMediaType,
      });
    } else {
      setForm(defaultForm);
    }
  }, [selectedPost]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const resolvedTitle = form.title.trim() || form.titleAr.trim();
      const resolvedContent = form.content.trim() || form.contentAr.trim();

      const payload = {
        type: "blog",
        category: form.category,
        title: resolvedTitle,
        titleAr: form.titleAr || undefined,
        description: form.description || undefined,
        descriptionAr: form.descriptionAr || undefined,
        content: resolvedContent,
        contentAr: form.contentAr || undefined,
        visibility: "public",
        status: form.status,
        tags: form.tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        typeMetadata: form.coverMediaUrl
          ? {
              coverMediaUrl: form.coverMediaUrl,
              coverMediaType: form.coverMediaType,
            }
          : {},
      };

      const url = selectedPost ? `/api/content/${selectedPost.id}` : "/api/content";
      const method = selectedPost ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Request failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      setDialogOpen(false);
      setSelectedPost(null);
      toast({
        title: selectedPost ? t("blogUpdateSuccess") : t("blogCreateSuccess"),
      });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: selectedPost ? t("blogUpdateError") : t("blogCreateError"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await fetch(`/api/content/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Request failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      toast({ title: t("blogDeleteSuccess") });
    },
    onError: () => {
      toast({ title: t("error"), description: t("blogDeleteError"), variant: "destructive" });
    },
  });

  const openCreate = () => {
    setSelectedPost(null);
    setDialogOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setSelectedPost(post);
    setDialogOpen(true);
  };

  const handleDelete = (post: BlogPost) => {
    if (confirm(`${t("blogDeleteConfirm")} "${post.title}"?`)) {
      deleteMutation.mutate(post.id);
    }
  };

  const handleShare = async (platform: "facebook" | "instagram" | "whatsapp", post: BlogPost) => {
    const postTitle = language === "ar" && post.titleAr ? post.titleAr : post.title;
    const shareUrl = `${window.location.origin}/blog?post=${post.id}`;
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`${postTitle} ${shareUrl}`);

    if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "_blank", "noopener,noreferrer");
      return;
    }

    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodedText}`, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await navigator.clipboard.writeText(`${postTitle}\n${shareUrl}`);
      toast({
        title: t("copied") || "Copied",
        description:
          language === "ar"
            ? "تم نسخ رابط المقال. يمكنك نشره على إنستغرام الآن."
            : "Post link copied. You can now share it on Instagram.",
      });
    } catch {
      toast({
        title: t("share") || "Share",
        description:
          language === "ar"
            ? "تعذر نسخ الرابط تلقائيا."
            : "Could not copy the link automatically.",
        variant: "destructive",
      });
    }
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("blogPosts")}</h2>
          <p className="text-sm text-muted-foreground">{t("blogPublishNote")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t("newBlogPost")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedPost ? t("editBlogPost") : t("newBlogPost")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("blogTitle")}</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("blogTitleAr")}</Label>
                  <Input
                    value={form.titleAr}
                    onChange={(e) => setForm((prev) => ({ ...prev, titleAr: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("blogDescription")}</Label>
                  <Textarea
                    value={form.description}
                    rows={3}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("blogDescriptionAr")}</Label>
                  <Textarea
                    value={form.descriptionAr}
                    rows={3}
                    onChange={(e) => setForm((prev) => ({ ...prev, descriptionAr: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("blogCategory")}</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nutrition">{t("nutrition")}</SelectItem>
                      <SelectItem value="workout">{t("workout")}</SelectItem>
                      <SelectItem value="supplement">{t("supplements")}</SelectItem>
                      <SelectItem value="mindset">{t("mindset")}</SelectItem>
                      <SelectItem value="recovery">{t("recovery")}</SelectItem>
                      <SelectItem value="general">{t("general")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("blogStatus")}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, status: value as "draft" | "published" | "archived" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("blogStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{t("draft")}</SelectItem>
                      <SelectItem value="published">{t("published")}</SelectItem>
                      <SelectItem value="archived">{t("archived")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{t("blogTags")}</Label>
                  <Input
                    value={form.tagsInput}
                    placeholder={t("blogTagsPlaceholder")}
                    onChange={(e) => setForm((prev) => ({ ...prev, tagsInput: e.target.value }))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>{t("blogCoverMedia") || "Cover media"}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="space-y-2">
                      <Label>{t("mediaType") || "Type"}</Label>
                      <Select
                        value={form.coverMediaType}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, coverMediaType: value === "video" ? "video" : "image" }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">{t("mediaTypeImage") || "Image"}</SelectItem>
                          <SelectItem value="video">{t("mediaTypeVideo") || "Video"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <MediaUpload
                        value={form.coverMediaUrl}
                        onChange={(url) => setForm((prev) => ({ ...prev, coverMediaUrl: url }))}
                        accept={form.coverMediaType === "video" ? "video/*" : "image/*"}
                        mediaType={form.coverMediaType}
                        label={t("blogCoverMedia") || "Cover media"}
                        placeholder={form.coverMediaType === "video" ? "https://example.com/video.mp4" : "https://example.com/image.jpg"}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("blogCoverMediaHint") || "Optional: shown on blog cards and post details."}
                  </p>
                </div>
              </div>

              <Tabs defaultValue="en" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="en">English</TabsTrigger>
                  <TabsTrigger value="ar">العربية</TabsTrigger>
                </TabsList>
                <TabsContent value="en" className="space-y-2">
                  <Label>{t("blogContent")}</Label>
                  <BlogEditor
                    value={form.content}
                    onChange={(value) => setForm((prev) => ({ ...prev, content: value }))}
                    placeholder={t("blogContent")}
                  />
                </TabsContent>
                <TabsContent value="ar" className="space-y-2" dir="rtl">
                  <Label>{t("blogContentAr")}</Label>
                  <BlogEditor
                    value={form.contentAr}
                    onChange={(value) => setForm((prev) => ({ ...prev, contentAr: value }))}
                    placeholder={t("blogContentAr")}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  onClick={() => {
                    const hasTitle = !!(form.title.trim() || form.titleAr.trim());
                    const hasContent = !!(form.content.trim() || form.contentAr.trim());
                    if (!hasTitle || !hasContent) {
                      toast({
                        title: t("error"),
                        description: t("blogRequiredFields"),
                        variant: "destructive",
                      });
                      return;
                    }
                    saveMutation.mutate();
                  }}
                  disabled={saveMutation.isPending}
                >
                  {selectedPost ? t("save") : t("create")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("blogSearchPlaceholder")}
          className="md:max-w-sm"
        />
        {mode === "admin" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:max-w-xs">
              <SelectValue placeholder={t("blogStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              <SelectItem value="draft">{t("draft")}</SelectItem>
              <SelectItem value="published">{t("published")}</SelectItem>
              <SelectItem value="archived">{t("archived")}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-5/6 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">{t("blogNoPosts")}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {posts.map((post) => (
            <Card key={post.id}>
              {typeof post.typeMetadata?.coverMediaUrl === "string" && post.typeMetadata.coverMediaUrl && (
                <div className="h-44 w-full overflow-hidden border-b bg-muted/30">
                  {post.typeMetadata?.coverMediaType === "video" ? (
                    <video
                      src={post.typeMetadata.coverMediaUrl}
                      className="h-full w-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={post.typeMetadata.coverMediaUrl}
                      alt={post.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              )}
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">{post.title}</CardTitle>
                  <Badge variant={post.status === "published" ? "default" : "outline"}>
                    {t(post.status)}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {post.description || post.content?.replace(/<[^>]+>/g, "").slice(0, 140)}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(post)}>
                  <Edit className="h-4 w-4 mr-1" />
                  {t("edit")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(post)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("delete")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleShare("facebook", post)}>
                  {t("share") || "Share"} Facebook
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleShare("instagram", post)}>
                  {t("share") || "Share"} Instagram
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleShare("whatsapp", post)}>
                  {t("share") || "Share"} WhatsApp
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
