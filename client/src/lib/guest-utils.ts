import type { User } from "@shared/schema";

export type GuestPreviewRole = "user" | "coach";

export type AppUser = User & {
  isGuest?: boolean;
  guestPreviewRole?: GuestPreviewRole;
};

export const GUEST_USER_STORAGE_KEY = "guestUser";
export const GUEST_UPGRADE_EVENT = "guest-upgrade-required";
export const GUEST_UPGRADE_MESSAGE = "للاستفادة الكاملة من المنصة يرجى إنشاء حساب.";

const ALLOWED_GUEST_MUTATIONS = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/contact",
  "/api/surveys",
  "/api/technical-issue",
];

export function isGuestUser(user: User | AppUser | null | undefined): user is AppUser {
  return Boolean(user && (user as AppUser).isGuest);
}

export function getStoredGuestUser(): AppUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(GUEST_USER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AppUser;
    if (!parsed?.isGuest) {
      localStorage.removeItem(GUEST_USER_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(GUEST_USER_STORAGE_KEY);
    return null;
  }
}

export function saveGuestUser(user: AppUser): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(GUEST_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearGuestUser(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(GUEST_USER_STORAGE_KEY);
}

export function triggerGuestUpgradePrompt(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(GUEST_UPGRADE_EVENT, {
      detail: { message: GUEST_UPGRADE_MESSAGE },
    }),
  );
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof input !== "string" && !(input instanceof URL)) {
    return (input as Request).method.toUpperCase();
  }

  return "GET";
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return (input as Request).url;
}

export function shouldBlockGuestRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = getRequestMethod(input, init);
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false;
  }

  const url = getRequestUrl(input);
  return !ALLOWED_GUEST_MUTATIONS.some((allowed) => url.includes(allowed));
}

export function createGuestUser(previewRole: GuestPreviewRole): AppUser {
  const arabicRole = previewRole === "coach" ? "مدرب" : "متدرب";

  return {
    id: -1,
    email: "guest@naioshfit.com",
    username: `guest-${previewRole}`,
    firstName: "زائر",
    lastName: arabicRole,
    role: previewRole,
    isApproved: true,
    isGuest: true,
    guestPreviewRole: previewRole,
    createdAt: new Date(),
    phoneNumber: null,
    city: null,
    country: null,
    gender: null,
    religion: null,
    height: null,
    age: null,
    weight: null,
    howFoundUs: null,
    coachId: null,
    gymId: null,
    approvedBy: null,
    profilePicture: null,
    whatsappWithCode: null,
    preferredCarbs: null,
    preferredProteins: null,
    preferredLegumes: null,
    preferredVegetables: null,
    preferredDairy: null,
    preferredFats: null,
    preferredFruits: null,
    hasAllergies: false,
    allergyDetails: null,
    wantsSupplements: false,
    previousTrainer: false,
    dailyRoutine: null,
    exerciseHistory: null,
    wakeUpTime: null,
    breakfastTime: null,
    breakfastDetails: null,
    lunchTime: null,
    lunchDetails: null,
    dinnerTime: null,
    dinnerDetails: null,
    lunchHasProtein: null,
    workType: null,
    workHours: null,
    hasKitchenScale: false,
    dailyMeals: null,
    goalWeight: null,
    shoulderWidth: null,
    chestWidth: null,
    waistWidth: null,
    hipWidth: null,
    hasInbody: false,
    fitnessGoal: null,
    trainingLevel: null,
    trainingDaysPerWeek: null,
    preferredWorkoutTime: null,
    preferredProgram: null,
    medicalHistory: false,
    medicalHistoryDetails: null,
    workIntensity: null,
    workoutLocation: null,
    inbodyDocument: null,
    bio: null,
    activityLevel: null,
    roleRequest: null,
    roleRequestStatus: null,
    roleRequestDate: null,
    roleRequestReason: null,
    roleRequestedBy: null,
    roleReviewedBy: null,
    roleReviewDate: null,
    roleReviewNotes: null,
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
    lastLoginAt: null,
    loginCount: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerified: false,
    emailVerificationToken: null,
    emailVerificationTokenExpiresAt: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    referralCode: null,
    referredBy: null,
    referralCount: 0,
    totalReferralEarnings: 0,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    subscriptionPlan: null,
    subscriptionCurrentPeriodStart: null,
    subscriptionCurrentPeriodEnd: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
  } as AppUser;
}
