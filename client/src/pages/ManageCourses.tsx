import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, BookOpen, Star, Users, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/LanguageContext";
import { CourseForm } from "@/components/courses/CourseForm";
import { useLocation } from "wouter";
import type { Course } from "@shared/schema";
import { useGuestRestriction } from "@/hooks/use-guest-restriction";
import { isPlatformAdminRole } from "@shared/roleAccess";

export default function ManageCoursesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isGuest, blockAction } = useGuestRestriction();
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  // Fetch courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["/api/courses", selectedCategory, selectedLevel, selectedStatus, searchQuery, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedLevel !== "all") params.append("level", selectedLevel);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (searchQuery) params.append("search", searchQuery);
      
      // If user is a coach, only show their courses
      if (user?.role === "coach" && user?.id) {
        params.append("instructorId", user.id.toString());
      }
      
      const response = await fetch(`/api/courses?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch courses");
      return response.json();
    },
    enabled: !!user && !isGuest
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/courses/${id}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to delete course");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: t("courseDeletedSuccess") });
    },
    onError: () => {
      toast({ title: t("failedToDeleteCourse"), variant: "destructive" });
    }
  });

  const handleDelete = (course: Course) => {
    if (confirm(`${t("confirmDeleteCourse")}\n\n"${course.title}"?`)) {
      deleteCourseMutation.mutate(course.id);
    }
  };

  const handleEdit = (course: Course) => {
    setSelectedCourse(course);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedCourse(null);
    queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
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

  if (!user || (!isPlatformAdminRole(user.role) && user.role !== "coach")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            {t("accessDeniedCoachAdmin")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <h2 className="text-2xl font-bold">هذه هي لوحة إدارة الدورات للمدرب</h2>
            <p className="text-muted-foreground">
              يمكنك هنا إنشاء الدورات، تنظيم الدروس، وتتبع أداء المتدربين بعد إنشاء حساب مدرب.
            </p>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>• إنشاء دورة جديدة وتحديد السعر والمستوى</p>
              <p>• إضافة دروس فيديو ومحتوى تعليمي</p>
              <p>• إدارة شهادات الإكمال للمتدربين</p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button className="bg-red-900 hover:bg-red-800" onClick={() => navigate('/signup')}>إنشاء حساب</Button>
              <Button variant="outline" onClick={blockAction}>تسجيل الدخول</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/ads-courses")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t("manageCourses")}</h1>
            <p className="text-muted-foreground">{t("campaignsCoursesSubtitle")}</p>
          </div>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedCourse(null)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("addCourse")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCourse ? t("editCourse") : t("addCourse")}
              </DialogTitle>
            </DialogHeader>
            <CourseForm 
              course={selectedCourse}
              onSuccess={handleFormSuccess}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t("searchCourses")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("filterByCategory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                <SelectItem value="fitness">{t("courseFitness")}</SelectItem>
                <SelectItem value="nutrition">{t("nutrition")}</SelectItem>
                <SelectItem value="wellness">{t("courseWellness")}</SelectItem>
                <SelectItem value="business">{t("courseBusiness")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Level Filter */}
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger>
                <SelectValue placeholder={t("filterByLevel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allLevels")}</SelectItem>
                <SelectItem value="beginner">{t("courseBeginnerLevel")}</SelectItem>
                <SelectItem value="intermediate">{t("courseIntermediateLevel")}</SelectItem>
                <SelectItem value="advanced">{t("courseAdvancedLevel")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t("filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCourseStatuses")}</SelectItem>
                <SelectItem value="draft">{t("courseDraft")}</SelectItem>
                <SelectItem value="published">{t("coursePublished")}</SelectItem>
                <SelectItem value="archived">{t("courseArchived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
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
      ) : courses.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">{t("noCourses")}</h3>
            <p>{t("createFirstCourse")}</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course: Course) => (
            <Card key={course.id} className="group hover:shadow-lg transition-shadow overflow-hidden">
              <div className="relative aspect-video bg-gradient-to-br from-blue-500 to-purple-600">
                {course.thumbnailUrl && (
                  <img 
                    src={course.thumbnailUrl} 
                    alt={course.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-2 left-2 flex gap-2 flex-wrap">
                  <Badge className={`${getCategoryBadgeColor(course.category)} text-white`}>
                    {t(course.category as any) || course.category}
                  </Badge>
                  <Badge className={`${getLevelBadgeColor(course.level)} text-white`}>
                    {t(course.level as any) || course.level}
                  </Badge>
                  {course.featured && (
                    <Badge className="bg-yellow-500 text-white">
                      <Star className="h-3 w-3 mr-1" />
                      {t("courseFeatured")}
                    </Badge>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="bg-white/90 backdrop-blur">
                    {t(course.status as any) || course.status}
                  </Badge>
                </div>
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/manage-courses/${course.id}/lessons`)}
                    >
                      <BookOpen className="h-4 w-4 mr-1" />
                      {t("viewLessons")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEdit(course)}
                    >
                      <Edit className="h-4 w-4" />
                      {t("edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(course)}
                      disabled={deleteCourseMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                  {course.title || (course as any).titleAr}
                  {course.title && (course as any).titleAr && (
                    <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                      {(course as any).titleAr}
                    </span>
                  )}
                </h3>
                {(course.description || (course as any).descriptionAr) && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {course.description || (course as any).descriptionAr}
                  </p>
                )}
                
                {/* Show creator information */}
                {(course as any).instructor && (
                  <div className="text-xs text-muted-foreground mb-2">
                    <span className="font-medium">{t("createdBy")}: </span>
                    <span>{(course as any).instructor.firstName} {(course as any).instructor.lastName}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{course.enrollmentCount || 0}</span>
                  </div>
                  {course.duration && (
                    <span>{course.duration}h</span>
                  )}
                  {course.averageRating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{course.averageRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {course.isFree ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    {t("courseFree")}
                  </Badge>
                ) : (
                  <div className="font-semibold text-lg">
                    {course.price} {course.currency}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
