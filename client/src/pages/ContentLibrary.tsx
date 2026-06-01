import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Video, Image, Edit, Trash2, Play, Youtube, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SwipeableTabs, SwipeableTabsList, SwipeableTabsTrigger, SwipeableTabsContent } from "@/components/ui/swipeable-tabs";
import { useToast } from "@/hooks/use-toast";
import { ContentLibraryForm } from "@/components/content/ContentLibraryForm";
import { useAuth } from "@/hooks/use-auth";
import type { ContentLibrary, User } from "@shared/schema";
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import { useLanguage } from "@/context/LanguageContext";

function ContentLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedContent, setSelectedContent] = useState<ContentLibrary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCoachAssign, setShowCoachAssign] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  
  // Debug user data
  // Allow all authenticated users to manage content
  // Also check localStorage as a fallback since AuthContext might have loading issues
  const getUserFromStorage = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  };
  
  const effectiveUser = user || getUserFromStorage();
  const canManageContent = !!effectiveUser;

  // Fetch content library items (server-side filtering by coach)
  const { data: contentItems = [], isLoading } = useQuery({
    queryKey: ["/api/content-library", selectedCategory, selectedType, searchQuery, effectiveUser?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedType !== "all") params.append("type", selectedType);
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/content-library?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch content library");
      return response.json();
    },
    enabled: !!effectiveUser
  });

  // Fetch all coaches (for admin only)
  const { data: coaches = [] } = useQuery<User[]>({
    queryKey: ["/api/coaches"],
    queryFn: async () => {
      const response = await fetch('/api/coaches', {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: effectiveUser?.role === 'admin' || effectiveUser?.role === 'super_admin'
  });

  // Assign coach mutation
  const assignCoachMutation = useMutation({
    mutationFn: async ({ contentId, coachId }: { contentId: number; coachId: number }) => {
      const response = await fetch(`/api/content-library/${contentId}`, {
        method: "PATCH",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ coachId })
      });
      if (!response.ok) throw new Error("Failed to assign coach");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-library"] });
      setShowCoachAssign(false);
      setSelectedCoachId("");
      toast({ title: t("coachAssignedSuccess") });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    }
  });

  // Delete content mutation
  const deleteContentMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/content-library/${id}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to delete content");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-library"] });
      toast({ title: t("contentDeletedSuccess") });
    },
    onError: () => {
      toast({ title: t("failedToDeleteContent"), variant: "destructive" });
    }
  });

  const handleDelete = (content: ContentLibrary) => {
    if (confirm(`${t("areYouSureDelete")} "${content.title}"?`)) {
      deleteContentMutation.mutate(content.id);
    }
  };

  const handleEdit = (content: ContentLibrary) => {
    setSelectedContent(content);
    setShowForm(true);
  };

  const handleAssignCoach = (content: ContentLibrary) => {
    setSelectedContent(content);
    setSelectedCoachId(content.coachId?.toString() || "");
    setShowCoachAssign(true);
  };

  const handleCoachAssignSubmit = () => {
    if (!selectedContent || !selectedCoachId) {
      toast({ title: t("chooseACoach"), variant: "destructive" });
      return;
    }
    assignCoachMutation.mutate({
      contentId: selectedContent.id,
      coachId: parseInt(selectedCoachId)
    });
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedContent(null);
    queryClient.invalidateQueries({ queryKey: ["/api/content-library"] });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const categories = ["workout", "exercise", "nutrition", "stretching", "cardio", "strength"];
  const types = ["video", "image"];

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("contentLibrary")}</h1>
            <p className="text-muted-foreground">{t("loading")}...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isRTL ? "text-right" : "text-left"}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t("contentLibrary")}</h1>
          <p className="text-muted-foreground">
            {t("manageWorkoutVideosImages")}
          </p>
        </div>
        {canManageContent && (
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedContent(null)}>
                <Plus className={`h-4 w-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                {t("addContent")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedContent ? t("editContent") : t("addNewContent")}
                </DialogTitle>
              </DialogHeader>
              <ContentLibraryForm 
                content={selectedContent}
                onSuccess={handleFormSuccess}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className={`absolute top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 ${isRTL ? "right-3" : "left-3"}`} />
        <Input
          placeholder={t("searchContent")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={isRTL ? "pr-10" : "pl-10"}
        />
      </div>

      {/* Swipeable Tabs for Categories and Types */}
      <SwipeableTabs defaultValue="all" className="w-full" onValueChange={(value) => {
        if (value === "videos") {
          setSelectedType("video");
          setSelectedCategory("all");
        } else if (value === "images") {
          setSelectedType("image");
          setSelectedCategory("all");
        } else if (value === "all") {
          setSelectedType("all");
          setSelectedCategory("all");
        } else {
          setSelectedCategory(value);
          setSelectedType("all");
        }
      }}>
        <SwipeableTabsList
          className="grid w-full grid-cols-4 lg:grid-cols-8 gap-1 h-auto p-1"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <SwipeableTabsTrigger value="all" className="text-xs sm:text-sm">{t("all")}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="videos" className="text-xs sm:text-sm">{t("videos")}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="images" className="text-xs sm:text-sm">{t("images")}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="workout" className="text-xs sm:text-sm">{t("workout")}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="nutrition" className="text-xs sm:text-sm hidden sm:flex">{t("nutrition")}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="cardio" className="text-xs sm:text-sm hidden lg:flex">{t("cardio")}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="strength" className="text-xs sm:text-sm hidden lg:flex">{t("strength")}</SwipeableTabsTrigger>
          <SwipeableTabsTrigger value="stretching" className="text-xs sm:text-sm hidden lg:flex">{t("stretching")}</SwipeableTabsTrigger>
        </SwipeableTabsList>

        {/* Content for all tabs - shows filtered content based on selected tab */}
        {["all", "videos", "images", "workout", "nutrition", "cardio", "strength", "stretching"].map((tabValue) => (
          <SwipeableTabsContent key={tabValue} value={tabValue} className="mt-6" dir={isRTL ? "rtl" : "ltr"}>
            {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-muted rounded-t-lg" />
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contentItems.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">{t("noContentFound")}</h3>
            <p>{t("startBuildingContentLibrary")}</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contentItems.map((content: ContentLibrary) => (
            <Card key={content.id} className={`group hover:shadow-lg transition-shadow ${isRTL ? "text-right" : ""}`}>
              <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
                {content.thumbnailUrl ? (
                  <img
                    src={content.thumbnailUrl}
                    alt={content.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : content.type === "video" && content.url && !/(youtube\.com|youtu\.be)/i.test(content.url) ? (
                  <video
                    src={content.url}
                    className="absolute inset-0 w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                ) : content.type === "video" ? (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-red-500 to-red-600">
                    <div className="flex flex-col items-center">
                      <Youtube className="h-10 w-10 text-white mb-2" />
                      <Play className="h-6 w-6 text-white opacity-80" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-green-500 to-teal-600">
                    <Image className="h-12 w-12 text-white opacity-80" />
                  </div>
                )}
                <div className={`absolute top-2 flex gap-2 ${isRTL ? "right-2" : "left-2"}`}>
                  <Badge variant={content.type === "video" ? "default" : "secondary"} className={content.type === "video" ? "bg-red-600 hover:bg-red-700" : ""}>
                    {content.type === "video" ? <Youtube className={`h-3 w-3 ${isRTL ? "ml-1" : "mr-1"}`} /> : <Image className={`h-3 w-3 ${isRTL ? "ml-1" : "mr-1"}`} />}
                    {content.type === "video" ? t("video") : content.type}
                  </Badge>
                  {/* Show "Coach" badge for coach-uploaded content */}
                  <Badge variant="outline" className="bg-blue-600 text-white border-blue-700">
                    {t("coach")}
                  </Badge>
                  <Badge variant="outline">{content.category}</Badge>
                </div>
                {content.duration && (
                  <div className={`absolute bottom-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs ${isRTL ? "left-2" : "right-2"}`}>
                    {formatDuration(content.duration)}
                  </div>
                )}
                {canManageContent && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      {(effectiveUser?.role === 'admin' || effectiveUser?.role === 'super_admin') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignCoach(content)}
                          title="Assign Coach"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>{t("assignCoach") || "Assign Coach"}</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleEdit(content)}
                      >
                        <Edit className="h-4 w-4" />
                        <span>{t("edit")}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(content)}
                        disabled={deleteContentMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>{t("delete")}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              <CardContent className={`p-4 ${isRTL ? "text-right" : ""}`}>
                <h3 className="font-semibold truncate mb-1">{content.title}</h3>
                {content.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {content.description}
                  </p>
                )}
                {content.tags && content.tags.length > 0 && (
                  <div className={`flex flex-wrap gap-1 ${isRTL ? "justify-end" : ""}`}>
                    {content.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {content.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{content.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
          </SwipeableTabsContent>
        ))}
      </SwipeableTabs>
      
      {/* Coach Assignment Dialog */}
      <Dialog open={showCoachAssign} onOpenChange={setShowCoachAssign}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("assignCoachToVideo")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("assignVideoToCoach")}
              </p>
              {selectedContent && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="font-medium text-sm">{selectedContent.title}</p>
                  <p className="text-xs text-muted-foreground">{selectedContent.category}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="coach-select" className="text-sm font-medium">
                {t("selectCoach")}
              </label>
              <Select value={selectedCoachId} onValueChange={setSelectedCoachId}>
                <SelectTrigger id="coach-select">
                  <SelectValue placeholder={t("chooseACoach")} />
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((coach: User) => (
                    <SelectItem key={coach.id} value={coach.id.toString()}>
                      {coach.firstName} {coach.lastName} ({coach.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCoachAssignSubmit} 
                disabled={assignCoachMutation.isPending || !selectedCoachId}
                className="flex-1"
              >
                {assignCoachMutation.isPending ? t("assigningCoach") : t("assignCoach")}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCoachAssign(false);
                  setSelectedCoachId("");
                }}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />
    </div>
  );
}

export default ContentLibrary;
