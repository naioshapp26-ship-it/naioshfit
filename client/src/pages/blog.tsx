import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import PublicHeader from "@/components/layout/PublicHeader";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type BlogPost = {
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

export default function BlogPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const showPublicHeader = !user;

  const queryParams = useMemo(() => ({
    type: "blog",
    visibility: "public",
    sort: "newest",
    limit: "30",
  }), []);

  const { data, isLoading } = useQuery<{ items: BlogPost[] }>({
    queryKey: ["/api/content", queryParams],
  });

  const posts = data?.items ?? [];

  useEffect(() => {
    if (!posts.length || selectedPost) return;
    const params = new URLSearchParams(window.location.search);
    const postIdParam = Number(params.get("post"));
    if (!Number.isFinite(postIdParam)) return;

    const matchedPost = posts.find((post) => post.id === postIdParam);
    if (matchedPost) {
      setSelectedPost(matchedPost);
    }
  }, [posts, selectedPost]);

  const getTextContent = (html: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleDateString(language === "ar" ? "ar" : "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const categoryKeyMap: Record<string, string> = {
    nutrition: "nutrition",
    workout: "workout",
    supplement: "supplements",
    mindset: "mindset",
    recovery: "recovery",
    general: "general",
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) return;

    setSelectedPost(null);

    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("post")) return;

    url.searchParams.delete("post");
    const query = url.searchParams.toString();
    const nextUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 via-gray-100 to-white" dir={language === "ar" ? "rtl" : "ltr"}>
      {showPublicHeader && (
        <div className="max-w-6xl mx-auto px-4 pt-8">
          <PublicHeader
            title={t("blog")}
            subtitle={t("blogPublicSubtitle")}
            backButtonClassName="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/60"
            stickyTopClassName="top-[116px]"
          />
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        {user && (
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{t("blog")}</h1>
            <p className="text-muted-foreground">{t("blogPublicSubtitle")}</p>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Card key={idx} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-muted rounded w-2/3" />
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
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("blogNoPosts")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => {
              const title = language === "ar" && post.titleAr ? post.titleAr : post.title;
              const description = language === "ar" && post.descriptionAr ? post.descriptionAr : post.description;
              const content = language === "ar" && post.contentAr ? post.contentAr : post.content;
              const previewText = description || getTextContent(content).slice(0, 200);

              return (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  {typeof post.typeMetadata?.coverMediaUrl === "string" && post.typeMetadata.coverMediaUrl && (
                    <div className="h-48 w-full overflow-hidden rounded-t-lg border-b bg-muted/30">
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
                          alt={title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  )}
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xl">{title}</CardTitle>
                          <Badge variant="outline">{t(categoryKeyMap[post.category] || post.category)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(post.publishedAt || post.createdAt)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{previewText}</p>
                    <Button variant="outline" onClick={() => setSelectedPost(post)}>
                      {t("blogReadMore")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedPost} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {language === "ar" && selectedPost.titleAr ? selectedPost.titleAr : selectedPost.title}
                </DialogTitle>
                <div className="text-xs text-muted-foreground">
                  {formatDate(selectedPost.publishedAt || selectedPost.createdAt)}
                </div>
              </DialogHeader>
              <div
                className="prose max-w-none"
                dir={language === "ar" ? "rtl" : "ltr"}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    language === "ar" && selectedPost.contentAr ? selectedPost.contentAr : selectedPost.content
                  ),
                }}
              />
              {typeof selectedPost.typeMetadata?.coverMediaUrl === "string" && selectedPost.typeMetadata.coverMediaUrl && (
                <div className="pt-3">
                  {selectedPost.typeMetadata?.coverMediaType === "video" ? (
                    <video
                      src={selectedPost.typeMetadata.coverMediaUrl}
                      className="w-full rounded-lg border"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={selectedPost.typeMetadata.coverMediaUrl}
                      alt={language === "ar" && selectedPost.titleAr ? selectedPost.titleAr : selectedPost.title}
                      className="w-full rounded-lg border object-cover"
                    />
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
