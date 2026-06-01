import {
  users,
  meals,
  progress,
  products,
  orders,
  orderItems,
  cartItems,
  messages,
  workouts,
  userWorkouts,
  workoutSessions,
  dailyStats,
  userPlans,
  contentLibrary,
  contentCategories,
  coachInvitations,
  coachInfo,
  coachProducts,
  affiliateProducts,
  affiliateCategories,
  trackingSettings,
  creditBalances,
  creditTransactions,
  scrapedAffiliateProducts,
  userPointsAndStreaks,
  userLogins,
  groupChallenges,
  challengeParticipants,
  type User,
  type Meal,
  type Progress,
  type Product,
  type Order,
  type OrderItem,
  type CartItem,
  type Message,
  type Workout,
  type UserWorkout,
  type WorkoutSession,
  type DailyStats,
  type UserPlan,
  type ContentLibrary,
  type ContentCategory,
  type CoachInvitation,
  type CoachInfo,
  type CoachProduct,
  type AffiliateProduct,
  type AffiliateCategory,
  type TrackingSettings,
  type ScrapedAffiliateProduct,
  type UserPointsAndStreaks,
  type CreditBalance,
  type CreditTransaction,
  type InsertUser,
  type InsertMeal,
  type InsertProgress,
  type InsertProduct,
  type InsertOrder,
  type InsertOrderItem,
  type InsertCartItem,
  type InsertMessage,
  type InsertWorkout,
  type InsertUserWorkout,
  type InsertWorkoutSession,
  type InsertDailyStats,
  type InsertUserPlan,
  type InsertContentLibrary,
  type InsertContentCategory,
  type InsertCoachInvitation,
  type InsertCoachInfo,
  type InsertCoachProduct,
  type InsertAffiliateProduct,
  type InsertAffiliateCategory,
  type InsertTrackingSettings,
  type InsertUserPointsAndStreaks,
  type InsertCreditTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, gte, lte, lt, desc, sql, inArray } from "drizzle-orm";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUserIdentity(insertUser: InsertUser) {
  const username = typeof insertUser.username === 'string' ? insertUser.username.trim() : '';
  const email = typeof insertUser.email === 'string' ? insertUser.email.trim().toLowerCase() : '';
  const inferredEmail = !email && EMAIL_PATTERN.test(username) ? username.toLowerCase() : '';

  return {
    username: username || inferredEmail || null,
    email: email || inferredEmail || null,
  };
}

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByWhatsappWithCode(whatsappWithCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  updateUserSubscription(id: number, subscription: { subscriptionType: string; subscriptionStartDate?: Date; subscriptionEndDate?: Date }): Promise<User | undefined>;
  getUsersByCoachId(coachId: number): Promise<User[]>;
  getUsersByGymId(gymId: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;

  // Workout methods
  getWorkout(id: number): Promise<Workout | undefined>;
  getAllWorkouts(): Promise<Workout[]>;
  getWorkoutsByCoachId(coachId: number): Promise<Workout[]>;
  createWorkout(workout: InsertWorkout): Promise<Workout>;
  updateWorkout(id: number, workout: Partial<Workout>): Promise<Workout | undefined>;
  deleteWorkout(id: number): Promise<boolean>;

  // User Workouts methods
  getUserWorkout(id: number): Promise<UserWorkout | undefined>;
  getUserWorkoutsByUserId(userId: number): Promise<UserWorkout[]>;
  getUserWorkouts(userId: number): Promise<UserWorkout[]>;
  getUserWorkoutsByDate(userId: number, date: Date): Promise<UserWorkout[]>;
  createUserWorkout(userWorkout: InsertUserWorkout): Promise<UserWorkout>;
  updateUserWorkout(id: number, userWorkout: Partial<UserWorkout>): Promise<UserWorkout | undefined>;
  markUserWorkoutComplete(id: number, completedAt: Date): Promise<UserWorkout | undefined>;
  deleteUserWorkout(id: number): Promise<boolean>;

  // Meals methods
  getMeal(id: number): Promise<Meal | undefined>;
  getMealsByUserId(userId: number): Promise<Meal[]>;
  getMealsByDate(userId: number, date: Date): Promise<Meal[]>;
  getMealsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Meal[]>;
  createMeal(meal: InsertMeal): Promise<Meal>;
  updateMeal(id: number, meal: Partial<Meal>): Promise<Meal | undefined>;
  deleteMeal(id: number): Promise<boolean>;

  // Progress methods
  getProgress(id: number): Promise<Progress | undefined>;
  getProgressByUserId(userId: number): Promise<Progress[]>;
  getUserProgress(userId: number): Promise<Progress[]>;
  getProgressByDate(userId: number, date: Date): Promise<Progress | undefined>;
  getProgressByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Progress[]>;
  createProgress(progress: InsertProgress): Promise<Progress>;
  updateProgress(id: number, progress: Partial<Progress>): Promise<Progress | undefined>;
  deleteProgress(id: number): Promise<boolean>;

  // Products methods
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Orders methods
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByUserId(userId: number): Promise<(Order & { items: OrderItem[] })[]>;
  getAllOrders(): Promise<(Order & { items: OrderItem[], user?: { id: number, username: string, firstName: string, lastName: string } })[]>;
  getOrderWithItems(id: number): Promise<(Order & { items: OrderItem[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;

  // Cart methods
  getCartItems(userId: number): Promise<(CartItem & { product: Product })[]>;
  getCartItem(userId: number, productId: number): Promise<CartItem | undefined>;
  upsertCartItem(userId: number, productId: number, quantity: number): Promise<CartItem>;
  removeCartItem(userId: number, productId: number): Promise<boolean>;
  clearCart(userId: number): Promise<void>;

  // Messages methods
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]>;
  getUserMessages(userId: number): Promise<Message[]>;
  getMessagesByUserId(userId: number): Promise<Message[]>;
  getUnreadMessagesByUserId(userId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;

  // Workout Sessions methods
  getWorkoutSession(id: number): Promise<WorkoutSession | undefined>;
  getWorkoutSessionsByUserId(userId: number): Promise<WorkoutSession[]>;
  getWorkoutSessionsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<WorkoutSession[]>;
  createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession>;
  updateWorkoutSession(id: number, session: Partial<WorkoutSession>): Promise<WorkoutSession | undefined>;
  deleteWorkoutSession(id: number): Promise<boolean>;

  // Daily Stats methods
  getDailyStats(id: number): Promise<DailyStats | undefined>;
  getDailyStatsByUserAndDate(userId: number, date: Date): Promise<DailyStats | undefined>;
  getDailyStatsByUserId(userId: number): Promise<DailyStats[]>;
  getDailyStatsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<DailyStats[]>;
  createDailyStats(stats: InsertDailyStats): Promise<DailyStats>;
  updateDailyStats(id: number, stats: Partial<DailyStats>): Promise<DailyStats | undefined>;
  getWeeklyStats(userId: number, startDate: Date): Promise<DailyStats[]>;
  updateUserDailyStatsGoals(userId: number, goals: { caloriesGoal: number; proteinGoal: number; carbsGoal: number; fatGoal: number }): Promise<void>;

  // User Plans methods
  getUserPlan(id: number): Promise<UserPlan | undefined>;
  getUserPlansByUserId(userId: number): Promise<UserPlan[]>;
  getLatestUserPlan(userId: number): Promise<UserPlan | undefined>;
  createUserPlan(plan: InsertUserPlan): Promise<UserPlan>;
  updateUserPlan(id: number, plan: Partial<UserPlan>): Promise<UserPlan | undefined>;
  deleteUserPlan(id: number): Promise<boolean>;

  // Content Library methods
  getContentLibraryItem(id: number): Promise<ContentLibrary | undefined>;
  getAllContentLibrary(): Promise<ContentLibrary[]>;
  getContentLibraryByCoachId(coachId: number): Promise<ContentLibrary[]>;
  getContentLibraryByCategory(coachId: number | null, category: string): Promise<ContentLibrary[]>;
  getContentLibraryByType(coachId: number | null, type: string): Promise<ContentLibrary[]>;
  searchContentLibrary(coachId: number | null, query: string): Promise<ContentLibrary[]>;
  createContentLibraryItem(content: InsertContentLibrary): Promise<ContentLibrary>;
  updateContentLibraryItem(id: number, content: Partial<ContentLibrary>): Promise<ContentLibrary | undefined>;
  deleteContentLibraryItem(id: number): Promise<boolean>;

  // Content Categories methods
  getContentCategory(id: number): Promise<ContentCategory | undefined>;
  getAllContentCategories(): Promise<ContentCategory[]>;
  createContentCategory(category: InsertContentCategory): Promise<ContentCategory>;
  updateContentCategory(id: number, category: Partial<ContentCategory>): Promise<ContentCategory | undefined>;
  deleteContentCategory(id: number): Promise<boolean>;

  // Coach Invitation methods
  createCoachInvitation(invitation: InsertCoachInvitation): Promise<CoachInvitation>;
  getCoachInvitation(id: number): Promise<CoachInvitation | undefined>;
  getCoachInvitationsByCoachId(coachId: number): Promise<(CoachInvitation & { userName: string, userWhatsapp: string })[]>;
  getCoachInvitationsByUserId(userId: number): Promise<(CoachInvitation & { coachName: string, coachWhatsapp: string })[]>;
  updateCoachInvitation(id: number, updates: Partial<CoachInvitation>): Promise<CoachInvitation | undefined>;
  deleteCoachInvitation(id: number): Promise<boolean>;

  // Coach Info methods
  getCoachInfo(coachId: number): Promise<CoachInfo | undefined>;
  createCoachInfo(info: InsertCoachInfo): Promise<CoachInfo>;
  updateCoachInfo(coachId: number, info: Partial<CoachInfo>): Promise<CoachInfo | undefined>;

  // Coach Products methods
  getCoachProduct(id: number): Promise<CoachProduct | undefined>;
  getCoachProductsByCoachId(coachId: number): Promise<CoachProduct[]>;
  createCoachProduct(product: InsertCoachProduct): Promise<CoachProduct>;
  updateCoachProduct(id: number, product: Partial<CoachProduct>): Promise<CoachProduct | undefined>;
  deleteCoachProduct(id: number): Promise<boolean>;

  // Affiliate Products methods
  getAffiliateProduct(id: number): Promise<AffiliateProduct | undefined>;
  getAllAffiliateProducts(): Promise<AffiliateProduct[]>;
  getActiveAffiliateProducts(): Promise<AffiliateProduct[]>;
  createAffiliateProduct(product: InsertAffiliateProduct): Promise<AffiliateProduct>;
  updateAffiliateProduct(id: number, product: Partial<AffiliateProduct>): Promise<AffiliateProduct | undefined>;
  deleteAffiliateProduct(id: number): Promise<boolean>;
  
  // Affiliate Categories methods
  getAllAffiliateCategories(): Promise<AffiliateCategory[]>;
  getActiveAffiliateCategories(): Promise<AffiliateCategory[]>;
  getAffiliateCategoryById(id: number): Promise<AffiliateCategory | undefined>;
  createAffiliateCategory(category: InsertAffiliateCategory): Promise<AffiliateCategory>;
  updateAffiliateCategory(id: number, category: Partial<AffiliateCategory>): Promise<AffiliateCategory | undefined>;
  deleteAffiliateCategory(id: number): Promise<boolean>;
  
  // Scraped Affiliate Products methods
  getScrapedProductsByAffiliateId(affiliateProductId: number): Promise<ScrapedAffiliateProduct[]>;
  getAllScrapedProducts(): Promise<ScrapedAffiliateProduct[]>;
  scrapeAffiliateProduct(affiliateProductId: number): Promise<{ count: number } | null>;
  scrapeAllAffiliateProducts(): Promise<{ success: number; failed: number }>;


  // User Points and Streaks methods
  getUserPointsAndStreaks(userId: number): Promise<UserPointsAndStreaks | undefined>;
  createUserPointsAndStreaks(data: InsertUserPointsAndStreaks): Promise<UserPointsAndStreaks>;
  updateUserPointsAndStreaks(userId: number, data: Partial<UserPointsAndStreaks>): Promise<UserPointsAndStreaks | undefined>;
  addPoints(userId: number, points: number, actionType: string): Promise<UserPointsAndStreaks | undefined>;
  updateStreak(userId: number, hasActivity: boolean): Promise<UserPointsAndStreaks | undefined>;

  // Credit & payment methods
  getCreditBalance(userId: number): Promise<CreditBalance | undefined>;
  incrementCreditBalance(userId: number, credits: number): Promise<CreditBalance>;
  createCreditTransaction(tx: InsertCreditTransaction): Promise<CreditTransaction>;
  updateCreditTransaction(id: number, update: Partial<CreditTransaction>): Promise<CreditTransaction | undefined>;
  getCreditTransactionByReference(reference: string): Promise<CreditTransaction | undefined>;
  getCreditTransactionsByUser(userId: number, limit?: number): Promise<CreditTransaction[]>;
  finalizeCreditTransaction(
    merchantReferenceId: string,
    update: {
      status: string;
      gatewayStatus?: string | null;
      responseCode?: string | null;
      orderId?: string | null;
      signatureValid?: boolean;
      signatureHeader?: string | null;
      callbackPayload?: unknown;
      errorMessage?: string | null;
      credited: boolean;
    }
  ): Promise<CreditTransaction | undefined>;

  // Tracking settings methods
  getTrackingSettings(): Promise<TrackingSettings | undefined>;
  upsertTrackingSettings(data: Partial<InsertTrackingSettings>): Promise<TrackingSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private workouts: Map<number, Workout>;
  private userWorkouts: Map<number, UserWorkout>;
  private meals: Map<number, Meal>;
  private progress: Map<number, Progress>;
  private products: Map<number, Product>;
  private cartItems: Map<number, CartItem>;
  private messages: Map<number, Message>;
  private dailyStats: Map<number, DailyStats>;
  private userPlans: Map<number, UserPlan>;
  private contentLibrary: Map<number, ContentLibrary>;
  private contentCategories: Map<number, ContentCategory>;
  private workoutSessions: Map<number, WorkoutSession>;
  private nextCartItemId: number;
  // Coach Invitations
  private coachInvitations: Map<number, CoachInvitation>;
  // Coach Info
  private coachInfoMap: Map<number, CoachInfo>;
  private coachInfoByCoachId: Map<number, number>; // coachId -> coachInfo.id for faster lookup
  // Coach Products
  private coachProductsMap: Map<number, CoachProduct>;
  private coachProductsByCoachId: Map<number, number[]>; // coachId -> array of product IDs
  // Affiliate Products
  private affiliateProductsMap: Map<number, AffiliateProduct>;
  // Tracking settings snapshot
  private trackingSettings: TrackingSettings | null;

  private userIdCounter: number;
  private workoutIdCounter: number;
  private userWorkoutIdCounter: number;
  private mealIdCounter: number;
  private progressIdCounter: number;
  private productIdCounter: number;
  private messageIdCounter: number;
  private dailyStatsIdCounter: number;
  private userPlanIdCounter: number;
  private contentLibraryIdCounter: number;
  private contentCategoryIdCounter: number;
  private workoutSessionIdCounter: number;
  // Coach Invitation ID Counter
  private coachInvitationIdCounter: number;
  // Coach Info ID Counter
  private coachInfoIdCounter: number;
  // Coach Products ID Counter
  private coachProductsIdCounter: number;
  // Affiliate Products ID Counter
  private affiliateProductsIdCounter: number;

  constructor() {
    this.users = new Map();
    this.workouts = new Map();
    this.userWorkouts = new Map();
    this.meals = new Map();
    this.progress = new Map();
    this.products = new Map();
    this.cartItems = new Map();
    this.messages = new Map();
    this.dailyStats = new Map();
    this.userPlans = new Map();
    this.contentCategories = new Map();
    this.contentLibrary = new Map();
    this.workoutSessions = new Map();
    // Initialize Coach Invitations
    this.coachInvitations = new Map();
    // Initialize Coach Info
    this.coachInfoMap = new Map();
    this.coachInfoByCoachId = new Map();
    // Initialize Coach Products
    this.coachProductsMap = new Map();
    this.coachProductsByCoachId = new Map();
    // Initialize Affiliate Products
    this.affiliateProductsMap = new Map();
    // Initialize tracking settings
    this.trackingSettings = null;

    this.userIdCounter = 1;
    this.workoutIdCounter = 1;
    this.userWorkoutIdCounter = 1;
    this.mealIdCounter = 1;
    this.progressIdCounter = 1;
    this.productIdCounter = 1;
    this.messageIdCounter = 1;
    this.dailyStatsIdCounter = 1;
    this.userPlanIdCounter = 1;
    this.contentLibraryIdCounter = 1;
    this.contentCategoryIdCounter = 1;
    this.workoutSessionIdCounter = 1;
    // Initialize Coach Invitation ID Counter
    this.coachInvitationIdCounter = 1;
    // Initialize Coach Info ID Counter
    this.coachInfoIdCounter = 1;
    // Initialize Coach Products ID Counter
    this.coachProductsIdCounter = 1;
    // Initialize Affiliate Products ID Counter
    this.affiliateProductsIdCounter = 1;
    this.nextCartItemId = 1;

    // Initialize demo products, workouts, and messages
    this.initializeProducts();
    this.initializeWorkouts();
    this.initializeMessages();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
  }

  async getUserByWhatsappWithCode(whatsappWithCode: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.whatsappWithCode === whatsappWithCode,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const identity = normalizeUserIdentity(insertUser);
    const user: User = {
      ...insertUser,
      username: identity.username,
      email: identity.email,
      id,
      role: insertUser.role || "user",
      coachId: insertUser.coachId ?? null, // No default coach assignment
      gymId: insertUser.gymId ?? null,
      subscriptionType: insertUser.subscriptionType || "1_month",
      subscriptionStartDate: insertUser.subscriptionStartDate || new Date(),
      subscriptionEndDate: insertUser.subscriptionEndDate ?? null,
      phoneNumber: insertUser.phoneNumber ?? null,
      gender: insertUser.gender ?? null,
      age: insertUser.age ?? null,
      height: insertUser.height ?? null,
      weight: insertUser.weight ?? null,
      goalWeight: insertUser.goalWeight ?? null,
      activityLevel: insertUser.activityLevel ?? null,
      fitnessGoal: insertUser.fitnessGoal ?? null,
      bio: insertUser.bio ?? null,
      nutritionPlan: insertUser.nutritionPlan ?? null,
      workoutPlan: insertUser.workoutPlan ?? null,
      profilePicture: insertUser.profilePicture ?? null
    };
    this.users.set(id, user);

    // Create initial daily stats for the user
    const dailyStatsId = this.dailyStatsIdCounter++;
    const dailyStats: DailyStats = {
      id: dailyStatsId,
      userId: id,
      date: now,
      calories: 0,
      caloriesGoal: 2200,
      protein: 0,
      proteinGoal: 140,
      carbs: 0,
      carbsGoal: 240,
      fat: 0,
      fatGoal: 60,
      fiber: 0,
      fiberGoal: 30,
      steps: 0,
      stepsGoal: 10000,
      water: 0,
      waterGoal: 8
    };

    this.dailyStats.set(dailyStatsId, dailyStats);

    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserSubscription(id: number, subscription: { subscriptionType: string; subscriptionStartDate?: Date; subscriptionEndDate?: Date }): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    // Calculate end date if not provided
    let endDate = subscription.subscriptionEndDate;
    if (!endDate && subscription.subscriptionStartDate) {
      const startDate = subscription.subscriptionStartDate;
      // Use the utility function for decimal month calculations
      const { calculateSubscriptionEndDate } = await import("@shared/subscriptionUtils");
      endDate = calculateSubscriptionEndDate(startDate, subscription.subscriptionType);
    }

    const updatedUser = {
      ...user,
      subscriptionType: subscription.subscriptionType,
      subscriptionStartDate: subscription.subscriptionStartDate || user.subscriptionStartDate,
      subscriptionEndDate: endDate || user.subscriptionEndDate
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getUsersByCoachId(coachId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.coachId === coachId,
    );
  }

  async getUsersByGymId(gymId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.gymId === gymId,
    );
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role === role,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Workout methods
  async getWorkout(id: number): Promise<Workout | undefined> {
    return this.workouts.get(id);
  }

  async getAllWorkouts(): Promise<Workout[]> {
    return Array.from(this.workouts.values());
  }

  async getWorkoutsByCoachId(coachId: number): Promise<Workout[]> {
    return Array.from(this.workouts.values()).filter(
      (workout) => workout.coachId === coachId,
    );
  }

  async createWorkout(workout: InsertWorkout): Promise<Workout> {
    const id = this.workoutIdCounter++;
    const createdWorkout: Workout = { ...workout, id };
    this.workouts.set(id, createdWorkout);
    return createdWorkout;
  }

  async updateWorkout(id: number, workoutData: Partial<Workout>): Promise<Workout | undefined> {
    const workout = this.workouts.get(id);
    if (!workout) return undefined;

    const updatedWorkout = { ...workout, ...workoutData };
    this.workouts.set(id, updatedWorkout);
    return updatedWorkout;
  }

  async deleteWorkout(id: number): Promise<boolean> {
    return this.workouts.delete(id);
  }

  // User Workouts methods
  async getUserWorkout(id: number): Promise<UserWorkout | undefined> {
    return this.userWorkouts.get(id);
  }

  async getUserWorkoutsByUserId(userId: number): Promise<UserWorkout[]> {
    return Array.from(this.userWorkouts.values()).filter(
      (userWorkout) => userWorkout.userId === userId,
    );
  }

  async getUserWorkouts(userId: number): Promise<UserWorkout[]> {
    return this.getUserWorkoutsByUserId(userId);
  }

  async getUserWorkoutsByDate(userId: number, date: Date): Promise<UserWorkout[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.userWorkouts.values()).filter(
      (userWorkout) =>
        userWorkout.userId === userId &&
        userWorkout.scheduledFor >= startOfDay &&
        userWorkout.scheduledFor <= endOfDay
    );
  }

  async createUserWorkout(userWorkout: InsertUserWorkout): Promise<UserWorkout> {
    const id = this.userWorkoutIdCounter++;
    const createdUserWorkout: UserWorkout = {
      ...userWorkout,
      id,
      completed: false,
      completedAt: null
    };
    this.userWorkouts.set(id, createdUserWorkout);
    return createdUserWorkout;
  }

  async updateUserWorkout(id: number, userWorkoutData: Partial<UserWorkout>): Promise<UserWorkout | undefined> {
    const userWorkout = this.userWorkouts.get(id);
    if (!userWorkout) return undefined;

    const updatedUserWorkout = { ...userWorkout, ...userWorkoutData };
    this.userWorkouts.set(id, updatedUserWorkout);
    return updatedUserWorkout;
  }

  async markUserWorkoutComplete(id: number, completedAt: Date): Promise<UserWorkout | undefined> {
    const userWorkout = this.userWorkouts.get(id);
    if (!userWorkout) return undefined;

    const updatedUserWorkout = {
      ...userWorkout,
      completed: true,
      completedAt
    };

    this.userWorkouts.set(id, updatedUserWorkout);
    return updatedUserWorkout;
  }

  async deleteUserWorkout(id: number): Promise<boolean> {
    return this.userWorkouts.delete(id);
  }

  // Meals methods
  async getMeal(id: number): Promise<Meal | undefined> {
    return this.meals.get(id);
  }

  async getMealsByUserId(userId: number): Promise<Meal[]> {
    return Array.from(this.meals.values()).filter(
      (meal) => meal.userId === userId,
    );
  }

  async getMealsByDate(userId: number, date: Date): Promise<Meal[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.meals.values()).filter(
      (meal) =>
        meal.userId === userId &&
        meal.date >= startOfDay &&
        meal.date <= endOfDay
    );
  }

  async getMealsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Meal[]> {
    return Array.from(this.meals.values()).filter(
      (meal) =>
        meal.userId === userId &&
        meal.date >= startDate &&
        meal.date <= endDate
    ).sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async createMeal(meal: InsertMeal): Promise<Meal> {
    const id = this.mealIdCounter++;
    const createdMeal: Meal = {
      ...meal,
      id,
      fiber: meal.fiber ?? null,
      foodItems: (meal as any).foodItems ?? null
    };
    this.meals.set(id, createdMeal);

    // Update daily stats
    await this.updateDailyStatsForMeal(meal);

    return createdMeal;
  }

  async updateMeal(id: number, mealData: Partial<Meal>): Promise<Meal | undefined> {
    const meal = this.meals.get(id);
    if (!meal) return undefined;

    const updatedMeal = { ...meal, ...mealData };
    this.meals.set(id, updatedMeal);

    // Update daily stats
    await this.recalculateDailyStats(meal.userId, meal.date);

    return updatedMeal;
  }

  async deleteMeal(id: number): Promise<boolean> {
    const meal = this.meals.get(id);
    if (!meal) return false;

    const result = this.meals.delete(id);

    // Update daily stats
    if (result) {
      await this.recalculateDailyStats(meal.userId, meal.date);
    }

    return result;
  }

  // Helper method to update daily stats when adding a meal
  private async updateDailyStatsForMeal(meal: InsertMeal): Promise<void> {
    const date = new Date(meal.date);
    date.setHours(0, 0, 0, 0);

    const stats = await this.getDailyStatsByUserAndDate(meal.userId, date);

    if (stats) {
      // Update existing stats
      await this.updateDailyStats(stats.id, {
        calories: (stats.calories || 0) + meal.calories,
        protein: (stats.protein || 0) + meal.proteins,
        carbs: (stats.carbs || 0) + meal.carbs,
        fat: (stats.fat || 0) + meal.fats,
        fiber: (stats.fiber || 0) + (meal.fiber || 0)
      });
    } else {
      // Create new stats
      await this.createDailyStats({
        userId: meal.userId,
        date,
        calories: meal.calories,
        caloriesGoal: 2200,
        protein: meal.proteins,
        proteinGoal: 140,
        carbs: meal.carbs,
        carbsGoal: 240,
        fat: meal.fats,
        fatGoal: 60,
        fiber: meal.fiber || 0,
        fiberGoal: 30,
        steps: 0,
        stepsGoal: 10000,
        water: 0,
        waterGoal: 8
      });
    }
  }

  // Helper method to recalculate daily stats after meal updates/deletions
  private async recalculateDailyStats(userId: number, mealDate: Date): Promise<void> {
    const date = new Date(mealDate);
    date.setHours(0, 0, 0, 0);

    const meals = await this.getMealsByDate(userId, date);

    const stats = await this.getDailyStatsByUserAndDate(userId, date);
    if (!stats) return;

    // Recalculate totals
    const totals = meals.reduce((acc, meal) => {
      return {
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.proteins,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fats,
        fiber: acc.fiber + (meal.fiber || 0)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    // Update stats
    await this.updateDailyStats(stats.id, {
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      fiber: totals.fiber
    });
  }

  // Progress methods
  async getProgress(id: number): Promise<Progress | undefined> {
    return this.progress.get(id);
  }

  async getProgressByUserId(userId: number): Promise<Progress[]> {
    return Array.from(this.progress.values())
      .filter(progress => progress.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getUserProgress(userId: number): Promise<Progress[]> {
    return this.getProgressByUserId(userId);
  }

  async getProgressByDate(userId: number, date: Date): Promise<Progress | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.progress.values()).find(
      (progress) =>
        progress.userId === userId &&
        progress.date >= startOfDay &&
        progress.date <= endOfDay
    );
  }

  async getProgressByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Progress[]> {
    return Array.from(this.progress.values())
      .filter(
        (progress) =>
          progress.userId === userId &&
          progress.date >= startDate &&
          progress.date <= endDate
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async createProgress(progressData: InsertProgress): Promise<Progress> {
    const id = this.progressIdCounter++;
    const createdProgress: Progress = {
      ...progressData,
      id,
      weight: progressData.weight ?? null,
      caloriesConsumed: progressData.caloriesConsumed ?? null,
      caloriesBurned: progressData.caloriesBurned ?? null,
      steps: progressData.steps ?? null,
      waterGlasses: progressData.waterGlasses ?? null,
      notes: progressData.notes ?? null
    };
    this.progress.set(id, createdProgress);

    // Update daily stats if needed
    const statsDate = new Date(progressData.date);
    statsDate.setHours(0, 0, 0, 0);

    const stats = await this.getDailyStatsByUserAndDate(progressData.userId, statsDate);
    if (stats) {
      const updates: Partial<DailyStats> = {};

      if (progressData.steps !== undefined) {
        updates.steps = progressData.steps;
      }

      if (progressData.waterGlasses !== undefined) {
        updates.water = progressData.waterGlasses;
      }

      if (Object.keys(updates).length > 0) {
        await this.updateDailyStats(stats.id, updates);
      }
    }

    return createdProgress;
  }

  async updateProgress(id: number, progressData: Partial<Progress>): Promise<Progress | undefined> {
    const progress = this.progress.get(id);
    if (!progress) return undefined;

    const updatedProgress = { ...progress, ...progressData };
    this.progress.set(id, updatedProgress);

    // Update daily stats if needed
    if (progressData.steps !== undefined || progressData.waterGlasses !== undefined) {
      const statsDate = new Date(progress.date);
      statsDate.setHours(0, 0, 0, 0);

      const stats = await this.getDailyStatsByUserAndDate(progress.userId, statsDate);
      if (stats) {
        const updates: Partial<DailyStats> = {};

        if (progressData.steps !== undefined) {
          updates.steps = progressData.steps;
        }

        if (progressData.waterGlasses !== undefined) {
          updates.water = progressData.waterGlasses;
        }

        if (Object.keys(updates).length > 0) {
          await this.updateDailyStats(stats.id, updates);
        }
      }
    }

    return updatedProgress;
  }

  async deleteProgress(id: number): Promise<boolean> {
    return this.progress.delete(id);
  }

  // Products methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      (product) => product.category === category,
    );
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const createdProduct: Product = {
      ...product,
      id,
      imageUrl: product.imageUrl ?? null,
      rating: product.rating ?? null,
      reviewCount: product.reviewCount ?? null
    };
    this.products.set(id, createdProduct);
    return createdProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updatedProduct = { ...product, ...productData };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Orders methods (in-memory implementation)
  async getOrder(id: number): Promise<Order | undefined> {
    return undefined; // Not implemented for in-memory storage
  }

  async getOrdersByUserId(userId: number): Promise<(Order & { items: OrderItem[] })[]> {
    return []; // Not implemented for in-memory storage
  }

  async getAllOrders(): Promise<(Order & { items: OrderItem[], user?: { id: number, username: string, firstName: string, lastName: string } })[]> {
    return []; // Not implemented for in-memory storage
  }

  async getOrderWithItems(id: number): Promise<(Order & { items: OrderItem[] }) | undefined> {
    return undefined; // Not implemented for in-memory storage
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    throw new Error("Orders not supported in in-memory storage");
  }

  async updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined> {
    return undefined; // Not implemented for in-memory storage
  }

  async deleteOrder(id: number): Promise<boolean> {
    return false; // Not implemented for in-memory storage
  }

  async getCartItems(userId: number): Promise<(CartItem & { product: Product })[]> {
    return []; // Not implemented for in-memory storage
  }

  async getCartItem(userId: number, productId: number): Promise<CartItem | undefined> {
    return undefined;
  }

  async upsertCartItem(userId: number, productId: number, quantity: number): Promise<CartItem> {
    throw new Error("Cart not supported in in-memory storage");
  }

  async removeCartItem(userId: number, productId: number): Promise<boolean> {
    return false;
  }

  async clearCart(userId: number): Promise<void> {
    return;
  }

  // Initialize some demo workouts
  private initializeWorkouts(): void {
    const workouts: InsertWorkout[] = [
      {
        name: "Full Body HIIT",
        description: "High-intensity interval training for full body conditioning",
        duration: 45,
        difficulty: "intermediate",
        type: "cardio",
        coachId: 0 as any, // No default coach assignment
        exercises: [
          { name: "Burpees", sets: 3, reps: "10-15", rest: "30s" },
          { name: "Mountain Climbers", sets: 3, reps: "20", rest: "30s" },
          { name: "Jump Squats", sets: 3, reps: "15", rest: "30s" },
          { name: "Push-ups", sets: 3, reps: "10-20", rest: "30s" }
        ]
      },
      {
        name: "Strength Training",
        description: "Progressive strength training for muscle building",
        duration: 60,
        difficulty: "intermediate",
        type: "strength",
        coachId: 0 as any,
        exercises: [
          { name: "Squats", sets: 4, reps: "8-12", rest: "90s" },
          { name: "Deadlifts", sets: 4, reps: "6-8", rest: "120s" },
          { name: "Bench Press", sets: 4, reps: "8-10", rest: "90s" },
          { name: "Pull-ups", sets: 3, reps: "5-10", rest: "90s" }
        ]
      },
      {
        name: "Cardio Blast",
        description: "Fat burning cardio workout",
        duration: 30,
        difficulty: "beginner",
        type: "cardio",
        coachId: 0 as any,
        exercises: [
          { name: "Jumping Jacks", sets: 3, reps: "30s", rest: "30s" },
          { name: "High Knees", sets: 3, reps: "30s", rest: "30s" },
          { name: "Butt Kicks", sets: 3, reps: "30s", rest: "30s" },
          { name: "Running in Place", sets: 3, reps: "30s", rest: "30s" }
        ]
      }
    ];

    workouts.forEach(workout => {
      const id = this.workoutIdCounter++;
      this.workouts.set(id, { ...workout, id });
    });
  }

  // Initialize some demo products
  private initializeProducts(): void {
    // Initialize demo products for the store
    const products: InsertProduct[] = [
      {
        name: "Premium Protein Powder",
        description: "High-quality protein powder with 24g of protein per serving. Helps muscle recovery and growth.",
        price: 39.99,
        imageUrl: "https://images.unsplash.com/photo-1594498653385-d5172c532c00?w=600&h=400&fit=crop",
        category: "supplements",
        rating: 4.5,
        reviewCount: 120,
        stock: 50
      },
      {
        name: "Resistance Bands Set",
        description: "Complete set of resistance bands for home workouts. Includes 5 different resistance levels.",
        price: 24.99,
        imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop",
        category: "equipment",
        rating: 4.0,
        reviewCount: 85,
        stock: 30
      },
      {
        name: "Smart Fitness Tracker",
        description: "Advanced fitness tracker that monitors heart rate, steps, sleep, and more. Syncs with our app.",
        price: 89.99,
        imageUrl: "https://images.unsplash.com/photo-1575311373937-040b8e1fd93b?w=600&h=400&fit=crop",
        category: "electronics",
        rating: 5.0,
        reviewCount: 42,
        stock: 15
      },
      {
        name: "Premium Yoga Mat",
        description: "Eco-friendly, non-slip yoga mat. Perfect for yoga, pilates, and floor exercises.",
        price: 34.99,
        imageUrl: "https://images.unsplash.com/photo-1603988363607-e1e4a66962c6?w=600&h=400&fit=crop",
        category: "equipment",
        rating: 4.5,
        reviewCount: 110,
        stock: 25
      },
      {
        name: "BCAAs Supplement",
        description: "Branch Chain Amino Acids supplement to support muscle recovery and reduce fatigue.",
        price: 29.99,
        imageUrl: "https://images.unsplash.com/photo-1593217188322-6dadcd86c75c?w=600&h=400&fit=crop",
        category: "supplements",
        rating: 4.3,
        reviewCount: 78,
        stock: 40
      },
      {
        name: "Adjustable Dumbbells Set",
        description: "Space-saving adjustable dumbbells that replace multiple sets. Ranges from 5-25 lbs each.",
        price: 149.99,
        imageUrl: "https://images.unsplash.com/photo-1580261450046-d0a30080dc9b?w=600&h=400&fit=crop",
        category: "equipment",
        rating: 4.8,
        reviewCount: 65,
        stock: 10
      }
    ];

    products.forEach(product => {
      const id = this.productIdCounter++;
      this.products.set(id, {
        ...product,
        id,
        imageUrl: product.imageUrl ?? null,
        rating: product.rating ?? null,
        reviewCount: product.reviewCount ?? null
      });
    });
  }

  // Initialize demo messages (empty by default - no hardcoded coach references)
  private initializeMessages(): void {
    const now = new Date();
    const messages: InsertMessage[] = [
      // No default demo messages
    ];

    messages.forEach((message, index) => {
      const id = this.messageIdCounter++;
      const sentAt = new Date(now.getTime() - (messages.length - index) * 60 * 60 * 1000); // Spread messages over hours
      this.messages.set(id, {
        ...message,
        id,
        sentAt,
        read: index < 3 // Mark first 3 as read
      });
    });
  }

  // Messages methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(
        (message) =>
          (message.senderId === userId1 && message.receiverId === userId2) ||
          (message.senderId === userId2 && message.receiverId === userId1)
      )
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }

  async getUserMessages(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(
        (message) => message.receiverId === userId || message.senderId === userId
      )
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    const createdMessage: Message = {
      ...message,
      id,
      sentAt: now,
      read: false
    };
    this.messages.set(id, createdMessage);
    return createdMessage;
  }

  async getMessagesByUserId(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (message) => message.senderId === userId || message.receiverId === userId
    ).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  async getUnreadMessagesByUserId(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (message) => message.receiverId === userId && !message.read
    ).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;

    const updatedMessage = { ...message, read: true };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  // Daily Stats methods
  async getDailyStats(id: number): Promise<DailyStats | undefined> {
    return this.dailyStats.get(id);
  }

  async getDailyStatsByUserAndDate(userId: number, date: Date): Promise<DailyStats | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.dailyStats.values()).find(
      (stats) =>
        stats.userId === userId &&
        stats.date >= startOfDay &&
        stats.date <= endOfDay
    );
  }

  async getDailyStatsByUserId(userId: number): Promise<DailyStats[]> {
    return Array.from(this.dailyStats.values()).filter(
      (stats) => stats.userId === userId
    ).sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getDailyStatsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<DailyStats[]> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return Array.from(this.dailyStats.values())
      .filter(stats =>
        stats.userId === userId &&
        stats.date >= start &&
        stats.date <= end
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  async createDailyStats(stats: InsertDailyStats): Promise<DailyStats> {
    const id = this.dailyStatsIdCounter++;
    const createdStats: DailyStats = {
      id,
      userId: stats.userId,
      date: stats.date,
      calories: stats.calories ?? null,
      caloriesGoal: stats.caloriesGoal ?? null,
      protein: stats.protein ?? null,
      proteinGoal: stats.proteinGoal ?? null,
      carbs: stats.carbs ?? null,
      carbsGoal: stats.carbsGoal ?? null,
      fat: stats.fat ?? null,
      fatGoal: stats.fatGoal ?? null,
      fiber: stats.fiber ?? null,
      fiberGoal: stats.fiberGoal ?? null,
      steps: stats.steps ?? null,
      stepsGoal: stats.stepsGoal ?? null,
      water: stats.water ?? null,
      waterGoal: stats.waterGoal ?? null
    };
    this.dailyStats.set(id, createdStats);
    return createdStats;
  }

  async updateDailyStats(id: number, statsData: Partial<DailyStats>): Promise<DailyStats | undefined> {
    const stats = this.dailyStats.get(id);
    if (!stats) return undefined;

    const updatedStats = { ...stats, ...statsData };
    this.dailyStats.set(id, updatedStats);
    return updatedStats;
  }

  async getWeeklyStats(userId: number, startDate: Date): Promise<DailyStats[]> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    return Array.from(this.dailyStats.values())
      .filter(
        (stats) =>
          stats.userId === userId &&
          stats.date >= startDate &&
          stats.date <= endDate
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async updateUserDailyStatsGoals(userId: number, goals: { caloriesGoal: number; proteinGoal: number; carbsGoal: number; fatGoal: number }): Promise<void> {
    Array.from(this.dailyStats.entries()).forEach(([id, stats]) => {
      if (stats.userId !== userId) return;
      this.dailyStats.set(id, {
        ...stats,
        caloriesGoal: goals.caloriesGoal,
        proteinGoal: goals.proteinGoal,
        carbsGoal: goals.carbsGoal,
        fatGoal: goals.fatGoal
      });
    });
  }

  // User Plans methods
  async getUserPlan(id: number): Promise<UserPlan | undefined> {
    return this.userPlans.get(id);
  }

  async getUserPlansByUserId(userId: number): Promise<UserPlan[]> {
    return Array.from(this.userPlans.values())
      .filter(plan => plan.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getLatestUserPlan(userId: number): Promise<UserPlan | undefined> {
    const plans = await this.getUserPlansByUserId(userId);
    return plans.length > 0 ? plans[0] : undefined;
  }

  async createUserPlan(plan: InsertUserPlan): Promise<UserPlan> {
    const id = this.userPlanIdCounter++;
    const now = new Date();
    const createdPlan: UserPlan = {
      ...plan,
      id,
      createdAt: now,
      updatedAt: now,
      weeklyFocus: plan.weeklyFocus ?? null,
      goals: (plan as any).goals ?? null,
      weeklySchedule: (plan as any).weeklySchedule ?? null
    };
    this.userPlans.set(id, createdPlan);
    return createdPlan;
  }

  async updateUserPlan(id: number, planData: Partial<UserPlan>): Promise<UserPlan | undefined> {
    const plan = this.userPlans.get(id);
    if (!plan) return undefined;

    const now = new Date();
    const updatedPlan = { ...plan, ...planData, updatedAt: now };
    this.userPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async deleteUserPlan(id: number): Promise<boolean> {
    return this.userPlans.delete(id);
  }

  // Content Library methods
  async getContentLibraryItem(id: number): Promise<ContentLibrary | undefined> {
    return this.contentLibrary.get(id);
  }

  async getAllContentLibrary(): Promise<ContentLibrary[]> {
    return Array.from(this.contentLibrary.values());
  }

  async getContentLibraryByCoachId(coachId: number): Promise<ContentLibrary[]> {
    return Array.from(this.contentLibrary.values()).filter(item => item.coachId === coachId);
  }

  async getContentLibraryByCategory(coachId: number | null, category: string): Promise<ContentLibrary[]> {
    return Array.from(this.contentLibrary.values()).filter(
      item => (coachId === null || item.coachId === coachId) && item.category === category
    );
  }

  async getContentLibraryByType(coachId: number | null, type: string): Promise<ContentLibrary[]> {
    return Array.from(this.contentLibrary.values()).filter(
      item => (coachId === null || item.coachId === coachId) && item.type === type
    );
  }

  async searchContentLibrary(coachId: number | null, query: string): Promise<ContentLibrary[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.contentLibrary.values()).filter(
      item =>
        (coachId === null || item.coachId === coachId) &&
        (item.title.toLowerCase().includes(lowerQuery) ||
         item.description?.toLowerCase().includes(lowerQuery) ||
         (item.tags ?? []).some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }

  async createContentLibraryItem(content: InsertContentLibrary): Promise<ContentLibrary> {
    const id = this.contentLibraryIdCounter++;
    const now = new Date();
    const createdContent: ContentLibrary = {
      ...content,
      id,
      createdAt: now,
      updatedAt: now,
      description: content.description ?? null,
      duration: content.duration ?? null,
      thumbnailUrl: content.thumbnailUrl ?? null,
      tags: content.tags ?? []
    };
    this.contentLibrary.set(id, createdContent);
    return createdContent;
  }

  async updateContentLibraryItem(id: number, contentData: Partial<ContentLibrary>): Promise<ContentLibrary | undefined> {
    const content = this.contentLibrary.get(id);
    if (!content) return undefined;

    const now = new Date();
    const updatedContent = { ...content, ...contentData, updatedAt: now };
    this.contentLibrary.set(id, updatedContent);
    return updatedContent;
  }

  async deleteContentLibraryItem(id: number): Promise<boolean> {
    return this.contentLibrary.delete(id);
  }

  // Content Categories methods
  async getContentCategory(id: number): Promise<ContentCategory | undefined> {
    return this.contentCategories.get(id);
  }

  async getAllContentCategories(): Promise<ContentCategory[]> {
    return Array.from(this.contentCategories.values())
      .filter(cat => cat.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }

  async createContentCategory(category: InsertContentCategory): Promise<ContentCategory> {
    const id = this.contentCategoryIdCounter++;
    const now = new Date();
    const createdCategory: ContentCategory = {
      ...category,
      id,
      createdAt: now,
      updatedAt: now,
      description: category.description ?? null,
      isActive: category.isActive ?? true,
      displayOrder: category.displayOrder ?? 0
    };
    this.contentCategories.set(id, createdCategory);
    return createdCategory;
  }

  async updateContentCategory(id: number, categoryData: Partial<ContentCategory>): Promise<ContentCategory | undefined> {
    const category = this.contentCategories.get(id);
    if (!category) return undefined;

    const now = new Date();
    const updatedCategory = { ...category, ...categoryData, updatedAt: now };
    this.contentCategories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteContentCategory(id: number): Promise<boolean> {
    // Soft delete by setting isActive to false
    const category = this.contentCategories.get(id);
    if (!category) return false;
    
    const now = new Date();
    const updatedCategory = { ...category, isActive: false, updatedAt: now };
    this.contentCategories.set(id, updatedCategory);
    return true;
  }

  // Workout Sessions methods
  async getWorkoutSession(id: number): Promise<WorkoutSession | undefined> {
    return this.workoutSessions.get(id);
  }

  async getWorkoutSessionsByUserId(userId: number): Promise<WorkoutSession[]> {
    return Array.from(this.workoutSessions.values()).filter(
      session => session.userId === userId
    ).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  async getWorkoutSessionsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<WorkoutSession[]> {
    return Array.from(this.workoutSessions.values()).filter(
      session =>
        session.userId === userId &&
        session.completedAt >= startDate &&
        session.completedAt <= endDate
    ).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  async createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession> {
    const id = this.workoutSessionIdCounter++;
    const now = new Date();
    const createdSession: WorkoutSession = {
      ...session,
      id,
      completedAt: now,
      duration: session.duration ?? null,
      exercises: (session as any).exercises ?? null,
      workoutId: session.workoutId ?? null,
      notes: session.notes ?? null,
      totalSets: session.totalSets ?? null,
      completedSets: session.completedSets ?? null
    };
    this.workoutSessions.set(id, createdSession);
    return createdSession;
  }

  async updateWorkoutSession(id: number, sessionData: Partial<WorkoutSession>): Promise<WorkoutSession | undefined> {
    const session = this.workoutSessions.get(id);
    if (!session) return undefined;

    const updatedSession = { ...session, ...sessionData };
    this.workoutSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteWorkoutSession(id: number): Promise<boolean> {
    return this.workoutSessions.delete(id);
  }

  // Coach Invitation methods
  async createCoachInvitation(invitation: InsertCoachInvitation): Promise<CoachInvitation> {
    const id = this.coachInvitationIdCounter++;
    const now = new Date();
    const createdInvitation: CoachInvitation = {
      ...invitation,
      id,
      invitedAt: now,
      respondedAt: null,
      status: "pending",
      userMessage: invitation.userMessage ?? null
    };
    this.coachInvitations.set(id, createdInvitation);
    return createdInvitation;
  }

  async getCoachInvitation(id: number): Promise<CoachInvitation | undefined> {
    return this.coachInvitations.get(id);
  }

  async getCoachInvitationsByCoachId(coachId: number): Promise<(CoachInvitation & { userName: string, userWhatsapp: string })[]> {
    // This is a simulation for MemStorage, as it doesn't have join capabilities.
    // In a real scenario, you'd join with the users table.
    const coachInvites = Array.from(this.coachInvitations.values()).filter(inv => inv.coachId === coachId);
    return coachInvites.map(inv => ({
      ...inv,
      userName: `User ${inv.userId}`, // Placeholder
      userWhatsapp: `+000000000` // Placeholder
    }));
  }

  async getCoachInvitationsByUserId(userId: number): Promise<(CoachInvitation & { coachName: string, coachWhatsapp: string })[]> {
    // This is a simulation for MemStorage, as it doesn't have join capabilities.
    // In a real scenario, you'd join with the users table.
    const userInvites = Array.from(this.coachInvitations.values()).filter(inv => inv.userId === userId);
    return userInvites.map(inv => ({
      ...inv,
      coachName: `Coach ${inv.coachId}`, // Placeholder
      coachWhatsapp: `+000000000` // Placeholder
    }));
  }

  async updateCoachInvitation(id: number, updates: Partial<CoachInvitation>): Promise<CoachInvitation | undefined> {
    const invitation = this.coachInvitations.get(id);
    if (!invitation) return undefined;

    const updatedInvitation = { ...invitation, ...updates, respondedAt: new Date() };
    this.coachInvitations.set(id, updatedInvitation);
    return updatedInvitation;
  }

  async deleteCoachInvitation(id: number): Promise<boolean> {
    return this.coachInvitations.delete(id);
  }

  // Coach Info methods
  async getCoachInfo(coachId: number): Promise<CoachInfo | undefined> {
    // Use index for O(1) lookup
    const infoId = this.coachInfoByCoachId.get(coachId);
    if (!infoId) return undefined;
    return this.coachInfoMap.get(infoId);
  }

  async createCoachInfo(info: InsertCoachInfo): Promise<CoachInfo> {
    const id = this.coachInfoIdCounter++;
    const now = new Date();
    const newInfo: CoachInfo = {
      id,
      coachId: info.coachId,
      aboutMe: info.aboutMe ?? null,
      qualifications: info.qualifications ?? null,
      trainingApproach: info.trainingApproach ?? null,
      successStories: info.successStories ?? null,
      servicesAndPrograms: info.servicesAndPrograms ?? null,
      contact: info.contact ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.coachInfoMap.set(id, newInfo);
    this.coachInfoByCoachId.set(info.coachId, id);
    return newInfo;
  }

  async updateCoachInfo(coachId: number, updates: Partial<CoachInfo>): Promise<CoachInfo | undefined> {
    const existing = await this.getCoachInfo(coachId);
    if (!existing) return undefined;

    const updated: CoachInfo = {
      ...existing,
      ...updates,
      coachId: existing.coachId,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.coachInfoMap.set(existing.id, updated);
    return updated;
  }

  // Coach Products methods
  async getCoachProduct(id: number): Promise<CoachProduct | undefined> {
    return this.coachProductsMap.get(id);
  }

  async getCoachProductsByCoachId(coachId: number): Promise<CoachProduct[]> {
    const productIds = this.coachProductsByCoachId.get(coachId) || [];
    return productIds
      .map(id => this.coachProductsMap.get(id))
      .filter((p): p is CoachProduct => p !== undefined);
  }

  async createCoachProduct(product: InsertCoachProduct): Promise<CoachProduct> {
    const id = this.coachProductsIdCounter++;
    const now = new Date();
    const newProduct: CoachProduct = {
      id,
      coachId: product.coachId,
      title: product.title,
      url: product.url,
      description: product.description ?? null,
      thumbnailUrl: product.thumbnailUrl ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.coachProductsMap.set(id, newProduct);
    
    // Add to coach's product list
    const existingIds = this.coachProductsByCoachId.get(product.coachId) || [];
    this.coachProductsByCoachId.set(product.coachId, [...existingIds, id]);
    
    return newProduct;
  }

  async updateCoachProduct(id: number, updates: Partial<CoachProduct>): Promise<CoachProduct | undefined> {
    const existing = this.coachProductsMap.get(id);
    if (!existing) return undefined;

    const updated: CoachProduct = {
      ...existing,
      ...updates,
      id: existing.id,
      coachId: existing.coachId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.coachProductsMap.set(id, updated);
    return updated;
  }

  async deleteCoachProduct(id: number): Promise<boolean> {
    const product = this.coachProductsMap.get(id);
    if (!product) return false;

    // Remove from coach's product list
    const existingIds = this.coachProductsByCoachId.get(product.coachId) || [];
    this.coachProductsByCoachId.set(
      product.coachId,
      existingIds.filter(pid => pid !== id)
    );

    return this.coachProductsMap.delete(id);
  }

  // Affiliate Products methods
  async getAffiliateProduct(id: number): Promise<AffiliateProduct | undefined> {
    return this.affiliateProductsMap.get(id);
  }

  async getAllAffiliateProducts(): Promise<AffiliateProduct[]> {
    return Array.from(this.affiliateProductsMap.values());
  }

  async getActiveAffiliateProducts(): Promise<AffiliateProduct[]> {
    return Array.from(this.affiliateProductsMap.values()).filter(p => p.isActive);
  }

  async createAffiliateProduct(product: InsertAffiliateProduct): Promise<AffiliateProduct> {
    const id = this.affiliateProductsIdCounter++;
    const now = new Date();
    const newProduct: AffiliateProduct = {
      id,
      title: product.title,
      url: product.url,
      description: product.description ?? null,
      thumbnailUrl: product.thumbnailUrl ?? null,
      category: product.category ?? null,
      source: product.source ?? null,
      isActive: product.isActive ?? true,
      lastScrapedAt: null,
      scrapeEnabled: null,
      createdAt: now,
      updatedAt: now,
    };
    this.affiliateProductsMap.set(id, newProduct);
    return newProduct;
  }

  async updateAffiliateProduct(id: number, updates: Partial<AffiliateProduct>): Promise<AffiliateProduct | undefined> {
    const existing = this.affiliateProductsMap.get(id);
    if (!existing) return undefined;

    const updated: AffiliateProduct = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    this.affiliateProductsMap.set(id, updated);
    return updated;
  }

  async deleteAffiliateProduct(id: number): Promise<boolean> {
    return this.affiliateProductsMap.delete(id);
  }

  // Affiliate Categories methods (stub for MemStorage)
  async getAllAffiliateCategories(): Promise<AffiliateCategory[]> {
    throw new Error("MemStorage not implemented for affiliate categories");
  }

  async getActiveAffiliateCategories(): Promise<AffiliateCategory[]> {
    throw new Error("MemStorage not implemented for affiliate categories");
  }

  async getAffiliateCategoryById(id: number): Promise<AffiliateCategory | undefined> {
    throw new Error("MemStorage not implemented for affiliate categories");
  }

  async createAffiliateCategory(category: InsertAffiliateCategory): Promise<AffiliateCategory> {
    throw new Error("MemStorage not implemented for affiliate categories");
  }

  async updateAffiliateCategory(id: number, category: Partial<AffiliateCategory>): Promise<AffiliateCategory | undefined> {
    throw new Error("MemStorage not implemented for affiliate categories");
  }

  async deleteAffiliateCategory(id: number): Promise<boolean> {
    throw new Error("MemStorage not implemented for affiliate categories");
  }

  // Scraped Affiliate Products methods (stub for MemStorage)
  async getScrapedProductsByAffiliateId(affiliateProductId: number): Promise<ScrapedAffiliateProduct[]> {
    throw new Error("MemStorage not implemented for scraped products");
  }

  async getAllScrapedProducts(): Promise<ScrapedAffiliateProduct[]> {
    throw new Error("MemStorage not implemented for scraped products");
  }

  async scrapeAffiliateProduct(affiliateProductId: number): Promise<{ count: number } | null> {
    throw new Error("MemStorage not implemented for scraping");
  }

  async scrapeAllAffiliateProducts(): Promise<{ success: number; failed: number }> {
    throw new Error("MemStorage not implemented for scraping");
  }

  // User Points and Streaks methods (stub implementations for MemStorage)
  async getUserPointsAndStreaks(userId: number): Promise<UserPointsAndStreaks | undefined> {
    throw new Error("MemStorage not implemented for points and streaks");
  }

  async createUserPointsAndStreaks(data: InsertUserPointsAndStreaks): Promise<UserPointsAndStreaks> {
    throw new Error("MemStorage not implemented for points and streaks");
  }

  async updateUserPointsAndStreaks(userId: number, data: Partial<UserPointsAndStreaks>): Promise<UserPointsAndStreaks | undefined> {
    throw new Error("MemStorage not implemented for points and streaks");
  }

  async addPoints(userId: number, points: number, actionType: string): Promise<UserPointsAndStreaks | undefined> {
    throw new Error("MemStorage not implemented for points and streaks");
  }

  async updateStreak(userId: number, hasActivity: boolean): Promise<UserPointsAndStreaks | undefined> {
    throw new Error("MemStorage not implemented for points and streaks");
  }

  async getCreditBalance(userId: number): Promise<CreditBalance | undefined> {
    throw new Error("MemStorage not implemented for credit balances");
  }

  async incrementCreditBalance(userId: number, credits: number): Promise<CreditBalance> {
    throw new Error("MemStorage not implemented for credit balances");
  }

  async createCreditTransaction(tx: InsertCreditTransaction): Promise<CreditTransaction> {
    throw new Error("MemStorage not implemented for credit transactions");
  }

  async updateCreditTransaction(id: number, update: Partial<CreditTransaction>): Promise<CreditTransaction | undefined> {
    throw new Error("MemStorage not implemented for credit transactions");
  }

  async getCreditTransactionByReference(reference: string): Promise<CreditTransaction | undefined> {
    throw new Error("MemStorage not implemented for credit transactions");
  }

  async getCreditTransactionsByUser(userId: number, limit: number = 20): Promise<CreditTransaction[]> {
    throw new Error("MemStorage not implemented for credit transactions");
  }

  async finalizeCreditTransaction(
    merchantReferenceId: string,
    update: {
      status: string;
      gatewayStatus?: string | null;
      responseCode?: string | null;
      orderId?: string | null;
      signatureValid?: boolean;
      signatureHeader?: string | null;
      callbackPayload?: unknown;
      errorMessage?: string | null;
      credited: boolean;
    }
  ): Promise<CreditTransaction | undefined> {
    throw new Error("MemStorage not implemented for credit transactions");
  }

  async getTrackingSettings(): Promise<TrackingSettings | undefined> {
    return this.trackingSettings ?? undefined;
  }

  async upsertTrackingSettings(data: Partial<InsertTrackingSettings>): Promise<TrackingSettings> {
    const now = new Date();

    if (this.trackingSettings) {
      this.trackingSettings = {
        ...this.trackingSettings,
        ...data,
        updatedAt: now,
      };
    } else {
      const base: TrackingSettings = {
        id: 1,
        metaPixelId: null,
        metaPixelAccessToken: null,
        metaPixelTestEventCode: null,
        googleAdsConversionId: null,
        googleAdsConversionLabel: null,
        googleAdsSendTo: null,
        googleAnalyticsMeasurementId: null,
        googleAnalyticsApiSecret: null,
        googleAnalyticsStreamId: null,
        googleAnalyticsPropertyId: null,
        updatedByUserId: null,
        createdAt: now,
        updatedAt: now,
      };

      this.trackingSettings = {
        ...base,
        ...data,
      };
    }

    return this.trackingSettings;
  }
}

export class DatabaseStorage implements IStorage {
  private db = db;

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username));
      return result[0] || undefined;
    } catch (err) {
      console.error('[DB] getUserByUsername failed', { username, err });
      throw err;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email));
      return result[0] || undefined;
    } catch (err) {
      console.error('[DB] getUserByEmail failed', { email, err });
      throw err;
    }
  }

  async getUserByWhatsappWithCode(whatsappWithCode: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.whatsappWithCode, whatsappWithCode));
      return result[0] || undefined;
    } catch (err) {
      console.error('[DB] getUserByWhatsappWithCode failed', { whatsappWithCode, err });
      throw err;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const identity = normalizeUserIdentity(insertUser);
      const result = await db
        .insert(users)
        .values({
          ...insertUser,
          username: identity.username,
          email: identity.email,
          role: insertUser.role || "user",
          coachId: insertUser.coachId ?? null,
          gymId: insertUser.gymId ?? null
        })
        .returning();
      const user = (result as unknown as User[])[0];

      // Create initial daily stats for the user
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await db.insert(dailyStats).values({
        userId: user.id,
        date: today,
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        fiber: 0,
        steps: 0,
        caloriesGoal: 2000,
        carbsGoal: 250,
        proteinGoal: 150,
        fatGoal: 65,
        fiberGoal: 30,
        stepsGoal: 10000,
        water: 0,
        waterGoal: 8
      });
      return user;
    } catch (err: any) {
      console.error('[DB] createUser failed', {
        message: err?.message,
        code: err?.code,
        detail: err?.detail,
        constraint: err?.constraint
      });
      throw err;
    }
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserSubscription(id: number, subscription: { subscriptionType: string; subscriptionStartDate?: Date; subscriptionEndDate?: Date }): Promise<User | undefined> {
    // Calculate end date based on subscription type and start date
    let endDate = subscription.subscriptionEndDate;
    const startDate = subscription.subscriptionStartDate || new Date();

    if (!endDate) {
      // Use the utility function for decimal month calculations
      const { calculateSubscriptionEndDate } = await import("@shared/subscriptionUtils");
      try {
        endDate = calculateSubscriptionEndDate(startDate, subscription.subscriptionType);
      } catch (error) {
        // Fallback to 1 month if invalid format
        endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        subscriptionType: subscription.subscriptionType,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getUsersByCoachId(coachId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.coachId, coachId));
  }

  async getUsersByGymId(gymId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.gymId, gymId));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // Delete in order to respect foreign key constraints
      
      // STEP 1: Set NULL on self-referencing columns in users table
      await db.update(users).set({ approvedBy: null }).where(eq(users.approvedBy, id));
      await db.update(users).set({ coachId: null }).where(eq(users.coachId, id));
      await db.update(users).set({ gymId: null }).where(eq(users.gymId, id));

      // STEP 2: Delete user_plans where this user is the coach (coachId is NOT NULL)
      await db.delete(userPlans).where(eq(userPlans.coachId, id));

      // STEP 3: Delete group challenges created by this user (notNull constraint prevents SET NULL)
      await db.delete(groupChallenges).where(eq(groupChallenges.createdBy, id));

      // STEP 4: Delete challenge participations
      await db.delete(challengeParticipants).where(eq(challengeParticipants.userId, id));

      // 1. Delete user workouts (references users and workouts)
      await db.delete(userWorkouts).where(eq(userWorkouts.userId, id));

      // 2. Delete workout sessions (references users)
      await db.delete(workoutSessions).where(eq(workoutSessions.userId, id));

      // 3. Delete meals (references users)
      await db.delete(meals).where(eq(meals.userId, id));

      // 4. Delete progress records (references users)
      await db.delete(progress).where(eq(progress.userId, id));

      // 5. Delete daily stats (references users)
      await db.delete(dailyStats).where(eq(dailyStats.userId, id));

      // 6. Delete user plans (references users)
      await db.delete(userPlans).where(eq(userPlans.userId, id));

      // 7. Delete messages where user is sender or receiver
      await db.delete(messages).where(or(
        eq(messages.senderId, id),
        eq(messages.receiverId, id)
      ));

      // 8. Delete workouts created by this coach (if they are a coach)
      await db.delete(workouts).where(eq(workouts.coachId, id));

      // 9. Delete content library items created by this coach
      await db.delete(contentLibrary).where(eq(contentLibrary.coachId, id));

      // 10. Delete coach invitations sent by this user
      await db.delete(coachInvitations).where(eq(coachInvitations.userId, id));

      // 11. Delete coach invitations sent to this coach
      await db.delete(coachInvitations).where(eq(coachInvitations.coachId, id));

      // 12. Delete coach info and products (if they are a coach)
      await db.delete(coachProducts).where(eq(coachProducts.coachId, id));
      await db.delete(coachInfo).where(eq(coachInfo.coachId, id));

      // 13. Delete user logins tracking
      await db.delete(userLogins).where(eq(userLogins.userId, id));

      // 14. Delete cart items for this user
      await db.delete(cartItems).where(eq(cartItems.userId, id));

      // 15. Delete order items for orders belonging to this user
      const userOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, id));
      const orderIds = userOrders.map(o => o.id);
      if (orderIds.length > 0) {
        await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      }

      // 16. Delete orders for this user
      await db.delete(orders).where(eq(orders.userId, id));

      // 17. Delete credit transactions and balances
      await db.delete(creditTransactions).where(eq(creditTransactions.userId, id));
      await db.delete(creditBalances).where(eq(creditBalances.userId, id));

      // 18. Delete user points and streaks
      await db.delete(userPointsAndStreaks).where(eq(userPointsAndStreaks.userId, id));

      // 19. Finally delete the user
      const result = await db.delete(users).where(eq(users.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting user and related data:', error);
      return false;
    }
  }

  async getWorkout(id: number): Promise<Workout | undefined> {
    const [workout] = await db.select().from(workouts).where(eq(workouts.id, id));
    return workout || undefined;
  }

  async getAllWorkouts(): Promise<Workout[]> {
    return db.select().from(workouts);
  }

  async getWorkoutsByCoachId(coachId: number): Promise<Workout[]> {
    return db.select().from(workouts).where(eq(workouts.coachId, coachId));
  }

  async createWorkout(workout: InsertWorkout): Promise<Workout> {
    const [createdWorkout] = await db
      .insert(workouts)
      .values(workout)
      .returning();
    return createdWorkout;
  }

  async updateWorkout(id: number, workoutData: Partial<Workout>): Promise<Workout | undefined> {
    const [updatedWorkout] = await db
      .update(workouts)
      .set(workoutData)
      .where(eq(workouts.id, id))
      .returning();
    return updatedWorkout || undefined;
  }

  async deleteWorkout(id: number): Promise<boolean> {
    const result = await db
      .delete(workouts)
      .where(eq(workouts.id, id));
    return true; // In PostgreSQL, success doesn't return a count
  }

  async getUserWorkout(id: number): Promise<UserWorkout | undefined> {
    const [userWorkout] = await db.select().from(userWorkouts).where(eq(userWorkouts.id, id));
    return userWorkout || undefined;
  }

  async getUserWorkoutsByUserId(userId: number): Promise<UserWorkout[]> {
    return db.select().from(userWorkouts).where(eq(userWorkouts.userId, userId));
  }

  async getUserWorkoutsByDate(userId: number, date: Date): Promise<UserWorkout[]> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    return db
      .select()
      .from(userWorkouts)
      .where(
        and(
          eq(userWorkouts.userId, userId),
          gte(userWorkouts.scheduledFor, startDate),
          lte(userWorkouts.scheduledFor, endDate)
        )
      );
  }

  async createUserWorkout(userWorkout: InsertUserWorkout): Promise<UserWorkout> {
    const [createdUserWorkout] = await db
      .insert(userWorkouts)
      .values(userWorkout)
      .returning();
    return createdUserWorkout;
  }

  async updateUserWorkout(id: number, userWorkoutData: Partial<UserWorkout>): Promise<UserWorkout | undefined> {
    const [updatedUserWorkout] = await db
      .update(userWorkouts)
      .set(userWorkoutData)
      .where(eq(userWorkouts.id, id))
      .returning();
    return updatedUserWorkout || undefined;
  }

  async markUserWorkoutComplete(id: number, completedAt: Date): Promise<UserWorkout | undefined> {
    const [updatedUserWorkout] = await db
      .update(userWorkouts)
      .set({ completedAt, completed: true })
      .where(eq(userWorkouts.id, id))
      .returning();
    return updatedUserWorkout || undefined;
  }

  async deleteUserWorkout(id: number): Promise<boolean> {
    await db
      .delete(userWorkouts)
      .where(eq(userWorkouts.id, id));
    return true;
  }

  async getMeal(id: number): Promise<Meal | undefined> {
    const [meal] = await db.select().from(meals).where(eq(meals.id, id));
    return meal || undefined;
  }

  async getMealsByUserId(userId: number): Promise<Meal[]> {
    return db.select().from(meals).where(eq(meals.userId, userId));
  }

  async getMealsByDate(userId: number, date: Date): Promise<Meal[]> {
    // Convert the input date to start and end of day for proper comparison
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return db
      .select()
      .from(meals)
      .where(
        and(
          eq(meals.userId, userId),
          gte(meals.date, startOfDay),
          lte(meals.date, endOfDay)
        )
      );
  }

  async getMealsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Meal[]> {
    return db
      .select()
      .from(meals)
      .where(
        and(
          eq(meals.userId, userId),
          gte(meals.date, startDate),
          lte(meals.date, endDate)
        )
      )
      .orderBy(desc(meals.date));
  }

  async createMeal(meal: InsertMeal): Promise<Meal> {
    const [createdMeal] = await db
      .insert(meals)
      .values(meal)
      .returning();

    // Update daily stats
    await this.updateDailyStatsForMeal(meal);

    return createdMeal;
  }

  async updateMeal(id: number, mealData: Partial<Meal>): Promise<Meal | undefined> {
    try {
      const originalMeal = await this.getMeal(id);
      if (!originalMeal) return undefined;

      console.log("Updating meal with data:", JSON.stringify(mealData, null, 2));

      const [updatedMeal] = await db
        .update(meals)
        .set(mealData)
        .where(eq(meals.id, id))
        .returning();

      console.log("Updated meal result:", JSON.stringify(updatedMeal, null, 2));

      // Recalculate stats
      if (updatedMeal) {
        await this.recalculateDailyStats(updatedMeal.userId, updatedMeal.date);
      }

      return updatedMeal || undefined;
    } catch (error) {
      console.error("Database error in updateMeal:", error);
      throw error;
    }
  }

  async deleteMeal(id: number): Promise<boolean> {
    const meal = await this.getMeal(id);
    if (!meal) return false;

    await db
      .delete(meals)
      .where(eq(meals.id, id));

    // Recalculate stats after deletion
    await this.recalculateDailyStats(meal.userId, meal.date);

    return true;
  }

  private async updateDailyStatsForMeal(meal: InsertMeal): Promise<void> {
    const date = new Date(meal.date);
    date.setHours(0, 0, 0, 0);

    // Find or create daily stats for this date
    let stats = await this.getDailyStatsByUserAndDate(meal.userId, date);

    if (!stats) {
      // Create new daily stats if none exist
      stats = await this.createDailyStats({
        userId: meal.userId,
        date,
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        fiber: 0,
        steps: 0,
        caloriesGoal: 2000,
        carbsGoal: 250,
        proteinGoal: 150,
        fatGoal: 65,
        fiberGoal: 30,
        stepsGoal: 10000,
        water: 0,
        waterGoal: 8
      });
    }

    // Update the stats with the new meal data
    await db
      .update(dailyStats)
      .set({
        calories: (stats.calories || 0) + meal.calories,
        carbs: (stats.carbs || 0) + meal.carbs,
        protein: (stats.protein || 0) + meal.proteins,
        fat: (stats.fat || 0) + meal.fats,
        fiber: (stats.fiber || 0) + (meal.fiber || 0)
      })
      .where(eq(dailyStats.id, stats.id));
  }

  private async recalculateDailyStats(userId: number, mealDate: Date): Promise<void> {
    const date = new Date(mealDate);
    date.setHours(0, 0, 0, 0);

    // Get all meals for this user and date
    const userMeals = await this.getMealsByDate(userId, date);

    // Calculate totals
    const totals = userMeals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        carbs: acc.carbs + meal.carbs,
        proteins: acc.proteins + meal.proteins,
        fats: acc.fats + meal.fats,
        fiber: acc.fiber + (meal.fiber || 0)
      }),
      { calories: 0, carbs: 0, proteins: 0, fats: 0, fiber: 0 }
    );

    // Get daily stats
    const stats = await this.getDailyStatsByUserAndDate(userId, date);

    if (stats) {
      // Update daily stats with new totals
      await db
        .update(dailyStats)
        .set({
          calories: totals.calories,
          carbs: totals.carbs,
          protein: totals.proteins,
          fat: totals.fats,
          fiber: totals.fiber
        })
        .where(eq(dailyStats.id, stats.id));
    }
  }

  async getProgress(id: number): Promise<Progress | undefined> {
    const [progressRecord] = await db.select().from(progress).where(eq(progress.id, id));
    return progressRecord || undefined;
  }

  async getProgressByUserId(userId: number): Promise<Progress[]> {
    return db.select().from(progress).where(eq(progress.userId, userId));
  }

  async getProgressByDate(userId: number, date: Date): Promise<Progress | undefined> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const [userProgress] = await db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.userId, userId),
          gte(progress.date, startDate),
          lte(progress.date, endDate)
        )
      );

    return userProgress || undefined;
  }

  async getProgressByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Progress[]> {
    return db
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.userId, userId),
          gte(progress.date, startDate),
          lte(progress.date, endDate)
        )
      )
      .orderBy(progress.date);
  }

  async createProgress(progressData: InsertProgress): Promise<Progress> {
    const [createdProgress] = await db
      .insert(progress)
      .values(progressData)
      .returning();
    return createdProgress;
  }

  async updateProgress(id: number, progressData: Partial<Progress>): Promise<Progress | undefined> {
    const [updatedProgress] = await db
      .update(progress)
      .set(progressData)
      .where(eq(progress.id, id))
      .returning();
    return updatedProgress || undefined;
  }

  async deleteProgress(id: number): Promise<boolean> {
    const result = await db.delete(progress).where(eq(progress.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(products);
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return db.select().from(products).where(eq(products.category, category));
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [createdProduct] = await db
      .insert(products)
      .values(product)
      .returning();
    return createdProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const [updatedProduct] = await db
      .update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();
    return result.length > 0;
  }

  // Cart methods
  async getCartItem(userId: number, productId: number): Promise<CartItem | undefined> {
    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
    return item || undefined;
  }

  async getCartItems(userId: number): Promise<(CartItem & { product: Product })[]> {
    const items = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.updatedAt));

    if (items.length === 0) {
      return [];
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)));
    const productList = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    const productMap = new Map(productList.map((product) => [product.id, product]));

    return items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;
        return {
          ...item,
          product,
        };
      })
      .filter((entry): entry is CartItem & { product: Product } => entry !== null);
  }

  async upsertCartItem(userId: number, productId: number, quantity: number): Promise<CartItem> {
    const existing = await this.getCartItem(userId, productId);

    if (existing) {
      const [updated] = await db
        .update(cartItems)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(cartItems.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(cartItems)
      .values({ userId, productId, quantity })
      .returning();
    return created;
  }

  async removeCartItem(userId: number, productId: number): Promise<boolean> {
    const deleted = await db
      .delete(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
      .returning();
    return deleted.length > 0;
  }

  async clearCart(userId: number): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  // Orders methods
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrdersByUserId(userId: number): Promise<(Order & { items: OrderItem[] })[]> {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));

    if (userOrders.length === 0) {
      return [];
    }

    const orderIds = userOrders.map((order) => order.id);
    const allItems = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<number, OrderItem[]>();
    for (const item of allItems) {
      const existing = itemsByOrder.get(item.orderId) || [];
      existing.push(item);
      itemsByOrder.set(item.orderId, existing);
    }

    return userOrders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) || []
    }));
  }

  async getAllOrders(): Promise<(Order & { items: OrderItem[], user?: { id: number, username: string, firstName: string, lastName: string } })[]> {
    const allOrders = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));

    if (allOrders.length === 0) {
      return [];
    }

    const orderIds = allOrders.map((order) => order.id);
    const allItems = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const itemsByOrder = new Map<number, OrderItem[]>();
    for (const item of allItems) {
      const existing = itemsByOrder.get(item.orderId) || [];
      existing.push(item);
      itemsByOrder.set(item.orderId, existing);
    }

    // Get user information for each order
    const userIds = [...new Set(allOrders.map(order => order.userId))];
    const usersData = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(users)
      .where(inArray(users.id, userIds));

    const userById = new Map(usersData.map(u => [u.id, u]));

    return allOrders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) || [],
      user: userById.get(order.userId)
    }));
  }

  async getOrderWithItems(id: number): Promise<(Order & { items: OrderItem[] }) | undefined> {
    const order = await this.getOrder(id);
    if (!order) return undefined;

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    return {
      ...order,
      items
    };
  }

  async createOrder(orderData: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    // Create order and items in a transaction
    const [order] = await db
      .insert(orders)
      .values(orderData)
      .returning();

    // Insert order items with the order ID
    const itemsWithOrderId = items.map(item => ({
      ...item,
      orderId: order.id
    }));

    await db
      .insert(orderItems)
      .values(itemsWithOrderId);

    return order;
  }

  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({ ...orderData, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder || undefined;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const result = await db
      .delete(orders)
      .where(eq(orders.id, id))
      .returning();
    return result.length > 0;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async getMessagesBetweenUsers(userId1: number, userId2: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, userId1),
            eq(messages.receiverId, userId2)
          ),
          and(
            eq(messages.senderId, userId2),
            eq(messages.receiverId, userId1)
          )
        )
      )
      .orderBy(messages.sentAt);
  }

  async getUserMessages(userId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        or(
          eq(messages.senderId, userId),
          eq(messages.receiverId, userId)
        )
      )
      .orderBy(messages.sentAt);
  }

  async getMessagesByUserId(userId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        or(
          eq(messages.senderId, userId),
          eq(messages.receiverId, userId)
        )
      )
      .orderBy(desc(messages.sentAt));
  }

  async getUnreadMessagesByUserId(userId: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.receiverId, userId),
          eq(messages.read, false)
        )
      )
      .orderBy(desc(messages.sentAt));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [createdMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return createdMessage;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [updatedMessage] = await db
      .update(messages)
      .set({ read: true })
      .where(eq(messages.id, id))
      .returning();
    return updatedMessage || undefined;
  }

  async getDailyStats(id: number): Promise<DailyStats | undefined> {
    const [stats] = await db.select().from(dailyStats).where(eq(dailyStats.id, id));
    return stats || undefined;
  }

  async getDailyStatsByUserAndDate(userId: number, date: Date): Promise<DailyStats | undefined> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const [stats] = await db
      .select()
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.userId, userId),
          gte(dailyStats.date, startDate),
          lte(dailyStats.date, endDate)
        )
      );

    return stats || undefined;
  }

  async getDailyStatsByUserId(userId: number): Promise<DailyStats[]> {
    return db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.userId, userId))
      .orderBy(desc(dailyStats.date));
  }

  async getDailyStatsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<DailyStats[]> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return db
      .select()
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.userId, userId),
          gte(dailyStats.date, start),
          lte(dailyStats.date, end)
        )
      )
      .orderBy(dailyStats.date);
  }

  async createDailyStats(stats: InsertDailyStats): Promise<DailyStats> {
    const [createdStats] = await db
      .insert(dailyStats)
      .values(stats)
      .returning();
    return createdStats;
  }

  async updateDailyStats(id: number, statsData: Partial<DailyStats>): Promise<DailyStats | undefined> {
    const [updatedStats] = await db
      .update(dailyStats)
      .set(statsData)
      .where(eq(dailyStats.id, id))
      .returning();
    return updatedStats || undefined;
  }

  async getWeeklyStats(userId: number, startDate: Date): Promise<DailyStats[]> {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    return db
      .select()
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.userId, userId),
          gte(dailyStats.date, startDate),
          lt(dailyStats.date, endDate)
        )
      )
      .orderBy(dailyStats.date);
  }

  async updateUserDailyStatsGoals(userId: number, goals: { caloriesGoal: number; proteinGoal: number; carbsGoal: number; fatGoal: number }): Promise<void> {
    await db
      .update(dailyStats)
      .set({
        caloriesGoal: goals.caloriesGoal,
        proteinGoal: goals.proteinGoal,
        carbsGoal: goals.carbsGoal,
        fatGoal: goals.fatGoal
      })
      .where(eq(dailyStats.userId, userId));
  }

  async getUserPlan(id: number): Promise<UserPlan | undefined> {
    const [plan] = await db.select().from(userPlans).where(eq(userPlans.id, id));
    return plan || undefined;
  }

  async getUserPlansByUserId(userId: number): Promise<UserPlan[]> {
    return db
      .select()
      .from(userPlans)
      .where(eq(userPlans.userId, userId))
      .orderBy(desc(userPlans.createdAt));
  }

  async getLatestUserPlan(userId: number): Promise<UserPlan | undefined> {
    const [plan] = await db
      .select()
      .from(userPlans)
      .where(eq(userPlans.userId, userId))
      .orderBy(desc(userPlans.createdAt))
      .limit(1);

    return plan || undefined;
  }

  async createUserPlan(plan: InsertUserPlan): Promise<UserPlan> {
    const now = new Date();
    const [createdPlan] = await db
      .insert(userPlans)
      .values({
        ...plan,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return createdPlan;
  }

  async updateUserPlan(id: number, planData: Partial<UserPlan>): Promise<UserPlan | undefined> {
    const [updatedPlan] = await db
      .update(userPlans)
      .set({
        ...planData,
        updatedAt: new Date()
      })
      .where(eq(userPlans.id, id))
      .returning();
    return updatedPlan || undefined;
  }

  async deleteUserPlan(id: number): Promise<boolean> {
    const deleted = await db
      .delete(userPlans)
      .where(eq(userPlans.id, id))
      .returning({ id: userPlans.id });
    return deleted.length > 0;
  }

  // Content Library methods
  async getContentLibraryItem(id: number): Promise<ContentLibrary | undefined> {
    const [item] = await db.select().from(contentLibrary).where(eq(contentLibrary.id, id));
    return item || undefined;
  }

  async getAllContentLibrary(): Promise<ContentLibrary[]> {
    return db
      .select()
      .from(contentLibrary)
      .orderBy(desc(contentLibrary.createdAt));
  }

  async getContentLibraryByCoachId(coachId: number): Promise<ContentLibrary[]> {
    return db
      .select()
      .from(contentLibrary)
      .where(eq(contentLibrary.coachId, coachId))
      .orderBy(desc(contentLibrary.createdAt));
  }

  async getContentLibraryByCategory(coachId: number | null, category: string): Promise<ContentLibrary[]> {
    if (coachId === null) {
      return db
        .select()
        .from(contentLibrary)
        .where(eq(contentLibrary.category, category))
        .orderBy(desc(contentLibrary.createdAt));
    }
    return db
      .select()
      .from(contentLibrary)
      .where(and(eq(contentLibrary.coachId, coachId), eq(contentLibrary.category, category)))
      .orderBy(desc(contentLibrary.createdAt));
  }

  async getContentLibraryByType(coachId: number | null, type: string): Promise<ContentLibrary[]> {
    if (coachId === null) {
      return db
        .select()
        .from(contentLibrary)
        .where(eq(contentLibrary.type, type))
        .orderBy(desc(contentLibrary.createdAt));
    }
    return db
      .select()
      .from(contentLibrary)
      .where(and(eq(contentLibrary.coachId, coachId), eq(contentLibrary.type, type)))
      .orderBy(desc(contentLibrary.createdAt));
  }

  async searchContentLibrary(coachId: number | null, query: string): Promise<ContentLibrary[]> {
    // For PostgreSQL, we would use proper text search functions in a real implementation
    // For now, using basic LIKE search
    if (coachId === null) {
      return db
        .select()
        .from(contentLibrary)
        .where(
          or(
            eq(contentLibrary.title, query),
            eq(contentLibrary.description, query)
          )
        )
        .orderBy(desc(contentLibrary.createdAt));
    }
    return db
      .select()
      .from(contentLibrary)
      .where(
        and(
          eq(contentLibrary.coachId, coachId),
          or(
            eq(contentLibrary.title, query),
            eq(contentLibrary.description, query)
          )
        )
      )
      .orderBy(desc(contentLibrary.createdAt));
  }

  async createContentLibraryItem(content: InsertContentLibrary): Promise<ContentLibrary> {
    const now = new Date();
    const [createdContent] = await db
      .insert(contentLibrary)
      .values({
        ...content,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return createdContent;
  }

  async updateContentLibraryItem(id: number, contentData: Partial<ContentLibrary>): Promise<ContentLibrary | undefined> {
    const [updatedContent] = await db
      .update(contentLibrary)
      .set({
        ...contentData,
        updatedAt: new Date()
      })
      .where(eq(contentLibrary.id, id))
      .returning();
    return updatedContent || undefined;
  }

  async deleteContentLibraryItem(id: number): Promise<boolean> {
    const result = await db.delete(contentLibrary).where(eq(contentLibrary.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Content Categories methods
  async getContentCategory(id: number): Promise<ContentCategory | undefined> {
    const [category] = await db.select().from(contentCategories).where(eq(contentCategories.id, id));
    return category || undefined;
  }

  async getAllContentCategories(): Promise<ContentCategory[]> {
    return db
      .select()
      .from(contentCategories)
      .where(eq(contentCategories.isActive, true))
      .orderBy(contentCategories.displayOrder, contentCategories.name);
  }

  async createContentCategory(category: InsertContentCategory): Promise<ContentCategory> {
    const now = new Date();
    const [createdCategory] = await db
      .insert(contentCategories)
      .values({
        ...category,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return createdCategory;
  }

  async updateContentCategory(id: number, categoryData: Partial<ContentCategory>): Promise<ContentCategory | undefined> {
    const [updatedCategory] = await db
      .update(contentCategories)
      .set({
        ...categoryData,
        updatedAt: new Date()
      })
      .where(eq(contentCategories.id, id))
      .returning();
    return updatedCategory || undefined;
  }

  async deleteContentCategory(id: number): Promise<boolean> {
    // Soft delete by setting isActive to false
    const [updated] = await db
      .update(contentCategories)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(contentCategories.id, id))
      .returning();
    return !!updated;
  }

  // Workout Sessions methods
  async getWorkoutSession(id: number): Promise<WorkoutSession | undefined> {
    const [session] = await db.select().from(workoutSessions).where(eq(workoutSessions.id, id));
    return session || undefined;
  }

  async getWorkoutSessionsByUserId(userId: number): Promise<WorkoutSession[]> {
    return db.select().from(workoutSessions)
      .where(eq(workoutSessions.userId, userId))
      .orderBy(desc(workoutSessions.completedAt));
  }

  async getWorkoutSessionsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<WorkoutSession[]> {
    return db.select().from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          gte(workoutSessions.completedAt, startDate),
          lte(workoutSessions.completedAt, endDate)
        )
      )
      .orderBy(desc(workoutSessions.completedAt));
  }

  async createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession> {
    const [createdSession] = await db
      .insert(workoutSessions)
      .values(session)
      .returning();
    return createdSession;
  }

  async updateWorkoutSession(id: number, sessionData: Partial<WorkoutSession>): Promise<WorkoutSession | undefined> {
    const [updatedSession] = await db
      .update(workoutSessions)
      .set(sessionData)
      .where(eq(workoutSessions.id, id))
      .returning();
    return updatedSession || undefined;
  }

  async deleteWorkoutSession(id: number): Promise<boolean> {
    const result = await db.delete(workoutSessions).where(eq(workoutSessions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Coach invitation methods
  async createCoachInvitation(invitation: InsertCoachInvitation): Promise<CoachInvitation> {
    const [created] = await db.insert(coachInvitations).values(invitation).returning();
    return created;
  }

  async getCoachInvitation(id: number): Promise<CoachInvitation | undefined> {
    const [invitation] = await db.select().from(coachInvitations).where(eq(coachInvitations.id, id));
    return invitation;
  }

  async getCoachInvitationsByCoachId(coachId: number): Promise<(CoachInvitation & { userName: string, userWhatsapp: string })[]> {
    const invitations = await this.db
      .select({
        id: coachInvitations.id,
        userId: coachInvitations.userId,
        coachId: coachInvitations.coachId,
        status: coachInvitations.status,
        invitedAt: coachInvitations.invitedAt,
        respondedAt: coachInvitations.respondedAt,
        userMessage: coachInvitations.userMessage,
        userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        userWhatsapp: users.whatsappWithCode
      })
      .from(coachInvitations)
      .leftJoin(users, eq(coachInvitations.userId, users.id))
      .where(eq(coachInvitations.coachId, coachId))
      .orderBy(desc(coachInvitations.invitedAt));

    return invitations;
  }

  async getCoachInvitationsByUserId(userId: number): Promise<(CoachInvitation & { coachName: string, coachWhatsapp: string })[]> {
    const invitations = await this.db
      .select({
        id: coachInvitations.id,
        userId: coachInvitations.userId,
        coachId: coachInvitations.coachId,
        status: coachInvitations.status,
        invitedAt: coachInvitations.invitedAt,
        respondedAt: coachInvitations.respondedAt,
        userMessage: coachInvitations.userMessage,
        coachName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
        coachWhatsapp: users.whatsappWithCode
      })
      .from(coachInvitations)
      .leftJoin(users, eq(coachInvitations.coachId, users.id))
      .where(eq(coachInvitations.userId, userId))
      .orderBy(desc(coachInvitations.invitedAt));

    return invitations;
  }

  async updateCoachInvitation(id: number, updates: Partial<CoachInvitation>): Promise<CoachInvitation | undefined> {
    const [updated] = await this.db.update(coachInvitations)
      .set(updates)
      .where(eq(coachInvitations.id, id))
      .returning();
    return updated;
  }

  async deleteCoachInvitation(id: number): Promise<boolean> {
    const result = await this.db.delete(coachInvitations).where(eq(coachInvitations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Coach Info methods
  async getCoachInfo(coachId: number): Promise<CoachInfo | undefined> {
    const result = await this.db
      .select()
      .from(coachInfo)
      .where(eq(coachInfo.coachId, coachId))
      .limit(1);
    return result[0];
  }

  async createCoachInfo(info: InsertCoachInfo): Promise<CoachInfo> {
    const [created] = await this.db
      .insert(coachInfo)
      .values(info)
      .returning();
    return created;
  }

  async updateCoachInfo(coachId: number, info: Partial<CoachInfo>): Promise<CoachInfo | undefined> {
    const [updated] = await this.db
      .update(coachInfo)
      .set({ ...info, updatedAt: new Date() })
      .where(eq(coachInfo.coachId, coachId))
      .returning();
    return updated;
  }

  // Coach Products methods
  async getCoachProduct(id: number): Promise<CoachProduct | undefined> {
    const [product] = await this.db
      .select()
      .from(coachProducts)
      .where(eq(coachProducts.id, id))
      .limit(1);
    return product;
  }

  async getCoachProductsByCoachId(coachId: number): Promise<CoachProduct[]> {
    const products = await this.db
      .select()
      .from(coachProducts)
      .where(eq(coachProducts.coachId, coachId))
      .orderBy(desc(coachProducts.createdAt));
    return products;
  }

  async createCoachProduct(product: InsertCoachProduct): Promise<CoachProduct> {
    const [created] = await this.db
      .insert(coachProducts)
      .values(product)
      .returning();
    return created;
  }

  async updateCoachProduct(id: number, updates: Partial<CoachProduct>): Promise<CoachProduct | undefined> {
    const [updated] = await this.db
      .update(coachProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(coachProducts.id, id))
      .returning();
    return updated;
  }

  async deleteCoachProduct(id: number): Promise<boolean> {
    const result = await this.db
      .delete(coachProducts)
      .where(eq(coachProducts.id, id))
      .returning();
    return result.length > 0;
  }

  // Affiliate Products methods
  async getAffiliateProduct(id: number): Promise<AffiliateProduct | undefined> {
    const [product] = await this.db
      .select()
      .from(affiliateProducts)
      .where(eq(affiliateProducts.id, id))
      .limit(1);
    return product;
  }

  async getAllAffiliateProducts(): Promise<AffiliateProduct[]> {
    return await this.db
      .select()
      .from(affiliateProducts)
      .orderBy(desc(affiliateProducts.createdAt));
  }

  async getActiveAffiliateProducts(): Promise<AffiliateProduct[]> {
    return await this.db
      .select()
      .from(affiliateProducts)
      .where(eq(affiliateProducts.isActive, true))
      .orderBy(desc(affiliateProducts.createdAt));
  }

  async createAffiliateProduct(product: InsertAffiliateProduct): Promise<AffiliateProduct> {
    const [newProduct] = await this.db
      .insert(affiliateProducts)
      .values(product)
      .returning();
    return newProduct;
  }

  async updateAffiliateProduct(id: number, updates: Partial<AffiliateProduct>): Promise<AffiliateProduct | undefined> {
    const [updated] = await this.db
      .update(affiliateProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(affiliateProducts.id, id))
      .returning();
    return updated;
  }

  async deleteAffiliateProduct(id: number): Promise<boolean> {
    const result = await this.db
      .delete(affiliateProducts)
      .where(eq(affiliateProducts.id, id))
      .returning();
    return result.length > 0;
  }

  // Affiliate Categories methods
  async getAllAffiliateCategories(): Promise<AffiliateCategory[]> {
    return await this.db
      .select()
      .from(affiliateCategories)
      .orderBy(affiliateCategories.displayOrder, affiliateCategories.nameEn);
  }

  async getActiveAffiliateCategories(): Promise<AffiliateCategory[]> {
    return await this.db
      .select()
      .from(affiliateCategories)
      .where(eq(affiliateCategories.isActive, true))
      .orderBy(affiliateCategories.displayOrder, affiliateCategories.nameEn);
  }

  async getAffiliateCategoryById(id: number): Promise<AffiliateCategory | undefined> {
    const [category] = await this.db
      .select()
      .from(affiliateCategories)
      .where(eq(affiliateCategories.id, id))
      .limit(1);
    return category;
  }

  async createAffiliateCategory(category: InsertAffiliateCategory): Promise<AffiliateCategory> {
    const [newCategory] = await this.db
      .insert(affiliateCategories)
      .values(category)
      .returning();
    return newCategory;
  }

  async updateAffiliateCategory(id: number, updates: Partial<AffiliateCategory>): Promise<AffiliateCategory | undefined> {
    const [updated] = await this.db
      .update(affiliateCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(affiliateCategories.id, id))
      .returning();
    return updated;
  }

  async deleteAffiliateCategory(id: number): Promise<boolean> {
    const result = await this.db
      .delete(affiliateCategories)
      .where(eq(affiliateCategories.id, id))
      .returning();
    return result.length > 0;
  }

  // Scraped Affiliate Products methods
  async getScrapedProductsByAffiliateId(affiliateProductId: number): Promise<ScrapedAffiliateProduct[]> {
    return await this.db
      .select()
      .from(scrapedAffiliateProducts)
      .where(eq(scrapedAffiliateProducts.affiliateProductId, affiliateProductId))
      .orderBy(desc(scrapedAffiliateProducts.createdAt));
  }

  async getAllScrapedProducts(): Promise<ScrapedAffiliateProduct[]> {
    return await this.db
      .select()
      .from(scrapedAffiliateProducts)
      .orderBy(desc(scrapedAffiliateProducts.createdAt));
  }

  async scrapeAffiliateProduct(affiliateProductId: number): Promise<{ count: number } | null> {
    const [product] = await this.db
      .select()
      .from(affiliateProducts)
      .where(eq(affiliateProducts.id, affiliateProductId))
      .limit(1);
    
    if (!product) {
      return null;
    }

    const { scrapeAffiliateProductUrl } = await import('./services/productScraper');
    const scrapedProducts = await scrapeAffiliateProductUrl(
      affiliateProductId, 
      product.url, 
      product.source || undefined
    );

    return { count: scrapedProducts.length };
  }

  async scrapeAllAffiliateProducts(): Promise<{ success: number; failed: number }> {
    const { scrapeAllAffiliateProducts } = await import('./services/productScraper');
    return await scrapeAllAffiliateProducts();
  }

  // Add missing methods to satisfy IStorage interface
  async getUserWorkouts(userId: number): Promise<UserWorkout[]> {
    return this.getUserWorkoutsByUserId(userId);
  }

  async getUserProgress(userId: number): Promise<Progress[]> {
    const progressRecords = await db.select().from(progress).where(eq(progress.userId, userId));
    return progressRecords as Progress[];
  }

  // User Points and Streaks methods
  async getUserPointsAndStreaks(userId: number): Promise<UserPointsAndStreaks | undefined> {
    const [record] = await this.db
      .select()
      .from(userPointsAndStreaks)
      .where(eq(userPointsAndStreaks.userId, userId))
      .limit(1);
    return record;
  }

  async createUserPointsAndStreaks(data: InsertUserPointsAndStreaks): Promise<UserPointsAndStreaks> {
    const [created] = await this.db
      .insert(userPointsAndStreaks)
      .values(data)
      .returning();
    return created;
  }

  async updateUserPointsAndStreaks(userId: number, data: Partial<UserPointsAndStreaks>): Promise<UserPointsAndStreaks | undefined> {
    const [updated] = await this.db
      .update(userPointsAndStreaks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPointsAndStreaks.userId, userId))
      .returning();
    return updated;
  }

  async addPoints(userId: number, points: number, actionType: string): Promise<UserPointsAndStreaks | undefined> {
    // Get or create user points record
    let userPoints = await this.getUserPointsAndStreaks(userId);
    if (!userPoints) {
      userPoints = await this.createUserPointsAndStreaks({ 
        userId, 
        totalPoints: 0, 
        currentStreak: 0, 
        longestStreak: 0 
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if action was already done today based on actionType
    let canAddPoints = false;
    const updateFields: Partial<UserPointsAndStreaks> = {};

    switch (actionType) {
      case 'breakfast':
        const lastBreakfast = userPoints.lastBreakfastLogDate ? new Date(userPoints.lastBreakfastLogDate) : null;
        if (!lastBreakfast || lastBreakfast < today) {
          canAddPoints = true;
          updateFields.lastBreakfastLogDate = new Date();
        }
        break;
      case 'lunch':
        const lastLunch = userPoints.lastLunchLogDate ? new Date(userPoints.lastLunchLogDate) : null;
        if (!lastLunch || lastLunch < today) {
          canAddPoints = true;
          updateFields.lastLunchLogDate = new Date();
        }
        break;
      case 'dinner':
        const lastDinner = userPoints.lastDinnerLogDate ? new Date(userPoints.lastDinnerLogDate) : null;
        if (!lastDinner || lastDinner < today) {
          canAddPoints = true;
          updateFields.lastDinnerLogDate = new Date();
        }
        break;
      case 'snack':
        const lastSnack = userPoints.lastSnackLogDate ? new Date(userPoints.lastSnackLogDate) : null;
        const isNewDay = !lastSnack || lastSnack < today;
        const snackCount = isNewDay ? 0 : userPoints.snackLogsToday;
        
        if (snackCount < 2) {
          canAddPoints = true;
          updateFields.lastSnackLogDate = new Date();
          updateFields.snackLogsToday = snackCount + 1;
        }
        break;
      case 'workout':
        const lastWorkout = userPoints.lastWorkoutLogDate ? new Date(userPoints.lastWorkoutLogDate) : null;
        if (!lastWorkout || lastWorkout < today) {
          canAddPoints = true;
          updateFields.lastWorkoutLogDate = new Date();
        }
        break;
      case 'weight':
        const lastWeight = userPoints.lastWeightLogDate ? new Date(userPoints.lastWeightLogDate) : null;
        if (!lastWeight || lastWeight < today) {
          canAddPoints = true;
          updateFields.lastWeightLogDate = new Date();
        }
        break;
      case 'store':
        canAddPoints = true;
        updateFields.lastStorePurchaseDate = new Date();
        break;
      default:
        canAddPoints = false;
    }

    if (canAddPoints) {
      updateFields.totalPoints = userPoints.totalPoints + points;
      return await this.updateUserPointsAndStreaks(userId, updateFields);
    }

    return userPoints;
  }

  async updateStreak(userId: number, hasActivity: boolean): Promise<UserPointsAndStreaks | undefined> {
    // Get or create user points record
    let userPoints = await this.getUserPointsAndStreaks(userId);
    if (!userPoints) {
      userPoints = await this.createUserPointsAndStreaks({ 
        userId, 
        totalPoints: 0, 
        currentStreak: 0, 
        longestStreak: 0 
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastActivity = userPoints.lastActivityDate ? new Date(userPoints.lastActivityDate) : null;
    
    if (hasActivity) {
      // Only update if this is the first activity today
      if (!lastActivity || lastActivity < today) {
        const updateFields: Partial<UserPointsAndStreaks> = {
          lastActivityDate: new Date()
        };

        if (!lastActivity) {
          // First ever activity
          updateFields.currentStreak = 1;
          updateFields.longestStreak = Math.max(1, userPoints.longestStreak);
        } else {
          // Create a new date for comparison to avoid mutating the original
          const lastActivityDate = new Date(lastActivity);
          lastActivityDate.setHours(0, 0, 0, 0);
          
          if (lastActivityDate.getTime() === yesterday.getTime()) {
            // Continuing streak
            updateFields.currentStreak = userPoints.currentStreak + 1;
            updateFields.longestStreak = Math.max(userPoints.currentStreak + 1, userPoints.longestStreak);
          } else if (lastActivityDate.getTime() < yesterday.getTime()) {
            // Streak broken, reset to 1
            updateFields.currentStreak = 1;
          }
          // If lastActivity is today, we already updated it, so don't change streak
        }

        return await this.updateUserPointsAndStreaks(userId, updateFields);
      }
    } else {
      // Check if streak should be reset (missed a day)
      if (lastActivity) {
        // Create a new date for comparison to avoid mutating the original
        const lastActivityDate = new Date(lastActivity);
        lastActivityDate.setHours(0, 0, 0, 0);
        
        if (lastActivityDate.getTime() < yesterday.getTime()) {
          // Missed a day, reset streak
          return await this.updateUserPointsAndStreaks(userId, { currentStreak: 0 });
        }
      }
    }

    return userPoints;
  }

  async getCreditBalance(userId: number): Promise<CreditBalance | undefined> {
    const [balance] = await this.db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);
    return balance;
  }

  async incrementCreditBalance(userId: number, credits: number): Promise<CreditBalance> {
    const now = new Date();
    const [balance] = await this.db
      .insert(creditBalances)
      .values({
        userId,
        totalCredits: credits,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: creditBalances.userId,
        set: {
          totalCredits: sql`${creditBalances.totalCredits} + ${credits}`,
          updatedAt: now,
        },
      })
      .returning();
    return balance;
  }

  async createCreditTransaction(txData: InsertCreditTransaction): Promise<CreditTransaction> {
    const now = new Date();
    const payload: InsertCreditTransaction = {
      ...txData,
      createdAt: txData.createdAt ?? now,
      updatedAt: txData.updatedAt ?? now,
    };
    const [transaction] = await this.db
      .insert(creditTransactions)
      .values(payload)
      .returning();
    return transaction;
  }

  async updateCreditTransaction(id: number, update: Partial<CreditTransaction>): Promise<CreditTransaction | undefined> {
    const [transaction] = await this.db
      .update(creditTransactions)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(creditTransactions.id, id))
      .returning();
    return transaction;
  }

  async getCreditTransactionByReference(reference: string): Promise<CreditTransaction | undefined> {
    const [transaction] = await this.db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.merchantReferenceId, reference))
      .limit(1);
    return transaction;
  }

  async getCreditTransactionsByUser(userId: number, limit = 20): Promise<CreditTransaction[]> {
    return this.db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
  }

  async finalizeCreditTransaction(
    merchantReferenceId: string,
    update: {
      status: string;
      gatewayStatus?: string | null;
      responseCode?: string | null;
      orderId?: string | null;
      signatureValid?: boolean;
      signatureHeader?: string | null;
      callbackPayload?: unknown;
      errorMessage?: string | null;
      credited: boolean;
    }
  ): Promise<CreditTransaction | undefined> {
    try {
      const result = await this.db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.merchantReferenceId, merchantReferenceId))
          .limit(1);

        if (!existing) {
          console.warn(`[Storage] Transaction not found: ${merchantReferenceId}`);
          return undefined;
        }

        if (update.credited && !existing.credited) {
          const now = new Date();
          await tx
            .insert(creditBalances)
            .values({
              userId: existing.userId,
              totalCredits: existing.credits,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: creditBalances.userId,
              set: {
                totalCredits: sql`${creditBalances.totalCredits} + ${existing.credits}`,
                updatedAt: now,
              },
            });
          console.log(`[Storage] Credits added: user=${existing.userId} credits=${existing.credits}`);
        }

        const shouldStampCompletion = update.status?.toLowerCase() !== "pending";
        const completionTime = shouldStampCompletion
          ? existing.completedAt ?? new Date()
          : existing.completedAt;

        const [transaction] = await tx
          .update(creditTransactions)
          .set({
            status: update.status,
            gatewayStatus: update.gatewayStatus ?? existing.gatewayStatus,
            responseCode: update.responseCode ?? existing.responseCode,
            orderId: update.orderId ?? existing.orderId,
            signatureValid: update.signatureValid ?? existing.signatureValid,
            signatureHeader: update.signatureHeader ?? existing.signatureHeader,
            callbackPayload: update.callbackPayload ?? existing.callbackPayload,
            errorMessage: update.errorMessage ?? existing.errorMessage,
            credited: existing.credited || update.credited,
            completedAt: completionTime,
            updatedAt: new Date(),
          })
          .where(eq(creditTransactions.id, existing.id))
          .returning();

        return transaction;
      });
      
      return result;
    } catch (error) {
      console.error("[Storage] finalizeCreditTransaction ERROR:", error);
      throw error;
    }
  }

  async getTrackingSettings(): Promise<TrackingSettings | undefined> {
    const [settings] = await this.db.select().from(trackingSettings).limit(1);
    return settings ?? undefined;
  }

  async upsertTrackingSettings(data: Partial<InsertTrackingSettings>): Promise<TrackingSettings> {
    const existing = await this.getTrackingSettings();
    const now = new Date();

    if (existing) {
      const [updated] = await this.db
        .update(trackingSettings)
        .set({
          ...data,
          updatedAt: now,
        })
        .where(eq(trackingSettings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(trackingSettings)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();