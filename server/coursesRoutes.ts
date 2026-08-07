import type { Express } from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { db } from "./db";
import { courses, lessons, courseEnrollments, lessonProgress, courseReviews, courseCertificates, courseCertificateIssuances, users } from "@shared/schema";
import { eq, and, desc, like, or, sql, inArray } from "drizzle-orm";
import { buildRequestMetadata, mergeStripeMetadata } from "./payment/metadata";
import { createPlatformCheckoutSession, logPlatformTransaction, retrievePlatformCheckoutSession } from "./payment/platformStripe";
import { createTenantCheckoutSession, logTenantTransaction, retrieveTenantCheckoutSession } from "./payment/tenantStripe";

export function registerCoursesRoutes(app: Express) {
  const resolveCoursesDb = (req: any) => {
    const tenantPool = req?.tenantPool;
    if (tenantPool) {
      return drizzle(tenantPool, { schema });
    }
    return db;
  };

  const isTenantRequest = (req: any) => Boolean(req?.tenantPool);

  const resolveCourseActor = (req: any) => {
    const actor = req?.user || req?.session?.user;
    if (!actor?.id) return null;
    return actor;
  };

  const canManageCourseAsCoach = (actor: any, course: { instructorId: number }) =>
    actor.role === 'coach' && course.instructorId === actor.id;

  const fetchCoachTrainees = async (courseDb: ReturnType<typeof resolveCoursesDb>, coachId: number) => {
    return courseDb.query.users.findMany({
      where: and(
        eq(users.coachId, coachId),
        inArray(users.role, ['user', 'visitor', 'guest']),
      ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        username: true,
      },
    });
  };

  const ensureTraineeEnrollment = async (
    courseDb: ReturnType<typeof resolveCoursesDb>,
    courseId: number,
    userId: number,
  ) => {
    const existing = await courseDb.query.courseEnrollments.findFirst({
      where: and(
        eq(courseEnrollments.courseId, courseId),
        eq(courseEnrollments.userId, userId),
      ),
    });
    if (existing) return existing;

    const [created] = await courseDb.insert(courseEnrollments).values({
      courseId,
      userId,
      enrolledAt: new Date(),
    }).returning();
    return created;
  };

  const buildTenantCertificateUrl = (
    cert: { templateUrl?: string | null; id: number },
    courseId: number,
    userId: number,
    sequenceOffset = 0
  ) => {
    const templateUrl = cert?.templateUrl || `/certificates/default?courseId=${courseId}`;
    if (templateUrl.startsWith("/certificates/default")) {
      const timestamp = Date.now() + sequenceOffset;
      const certNumber = `CERT-${courseId}-${userId}-${timestamp}`;
      return `/certificates/${certNumber}.pdf`;
    }

    const separator = templateUrl.includes("?") ? "&" : "?";
    return `${templateUrl}${separator}user=${userId}&cert=${cert.id}`;
  };

  const buildCentralCertificateUrl = (
    cert: { templateUrl?: string | null; id: number },
    courseId: number,
    userId: number,
    certIdOverride?: number
  ) => {
    const templateUrl = cert?.templateUrl || `/certificates/default?courseId=${courseId}`;
    const separator = templateUrl.includes("?") ? "&" : "?";
    const certId = certIdOverride ?? cert.id;
    return `${templateUrl}${separator}user=${userId}&cert=${certId}`;
  };

  const isPaidCourse = (course: typeof courses.$inferSelect) => {
    const price = Number(course.price || 0);
    return !course.isFree && price > 0;
  };

  const toStripeAmount = (price: number) => Math.round(price * 100);

  const buildCoursePaymentMetadata = (req: any, course: typeof courses.$inferSelect) => {
    const user = req.user as any;
    const tenant = req.tenant as { id?: string; subdomain?: string } | undefined;
    const requestMetadata = buildRequestMetadata(req);
    const userMetadata = {
      user_id: user?.id,
      user_email: user?.email,
      user_username: user?.username,
      user_role: user?.role,
      tenant_id: tenant?.id,
      tenant_subdomain: tenant?.subdomain,
    };
    const courseMetadata = {
      payment_type: "course_enrollment",
      course_id: course.id,
      course_title: course.title,
      course_price: Number(course.price || 0),
      course_currency: course.currency || "USD",
    };

    return mergeStripeMetadata(requestMetadata, userMetadata, courseMetadata);
  };

  const verifyCoursePaymentSession = async (req: any, course: typeof courses.$inferSelect, sessionId: string) => {
    const session = req.tenantPool
      ? await retrieveTenantCheckoutSession(req.tenantPool, sessionId)
      : await retrievePlatformCheckoutSession(sessionId);

    const paymentStatus = session.payment_status || session.status;
    const isPaid = paymentStatus === "paid" || paymentStatus === "complete";
    if (!isPaid) {
      return null;
    }

    const metadata = session.metadata || {};
    const metadataCourseId = metadata.course_id || metadata.courseId;
    const metadataUserId = metadata.user_id || metadata.userId;

    if (String(metadata.payment_type || metadata.paymentType) !== "course_enrollment") {
      return null;
    }

    if (String(metadataCourseId || "") !== String(course.id)) {
      return null;
    }

    if (req.user && String(metadataUserId || "") !== String(req.user.id)) {
      return null;
    }

    const expectedAmount = toStripeAmount(Number(course.price || 0));
    if (session.amount_total && session.amount_total !== expectedAmount) {
      return null;
    }

    const expectedCurrency = (course.currency || "USD").toLowerCase();
    if (session.currency && session.currency.toLowerCase() !== expectedCurrency) {
      return null;
    }

    return session;
  };

  // Get all courses with filters
  app.get("/api/courses", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const { category, level, status, search, instructorId } = req.query;
      
      console.log("[COURSES] Fetching courses with filters:", { category, level, status, search, instructorId });
      
      let conditions: any[] = [];
      
      if (category && category !== "all") {
        conditions.push(eq(courses.category, category as string));
      }
      if (level && level !== "all") {
        conditions.push(eq(courses.level, level as string));
      }
      if (status && status !== "all") {
        conditions.push(eq(courses.status, status as string));
      }
      if (instructorId) {
        conditions.push(eq(courses.instructorId, parseInt(instructorId as string)));
      }
      if (search) {
        conditions.push(
          or(
            like(courses.title, `%${search}%`),
            like(courses.titleAr, `%${search}%`),
            like(courses.description, `%${search}%`)
          )
        );
      }

      const result = await courseDb.query.courses.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(courses.createdAt)],
        with: {
          instructor: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          }
        }
      });

      console.log("[COURSES] Found", result.length, "courses");
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single course
  app.get("/api/courses/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const courseId = parseInt(req.params.id);
      
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId),
        with: {
          instructor: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              profilePicture: true
            }
          }
        }
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.json(course);
    } catch (error: any) {
      console.error("Error fetching course:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create course
  app.post("/api/courses", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || ((req.user.role !== "admin" && req.user.role !== "super_admin") && req.user.role !== "coach")) {
        return res.status(403).json({ message: "Unauthorized. Admin or Coach role required." });
      }

      const courseData = {
        ...req.body,
        instructorId: req.user.id, // Always set to the creating user
        publishedAt: req.body.status === "published" ? new Date() : null
      };

      const [newCourse] = await courseDb.insert(courses).values(courseData).returning();
      res.status(201).json(newCourse);
    } catch (error: any) {
      console.error("Error creating course:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update course
  app.patch("/api/courses/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const courseId = parseInt(req.params.id);
      
      // Check if course exists and user has permission
      const existingCourse = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!existingCourse) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Admins can edit any course, coaches can only edit their own courses
      if ((req.user.role !== "admin" && req.user.role !== "super_admin") && existingCourse.instructorId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized. You can only edit your own courses." });
      }
      
      const {
        instructorId: _instructorId,
        enrollmentCount: _enrollmentCount,
        averageRating: _averageRating,
        ratingCount: _ratingCount,
        createdAt: _createdAt,
        instructor: _instructor,
        ...bodyFields
      } = req.body;

      // Coerce publishedAt into a real Date (or null); JSON payloads deliver it as an ISO string,
      // and drizzle's timestamp column calls .toISOString() on the value, which fails for strings.
      const normalizePublishedAt = (value: unknown): Date | null => {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
        const parsed = new Date(value as string);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };
      const providedPublishedAt = normalizePublishedAt(req.body.publishedAt);

      const updateData: Record<string, unknown> = {
        ...bodyFields,
        updatedAt: new Date(),
        publishedAt: req.body.status === "published" && !providedPublishedAt
          ? new Date()
          : providedPublishedAt
      };

      if (updateData.duration === null || updateData.duration === "" || Number.isNaN(updateData.duration)) {
        delete updateData.duration;
      }
      if (!updateData.publishedAt) {
        delete updateData.publishedAt;
      }

      const [updatedCourse] = await courseDb
        .update(courses)
        .set(updateData)
        .where(eq(courses.id, courseId))
        .returning();

      if (!updatedCourse) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.json(updatedCourse);
    } catch (error: any) {
      console.error("Error updating course:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete course
  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const courseId = parseInt(req.params.id);
      
      // Check if course exists and user has permission
      const existingCourse = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!existingCourse) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Admins can delete any course, coaches can only delete their own courses
      if ((req.user.role !== "admin" && req.user.role !== "super_admin") && existingCourse.instructorId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized. You can only delete your own courses." });
      }
      
      await courseDb.delete(courses).where(eq(courses.id, courseId));
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting course:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get lessons for a course
  app.get("/api/courses/:courseId/lessons", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const courseId = parseInt(req.params.courseId);
      
      const result = await courseDb.query.lessons.findMany({
        where: eq(lessons.courseId, courseId),
        orderBy: [lessons.orderIndex]
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching lessons:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single lesson
  app.get("/api/lessons/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const lessonId = parseInt(req.params.id);
      
      const lesson = await courseDb.query.lessons.findFirst({
        where: eq(lessons.id, lessonId),
        with: {
          course: true
        }
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      
      // If lesson is not preview and user is not enrolled, restrict access
      if (!lesson.isPreview && lesson.course.status === "published") {
        // TODO: Check enrollment status when enrollment system is fully implemented
        // For now, allow access to all lessons if course is published
      }

      res.json(lesson);
    } catch (error: any) {
      console.error("Error fetching lesson:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create lesson
  app.post("/api/courses/:courseId/lessons", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || ((req.user.role !== "admin" && req.user.role !== "super_admin") && req.user.role !== "coach")) {
        return res.status(403).json({ message: "Unauthorized. Admin or Coach role required." });
      }

      const courseId = parseInt(req.params.courseId);
      
      // Check if user owns the course
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.instructorId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized. You can only add lessons to your own courses." });
      }
      
      const lessonData = {
        ...req.body,
        courseId
      };

      const [newLesson] = await courseDb.insert(lessons).values(lessonData).returning();
      res.status(201).json(newLesson);
    } catch (error: any) {
      console.error("Error creating lesson:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update lesson
  app.patch("/api/lessons/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || ((req.user.role !== "admin" && req.user.role !== "super_admin") && req.user.role !== "coach")) {
        return res.status(403).json({ message: "Unauthorized. Admin or Coach role required." });
      }

      const lessonId = parseInt(req.params.id);
      
      // Get the lesson to find its course
      const existingLesson = await courseDb.query.lessons.findFirst({
        where: eq(lessons.id, lessonId),
        with: {
          course: true
        }
      });

      if (!existingLesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      // Check if user owns the course
      if (existingLesson.course.instructorId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized. You can only edit lessons for your own courses." });
      }
      
      const updateData = {
        ...req.body,
        updatedAt: new Date()
      };

      const [updatedLesson] = await courseDb
        .update(lessons)
        .set(updateData)
        .where(eq(lessons.id, lessonId))
        .returning();

      if (!updatedLesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      res.json(updatedLesson);
    } catch (error: any) {
      console.error("Error updating lesson:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete lesson
  app.delete("/api/lessons/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || ((req.user.role !== "admin" && req.user.role !== "super_admin") && req.user.role !== "coach")) {
        return res.status(403).json({ message: "Unauthorized. Admin or Coach role required." });
      }

      const lessonId = parseInt(req.params.id);
      
      // Get the lesson to find its course
      const existingLesson = await courseDb.query.lessons.findFirst({
        where: eq(lessons.id, lessonId),
        with: {
          course: true
        }
      });

      if (!existingLesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      // Check if user owns the course
      if (existingLesson.course.instructorId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized. You can only delete lessons for your own courses." });
      }
      
      await courseDb.delete(lessons).where(eq(lessons.id, lessonId));
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting lesson:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create Stripe checkout session for paid course enrollment
  app.post("/api/courses/:courseId/payment-session", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized. Please login." });
      }

      const courseId = parseInt(req.params.courseId);
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.status !== "published") {
        return res.status(400).json({ message: "This course is not available for enrollment" });
      }

      if (!isPaidCourse(course)) {
        return res.status(400).json({ message: "This course is free and does not require payment" });
      }

      const existingEnrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.userId, req.user.id)
        )
      });

      if (existingEnrollment) {
        return res.status(200).json({
          message: "Already enrolled",
          alreadyEnrolled: true,
          enrollmentId: existingEnrollment.id
        });
      }

      const amountCents = toStripeAmount(Number(course.price || 0));
      if (!(amountCents > 0)) {
        return res.status(400).json({ message: "Invalid course price" });
      }

      const returnUrl = req.body?.returnUrl || req.body?.return_url || req.headers.referer;
      if (!returnUrl) {
        return res.status(400).json({ message: "Return URL is required" });
      }

      const currency = course.currency || "USD";
      const metadata = buildCoursePaymentMetadata(req, course);

      const session = req.tenantPool
        ? await createTenantCheckoutSession(req.tenantPool, {
            items: [
              {
                name: course.title,
                description: course.description || undefined,
                amount: amountCents,
                quantity: 1
              }
            ],
            currency,
            successUrl: returnUrl,
            cancelUrl: returnUrl,
            returnUrl,
            customerEmail: req.user.email,
            metadata,
            uiMode: "embedded"
          })
        : await createPlatformCheckoutSession({
            items: [
              {
                name: course.title,
                description: course.description || undefined,
                amount: amountCents,
                quantity: 1
              }
            ],
            currency,
            paymentType: "course_enrollment",
            successUrl: returnUrl,
            cancelUrl: returnUrl,
            returnUrl,
            customerEmail: req.user.email,
            metadata,
            uiMode: "embedded"
          });

      if (req.tenantPool) {
        await logTenantTransaction(req.tenantPool, {
          stripePaymentId: session.sessionId,
          stripeCheckoutSessionId: session.sessionId,
          customerUserId: req.user.id,
          amount: Number(course.price || 0),
          currency,
          status: "pending",
          paymentType: "course_enrollment",
          metadata
        });
      } else {
        await logPlatformTransaction({
          stripePaymentId: session.sessionId,
          stripeCheckoutSessionId: session.sessionId,
          tenantId: null,
          amount: Number(course.price || 0),
          currency,
          status: "pending",
          paymentType: "course_enrollment",
          metadata
        });
      }

      return res.json({
        sessionId: session.sessionId,
        checkoutUrl: session.checkoutUrl,
        clientSecret: session.clientSecret
      });
    } catch (error: any) {
      console.error("Error creating course payment session:", error);
      if (error.message === "TENANT_PAYMENT_NOT_CONFIGURED" || error.message === "PLATFORM_PAYMENT_NOT_CONFIGURED") {
        return res.status(400).json({
          message: "Payment gateway not configured. Please contact administrator."
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Enroll in course
  app.post("/api/courses/:courseId/enroll", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized. Please login." });
      }

      const courseId = parseInt(req.params.courseId);
      
      // Check if course exists and is published
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.status !== "published") {
        return res.status(400).json({ message: "This course is not available for enrollment" });
      }

      // Check if already enrolled
      const existingEnrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.userId, req.user.id)
        )
      });

      if (existingEnrollment) {
        return res.json({
          message: "Already enrolled in this course",
          enrollment: existingEnrollment,
          alreadyEnrolled: true
        });
      }

      if (isPaidCourse(course)) {
        const sessionId = req.body?.sessionId || req.body?.session_id;
        if (!sessionId) {
          return res.status(402).json({ message: "Payment required to enroll in this course" });
        }

        const session = await verifyCoursePaymentSession(req, course, sessionId);
        if (!session) {
          return res.status(400).json({ message: "Payment not verified for this course" });
        }
      }

      // Create enrollment
      const [enrollment] = await courseDb
        .insert(courseEnrollments)
        .values({
          courseId,
          userId: req.user.id,
          progress: 0,
          completed: false
        })
        .returning();

      // Update enrollment count
      await courseDb
        .update(courses)
        .set({
          enrollmentCount: sql`${courses.enrollmentCount} + 1`
        })
        .where(eq(courses.id, courseId));

      res.json(enrollment);
    } catch (error: any) {
      console.error("Error enrolling in course:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Check enrollment status for a specific course
  app.get("/api/courses/:courseId/enrollment-status", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ isEnrolled: false });
      }

      const courseId = parseInt(req.params.courseId);

      const enrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.userId, req.user.id)
        )
      });
      
      res.json({ 
        isEnrolled: !!enrollment,
        enrollment: enrollment || null,
        certificateIssued: enrollment?.certificateIssued || false,
        certificateUrl: enrollment?.certificateUrl || null,
        completed: enrollment?.completed || false,
        completedAt: enrollment?.completedAt || null,
        progress: enrollment?.progress || 0
      });
    } catch (error: any) {
      console.error("Error checking enrollment status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's enrollments
  app.get("/api/user/enrollments", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const enrollments = await courseDb.query.courseEnrollments.findMany({
        where: eq(courseEnrollments.userId, req.user.id)
      });

      res.json(enrollments);
    } catch (error: any) {
      console.error("Error fetching user enrollments:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's certificates
  app.get("/api/user/certificates", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const certificates = await courseDb.query.courseCertificateIssuances.findMany({
        where: eq(courseCertificateIssuances.userId, req.user.id),
        orderBy: [desc(courseCertificateIssuances.issuedAt)],
        with: {
          course: {
            columns: {
              id: true,
              title: true,
              titleAr: true
            }
          },
          certificate: {
            columns: {
              id: true,
              title: true,
              templateUrl: true
            }
          },
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          }
        }
      });

      res.json(certificates);
    } catch (error: any) {
      console.error("Error fetching user certificates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually issue certificate for completed course (for retroactive issuance)
  app.post("/api/courses/:courseId/issue-certificate", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const courseId = parseInt(req.params.courseId);

      // Check if user completed the course
      const enrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.userId, req.user.id)
        )
      });

      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }

      if (!enrollment.completed) {
        return res.status(400).json({ message: "Course not completed yet" });
      }

      if (enrollment.certificateIssued) {
        return res.status(400).json({ message: "Certificate already issued" });
      }

      // Get the course
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (!course.certificateEnabled) {
        return res.status(400).json({ message: "Certificates not enabled for this course" });
      }

      // Get or create certificate
      let autoCerts = await courseDb.query.courseCertificates.findMany({
        where: and(
          eq(courseCertificates.courseId, courseId),
          eq(courseCertificates.issueUponCompletion, true)
        )
      });

      // If no certificates configured, create a default one
      if (autoCerts.length === 0) {
        const [defaultCert] = await courseDb.insert(courseCertificates).values({
          courseId: courseId,
          title: `${course.title} - Completion Certificate`,
          templateUrl: `/certificates/default?courseId=${courseId}`,
          issueUponCompletion: true,
          createdAt: new Date()
        }).returning();

        autoCerts = [defaultCert];
      }

      // Issue certificate
      const issuances = [];
      for (const cert of autoCerts) {
        // Check if already issued
        const existing = await courseDb.query.courseCertificateIssuances.findFirst({
          where: and(
            eq(courseCertificateIssuances.certificateId, cert.id),
            eq(courseCertificateIssuances.userId, req.user.id)
          )
        });

        if (!existing) {
          const certificateUrl = isTenantRequest(req)
            ? buildTenantCertificateUrl(cert, courseId, req.user.id, issuances.length)
            : buildCentralCertificateUrl(cert, courseId, req.user.id);
          issuances.push({
            certificateId: cert.id,
            userId: req.user.id,
            courseId: courseId,
            issuedAt: new Date(),
            certificateUrl,
            notes: "Manually issued"
          });
        }
      }

      if (issuances.length > 0) {
        await courseDb.insert(courseCertificateIssuances).values(issuances);

        // Update enrollment
        await courseDb
          .update(courseEnrollments)
          .set({
            certificateIssued: true,
            certificateIssuedAt: new Date(),
            certificateUrl: issuances[0].certificateUrl
          })
          .where(eq(courseEnrollments.id, enrollment.id));

        res.json({ 
          message: "Certificate issued successfully",
          certificates: issuances
        });
      } else {
        res.status(400).json({ message: "Certificate already exists" });
      }
    } catch (error: any) {
      console.error("Error issuing certificate:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel enrollment (unenroll from course)
  app.post("/api/courses/:courseId/unenroll", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized. Please login." });
      }

      const courseId = parseInt(req.params.courseId);

      // Check if enrollment exists
      const enrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.userId, req.user.id)
        )
      });

      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }

      // Delete enrollment
      await courseDb
        .delete(courseEnrollments)
        .where(
          and(
            eq(courseEnrollments.courseId, courseId),
            eq(courseEnrollments.userId, req.user.id)
          )
        );

      // Update enrollment count
      await courseDb
        .update(courses)
        .set({
          enrollmentCount: sql`${courses.enrollmentCount} - 1`
        })
        .where(eq(courses.id, courseId));

      res.json({ message: "Successfully unenrolled from course" });
    } catch (error: any) {
      console.error("Error unenrolling from course:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mark lesson as complete
  app.post("/api/lessons/:lessonId/complete", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized. Please login." });
      }

      const lessonId = parseInt(req.params.lessonId);

      // Get lesson and verify it exists
      const lesson = await courseDb.query.lessons.findFirst({
        where: eq(lessons.id, lessonId),
        with: {
          course: true
        }
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      // Check if user is enrolled in the course
      const enrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, lesson.courseId),
          eq(courseEnrollments.userId, req.user.id)
        )
      });

      if (!enrollment) {
        return res.status(403).json({ message: "You must be enrolled in this course to mark lessons as complete" });
      }

      // Check if progress record already exists
      const existingProgress = await courseDb.query.lessonProgress.findFirst({
        where: and(
          eq(lessonProgress.enrollmentId, enrollment.id),
          eq(lessonProgress.lessonId, lessonId),
          eq(lessonProgress.userId, req.user.id)
        )
      });

      let progress;

      if (existingProgress) {
        // Update existing progress
        [progress] = await courseDb
          .update(lessonProgress)
          .set({
            completed: true,
            completedAt: new Date(),
            lastAccessedAt: new Date()
          })
          .where(eq(lessonProgress.id, existingProgress.id))
          .returning();
      } else {
        // Create new progress record
        [progress] = await courseDb
          .insert(lessonProgress)
          .values({
            enrollmentId: enrollment.id,
            lessonId,
            userId: req.user.id,
            completed: true,
            completedAt: new Date(),
            lastAccessedAt: new Date()
          })
          .returning();
      }

      // Calculate course progress
      const allLessons = await courseDb.query.lessons.findMany({
        where: and(
          eq(lessons.courseId, lesson.courseId),
          eq(lessons.status, "published")
        )
      });

      const completedLessons = await courseDb.query.lessonProgress.findMany({
        where: and(
          eq(lessonProgress.enrollmentId, enrollment.id),
          eq(lessonProgress.completed, true)
        )
      });

      const progressPercentage = allLessons.length > 0
        ? Math.round((completedLessons.length / allLessons.length) * 100)
        : 0;

      const allLessonsCompleted = progressPercentage === 100;

      // Update enrollment progress
      const enrollmentUpdate: any = {
        progress: progressPercentage,
        completed: allLessonsCompleted,
        lastAccessedAt: new Date()
      };

      if (allLessonsCompleted) {
        enrollmentUpdate.completedAt = new Date();
      }

      await courseDb
        .update(courseEnrollments)
        .set(enrollmentUpdate)
        .where(eq(courseEnrollments.id, enrollment.id));

      // Auto-issue certificates if course is now complete and certificates are enabled
      if (allLessonsCompleted && !enrollment.certificateIssued) {
        try {
          // Get the course to check if certificates are enabled
          const courseData = await courseDb.query.courses.findFirst({
            where: eq(courses.id, lesson.courseId)
          });

          if (courseData?.certificateEnabled) {
            // Get certificates configured for automatic issuance on completion
            const autoCerts = await courseDb.query.courseCertificates.findMany({
              where: and(
                eq(courseCertificates.courseId, lesson.courseId),
                eq(courseCertificates.issueUponCompletion, true)
              )
            });

            // If no certificates configured but course has certificates enabled,
            // create a default certificate and issue it
            if (autoCerts.length === 0) {
              console.log(`[CERTIFICATES] No certificates configured for course ${lesson.courseId}, creating default certificate`);
              
              // Create a default certificate for this course
              const [defaultCert] = await courseDb.insert(courseCertificates).values({
                courseId: lesson.courseId,
                title: `${courseData.title} - Completion Certificate`,
                templateUrl: `/certificates/default?courseId=${lesson.courseId}`,
                issueUponCompletion: true,
                createdAt: new Date()
              }).returning();

              autoCerts.push(defaultCert);
            }

            if (autoCerts.length > 0) {
              const issuances = [];
              for (const cert of autoCerts) {
                // Check if already issued to this user
                const existing = await courseDb.query.courseCertificateIssuances.findFirst({
                  where: and(
                    eq(courseCertificateIssuances.certificateId, cert.id),
                    eq(courseCertificateIssuances.userId, req.user.id)
                  )
                });

                if (!existing) {
                  const certificateUrl = isTenantRequest(req)
                    ? buildTenantCertificateUrl(cert, lesson.courseId, req.user.id, issuances.length)
                    : buildCentralCertificateUrl(cert, lesson.courseId, req.user.id);
                  issuances.push({
                    certificateId: cert.id,
                    userId: req.user.id,
                    courseId: lesson.courseId,
                    issuedAt: new Date(),
                    certificateUrl,
                    notes: "Auto-issued upon course completion"
                  });
                }
              }

              if (issuances.length > 0) {
                await courseDb.insert(courseCertificateIssuances).values(issuances);

                // Update enrollment to mark certificateIssued
                await courseDb
                  .update(courseEnrollments)
                  .set({
                    certificateIssued: true,
                    certificateIssuedAt: new Date(),
                    certificateUrl: issuances[0].certificateUrl
                  })
                  .where(eq(courseEnrollments.id, enrollment.id));
                
                console.log(`[CERTIFICATES] Successfully issued ${issuances.length} certificate(s) to user ${req.user.id} for course ${lesson.courseId}`);
              }
            }
          }
        } catch (certError: any) {
          console.warn("Error auto-issuing certificates:", certError.message);
          // Don't throw - certificate issuance shouldn't block course completion
        }
      }

      res.json({
        success: true,
        progress,
        courseProgress: progressPercentage,
        courseCompleted: allLessonsCompleted
      });
    } catch (error: any) {
      console.error("Error marking lesson as complete:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get lesson progress
  app.get("/api/lessons/:lessonId/progress", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const lessonId = parseInt(req.params.lessonId);

      // Get lesson
      const lesson = await courseDb.query.lessons.findFirst({
        where: eq(lessons.id, lessonId)
      });

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      // Get enrollment
      const enrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, lesson.courseId),
          eq(courseEnrollments.userId, req.user.id)
        )
      });

      if (!enrollment) {
        return res.json({ completed: false });
      }

      // Get progress
      const progress = await courseDb.query.lessonProgress.findFirst({
        where: and(
          eq(lessonProgress.enrollmentId, enrollment.id),
          eq(lessonProgress.lessonId, lessonId),
          eq(lessonProgress.userId, req.user.id)
        )
      });

      res.json({
        completed: progress?.completed || false,
        completedAt: progress?.completedAt,
        timeSpent: progress?.timeSpent || 0
      });
    } catch (error: any) {
      console.error("Error fetching lesson progress:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== CERTIFICATE ENDPOINTS ====================

  // Coach's own courses (certificate dropdown, etc.)
  app.get("/api/coach/courses", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const actor = resolveCourseActor(req);
      if (!actor || (actor.role !== "coach" && actor.role !== "admin" && actor.role !== "super_admin")) {
        return res.status(403).json({ message: "Unauthorized. Coach role required." });
      }

      const coachIdParam = req.query.coachId as string | undefined;
      const targetCoachId =
        (actor.role === "admin" || actor.role === "super_admin") && coachIdParam
          ? parseInt(coachIdParam, 10)
          : actor.id;

      if (Number.isNaN(targetCoachId)) {
        return res.status(400).json({ message: "Invalid coachId" });
      }

      const coachCourses = await courseDb.query.courses.findMany({
        where: eq(courses.instructorId, targetCoachId),
        orderBy: [desc(courses.createdAt)],
      });

      res.json(coachCourses);
    } catch (error: any) {
      console.error("Error fetching coach courses:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get certificates for coach's courses
  app.get("/api/coach/certificates", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || req.user.role !== "coach") {
        return res.status(403).json({ message: "Unauthorized. Coach role required." });
      }

      // Get all courses owned by this coach
      const coachCourses = await courseDb.query.courses.findMany({
        where: eq(courses.instructorId, req.user.id),
        columns: { id: true }
      });

      const courseIds = coachCourses.map(c => c.id);
      if (courseIds.length === 0) {
        return res.json([]);
      }

      // Get all certificates for those courses
      const certs = await courseDb.query.courseCertificates.findMany({
        where: sql`${courseCertificates.courseId} = ANY(ARRAY[${sql.join(courseIds.map(id => sql`${id}`), sql`, `)}])`,
        orderBy: [desc(courseCertificates.createdAt)],
        with: {
          course: {
            columns: {
              id: true,
              title: true,
              titleAr: true
            }
          },
          issuances: true
        }
      });

      res.json(certs);
    } catch (error: any) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create certificate template
  app.post("/api/coach/certificates", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || req.user.role !== "coach") {
        return res.status(403).json({ message: "Unauthorized. Coach role required." });
      }

      const { courseId, title, titleAr, description, descriptionAr, templateUrl, issueAutomatically, issueUponCompletion } = req.body;

      // Verify coach owns this course
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!course || course.instructorId !== req.user.id) {
        return res.status(403).json({ message: "You can only create certificates for your own courses" });
      }

      const result = await courseDb.insert(courseCertificates).values({
        courseId,
        title,
        titleAr,
        description,
        descriptionAr,
        templateUrl,
        issueAutomatically,
        issueUponCompletion
      }).returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update certificate template
  app.patch("/api/coach/certificates/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || req.user.role !== "coach") {
        return res.status(403).json({ message: "Unauthorized. Coach role required." });
      }

      const certId = parseInt(req.params.id);
      const { title, titleAr, description, descriptionAr, templateUrl, issueAutomatically, issueUponCompletion } = req.body;

      // Get certificate
      const cert = await courseDb.query.courseCertificates.findFirst({
        where: eq(courseCertificates.id, certId),
        with: { course: true }
      });

      if (!cert) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Verify coach owns this course
      if (cert.course.instructorId !== req.user.id) {
        return res.status(403).json({ message: "You can only manage certificates for your own courses" });
      }

      const result = await courseDb.update(courseCertificates)
        .set({
          title,
          titleAr,
          description,
          descriptionAr,
          templateUrl,
          issueAutomatically,
          issueUponCompletion,
          updatedAt: new Date()
        })
        .where(eq(courseCertificates.id, certId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Error updating certificate:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete certificate template
  app.delete("/api/coach/certificates/:id", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || req.user.role !== "coach") {
        return res.status(403).json({ message: "Unauthorized. Coach role required." });
      }

      const certId = parseInt(req.params.id);

      // Get certificate
      const cert = await courseDb.query.courseCertificates.findFirst({
        where: eq(courseCertificates.id, certId),
        with: { course: true }
      });

      if (!cert) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Verify coach owns this course
      if (cert.course.instructorId !== req.user.id) {
        return res.status(403).json({ message: "You can only manage certificates for your own courses" });
      }

      await courseDb.delete(courseCertificates).where(eq(courseCertificates.id, certId));

      res.json({ message: "Certificate deleted" });
    } catch (error: any) {
      console.error("Error deleting certificate:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Issue certificate to users
  app.post("/api/coach/certificates/:id/issue", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const actor = resolveCourseActor(req);
      if (!actor || actor.role !== "coach") {
        return res.status(403).json({ message: "Unauthorized. Coach role required." });
      }

      const certId = parseInt(req.params.id);
      const { userIds, notes } = req.body; // userIds should be array of user IDs
      const requestedUserIds = Array.isArray(userIds)
        ? userIds.map((id: unknown) => Number(id)).filter((id) => !Number.isNaN(id))
        : [];

      if (requestedUserIds.length === 0) {
        return res.status(400).json({ message: "At least one user ID is required" });
      }

      // Get certificate
      const cert = await courseDb.query.courseCertificates.findFirst({
        where: eq(courseCertificates.id, certId),
        with: { course: true }
      });

      if (!cert) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Verify coach owns this course
      if (cert.course.instructorId !== actor.id) {
        return res.status(403).json({ message: "You can only issue certificates for your own courses" });
      }

      if (canManageCourseAsCoach(actor, cert.course)) {
        const assignedTrainees = await fetchCoachTrainees(courseDb, actor.id);
        const assignedIds = new Set(assignedTrainees.map((trainee) => trainee.id));
        for (const userId of requestedUserIds) {
          const existingEnrollment = await courseDb.query.courseEnrollments.findFirst({
            where: and(
              eq(courseEnrollments.courseId, cert.courseId),
              eq(courseEnrollments.userId, userId),
            ),
          });
          if (!existingEnrollment && assignedIds.has(userId)) {
            await ensureTraineeEnrollment(courseDb, cert.courseId, userId);
          }
        }
      }

      // Verify users are enrolled in the course
      const enrollments = await courseDb.query.courseEnrollments.findMany({
        where: and(
          eq(courseEnrollments.courseId, cert.courseId),
          inArray(courseEnrollments.userId, requestedUserIds),
        )
      });

      if (enrollments.length === 0) {
        return res.status(400).json({ message: "No valid enrollments found for specified users" });
      }

      // Create issuance records
      const issuances = await courseDb.insert(courseCertificateIssuances).values(
        enrollments.map(e => ({
          certificateId: certId,
          userId: e.userId,
          courseId: cert.courseId,
          issuedAt: new Date(),
          certificateUrl: isTenantRequest(req)
            ? buildTenantCertificateUrl(cert, cert.courseId, e.userId)
            : buildCentralCertificateUrl(cert, cert.courseId, e.userId, certId),
          notes
        }))
      ).returning();

      res.status(201).json(issuances);
    } catch (error: any) {
      console.error("Error issuing certificates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get enrolled users for a course (for certificate issuance UI)
  app.get("/api/courses/:courseId/enrolled-users", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const actor = resolveCourseActor(req);
      if (!actor) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const courseId = parseInt(req.params.courseId);

      // Get course
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId)
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // If user is not admin or course instructor, deny access
      if ((actor.role !== "admin" && actor.role !== "super_admin") && course.instructorId !== actor.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Get all enrollments with user details
      const enrollments = await courseDb.query.courseEnrollments.findMany({
        where: eq(courseEnrollments.courseId, courseId),
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePicture: true,
              username: true,
            }
          }
        },
        orderBy: [desc(courseEnrollments.enrolledAt)]
      });

      const payload = enrollments.map((enrollment) => ({
        ...enrollment,
        isAssignedTrainee: false,
      }));

      if (canManageCourseAsCoach(actor, course)) {
        const assignedTrainees = await fetchCoachTrainees(courseDb, actor.id);
        const enrolledUserIds = new Set(payload.map((entry) => entry.userId));
        for (const trainee of assignedTrainees) {
          if (enrolledUserIds.has(trainee.id)) continue;
          payload.push({
            id: null,
            userId: trainee.id,
            courseId,
            enrolledAt: null,
            completedAt: null,
            progress: null,
            user: trainee,
            isAssignedTrainee: true,
          } as any);
        }
      }

      res.json(payload);
    } catch (error: any) {
      console.error("Error fetching enrolled users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get certificate issuance history
  app.get("/api/coach/certificates/:id/issuances", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || req.user.role !== "coach") {
        return res.status(403).json({ message: "Unauthorized. Coach role required." });
      }

      const certId = parseInt(req.params.id);

      // Get certificate
      const cert = await courseDb.query.courseCertificates.findFirst({
        where: eq(courseCertificates.id, certId),
        with: { course: true }
      });

      if (!cert) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Verify coach owns this course
      if (cert.course.instructorId !== req.user.id) {
        return res.status(403).json({ message: "You can only view issuances for your own courses" });
      }

      // Get issuances with user details
      const issuances = await courseDb.query.courseCertificateIssuances.findMany({
        where: eq(courseCertificateIssuances.certificateId, certId),
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: [desc(courseCertificateIssuances.issuedAt)]
      });

      res.json(issuances);
    } catch (error: any) {
      console.error("Error fetching issuances:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Coach manually issue certificate to a user
  app.post("/api/coach/issue-certificate-to-user", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      const actor = resolveCourseActor(req);
      if (!actor || (actor.role !== "coach" && actor.role !== "admin" && actor.role !== "super_admin")) {
        return res.status(403).json({ message: "Unauthorized. Coach or admin role required." });
      }

      const { courseId, userId } = req.body;

      if (!courseId || !userId) {
        return res.status(400).json({ message: "Course ID and User ID are required" });
      }

      // Get the course
      const course = await courseDb.query.courses.findFirst({
        where: eq(courses.id, courseId),
        with: { instructor: true }
      });

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Verify coach owns this course (unless admin)
      if (actor.role === "coach" && course.instructorId !== actor.id) {
        return res.status(403).json({ message: "You can only issue certificates for your own courses" });
      }

      let enrollment = await courseDb.query.courseEnrollments.findFirst({
        where: and(
          eq(courseEnrollments.courseId, courseId),
          eq(courseEnrollments.userId, userId)
        )
      });

      if (!enrollment) {
        const trainee = await courseDb.query.users.findFirst({
          where: eq(users.id, userId),
        });

        const isAssignedTrainee =
          actor.role === 'coach' &&
          course.instructorId === actor.id &&
          trainee?.coachId === actor.id;

        if (isAssignedTrainee || actor.role === 'admin' || actor.role === 'super_admin') {
          enrollment = await ensureTraineeEnrollment(courseDb, courseId, userId);
        } else {
          return res.status(404).json({ message: "User is not enrolled in this course" });
        }
      }

      // Check if certificate already issued
      const existingIssuance = await courseDb.query.courseCertificateIssuances.findFirst({
        where: and(
          eq(courseCertificateIssuances.courseId, courseId),
          eq(courseCertificateIssuances.userId, userId)
        )
      });

      if (existingIssuance) {
        return res.status(400).json({ message: "Certificate already issued to this user" });
      }

      // Get or create certificate template for this course
      let courseCert = await courseDb.query.courseCertificates.findFirst({
        where: eq(courseCertificates.courseId, courseId)
      });

      // If no certificate template exists, create a default one
      if (!courseCert) {
        const [newCert] = await courseDb.insert(courseCertificates).values({
          courseId: courseId,
          title: `${course.title} - Completion Certificate`,
          titleAr: course.titleAr ? `${course.titleAr} - شهادة الإكمال` : undefined,
          description: `Certificate of completion for ${course.title}`,
          descriptionAr: course.titleAr ? `شهادة إتمام دورة ${course.titleAr}` : undefined,
          templateUrl: `/certificates/default?courseId=${courseId}`,
          issueUponCompletion: true,
          issueAutomatically: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();

        courseCert = newCert;
      }

      // Generate certificate number
      const timestamp = Date.now();
      const certNumber = `CERT-${courseId}-${userId}-${timestamp}`;
      const certificateUrl = `/certificates/${certNumber}.pdf`;

      // Issue the certificate
      const [issuance] = await courseDb.insert(courseCertificateIssuances).values({
        certificateId: courseCert.id,
        userId: userId,
        courseId: courseId,
        issuedAt: new Date(),
        certificateUrl: certificateUrl,
        notes: `Manually issued by coach ${req.user.firstName} ${req.user.lastName}`,
        createdAt: new Date()
      }).returning();

      // Update enrollment record
      await courseDb.update(courseEnrollments)
        .set({
          certificateIssued: true,
          certificateIssuedAt: new Date(),
          certificateUrl: certificateUrl
        })
        .where(eq(courseEnrollments.id, enrollment.id));

      console.log(`[CERTIFICATES] Coach ${req.user.id} manually issued certificate to user ${userId} for course ${courseId}`);

      res.json({
        success: true,
        message: "Certificate issued successfully",
        certificate: issuance,
        certificateUrl: certificateUrl
      });
    } catch (error: any) {
      console.error("Error issuing certificate:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all issued certificates for coach's courses
  app.get("/api/coach/all-issued-certificates", async (req, res) => {
    try {
      const courseDb = resolveCoursesDb(req);
      if (!req.user || (req.user.role !== "coach" && (req.user.role !== "admin" && req.user.role !== "super_admin"))) {
        return res.status(403).json({ message: "Unauthorized. Coach or admin role required." });
      }

      // Get all courses for this coach
      const coachCourses = await courseDb.query.courses.findMany({
        where: eq(courses.instructorId, req.user.id),
        columns: { id: true }
      });

      const courseIds = coachCourses.map(c => c.id);

      if (courseIds.length === 0) {
        return res.json([]);
      }

      // Get all certificate issuances for these courses
      const issuances = await courseDb.query.courseCertificateIssuances.findMany({
        where: sql`${courseCertificateIssuances.courseId} IN (${sql.join(courseIds.map(id => sql`${id}`), sql`, `)})`,
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          },
          course: {
            columns: {
              id: true,
              title: true,
              titleAr: true
            }
          },
          certificate: {
            columns: {
              id: true,
              title: true,
              titleAr: true
            }
          }
        },
        orderBy: [desc(courseCertificateIssuances.issuedAt)]
      });

      res.json(issuances);
    } catch (error: any) {
      console.error("Error fetching issued certificates:", error);
      res.status(500).json({ message: error.message });
    }
  });
}

