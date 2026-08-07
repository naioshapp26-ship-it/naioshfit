import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { BookOpen, Star, Users, Clock, ChevronRight, Play, Plus, Download, Eye, Award } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmbeddedCheckout from "@/components/payments/EmbeddedCheckout";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useGuestRestriction } from "@/hooks/use-guest-restriction";
import type { Course } from "@shared/schema";

export default function CoursesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [enrolledCourses, setEnrolledCourses] = useState<Set<number>>(new Set());
  const [enrollingCourses, setEnrollingCourses] = useState<Set<number>>(new Set());
  const [enrolledCoursesData, setEnrolledCoursesData] = useState<Course[]>([]);
  const [paymentCourse, setPaymentCourse] = useState<Course | null>(null);
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentPublishableKey, setPaymentPublishableKey] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const { user } = useAuth();
  const { isGuest, blockAction } = useGuestRestriction();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const showPublicHeader = !user;

  const buildTenantDownloadUrl = (url: string) => {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}download=1`;
  };

  const resetPaymentState = () => {
    setPaymentCourse(null);
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

  // Fetch published courses only
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["/api/courses", selectedCategory, selectedLevel, searchQuery, "published"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("status", "published");
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      if (selectedLevel !== "all") params.append("level", selectedLevel);
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/courses?${params}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch courses");
      return response.json();
    },
    // Override the global staleTime: Infinity so newly published courses appear
    // without the user having to clear their cache.
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch user's enrollments with course details
  useQuery({
    queryKey: ["/api/user/enrollments"],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch("/api/user/enrollments", {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch enrollments");
      const data = await response.json();
      const courseIds = data.map((e: any) => e.courseId);
      setEnrolledCourses(new Set(courseIds));
      
      // Fetch full course details for enrolled courses
      if (courseIds.length > 0) {
        const coursesPromises = courseIds.map((id: number) =>
          fetch(`/api/courses/${id}`, { credentials: 'include' }).then(r => r.json())
        );
        const coursesData = await Promise.all(coursesPromises);
        setEnrolledCoursesData(coursesData);
      } else {
        setEnrolledCoursesData([]);
      }
      return data;
    },
    enabled: !!user && !isGuest,
    staleTime: 60000
  });

  // Fetch user's certificates
  const { data: certificates = [] } = useQuery({
    queryKey: ["/api/user/certificates"],
    queryFn: async () => {
      if (!user) return [];
      const response = await fetch("/api/user/certificates", {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch certificates");
      return response.json();
    },
    enabled: !!user && !isGuest,
    staleTime: 60000
  });

  // Enrollment mutation
  const enrollMutation = useMutation({
    mutationFn: async ({ courseId, sessionId }: { courseId: number; sessionId?: string | null }) => {
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
      return response.json();
    },
    onSuccess: async (_, variables) => {
      setEnrolledCourses(prev => new Set([...prev, variables.courseId]));
      setEnrollingCourses(prev => {
        const next = new Set(prev);
        next.delete(variables.courseId);
        return next;
      });
      
      // Add to enrolled courses data
      const response = await fetch(`/api/courses/${variables.courseId}`, { credentials: 'include' });
      if (response.ok) {
        const courseData = await response.json();
        setEnrolledCoursesData(prev => [...prev, courseData]);
      }
      
      toast({ title: t("enrolledSuccess") });
      resetPaymentState();
    },
    onError: (error: Error) => {
      toast({ 
        title: t("enrollmentFailed"), 
        description: error.message,
        variant: "destructive" 
      });
      setEnrollingCourses(prev => new Set());
    }
  });

  // Cancel enrollment mutation
  const cancelEnrollmentMutation = useMutation({
    mutationFn: async (courseId: number) => {
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
    onSuccess: (_, courseId) => {
      setEnrolledCourses(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      setEnrollingCourses(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
      
      // Remove from enrolled courses data
      setEnrolledCoursesData(prev => prev.filter(c => c.id !== courseId));
      
      toast({ title: t("enrollmentCanceled") });
    },
    onError: (error: Error) => {
      toast({ 
        title: t("cancelEnrollmentFailed"), 
        description: error.message,
        variant: "destructive" 
      });
      setEnrollingCourses(prev => new Set());
    }
  });

  const handleEnrollmentToggle = async (course: Course, isEnrolled: boolean) => {
    if (isGuest) {
      blockAction();
      return;
    }

    if (isEnrolled) {
      setEnrollingCourses(prev => new Set([...prev, course.id]));
      cancelEnrollmentMutation.mutate(course.id);
      return;
    }

    if (course.isFree || !course.price || course.price <= 0) {
      setEnrollingCourses(prev => new Set([...prev, course.id]));
      enrollMutation.mutate({ courseId: course.id });
      return;
    }

    try {
      setPaymentLoading(true);
      const session = await createCoursePaymentSession(course.id);
      const publishableKey = await fetchPublishableKey();
      setPaymentCourse(course);
      setPaymentSessionId(session.sessionId);
      setPaymentClientSecret(session.clientSecret || null);
      setPaymentPublishableKey(publishableKey);
      setIsPaymentOpen(true);
    } catch (error) {
      toast({
        title: t("enrollmentFailed"),
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setPaymentLoading(false);
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

  // Filter out enrolled courses from all courses
  const availableCourses = courses.filter((course: Course) => !enrolledCourses.has(course.id));

  const renderCourseCard = (course: Course, isEnrolled: boolean = false) => (
    <Card 
      key={course.id} 
      className="group hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer"
      onClick={() => navigate(`/courses/${course.id}`)}
    >
      <div className="relative aspect-video bg-gradient-to-br from-blue-500 to-purple-600">
        {course.thumbnailUrl ? (
          <img 
            src={course.thumbnailUrl} 
            alt={course.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="h-16 w-16 text-white/50" />
          </div>
        )}
        {course.previewVideoUrl && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white rounded-full p-4">
              <Play className="h-8 w-8 text-primary" />
            </div>
          </div>
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
              <Star className="h-3 w-3 mr-1 fill-current" />
              {t("courseFeatured")}
            </Badge>
          )}
        </div>
        {course.isFree ? (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500 text-white">
              {t("courseFree")}
            </Badge>
          </div>
        ) : course.price && course.price > 0 ? (
          <div className="absolute top-2 right-2">
            <Badge className="bg-white text-gray-900 font-semibold">
              {course.currency === "USD" ? "$" : course.currency} {course.price}
            </Badge>
          </div>
        ) : null}
      </div>

      <CardContent className="p-5">
        <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {course.title || course.titleAr}
          {course.title && course.titleAr && (
            <span className="block text-sm font-normal text-muted-foreground mt-0.5">
              {course.titleAr}
            </span>
          )}
        </h3>
        {(course.description || course.descriptionAr) && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {course.description || course.descriptionAr}
          </p>
        )}

        {/* Course Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          {course.duration && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{course.duration}h</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{course.enrollmentCount || 0}</span>
          </div>
          {course.averageRating && course.averageRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{course.averageRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Instructor */}
        {course.instructor && (
          <div className="text-xs text-muted-foreground mb-4">
            {t("by")}{" "}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile?coachId=${course.instructorId}`);
              }}
              className="hover:underline cursor-pointer font-medium text-foreground"
            >
              {course.instructor.firstName} {course.instructor.lastName}
            </button>
          </div>
        )}

        <div className="space-y-2">
          {user && (
            <Button 
              className="w-full"
              variant={isEnrolled ? "destructive" : "default"}
              onClick={(e) => {
                e.stopPropagation();
                handleEnrollmentToggle(course, isEnrolled);
              }}
              disabled={enrollingCourses.has(course.id) || paymentLoading}
            >
              {enrollingCourses.has(course.id)
                ? (isEnrolled ? t("canceling") : t("enrolling"))
                : (isEnrolled ? t("cancelEnrollment") : t("enrollNow"))
              }
            </Button>
          )}
          <Button 
            className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
            variant="outline"
            onClick={() => navigate(`/courses/${course.id}`)}
          >
            {t("viewCourse") || "View Course"}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-4 lg:p-8 min-h-screen bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      {showPublicHeader ? (
        <PublicHeader
          title={t("courses")}
          subtitle={t("exploreCourses") || "Explore our courses and start learning today"}
          backButtonClassName="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/60"
          sticky={false}
        />
      ) : (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("courses")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("exploreCourses") || "Explore our courses and start learning today"}
            </p>
          </div>
          {user && (user.role === "admin" || user.role === "super_admin" || user.role === "coach") && (
            <Button onClick={() => (isGuest ? blockAction() : navigate("/manage-courses"))}> 
              <Plus className="h-4 w-4 mr-2" />
              {t("addCourse")}
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Input
                placeholder={t("searchCourses")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-4"
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
          </div>
        </CardContent>
      </Card>

      {/* Section 1: My Enrolled Courses */}
      {user && !isGuest && enrolledCoursesData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {t("myCourses") || "My Courses"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("enrolledCoursesDesc") || "Continue learning from your enrolled courses"}
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {enrolledCoursesData.length} {enrolledCoursesData.length === 1 ? t("course") : t("courses")}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledCoursesData.map((course: Course) => renderCourseCard(course, true))}
          </div>
        </div>
      )}

      {/* Section 2: My Certificates */}
      {user && !isGuest && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {t("myCertificates")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("certificatesDesc")}
                  </p>
                </div>
              </div>
              {certificates.length > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {certificates.length} {certificates.length === 1 ? t("certificate") : t("certificates")}
                </Badge>
              )}
            </div>

            {certificates.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("courseName")}</TableHead>
                      <TableHead>{t("issueDate")}</TableHead>
                      <TableHead>{t("certificationNumber")}</TableHead>
                      <TableHead className="text-right">{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((cert: any) => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-medium">
                          {language === "ar" && cert.course?.titleAr 
                            ? cert.course.titleAr 
                            : cert.course?.title || "-"}
                        </TableCell>
                        <TableCell>
                          {cert.issuedAt 
                            ? new Date(cert.issuedAt).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            #{cert.id.toString().padStart(6, '0')}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              className="bg-red-800 text-white hover:bg-red-900"
                              size="sm"
                              onClick={() => cert.certificateUrl && window.open(cert.certificateUrl, '_blank')}
                              disabled={!cert.certificateUrl}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              {t("viewCertificate")}
                            </Button>
                            <Button
                              className="bg-red-800 text-white hover:bg-red-900"
                              size="sm"
                              onClick={() => {
                                if (!cert.certificateUrl) return;
                                // The certificate URL is an in-app page, not a real PDF file.
                                // Open it with download=1 so the page itself generates and
                                // downloads a valid image instead of saving the HTML shell.
                                window.open(buildTenantDownloadUrl(cert.certificateUrl), '_blank');
                              }}
                              disabled={!cert.certificateUrl}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              {t("downloadCertificate")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                  {t("noCertificates")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("completeCourses")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 3: All Available Courses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user && enrolledCoursesData.length > 0 
                ? (t("discoverMoreCourses") || "Discover More Courses")
                : (t("allCourses") || "All Courses")
              }
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("browseAvailableCourses") || "Browse all available courses to expand your knowledge"}
            </p>
          </div>
          {!isLoading && availableCourses.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {availableCourses.length} {availableCourses.length === 1 ? t("course") : t("courses")}
            </Badge>
          )}
        </div>

        {/* Loading State */}
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
        ) : availableCourses.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">
                {user && enrolledCoursesData.length > 0
                  ? (t("noMoreCourses") || "No More Courses Available")
                  : (t("noCourses"))}
              </h3>
              <p>
                {user && enrolledCoursesData.length > 0
                  ? (t("allCoursesEnrolled") || "You've explored all available courses!")
                  : (t("noCoursesAvailable") || "No courses available at the moment")}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course: Course) => renderCourseCard(course, false))}
          </div>
        )}
      </div>
      <Dialog open={isPaymentOpen} onOpenChange={(open) => (open ? setIsPaymentOpen(true) : resetPaymentState())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("payWithStripe") || "Pay with Stripe"}</DialogTitle>
            <DialogDescription>
              {paymentCourse
                ? `${paymentCourse.title} • ${paymentCourse.price?.toFixed(2)} ${paymentCourse.currency || "USD"}`
                : t("processingPayment") || "Processing payment"}
            </DialogDescription>
          </DialogHeader>
          {paymentClientSecret && paymentPublishableKey ? (
            <EmbeddedCheckout
              clientSecret={paymentClientSecret}
              publishableKey={paymentPublishableKey}
              onComplete={async () => {
                if (!paymentCourse || !paymentSessionId) {
                  return;
                }
                try {
                  await enrollMutation.mutateAsync({
                    courseId: paymentCourse.id,
                    sessionId: paymentSessionId
                  });
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
