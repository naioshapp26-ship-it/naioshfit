import { pgTable, text, serial, integer, boolean, timestamp, real, json, index, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users: ReturnType<typeof pgTable> = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(),
  password: text("password").notNull(),
  pinNumber: text("pin_number"), // 4-digit PIN for password reset (stored unhashed)
  email: text("email").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phoneNumber: text("phone_number"),
  whatsappWithCode: text("whatsapp_with_code"),
  city: text("city"),
  country: text("country"),
  gender: text("gender"),
  religion: text("religion"), // muslim, christian
  age: integer("age"),
  height: real("height"),
  weight: real("weight"),
  goalWeight: real("goal_weight"),

  // Subscription Details
  subscriptionDuration: text("subscription_duration"), // 1_month, 3_months, etc.

  // Body Measurements
  shoulderWidth: real("shoulder_width"),
  chestWidth: real("chest_width"),
  waistWidth: real("waist_width"),
  hipWidth: real("hip_width"),
  frontPhoto: text("front_photo"),
  backPhoto: text("back_photo"),
  sidePhoto: text("side_photo"),
  hasInbody: boolean("has_inbody").default(false),

  // Fitness Goals
  fitnessGoal: text("fitness_goal"), // weight_gain, weight_loss, bulking, cutting

  // Training Experience
  trainingLevel: text("training_level"), // beginner, intermediate, advanced
  trainingDaysPerWeek: integer("training_days_per_week"),
  preferredWorkoutTime: text("preferred_workout_time"), // morning, midday, evening
  preferredProgram: text("preferred_program"), // pro_split, push_pull_legs, upper_lower, random, dont_know

  // Health Information
  medicalHistory: boolean("medical_history").default(false),
  medicalHistoryDetails: text("medical_history_details"),
  workIntensity: text("work_intensity"), // comfortable, moderate, intense
  workoutLocation: text("workout_location"), // gym, home, both
  inbodyDocument: text("inbody_document"),

  // Nutrition Preferences
  dailyMeals: integer("daily_meals"), // 3, 4, 5, 6
  preferredCarbs: text("preferred_carbs"), // potato, sweet_potato, rice, quinoa, oats, pasta, brown_toast, none
  preferredProteins: text("preferred_proteins"), // tuna, fish, chicken, meat, eggs, liver, salmon, none
  preferredLegumes: text("preferred_legumes"), // chickpeas, corn, beans, peas, red_beans, white_beans, none
  preferredVegetables: text("preferred_vegetables"), // zucchini, broccoli, okra, green_beans, spinach, pumpkin, none
  preferredDairy: text("preferred_dairy"), // mozzarella, milk, cottage_cheese, cheddar, yogurt, none
  preferredFats: text("preferred_fats"), // butter, coconut_oil, olive_oil, peanut_butter, avocado, nuts, none
  preferredFruits: text("preferred_fruits"), // strawberry, apple, banana, orange, watermelon, none
  hasAllergies: boolean("has_allergies").default(false),
  allergyDetails: text("allergy_details"),
  wantsSupplements: boolean("wants_supplements").default(false),
  supplementPhoto: text("supplement_photo"),

  // Additional Details
  previousTrainer: boolean("previous_trainer").default(false),
  dailyRoutine: text("daily_routine"),
  exerciseHistory: text("exercise_history"),
  wakeUpTime: text("wake_up_time"),
  breakfastTime: text("breakfast_time"),
  breakfastDetails: text("breakfast_details"),
  lunchTime: text("lunch_time"),
  lunchDetails: text("lunch_details"),
  dinnerTime: text("dinner_time"),
  dinnerDetails: text("dinner_details"),
  lunchHasProtein: boolean("lunch_has_protein").default(true),
  workType: text("work_type"), // office, mobile
  workHours: text("work_hours"),
  hasKitchenScale: boolean("has_kitchen_scale").default(false),
  paymentReceipt: text("payment_receipt"),

  // Marketing
  howFoundUs: text("how_found_us"), // facebook, instagram, youtube, tiktok, whatsapp
  preferredCoachName: text("preferred_coach_name"),

  // Existing fields
  activityLevel: text("activity_level"),
  bio: text("bio"),
  nutritionPlan: text("nutrition_plan"),
  workoutPlan: text("workout_plan"),
  role: text("role").notNull().default("user"),
  profilePicture: text("profile_picture"),
  coachId: integer("coach_id"),
  gymId: integer("gym_id").references((): any => users.id),
  subscriptionType: text("subscription_type").default("1_month"),
  subscriptionStartDate: timestamp("subscription_start_date").defaultNow(),
  subscriptionEndDate: timestamp("subscription_end_date"),
  isApproved: boolean("is_approved").default(true), // Default true for users, false for coaches until approved
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references((): any => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at"), // Tracks last app interaction (any API call)
});

// Add the foreign key reference after table definition
// This prevents circular dependency issues during table creation

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  coachId: true,
  subscriptionType: true,
  subscriptionStartDate: true,
  subscriptionEndDate: true
}).extend({
  role: z.enum(["user", "coach", "gym", "admin", "super_admin", "visitor"]).default("user"),
  username: z.string().optional(),
  email: z.string().email("البريد الإلكتروني غير صحيح").min(1, "البريد الإلكتروني مطلوب"),
  pinNumber: z.string()
    .regex(/^\d{4}$/, "رقم التحقق يجب أن يكون 4 أرقام بالضبط")
    .optional(),
  gymId: z.number().int().positive().optional(),
  firstName: z.string().min(1, "الاسم الأول مطلوب"),
  lastName: z.string().min(1, "اسم العائلة مطلوب"),
  whatsappWithCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  religion: z.enum(["muslim", "christian"]).optional(),
  height: z.number().min(50, "الطول يجب أن يكون 50 سم على الأقل").max(300, "الطول يجب أن يكون أقل من 300 سم").optional(),
  age: z.number().min(13, "العمر يجب أن يكون 13 سنة على الأقل").max(120, "العمر يجب أن يكون أقل من 120 سنة").optional(),
  weight: z.number().min(30, "الوزن يجب أن يكون 30 كجم على الأقل").max(500, "الوزن يجب أن يكون أقل من 500 كجم").optional(),
  preferredCarbs: z.string().optional(),
  preferredProteins: z.string().optional(),
  preferredLegumes: z.string().optional(),
  preferredVegetables: z.string().optional(),
  preferredDairy: z.string().optional(),
  preferredFats: z.string().optional(),
  preferredFruits: z.string().optional(),
  howFoundUs: z.enum(["facebook", "instagram", "youtube", "tiktok", "whatsapp"]).optional(),
  fitnessGoal: z.enum(["weight_gain", "weight_loss", "bulking", "cutting"]).optional(),
  trainingLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  preferredWorkoutTime: z.enum(["morning", "midday", "evening"]).optional(),
  preferredProgram: z.enum(["bro_split", "push_pull_legs", "upper_lower", "random", "dont_know"]).optional(),
  workIntensity: z.enum(["easy", "moderate", "hard"]).optional(),
  workType: z.string().optional(),
  frontPhoto: z.string().optional(),
  backPhoto: z.string().optional(),
  sidePhoto: z.string().optional(),
  preferredCoachName: z.string().optional(),
}).refine((data) => {
  // For user and visitor roles, require profile fields.
  if (data.role === "user" || data.role === "visitor") {
    const has = (v: any) => typeof v === 'string' ? v.trim().length > 0 : !!v;
    return (
      has(data.email) &&
      has(data.city) &&
      has(data.country) &&
      !!data.gender &&
      !!data.religion &&
      !!data.height &&
      !!data.age &&
      !!data.weight &&
      !!data.howFoundUs
    );
  }
  // For coach/gym/admin roles, only basic fields are required.
  return true;
}, {
  message: "الحقول المطلوبة ناقصة لتسجيل المستخدم",
  path: ["role"]
});

// Admin-only subscription update schema
export const updateSubscriptionSchema = z.object({
  subscriptionType: z.string().regex(/^\d+(?:\.\d{1,2})?_(month|months)$/, "Must be a valid subscription duration (e.g., 1.5_months, 3.78_months, 12_months)"),
  subscriptionStartDate: z.date().optional(),
  subscriptionEndDate: z.date().optional(),
});

// Password reset tokens table for email-based password recovery
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), // SHA256 hash of the reset token
  expiresAt: timestamp("expires_at").notNull(), // Token expiration time (typically 1 hour)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  usedAt: timestamp("used_at"), // Timestamp when token was used (prevents reuse)
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

// Workouts table
export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  duration: integer("duration").notNull(),
  difficulty: text("difficulty").notNull(),
  type: text("type").notNull(),
  coachId: integer("coach_id").references(() => users.id).notNull(),
  exercises: json("exercises").notNull(),
});

export const insertWorkoutSchema = createInsertSchema(workouts).omit({ 
  id: true 
});

// User workouts (scheduled workouts for users)
export const userWorkouts = pgTable("user_workouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  workoutId: integer("workout_id").references(() => workouts.id).notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
});

export const insertUserWorkoutSchema = createInsertSchema(userWorkouts).omit({ 
  id: true,
  completed: true,
  completedAt: true
});

// Workout sessions (for tracking completed workouts)
export const workoutSessions = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  workoutId: integer("workout_id").references(() => workouts.id),
  workoutName: text("workout_name").notNull(),
  workoutType: text("workout_type").notNull(), // regular or custom
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  duration: integer("duration"), // minutes
  totalSets: integer("total_sets").default(0),
  completedSets: integer("completed_sets").default(0),
  exercises: json("exercises"), // exercise log data
  notes: text("notes"),
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({ 
  id: true,
  completedAt: true
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;

// Meals table
export const meals = pgTable("meals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // breakfast, lunch, dinner, snack
  calories: integer("calories").notNull(),
  proteins: real("proteins").notNull(),
  carbs: real("carbs").notNull(),
  fats: real("fats").notNull(),
  fiber: real("fiber"),
  date: timestamp("date").notNull(),
  foodItems: json("food_items"), // JSON array of food items with quantities
});

export const insertMealSchema = createInsertSchema(meals).omit({ id: true });

// Global Food Items Database
export const foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  brand: text("brand"),
  brandAr: text("brand_ar"),
  calories: real("calories").notNull(),
  proteins: real("proteins").notNull(),
  carbs: real("carbs").notNull(),
  fats: real("fats").notNull(),
  fiber: real("fiber").notNull(),
  servingSize: text("serving_size").notNull(),
  servingSizeGrams: real("serving_size_grams").notNull(),
  category: text("category").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFoodItemSchema = createInsertSchema(foodItems).omit({ 
  id: true, 
  createdAt: true 
});

// Progress tracking
export const progress = pgTable("progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  weight: real("weight"),
  caloriesConsumed: integer("calories_consumed"),
  caloriesBurned: integer("calories_burned"),
  steps: integer("steps"),
  waterGlasses: integer("water_glasses"),
  notes: text("notes"),
});

export const insertProgressSchema = createInsertSchema(progress).omit({ id: true });

// Products store
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  imageUrl: text("image_url"),
  category: text("category").notNull(),
  rating: real("rating"),
  reviewCount: integer("review_count"),
  stock: integer("stock").notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, shipped, delivered, cancelled
  total: real("total").notNull(),
  currency: text("currency").notNull().default("EGP"),
  paymentMethod: text("payment_method").notNull().default("card"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  shippingAddress: text("shipping_address"),
  shippingCity: text("shipping_city"),
  shippingCountry: text("shipping_country"),
  shippingPhone: text("shipping_phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  completedAt: true
});

// Order Items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  productName: text("product_name").notNull(), // Store product name at time of purchase
  productPrice: real("product_price").notNull(), // Store price at time of purchase
  productImageUrl: text("product_image_url"),
  quantity: integer("quantity").notNull().default(1),
  subtotal: real("subtotal").notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });

// Cart items table
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userProductIdx: uniqueIndex("cart_items_user_product_idx").on(table.userId, table.productId),
}));

export const insertCartItemSchema = createInsertSchema(cartItems).omit({ id: true, createdAt: true, updatedAt: true });

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  read: boolean("read").default(false),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
  read: true
});

// User daily stats (for dashboard)
export const dailyStats = pgTable("daily_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  calories: integer("calories").default(0),
  caloriesGoal: integer("calories_goal").default(2200),
  protein: real("protein").default(0),
  proteinGoal: real("protein_goal").default(140),
  carbs: real("carbs").default(0),
  carbsGoal: real("carbs_goal").default(240),
  fat: real("fat").default(0),
  fatGoal: real("fat_goal").default(60),
  fiber: real("fiber").default(0),
  fiberGoal: real("fiber_goal").default(30),
  steps: integer("steps").default(0),
  stepsGoal: integer("steps_goal").default(10000),
  water: integer("water").default(0),
  waterGoal: integer("water_goal").default(8),
});

export const insertDailyStatsSchema = createInsertSchema(dailyStats).omit({ id: true });

// User plans (coach assigned plans)
export const userPlans = pgTable("user_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  coachId: integer("coach_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  weeklyFocus: text("weekly_focus"),
  goals: json("goals"),
  weeklySchedule: json("weekly_schedule"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserPlanSchema = createInsertSchema(userPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Credit balances for credit purchases
export const creditBalances = pgTable("credit_balances", {
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).primaryKey(),
  totalCredits: real("total_credits").notNull().default(0),
  lastDeductionDate: timestamp("last_deduction_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit transactions ledger (supports multiple gateways)
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  merchantReferenceId: text("merchant_reference_id").notNull().unique(),
  sessionId: text("session_id"),
  orderId: text("order_id"),
  paymentGateway: text("payment_gateway").notNull().default("stripe"),
  status: text("status").notNull().default("pending"),
  gatewayStatus: text("gateway_status"),
  responseCode: text("response_code"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("EGP"),
  credits: integer("credits").notNull(),
  checkoutUrl: text("checkout_url"),
  returnUrl: text("return_url"),
  callbackUrl: text("callback_url"),
  requestPayload: json("request_payload"),
  sessionPayload: json("session_payload"),
  callbackPayload: json("callback_payload"),
  signatureValid: boolean("signature_valid").default(false),
  signatureHeader: text("signature_header"),
  errorMessage: text("error_message"),
  credited: boolean("credited").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  sessionIdx: uniqueIndex("credit_transactions_session_id_key").on(table.sessionId),
  merchantRefIdx: uniqueIndex("credit_transactions_merchant_ref_key").on(table.merchantReferenceId),
  userIdx: index("credit_transactions_user_idx").on(table.userId),
  statusIdx: index("credit_transactions_status_idx").on(table.status),
}));

// Credit accounts v2 (multi-tenant aware)
export const creditAccountsV2 = pgTable("credit_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tenantId: uuid("tenant_id"),
  balance: integer("balance").notNull().default(0),
  lowBalanceThreshold: integer("low_balance_threshold").notNull().default(10),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userTenantIdx: uniqueIndex("credit_accounts_user_tenant_idx").on(table.userId, table.tenantId),
  tenantIdx: index("credit_accounts_tenant_idx").on(table.tenantId),
  userIdx: index("credit_accounts_user_idx").on(table.userId),
}));

export const creditBundles = pgTable("credit_bundles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id"),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  listIdx: index("credit_bundles_list_idx").on(table.tenantId, table.isActive, table.sortOrder),
}));

export const creditActionsV2 = pgTable("credit_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id"),
  actionKey: text("action_key").notNull(),
  description: text("description"),
  cost: integer("cost").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueAction: uniqueIndex("credit_actions_tenant_action_key_idx").on(table.tenantId, table.actionKey),
  activeIdx: index("credit_actions_active_idx").on(table.tenantId, table.isActive),
}));

export const creditTransactionsV2 = pgTable("credit_transactions_v2", {
  id: uuid("id").defaultRandom().primaryKey(),
  creditAccountId: uuid("credit_account_id").references(() => creditAccountsV2.id, { onDelete: "cascade" }).notNull(),
  tenantId: uuid("tenant_id"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  creditsDelta: integer("credits_delta").notNull(),
  balanceAfter: integer("balance_after"),
  provider: text("provider"),
  providerReference: text("provider_reference"),
  checkoutSessionId: text("checkout_session_id"),
  bundleId: uuid("bundle_id").references(() => creditBundles.id),
  actionKey: text("action_key"),
  metadata: json("metadata"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  providerRefIdx: uniqueIndex("credit_transactions_v2_provider_ref_idx").on(table.providerReference),
  accountIdx: index("credit_tx_account_idx").on(table.creditAccountId, table.createdAt),
  sessionIdx: index("credit_tx_session_idx").on(table.checkoutSessionId),
  actionIdx: index("credit_tx_action_idx").on(table.actionKey),
}));

// Define types for all schemas
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;

export type UserWorkout = typeof userWorkouts.$inferSelect;
export type InsertUserWorkout = z.infer<typeof insertUserWorkoutSchema>;

export type Meal = typeof meals.$inferSelect;
export type InsertMeal = z.infer<typeof insertMealSchema>;

export type FoodItem = typeof foodItems.$inferSelect;
export type InsertFoodItem = z.infer<typeof insertFoodItemSchema>;

export type Progress = typeof progress.$inferSelect;
export type InsertProgress = z.infer<typeof insertProgressSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type DailyStats = typeof dailyStats.$inferSelect;
export type InsertDailyStats = z.infer<typeof insertDailyStatsSchema>;

export type UserPlan = typeof userPlans.$inferSelect;
export type InsertUserPlan = z.infer<typeof insertUserPlanSchema>;

export type CreditBalance = typeof creditBalances.$inferSelect;
export type InsertCreditBalance = typeof creditBalances.$inferInsert;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactions.$inferInsert;

export type CreditAccountV2 = typeof creditAccountsV2.$inferSelect;
export type InsertCreditAccountV2 = typeof creditAccountsV2.$inferInsert;

export type CreditBundle = typeof creditBundles.$inferSelect;
export type InsertCreditBundle = typeof creditBundles.$inferInsert;

export type CreditActionV2 = typeof creditActionsV2.$inferSelect;
export type InsertCreditActionV2 = typeof creditActionsV2.$inferInsert;

export type CreditTransactionV2 = typeof creditTransactionsV2.$inferSelect;
export type InsertCreditTransactionV2 = typeof creditTransactionsV2.$inferInsert;

// Content Library table (for coaches to manage workout videos and images)
export const contentLibrary = pgTable("content_library", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'video' or 'image'
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category").notNull(), // 'workout', 'exercise', 'nutrition', etc.
  tags: text("tags").array().default([]), // Array of tags for filtering
  duration: integer("duration"), // For videos, duration in seconds
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertContentLibrarySchema = createInsertSchema(contentLibrary).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  tags: z.array(z.string()).optional().default([])
});

export type ContentLibrary = typeof contentLibrary.$inferSelect;
export type InsertContentLibrary = z.infer<typeof insertContentLibrarySchema>;

// Content Categories table (for managing content library categories)
export const contentCategories = pgTable("content_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("content_categories_name_idx").on(table.name),
  slugIdx: index("content_categories_slug_idx").on(table.slug),
  activeIdx: index("content_categories_active_idx").on(table.isActive),
}));

export const insertContentCategorySchema = createInsertSchema(contentCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type ContentCategory = typeof contentCategories.$inferSelect;
export type InsertContentCategory = z.infer<typeof insertContentCategorySchema>;

// Coach Invitations table
export const coachInvitations = pgTable("coach_invitations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  coachId: integer("coach_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, declined
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  userMessage: text("user_message"), // Optional message from user to coach
});

export const insertCoachInvitationSchema = createInsertSchema(coachInvitations).omit({
  id: true,
  invitedAt: true,
  respondedAt: true
});

export type CoachInvitation = typeof coachInvitations.$inferSelect;
export type InsertCoachInvitation = z.infer<typeof insertCoachInvitationSchema>;

// Coach Info table (for coach profile information)
export const coachInfo = pgTable("coach_info", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").references(() => users.id).notNull().unique(),
  aboutMe: text("about_me"),
  qualifications: text("qualifications"),
  certificateImages: text("certificate_images").array(),
  trainingApproach: text("training_approach"),
  successStories: text("success_stories"),
  servicesAndPrograms: text("services_and_programs"),
  contact: text("contact"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCoachInfoSchema = createInsertSchema(coachInfo).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type CoachInfo = typeof coachInfo.$inferSelect;
export type InsertCoachInfo = z.infer<typeof insertCoachInfoSchema>;

// Coach Products table (for coach's personal product recommendations)
export const coachProducts = pgTable("coach_products", {
  id: serial("id").primaryKey(),
  coachId: integer("coach_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCoachProductSchema = createInsertSchema(coachProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type CoachProduct = typeof coachProducts.$inferSelect;
export type InsertCoachProduct = z.infer<typeof insertCoachProductSchema>;

// Affiliate Products table (for admin-managed affiliate links)
export const affiliateProducts = pgTable("affiliate_products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category"), // e.g., "supplements", "equipment", "apparel"
  source: text("source"), // e.g., "amazon", "noon"
  isActive: boolean("is_active").default(true),
  lastScrapedAt: timestamp("last_scraped_at"),
  scrapeEnabled: boolean("scrape_enabled").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAffiliateProductSchema = createInsertSchema(affiliateProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScrapedAt: true
});

export type AffiliateProduct = typeof affiliateProducts.$inferSelect;
export type InsertAffiliateProduct = z.infer<typeof insertAffiliateProductSchema>;

// Affiliate Categories table (for dynamic category management)
export const affiliateCategories = pgTable("affiliate_categories", {
  id: serial("id").primaryKey(),
  nameEn: text("name_en").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAffiliateCategorySchema = createInsertSchema(affiliateCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type AffiliateCategory = typeof affiliateCategories.$inferSelect;
export type InsertAffiliateCategory = z.infer<typeof insertAffiliateCategorySchema>;

// Scraped Affiliate Products table (products extracted from category URLs)
export const scrapedAffiliateProducts = pgTable("scraped_affiliate_products", {
  id: serial("id").primaryKey(),
  affiliateProductId: integer("affiliate_product_id").references(() => affiliateProducts.id, { onDelete: 'cascade' }).notNull(),
  title: text("title").notNull(),
  price: text("price"),
  originalPrice: text("original_price"),
  discount: text("discount"),
  rating: real("rating"),
  reviewCount: integer("review_count"),
  imageUrl: text("image_url"),
  productUrl: text("product_url").notNull(),
  availability: text("availability"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScrapedAffiliateProductSchema = createInsertSchema(scrapedAffiliateProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type ScrapedAffiliateProduct = typeof scrapedAffiliateProducts.$inferSelect;
export type InsertScrapedAffiliateProduct = z.infer<typeof insertScrapedAffiliateProductSchema>;

// Product Clicks table (track user clicks on affiliate products)
export const productClicks = pgTable("product_clicks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  affiliateProductId: integer("affiliate_product_id").references(() => affiliateProducts.id, { onDelete: 'cascade' }).notNull(),
  clickedAt: timestamp("clicked_at").notNull().defaultNow(),
});

export const insertProductClickSchema = createInsertSchema(productClicks).omit({
  id: true,
  clickedAt: true
});

export type ProductClick = typeof productClicks.$inferSelect;
export type InsertProductClick = z.infer<typeof insertProductClickSchema>;

// Tracking & Ads global settings (single-row table)
export const trackingSettings = pgTable("tracking_settings", {
  id: serial("id").primaryKey(),
  metaPixelId: text("meta_pixel_id"),
  metaPixelAccessToken: text("meta_pixel_access_token"),
  metaPixelTestEventCode: text("meta_pixel_test_event_code"),
  googleAdsConversionId: text("google_ads_conversion_id"),
  googleAdsConversionLabel: text("google_ads_conversion_label"),
  googleAdsSendTo: text("google_ads_send_to"),
  googleAnalyticsMeasurementId: text("google_analytics_measurement_id"),
  googleAnalyticsApiSecret: text("google_analytics_api_secret"),
  googleAnalyticsStreamId: text("google_analytics_stream_id"),
  googleAnalyticsPropertyId: text("google_analytics_property_id"),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrackingSettingsSchema = createInsertSchema(trackingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TrackingSettings = typeof trackingSettings.$inferSelect;
export type InsertTrackingSettings = z.infer<typeof insertTrackingSettingsSchema>;

// User Points and Streaks table (for gamification)
export const userPointsAndStreaks = pgTable("user_points_and_streaks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  totalPoints: integer("total_points").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: timestamp("last_activity_date"),
  // Daily action tracking for point caps
  lastBreakfastLogDate: timestamp("last_breakfast_log_date"),
  lastLunchLogDate: timestamp("last_lunch_log_date"),
  lastDinnerLogDate: timestamp("last_dinner_log_date"),
  lastSnackLogDate: timestamp("last_snack_log_date"),
  snackLogsToday: integer("snack_logs_today").notNull().default(0),
  lastWorkoutLogDate: timestamp("last_workout_log_date"),
  lastWeightLogDate: timestamp("last_weight_log_date"),
  lastStorePurchaseDate: timestamp("last_store_purchase_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserPointsAndStreaksSchema = createInsertSchema(userPointsAndStreaks).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type UserPointsAndStreaks = typeof userPointsAndStreaks.$inferSelect;
export type InsertUserPointsAndStreaks = z.infer<typeof insertUserPointsAndStreaksSchema>;

// User Logins table (for tracking user login activity)
export const userLogins = pgTable("user_logins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  loginAt: timestamp("login_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const insertUserLoginSchema = createInsertSchema(userLogins).omit({
  id: true,
  loginAt: true
});

export type UserLogin = typeof userLogins.$inferSelect;
export type InsertUserLogin = z.infer<typeof insertUserLoginSchema>;

// ============================================================================
// SUPPLEMENTS FEATURE (Epic A)
// ============================================================================

// Supplements Catalog table (A1: Database)
export const supplements = pgTable("supplements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  forms: json("forms").$type<string[]>(), // capsule, powder, tablet, liquid, etc.
  ingredients: text("ingredients"),
  dosageRangeMin: real("dosage_range_min"),
  dosageRangeMax: real("dosage_range_max"),
  dosageUnit: text("dosage_unit"), // mg, g, ml, IU, etc.
  contraindications: text("contraindications"),
  interactions: text("interactions"),
  warnings: text("warnings"),
  categories: json("categories").$type<string[]>(), // protein, vitamins, minerals, pre-workout, etc.
  evidenceNotes: text("evidence_notes"),
  references: text("references"),
  isGlobal: boolean("is_global").default(true).notNull(), // true = admin-curated, false = coach-added
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  scopeCoachId: integer("scope_coach_id").references(() => users.id, { onDelete: 'cascade' }), // For coach-scoped supplements
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("supplements_name_idx").on(table.name),
  globalIdx: index("supplements_global_idx").on(table.isGlobal),
  createdByIdx: index("supplements_created_by_idx").on(table.createdBy),
}));

export const insertSupplementSchema = createInsertSchema(supplements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Supplement name is required"),
  forms: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  dosageRangeMin: z.number().positive().optional(),
  dosageRangeMax: z.number().positive().optional(),
  isGlobal: z.boolean().default(true),
});

export type Supplement = typeof supplements.$inferSelect;
export type InsertSupplement = z.infer<typeof insertSupplementSchema>;

// Supplement Recommendations table (A2 & A3: Dosage and Timing Guidance)
export const supplementRecommendations = pgTable("supplement_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  supplementId: integer("supplement_id").references(() => supplements.id, { onDelete: 'cascade' }).notNull(),
  coachId: integer("coach_id").references(() => users.id, { onDelete: 'set null' }), // Nullable to handle coach deletion
  
  // A2: Dosage Guidance
  dosageAmount: real("dosage_amount").notNull(),
  dosageUnit: text("dosage_unit").notNull(),
  dosageFrequency: text("dosage_frequency").notNull(), // daily, twice_daily, with_each_meal, etc.
  maxDailyLimit: real("max_daily_limit"),
  
  // Coach override
  isCustomDosage: boolean("is_custom_dosage").default(false),
  dosageRationale: text("dosage_rationale"),
  coachNotes: text("coach_notes"),
  
  // A3: Timing Guidance
  timingType: text("timing_type"), // morning, pre_workout, post_workout, with_meals, before_sleep
  timingDetails: json("timing_details").$type<{
    specificTime?: string; // HH:MM format
    relativeToWorkout?: 'before' | 'after' | 'during';
    minutesOffset?: number; // minutes before/after workout
    relativeToMeal?: 'with' | 'before' | 'after';
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'any';
  }>(),
  
  // Status and tracking
  status: text("status").default("active").notNull(), // active, paused, completed, discontinued
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  
  // A4: Warnings checked flag
  warningsChecked: boolean("warnings_checked").default(false),
  warningsAcknowledged: boolean("warnings_acknowledged").default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("supp_rec_user_idx").on(table.userId),
  supplementIdx: index("supp_rec_supplement_idx").on(table.supplementId),
  coachIdx: index("supp_rec_coach_idx").on(table.coachId),
  statusIdx: index("supp_rec_status_idx").on(table.status),
}));

export const insertSupplementRecommendationSchema = createInsertSchema(supplementRecommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  warningsChecked: true,
  warningsAcknowledged: true,
}).extend({
  userId: z.number().int().positive(),
  supplementId: z.number().int().positive(),
  coachId: z.number().int().positive().optional(), // Optional since it can be null if coach is deleted
  dosageAmount: z.number().positive(),
  dosageUnit: z.string().min(1),
  dosageFrequency: z.string().min(1),
  timingType: z.enum(['morning', 'pre_workout', 'post_workout', 'with_meals', 'before_sleep']).optional(),
  status: z.enum(['active', 'paused', 'completed', 'discontinued']).default('active'),
});

export type SupplementRecommendation = typeof supplementRecommendations.$inferSelect;
export type InsertSupplementRecommendation = z.infer<typeof insertSupplementRecommendationSchema>;

// Supplement Interactions table (A4: Warnings & Interactions)
export const supplementInteractions = pgTable("supplement_interactions", {
  id: serial("id").primaryKey(),
  supplementId: integer("supplement_id").references(() => supplements.id, { onDelete: 'cascade' }).notNull(),
  interactsWith: text("interacts_with").notNull(), // other supplement name, medication, condition
  interactionType: text("interaction_type").notNull(), // supplement, medication, medical_condition, allergy
  severity: text("severity").notNull(), // mild, moderate, severe, critical
  description: text("description").notNull(),
  actionRequired: text("action_required").default("warning").notNull(), // warning, confirmation_required, hard_block
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  supplementIdx: index("supp_int_supplement_idx").on(table.supplementId),
  severityIdx: index("supp_int_severity_idx").on(table.severity),
}));

export const insertSupplementInteractionSchema = createInsertSchema(supplementInteractions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  supplementId: z.number().int().positive(),
  interactsWith: z.string().min(1),
  interactionType: z.enum(['supplement', 'medication', 'medical_condition', 'allergy']),
  severity: z.enum(['mild', 'moderate', 'severe', 'critical']),
  actionRequired: z.enum(['warning', 'confirmation_required', 'hard_block']).default('warning'),
});

export type SupplementInteraction = typeof supplementInteractions.$inferSelect;
export type InsertSupplementInteraction = z.infer<typeof insertSupplementInteractionSchema>;

// User Supplement Warnings table (A4: Track flagged users)
export const userSupplementWarnings = pgTable("user_supplement_warnings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recommendationId: integer("recommendation_id").references(() => supplementRecommendations.id, { onDelete: 'cascade' }).notNull(),
  interactionId: integer("interaction_id").references(() => supplementInteractions.id, { onDelete: 'set null' }),
  severity: text("severity").notNull(),
  warningMessage: text("warning_message").notNull(),
  flaggedReason: text("flagged_reason").notNull(), // Details of what triggered the warning
  status: text("status").default("pending").notNull(), // pending, acknowledged, resolved, overridden
  acknowledgedBy: integer("acknowledged_by").references(() => users.id, { onDelete: 'set null' }), // Coach or admin who acknowledged
  acknowledgedAt: timestamp("acknowledged_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("user_supp_warn_user_idx").on(table.userId),
  recIdx: index("user_supp_warn_rec_idx").on(table.recommendationId),
  statusIdx: index("user_supp_warn_status_idx").on(table.status),
  severityIdx: index("user_supp_warn_severity_idx").on(table.severity),
}));

export const insertUserSupplementWarningSchema = createInsertSchema(userSupplementWarnings).omit({
  id: true,
  createdAt: true,
  acknowledgedAt: true,
}).extend({
  userId: z.number().int().positive(),
  recommendationId: z.number().int().positive(),
  severity: z.enum(['mild', 'moderate', 'severe', 'critical']),
  status: z.enum(['pending', 'acknowledged', 'resolved', 'overridden']).default('pending'),
});

export type UserSupplementWarning = typeof userSupplementWarnings.$inferSelect;
export type InsertUserSupplementWarning = z.infer<typeof insertUserSupplementWarningSchema>;

// ============================================================================
// EPIC B: SUPPLEMENTS FOLLOW-UP (المتابعة)
// ============================================================================

// B1: Supplement Reminders (تذكير بالمكملات)
export const supplementReminders = pgTable("supplement_reminders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recommendationId: integer("recommendation_id").references(() => supplementRecommendations.id, { onDelete: 'cascade' }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  reminderTimes: json("reminder_times").$type<string[]>(), // Array of times in HH:MM format
  reminderDays: json("reminder_days").$type<string[]>(), // Array of days: monday, tuesday, etc.
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("supp_reminder_user_idx").on(table.userId),
  recIdx: index("supp_reminder_rec_idx").on(table.recommendationId),
  enabledIdx: index("supp_reminder_enabled_idx").on(table.enabled),
}));

export const insertSupplementReminderSchema = createInsertSchema(supplementReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSentAt: true,
}).extend({
  userId: z.number().int().positive(),
  recommendationId: z.number().int().positive(),
  enabled: z.boolean().default(true),
  reminderTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)).optional(),
  reminderDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
});

export type SupplementReminder = typeof supplementReminders.$inferSelect;
export type InsertSupplementReminder = z.infer<typeof insertSupplementReminderSchema>;

// B2: Side Effects Logging (تسجيل الأعراض الجانبية)
export const supplementSideEffects = pgTable("supplement_side_effects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recommendationId: integer("recommendation_id").references(() => supplementRecommendations.id, { onDelete: 'cascade' }).notNull(),
  supplementId: integer("supplement_id").references(() => supplements.id, { onDelete: 'set null' }),
  severity: text("severity").notNull(), // mild, moderate, severe, critical
  symptoms: text("symptoms").notNull(), // Description of symptoms
  notes: text("notes"),
  photo: text("photo"), // URL or path to photo
  occurredAt: timestamp("occurred_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
  status: text("status").default("active").notNull(), // active, resolved, escalated
  escalatedTo: integer("escalated_to").references(() => users.id, { onDelete: 'set null' }), // Coach or admin
  escalatedAt: timestamp("escalated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("supp_side_eff_user_idx").on(table.userId),
  recIdx: index("supp_side_eff_rec_idx").on(table.recommendationId),
  severityIdx: index("supp_side_eff_severity_idx").on(table.severity),
  statusIdx: index("supp_side_eff_status_idx").on(table.status),
}));

export const insertSupplementSideEffectSchema = createInsertSchema(supplementSideEffects).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  escalatedAt: true,
}).extend({
  userId: z.number().int().positive(),
  recommendationId: z.number().int().positive(),
  severity: z.enum(['mild', 'moderate', 'severe', 'critical']),
  symptoms: z.string().min(1),
  status: z.enum(['active', 'resolved', 'escalated']).default('active'),
  occurredAt: z.date().or(z.string()),
});

export type SupplementSideEffect = typeof supplementSideEffects.$inferSelect;
export type InsertSupplementSideEffect = z.infer<typeof insertSupplementSideEffectSchema>;

// B3: Effectiveness Rating (تقييم الفاعلية)
export const supplementEffectivenessRatings = pgTable("supplement_effectiveness_ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recommendationId: integer("recommendation_id").references(() => supplementRecommendations.id, { onDelete: 'cascade' }).notNull(),
  supplementId: integer("supplement_id").references(() => supplements.id, { onDelete: 'set null' }),
  rating: integer("rating").notNull(), // 1-5 scale
  notes: text("notes"),
  ratingPeriodStart: timestamp("rating_period_start"),
  ratingPeriodEnd: timestamp("rating_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("supp_eff_rating_user_idx").on(table.userId),
  recIdx: index("supp_eff_rating_rec_idx").on(table.recommendationId),
  suppIdx: index("supp_eff_rating_supp_idx").on(table.supplementId),
  ratingIdx: index("supp_eff_rating_rating_idx").on(table.rating),
}));

export const insertSupplementEffectivenessRatingSchema = createInsertSchema(supplementEffectivenessRatings).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.number().int().positive(),
  recommendationId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  ratingPeriodStart: z.date().or(z.string()).optional(),
  ratingPeriodEnd: z.date().or(z.string()).optional(),
});

export type SupplementEffectivenessRating = typeof supplementEffectivenessRatings.$inferSelect;
export type InsertSupplementEffectivenessRating = z.infer<typeof insertSupplementEffectivenessRatingSchema>;

// ============================================================================
// EPIC C: SMART ALERTS & NOTIFICATIONS (التنبيهات الذكية)
// ============================================================================

// C1, C2, C3, C4: Unified Reminders/Notifications System
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: text("type").notNull(), // meal, workout, supplement, sleep, water, motivational, achievement
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  status: text("status").default("pending").notNull(), // pending, sent, read, dismissed
  relatedEntityType: text("related_entity_type"), // recommendation, workout, meal, etc.
  relatedEntityId: integer("related_entity_id"),
  metadata: json("metadata"), // Additional context data
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("notif_user_idx").on(table.userId),
  typeIdx: index("notif_type_idx").on(table.type),
  statusIdx: index("notif_status_idx").on(table.status),
  scheduledIdx: index("notif_scheduled_idx").on(table.scheduledFor),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  readAt: true,
}).extend({
  userId: z.number().int().positive(),
  type: z.enum(['meal', 'workout', 'supplement', 'sleep', 'water', 'motivational', 'achievement']),
  title: z.string().min(1),
  message: z.string().min(1),
  status: z.enum(['pending', 'sent', 'read', 'dismissed']).default('pending'),
  scheduledFor: z.date().or(z.string()).optional(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Reminder Settings - User preferences for different reminder types
export const reminderSettings = pgTable("reminder_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reminderType: text("reminder_type").notNull(), // meal, workout, supplement, sleep, water
  enabled: boolean("enabled").default(true).notNull(),
  times: json("times").$type<string[]>(), // Array of HH:MM times
  days: json("days").$type<string[]>(), // Array of day names
  customMessage: text("custom_message"),
  customMessageAr: text("custom_message_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("reminder_set_user_idx").on(table.userId),
  typeIdx: index("reminder_set_type_idx").on(table.reminderType),
  enabledIdx: index("reminder_set_enabled_idx").on(table.enabled),
  uniqueUserType: uniqueIndex("reminder_set_user_type_idx").on(table.userId, table.reminderType),
}));

export const insertReminderSettingSchema = createInsertSchema(reminderSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.number().int().positive(),
  reminderType: z.enum(['meal', 'workout', 'supplement', 'sleep', 'water']),
  enabled: z.boolean().default(true),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)).optional(),
  days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).optional(),
});

export type ReminderSetting = typeof reminderSettings.$inferSelect;
export type InsertReminderSetting = z.infer<typeof insertReminderSettingSchema>;

// C5: Motivational Message Templates
export const motivationalTemplates = pgTable("motivational_templates", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(), // streak_achieved, inactivity_detected, goal_milestone, etc.
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0), // Higher priority messages sent first
  minStreakDays: integer("min_streak_days"), // For streak_achieved trigger
  inactivityDays: integer("inactivity_days"), // For inactivity_detected trigger
  createdBy: integer("created_by").references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  triggerIdx: index("motiv_tmpl_trigger_idx").on(table.trigger),
  activeIdx: index("motiv_tmpl_active_idx").on(table.isActive),
}));

export const insertMotivationalTemplateSchema = createInsertSchema(motivationalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  trigger: z.enum(['streak_achieved', 'inactivity_detected', 'goal_milestone', 'workout_completed', 'nutrition_target_hit']),
  title: z.string().min(1),
  message: z.string().min(1),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
});

export type MotivationalTemplate = typeof motivationalTemplates.$inferSelect;
export type InsertMotivationalTemplate = z.infer<typeof insertMotivationalTemplateSchema>;

// C6: Achievement Milestones
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  achievementType: text("achievement_type").notNull(), // workout_streak, nutrition_adherence, weight_milestone, supplement_adherence
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  value: integer("value"), // Numeric value (e.g., 7 for 7-day streak)
  metadata: json("metadata"), // Additional context
  achievedAt: timestamp("achieved_at").notNull().defaultNow(),
  notificationSent: boolean("notification_sent").default(false),
}, (table) => ({
  userIdx: index("achievement_user_idx").on(table.userId),
  typeIdx: index("achievement_type_idx").on(table.achievementType),
  achievedIdx: index("achievement_achieved_idx").on(table.achievedAt),
}));

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  achievedAt: true,
  notificationSent: true,
}).extend({
  userId: z.number().int().positive(),
  achievementType: z.enum(['workout_streak', 'nutrition_adherence', 'weight_milestone', 'supplement_adherence', 'consistency_streak']),
  title: z.string().min(1),
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;

// C2: Missed Workout Tracking
export const missedWorkouts = pgTable("missed_workouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  workoutId: integer("workout_id").references(() => workouts.id, { onDelete: 'set null' }),
  notificationSent: boolean("notification_sent").default(false),
  coachNotified: boolean("coach_notified").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("missed_workout_user_idx").on(table.userId),
  scheduledIdx: index("missed_workout_scheduled_idx").on(table.scheduledDate),
}));

export const insertMissedWorkoutSchema = createInsertSchema(missedWorkouts).omit({
  id: true,
  createdAt: true,
  notificationSent: true,
  coachNotified: true,
}).extend({
  userId: z.number().int().positive(),
  scheduledDate: z.date().or(z.string()),
});

export type MissedWorkout = typeof missedWorkouts.$inferSelect;
export type InsertMissedWorkout = z.infer<typeof insertMissedWorkoutSchema>;

// ============================================================================
// EPIC D: FILES & REPORTS (الملفات والتقارير)
// ============================================================================

// D1: File Management (إدارة الملفات)
export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  coachId: integer("coach_id").references(() => users.id, { onDelete: 'set null' }),
  fileType: text("file_type").notNull(), // progress_photo, image, medical_report, pdf, excel, video
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // Secure URL (signed or protected)
  fileSize: integer("file_size").notNull(), // In bytes
  mimeType: text("mime_type").notNull(),
  tags: json("tags").$type<string[]>(), // Array of tags for categorization
  description: text("description"),
  descriptionAr: text("description_ar"),
  visibility: text("visibility").default("private").notNull(), // private, coach_visible, admin_visible
  uploadDate: timestamp("upload_date").notNull().defaultNow(),
  linkedEntityType: text("linked_entity_type"), // workout, meal, progress_log, supplement, etc.
  linkedEntityId: integer("linked_entity_id"),
  virusScanStatus: text("virus_scan_status").default("pending"), // pending, clean, infected, skipped
  virusScanDate: timestamp("virus_scan_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("uploaded_files_user_idx").on(table.userId),
  coachIdx: index("uploaded_files_coach_idx").on(table.coachId),
  typeIdx: index("uploaded_files_type_idx").on(table.fileType),
  visibilityIdx: index("uploaded_files_visibility_idx").on(table.visibility),
  uploadDateIdx: index("uploaded_files_upload_date_idx").on(table.uploadDate),
}));

export const insertUploadedFileSchema = createInsertSchema(uploadedFiles).omit({
  id: true,
  createdAt: true,
  uploadDate: true,
  virusScanDate: true,
}).extend({
  userId: z.number().int().positive(),
  fileType: z.enum(['progress_photo', 'image', 'medical_report', 'pdf', 'excel', 'video', 'other']),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  visibility: z.enum(['private', 'coach_visible', 'admin_visible']).default('private'),
  virusScanStatus: z.enum(['pending', 'clean', 'infected', 'skipped']).default('pending'),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;

// D2: Reports - Weekly/Monthly Summary Reports
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reportType: text("report_type").notNull(), // weekly, monthly, custom
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  generatedBy: integer("generated_by").references(() => users.id, { onDelete: 'set null' }), // Coach or admin who generated
  reportData: json("report_data").notNull(), // All report metrics as JSON
  pdfUrl: text("pdf_url"), // Optional PDF export URL
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("reports_user_idx").on(table.userId),
  typeIdx: index("reports_type_idx").on(table.reportType),
  periodIdx: index("reports_period_idx").on(table.periodStart, table.periodEnd),
}));

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.number().int().positive(),
  reportType: z.enum(['weekly', 'monthly', 'custom']),
  periodStart: z.date().or(z.string()),
  periodEnd: z.date().or(z.string()),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

// D2: Progress Snapshots - Weight & Measurements over time
export const progressSnapshots = pgTable("progress_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  recordDate: timestamp("record_date").notNull(),
  weight: real("weight"), // kg
  bodyFat: real("body_fat"), // percentage
  muscleMass: real("muscle_mass"), // kg
  measurements: json("measurements").$type<{
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
    [key: string]: number | undefined;
  }>(),
  photos: json("photos").$type<number[]>(), // Array of uploaded_files IDs
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("progress_snap_user_idx").on(table.userId),
  dateIdx: index("progress_snap_date_idx").on(table.recordDate),
}));

export const insertProgressSnapshotSchema = createInsertSchema(progressSnapshots).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.number().int().positive(),
  recordDate: z.date().or(z.string()),
});

export type ProgressSnapshot = typeof progressSnapshots.$inferSelect;
export type InsertProgressSnapshot = z.infer<typeof insertProgressSnapshotSchema>;


// ====================
// Courses and Lessons (for Ads & Courses Epic)
// ====================

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  
  // Bilingual content
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  
  // Course details
  category: text("category").notNull(), // fitness, nutrition, wellness, business
  level: text("level").notNull(), // beginner, intermediate, advanced
  duration: integer("duration"), // estimated duration in hours
  
  // Media
  thumbnailUrl: text("thumbnail_url"),
  previewVideoUrl: text("preview_video_url"),
  
  // Pricing
  price: real("price").default(0),
  currency: text("currency").default("USD"),
  isFree: boolean("is_free").default(false),
  
  // Metadata
  tags: json("tags").$type<string[]>().default([]),
  instructorId: integer("instructor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Publishing controls
  status: text("status").notNull().default("draft"), // draft, published, archived
  featured: boolean("featured").default(false),
  
  // Certificate
  certificateEnabled: boolean("certificate_enabled").default(false),
  certificateTemplate: text("certificate_template"),
  
  // Engagement
  enrollmentCount: integer("enrollment_count").default(0),
  averageRating: real("average_rating").default(0),
  ratingCount: integer("rating_count").default(0),
  
  // Timestamps
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("courses_category_idx").on(table.category),
  levelIdx: index("courses_level_idx").on(table.level),
  statusIdx: index("courses_status_idx").on(table.status),
  instructorIdx: index("courses_instructor_idx").on(table.instructorId),
  featuredIdx: index("courses_featured_idx").on(table.featured),
}));

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  
  // Bilingual content
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  content: text("content"),
  contentAr: text("content_ar"),
  
  // Lesson details
  orderIndex: integer("order_index").notNull().default(0),
  type: text("type").notNull(), // video, article, quiz, assignment
  duration: integer("duration"), // in minutes
  
  // Media
  videoUrl: text("video_url"),
  attachments: json("attachments").$type<string[]>().default([]),
  
  // Quiz data (if type is quiz)
  quizData: json("quiz_data").$type<Record<string, any>>(),
  
  // Publishing
  isPreview: boolean("is_preview").default(false), // can be viewed without enrollment
  status: text("status").notNull().default("draft"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  courseIdx: index("lessons_course_idx").on(table.courseId),
  orderIdx: index("lessons_order_idx").on(table.orderIndex),
  typeIdx: index("lessons_type_idx").on(table.type),
}));

export const courseEnrollments = pgTable("course_enrollments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Progress tracking
  progress: integer("progress").default(0), // 0-100
  currentLessonId: integer("current_lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // Certificate
  certificateIssued: boolean("certificate_issued").default(false),
  certificateUrl: text("certificate_url"),
  certificateIssuedAt: timestamp("certificate_issued_at"),
  
  // Timestamps
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
}, (table) => ({
  courseIdx: index("course_enrollments_course_idx").on(table.courseId),
  userIdx: index("course_enrollments_user_idx").on(table.userId),
  uniqueEnrollment: uniqueIndex("course_enrollments_unique").on(table.courseId, table.userId),
}));

export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  enrollmentId: integer("enrollment_id").notNull().references(() => courseEnrollments.id, { onDelete: "cascade" }),
  lessonId: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Progress
  completed: boolean("completed").default(false),
  timeSpent: integer("time_spent").default(0), // in seconds
  
  // Quiz results (if lesson type is quiz)
  quizScore: integer("quiz_score"),
  quizAttempts: integer("quiz_attempts").default(0),
  
  // Timestamps
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
}, (table) => ({
  enrollmentIdx: index("lesson_progress_enrollment_idx").on(table.enrollmentId),
  lessonIdx: index("lesson_progress_lesson_idx").on(table.lessonId),
  userIdx: index("lesson_progress_user_idx").on(table.userId),
  uniqueProgress: uniqueIndex("lesson_progress_unique").on(table.enrollmentId, table.lessonId),
}));

export const courseReviews = pgTable("course_reviews", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  rating: integer("rating").notNull(), // 1-5
  review: text("review"),
  
  // Moderation
  isApproved: boolean("is_approved").default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  courseIdx: index("course_reviews_course_idx").on(table.courseId),
  userIdx: index("course_reviews_user_idx").on(table.userId),
  uniqueReview: uniqueIndex("course_reviews_unique").on(table.courseId, table.userId),
}));

// Course relations
export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
  }),
  lessons: many(lessons),
  enrollments: many(courseEnrollments),
  reviews: many(courseReviews),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
}));

export const courseEnrollmentsRelations = relations(courseEnrollments, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseEnrollments.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [courseEnrollments.userId],
    references: [users.id],
  }),
  currentLesson: one(lessons, {
    fields: [courseEnrollments.currentLessonId],
    references: [lessons.id],
  }),
  lessonProgress: many(lessonProgress),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  enrollment: one(courseEnrollments, {
    fields: [lessonProgress.enrollmentId],
    references: [courseEnrollments.id],
  }),
  lesson: one(lessons, {
    fields: [lessonProgress.lessonId],
    references: [lessons.id],
  }),
  user: one(users, {
    fields: [lessonProgress.userId],
    references: [users.id],
  }),
}));

export const courseReviewsRelations = relations(courseReviews, ({ one }) => ({
  course: one(courses, {
    fields: [courseReviews.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [courseReviews.userId],
    references: [users.id],
  }),
}));

// Course Certificates table - for managing certificate templates and assignments
export const courseCertificates = pgTable("course_certificates", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  
  // Bilingual certificate info
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  templateUrl: text("template_url"), // URL to certificate design template
  
  // Issuance settings
  issueAutomatically: boolean("issue_automatically").default(false),
  issueUponCompletion: boolean("issue_upon_completion").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  courseIdx: index("course_certificates_course_idx").on(table.courseId),
  uniqueCert: uniqueIndex("course_certificates_unique").on(table.courseId, table.title),
}));

// Course Certificate Issuances table - for tracking manual certificate issuances
export const courseCertificateIssuances = pgTable("course_certificate_issuances", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").notNull().references(() => courseCertificates.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  
  // Status
  issuedAt: timestamp("issued_at").defaultNow(),
  certificateUrl: text("certificate_url"),
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  certificateIdx: index("cert_issuances_cert_idx").on(table.certificateId),
  userIdx: index("cert_issuances_user_idx").on(table.userId),
  courseIdx: index("cert_issuances_course_idx").on(table.courseId),
  uniqueIssuance: uniqueIndex("cert_issuances_unique").on(table.certificateId, table.userId),
}));

// Course Certificate relations
export const courseCertificatesRelations = relations(courseCertificates, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseCertificates.courseId],
    references: [courses.id],
  }),
  issuances: many(courseCertificateIssuances),
}));

export const courseCertificateIssuancesRelations = relations(courseCertificateIssuances, ({ one }) => ({
  certificate: one(courseCertificates, {
    fields: [courseCertificateIssuances.certificateId],
    references: [courseCertificates.id],
  }),
  user: one(users, {
    fields: [courseCertificateIssuances.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [courseCertificateIssuances.courseId],
    references: [courses.id],
  }),
}));

// Insert schemas
export const insertCourseCertificateSchema = createInsertSchema(courseCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourseCertificateIssuanceSchema = createInsertSchema(courseCertificateIssuances).omit({
  id: true,
  issuedAt: true,
  createdAt: true,
});

// Types
export type CourseCertificate = typeof courseCertificates.$inferSelect;
export type InsertCourseCertificate = z.infer<typeof insertCourseCertificateSchema>;
export type CourseCertificateIssuance = typeof courseCertificateIssuances.$inferSelect;
export type InsertCourseCertificateIssuance = z.infer<typeof insertCourseCertificateIssuanceSchema>;

// Insert schemas for courses
export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  enrollmentCount: true,
  averageRating: true,
  ratingCount: true,
});

export const insertLessonSchema = createInsertSchema(lessons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourseEnrollmentSchema = createInsertSchema(courseEnrollments).omit({
  id: true,
  enrolledAt: true,
});

export const insertCourseReviewSchema = createInsertSchema(courseReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;
export type InsertCourseEnrollment = z.infer<typeof insertCourseEnrollmentSchema>;
export type CourseReview = typeof courseReviews.$inferSelect;
export type InsertCourseReview = z.infer<typeof insertCourseReviewSchema>;

// ============================================================
// EPIC E: AI ASSISTANT
// ============================================================

// E1: AI Conversations - Basic Assistant conversation history
export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  messageType: text("message_type").notNull().$type<'question' | 'answer' | 'guidance' | 'error' | 'escalation'>(),
  messageText: text("message_text").notNull(),
  messageTextAr: text("message_text_ar"),
  contextData: json("context_data").$type<Record<string, any>>(),
  confidenceScore: real("confidence_score"),
  language: text("language").notNull().default('en').$type<'en' | 'ar'>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("ai_conv_user_idx").on(table.userId),
  createdIdx: index("ai_conv_created_idx").on(table.createdAt),
}));

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.number().int().positive(),
  messageType: z.enum(['question', 'answer', 'guidance', 'error', 'escalation']),
  language: z.enum(['en', 'ar']).default('en'),
  confidenceScore: z.number().min(0).max(1).optional(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;

// E2: AI Insights - Advanced Assistant behavior analysis and risk prediction
export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  insightType: text("insight_type").notNull().$type<'adherence_pattern' | 'risk_prediction' | 'progress_analysis' | 'recommendation'>(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  keySignals: json("key_signals").$type<Array<{ signal: string; value: any; importance: string }>>(),
  confidenceScore: real("confidence_score").notNull(),
  riskLevel: text("risk_level").$type<'low' | 'moderate' | 'high' | 'critical'>(),
  trend: text("trend").$type<'improving' | 'stable' | 'declining'>(),
  language: text("language").notNull().default('en').$type<'en' | 'ar'>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  userIdx: index("ai_insights_user_idx").on(table.userId),
  typeIdx: index("ai_insights_type_idx").on(table.insightType),
  riskIdx: index("ai_insights_risk_idx").on(table.riskLevel),
  activeIdx: index("ai_insights_active_idx").on(table.isActive, table.createdAt),
}));

export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.number().int().positive(),
  insightType: z.enum(['adherence_pattern', 'risk_prediction', 'progress_analysis', 'recommendation']),
  confidenceScore: z.number().min(0).max(1),
  riskLevel: z.enum(['low', 'moderate', 'high', 'critical']).optional(),
  trend: z.enum(['improving', 'stable', 'declining']).optional(),
  language: z.enum(['en', 'ar']).default('en'),
});

export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;

// E2: AI Plan Suggestions - Auto-personalization with coach approval
export const aiPlanSuggestions = pgTable("ai_plan_suggestions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  coachId: integer("coach_id").references(() => users.id, { onDelete: 'set null' }),
  insightId: integer("insight_id").references(() => aiInsights.id, { onDelete: 'set null' }),
  suggestionType: text("suggestion_type").notNull().$type<'workout_intensity' | 'rest_days' | 'calorie_target' | 'macro_ratio' | 'exercise_substitution' | 'other'>(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  rationale: text("rationale").notNull(),
  rationaleAr: text("rationale_ar"),
  currentPlan: json("current_plan").$type<Record<string, any>>(),
  suggestedPlan: json("suggested_plan").$type<Record<string, any>>(),
  diffSummary: text("diff_summary"),
  diffSummaryAr: text("diff_summary_ar"),
  status: text("status").notNull().default('pending').$type<'pending' | 'approved' | 'rejected' | 'applied'>(),
  approvedBy: integer("approved_by").references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp("approved_at"),
  appliedAt: timestamp("applied_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("ai_suggestions_user_idx").on(table.userId),
  coachIdx: index("ai_suggestions_coach_idx").on(table.coachId),
  statusIdx: index("ai_suggestions_status_idx").on(table.status),
  pendingIdx: index("ai_suggestions_pending_idx").on(table.status, table.createdAt),
}));

export const insertAiPlanSuggestionSchema = createInsertSchema(aiPlanSuggestions).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  appliedAt: true,
}).extend({
  userId: z.number().int().positive(),
  coachId: z.number().int().positive().optional(),
  insightId: z.number().int().positive().optional(),
  suggestionType: z.enum(['workout_intensity', 'rest_days', 'calorie_target', 'macro_ratio', 'exercise_substitution', 'other']),
  status: z.enum(['pending', 'approved', 'rejected', 'applied']).default('pending'),
});

export type AiPlanSuggestion = typeof aiPlanSuggestions.$inferSelect;
export type InsertAiPlanSuggestion = z.infer<typeof insertAiPlanSuggestionSchema>;

// E3: Escalation Requests - Unified escalation tracking
export const escalationRequests = pgTable("escalation_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  escalationType: text("escalation_type").notNull().$type<'coach_handoff' | 'admin_support' | 'consultation_booking' | 'medical_referral'>(),
  triggerSource: text("trigger_source").notNull().$type<'side_effect' | 'repeated_failure' | 'user_request' | 'risk_prediction' | 'medical_concern' | 'ai_assistant'>(),
  priority: text("priority").notNull().default('medium').$type<'low' | 'medium' | 'high' | 'urgent'>(),
  status: text("status").notNull().default('pending').$type<'pending' | 'assigned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'>(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  
  // Linked entities
  sideEffectId: integer("side_effect_id").references(() => supplementSideEffects.id, { onDelete: 'set null' }),
  missedWorkoutId: integer("missed_workout_id").references(() => missedWorkouts.id, { onDelete: 'set null' }),
  insightId: integer("insight_id").references(() => aiInsights.id, { onDelete: 'set null' }),
  conversationId: integer("conversation_id").references(() => aiConversations.id, { onDelete: 'set null' }),
  
  // Assignment and scheduling
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: 'set null' }),
  assignedAt: timestamp("assigned_at"),
  scheduledAt: timestamp("scheduled_at"),
  
  // Resolution
  resolvedBy: integer("resolved_by").references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("escalation_user_idx").on(table.userId),
  assignedIdx: index("escalation_assigned_idx").on(table.assignedTo),
  statusIdx: index("escalation_status_idx").on(table.status),
  priorityIdx: index("escalation_priority_idx").on(table.priority, table.createdAt),
  pendingIdx: index("escalation_pending_idx").on(table.status, table.priority),
  typeIdx: index("escalation_type_idx").on(table.escalationType),
}));

export const insertEscalationRequestSchema = createInsertSchema(escalationRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  assignedAt: true,
  resolvedAt: true,
}).extend({
  userId: z.number().int().positive(),
  escalationType: z.enum(['coach_handoff', 'admin_support', 'consultation_booking', 'medical_referral']),
  triggerSource: z.enum(['side_effect', 'repeated_failure', 'user_request', 'risk_prediction', 'medical_concern', 'ai_assistant']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled']).default('pending'),
});

export type EscalationRequest = typeof escalationRequests.$inferSelect;
export type InsertEscalationRequest = z.infer<typeof insertEscalationRequestSchema>;

// ============================================================================
// Epic F: Community & Engagement
// ============================================================================

// F1: Social Interactions

// Friendships table
export const friendships: ReturnType<typeof pgTable> = pgTable("friendships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: integer("friend_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default('pending'), // pending, accepted, rejected, blocked
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("friendships_user_idx").on(table.userId),
  friendIdx: index("friendships_friend_idx").on(table.friendId),
  statusIdx: index("friendships_status_idx").on(table.status),
}));

// Achievement Shares table
export const achievementShares: ReturnType<typeof pgTable> = pgTable("achievement_shares", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: integer("achievement_id").notNull().references(() => achievements.id, { onDelete: 'cascade' }),
  visibility: text("visibility").notNull().default('friends_only'), // private, friends_only, public
  shareType: text("share_type").notNull().default('general'), // general, group, challenge
  groupId: integer("group_id").references(() => groups.id, { onDelete: 'set null' }),
  message: text("message"),
  messageAr: text("message_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("achievement_shares_user_idx").on(table.userId),
  achievementIdx: index("achievement_shares_achievement_idx").on(table.achievementId),
  visibilityIdx: index("achievement_shares_visibility_idx").on(table.visibility),
  groupIdx: index("achievement_shares_group_idx").on(table.groupId),
}));

// Group Challenges table
export const groupChallenges: ReturnType<typeof pgTable> = pgTable("group_challenges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  mediaUrls: json("media_urls").$type<Array<{ url: string; type: "image" | "video" }>>().default([]),
  challengeType: text("challenge_type").notNull(), // workout_count, weight_loss, step_count, nutrition_adherence, custom
  metricName: text("metric_name").notNull(),
  targetValue: real("target_value"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: 'set null' }),
  groupId: integer("group_id").references(() => groups.id, { onDelete: 'cascade' }),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  createdByIdx: index("group_challenges_created_by_idx").on(table.createdBy),
  groupIdx: index("group_challenges_group_idx").on(table.groupId),
  datesIdx: index("group_challenges_dates_idx").on(table.startDate, table.endDate),
}));

// Challenge Participants table
export const challengeParticipants: ReturnType<typeof pgTable> = pgTable("challenge_participants", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => groupChallenges.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  currentValue: real("current_value").default(0),
  rank: integer("rank"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
}, (table) => ({
  challengeIdx: index("challenge_participants_challenge_idx").on(table.challengeId),
  userIdx: index("challenge_participants_user_idx").on(table.userId),
  rankIdx: index("challenge_participants_rank_idx").on(table.rank),
}));

// Encouragements table
export const encouragements: ReturnType<typeof pgTable> = pgTable("encouragements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: text("target_type").notNull(), // achievement_share, challenge_progress, discussion_topic, topic_reply
  targetId: integer("target_id").notNull(),
  reactionType: text("reaction_type").notNull().default('like'), // like, cheer, fire, celebrate, strong
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("encouragements_user_idx").on(table.userId),
  targetIdx: index("encouragements_target_idx").on(table.targetType, table.targetId),
}));

// Content Reports table
export const contentReports: ReturnType<typeof pgTable> = pgTable("content_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").notNull().references(() => users.id, { onDelete: 'set null' }),
  contentType: text("content_type").notNull(), // achievement_share, discussion_topic, topic_reply, user_profile
  contentId: integer("content_id").notNull(),
  reportType: text("report_type").notNull(), // spam, harassment, inappropriate, fake_profile, other
  reason: text("reason").notNull(),
  status: text("status").notNull().default('pending'), // pending, under_review, resolved, dismissed
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: 'set null' }),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  reporterIdx: index("content_reports_reporter_idx").on(table.reporterId),
  contentIdx: index("content_reports_content_idx").on(table.contentType, table.contentId),
  statusIdx: index("content_reports_status_idx").on(table.status),
  assignedIdx: index("content_reports_assigned_idx").on(table.assignedTo),
}));

// F2: Groups

// Groups table
export const groups: ReturnType<typeof pgTable> = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  goalType: text("goal_type").notNull(), // weight_loss, muscle_gain, endurance, flexibility, general_fitness
  groupType: text("group_type").notNull().default('public'), // public, private
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: 'set null' }),
  maxMembers: integer("max_members"),
  memberCount: integer("member_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index("groups_owner_idx").on(table.ownerId),
  goalIdx: index("groups_goal_idx").on(table.goalType),
  typeIdx: index("groups_type_idx").on(table.groupType),
}));

// Group Members table
export const groupMembers: ReturnType<typeof pgTable> = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text("role").notNull().default('member'), // owner, moderator, member
  status: text("status").notNull().default('active'), // pending, active, removed, banned
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  groupIdx: index("group_members_group_idx").on(table.groupId),
  userIdx: index("group_members_user_idx").on(table.userId),
  roleIdx: index("group_members_role_idx").on(table.role),
  statusIdx: index("group_members_status_idx").on(table.status),
}));

// Discussion Topics table
export const discussionTopics: ReturnType<typeof pgTable> = pgTable("discussion_topics", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: 'cascade' }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  status: text("status").notNull().default('open'), // open, closed, locked
  replyCount: integer("reply_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  groupIdx: index("discussion_topics_group_idx").on(table.groupId),
  authorIdx: index("discussion_topics_author_idx").on(table.authorId),
  statusIdx: index("discussion_topics_status_idx").on(table.status),
  pinnedIdx: index("discussion_topics_pinned_idx").on(table.isPinned),
}));

// Topic Replies table
export const topicReplies: ReturnType<typeof pgTable> = pgTable("topic_replies", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull().references(() => discussionTopics.id, { onDelete: 'cascade' }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: 'set null' }),
  parentReplyId: integer("parent_reply_id").references(() => topicReplies.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  topicIdx: index("topic_replies_topic_idx").on(table.topicId),
  authorIdx: index("topic_replies_author_idx").on(table.authorId),
  parentIdx: index("topic_replies_parent_idx").on(table.parentReplyId),
}));

// Workshops table
export const workshops: ReturnType<typeof pgTable> = pgTable("workshops", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id, { onDelete: 'set null' }),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  instructorId: integer("instructor_id").notNull().references(() => users.id, { onDelete: 'set null' }),
  workshopType: text("workshop_type").notNull(), // nutrition, workout, mindset, supplement, general
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  maxAttendees: integer("max_attendees"),
  price: real("price").default(0),
  meetingLink: text("meeting_link"),
  status: text("status").notNull().default('scheduled'), // scheduled, in_progress, completed, cancelled
  attendeeCount: integer("attendee_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  groupIdx: index("workshops_group_idx").on(table.groupId),
  instructorIdx: index("workshops_instructor_idx").on(table.instructorId),
  scheduledIdx: index("workshops_scheduled_idx").on(table.scheduledAt),
  statusIdx: index("workshops_status_idx").on(table.status),
}));

// Workshop Attendees table
export const workshopAttendees: ReturnType<typeof pgTable> = pgTable("workshop_attendees", {
  id: serial("id").primaryKey(),
  workshopId: integer("workshop_id").notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  registrationStatus: text("registration_status").notNull().default('registered'), // registered, attended, cancelled, no_show
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
  attendedAt: timestamp("attended_at"),
}, (table) => ({
  workshopIdx: index("workshop_attendees_workshop_idx").on(table.workshopId),
  userIdx: index("workshop_attendees_user_idx").on(table.userId),
}));

// F3: Referrals & Rewards

// Referrals table
export const referrals: ReturnType<typeof pgTable> = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  referralCode: text("referral_code").notNull().unique(),
  referralType: text("referral_type").notNull().default('user'), // user, coach, gym, partner
  
  // Referred user tracking
  referredUserId: integer("referred_user_id").references(() => users.id, { onDelete: 'set null' }),
  conversionStatus: text("conversion_status").notNull().default('pending'), // pending, registered, plan_purchased, subscription_active, revenue_milestone
  conversionDate: timestamp("conversion_date"),
  
  // Commission tracking
  revenueGenerated: real("revenue_generated").default(0),
  commissionRate: real("commission_rate").default(0), // percentage
  commissionAmount: real("commission_amount").default(0),
  commissionStatus: text("commission_status").default('pending'), // pending, approved, paid, cancelled
  commissionPaidAt: timestamp("commission_paid_at"),
  
  // Reward tracking
  rewardType: text("reward_type"), // credits, discount, free_month, bonus_features, cash
  rewardValue: real("reward_value"),
  rewardIssued: boolean("reward_issued").default(false),
  rewardIssuedAt: timestamp("reward_issued_at"),
  rewardExpiresAt: timestamp("reward_expires_at"),
  
  // Fraud prevention
  isSuspicious: boolean("is_suspicious").default(false),
  fraudCheckNotes: text("fraud_check_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  referrerIdx: index("referrals_referrer_idx").on(table.referrerId),
  codeIdx: index("referrals_code_idx").on(table.referralCode),
  referredUserIdx: index("referrals_referred_user_idx").on(table.referredUserId),
  conversionStatusIdx: index("referrals_conversion_status_idx").on(table.conversionStatus),
  commissionStatusIdx: index("referrals_commission_status_idx").on(table.commissionStatus),
  suspiciousIdx: index("referrals_suspicious_idx").on(table.isSuspicious),
}));

// ====================
// Epic G - Educational Content Hub
// ====================

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // article, video, faq, story
  category: text("category").notNull(), // nutrition, workout, supplement, mindset, recovery, general
  
  // Bilingual content
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  content: text("content").notNull(),
  contentAr: text("content_ar"),
  
  // Metadata
  tags: json("tags").$type<string[]>().default([]),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  coachId: integer("coach_id").references(() => users.id, { onDelete: "set null" }),
  groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }),
  
  // Publishing controls
  status: text("status").notNull().default("draft"), // draft, published, archived
  visibility: text("visibility").notNull().default("public"), // public, trainees_only, group_only, admin_only
  featured: boolean("featured").default(false),
  
  // Type-specific fields (JSONB for flexibility)
  typeMetadata: json("type_metadata").$type<Record<string, any>>().default({}),
  
  // Engagement tracking
  viewCount: integer("view_count").default(0),
  averageRating: real("average_rating").default(0),
  ratingCount: integer("rating_count").default(0),
  
  // Timestamps
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  typeIdx: index("content_items_type_idx").on(table.type),
  categoryIdx: index("content_items_category_idx").on(table.category),
  statusIdx: index("content_items_status_idx").on(table.status),
  visibilityIdx: index("content_items_visibility_idx").on(table.visibility),
  authorIdx: index("content_items_author_idx").on(table.authorId),
  coachIdx: index("content_items_coach_idx").on(table.coachId),
  groupIdx: index("content_items_group_idx").on(table.groupId),
  featuredIdx: index("content_items_featured_idx").on(table.featured),
}));

export const contentRatings = pgTable("content_ratings", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5
  reviewText: text("review_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  contentIdx: index("content_ratings_content_idx").on(table.contentId),
  userIdx: index("content_ratings_user_idx").on(table.userId),
  uniqueRating: uniqueIndex("content_ratings_unique").on(table.contentId, table.userId),
}));

export const contentBookmarks = pgTable("content_bookmarks", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull().references(() => contentItems.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  progressPercent: integer("progress_percent").default(0), // 0-100
  completed: boolean("completed").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  contentIdx: index("content_bookmarks_content_idx").on(table.contentId),
  userIdx: index("content_bookmarks_user_idx").on(table.userId),
  uniqueBookmark: uniqueIndex("content_bookmarks_unique").on(table.contentId, table.userId),
}));

// SEO Settings (central and tenant scoped)
export const seoSettings = pgTable("seo_settings", {
  id: serial("id").primaryKey(),
  titleTemplate: text("title_template").notNull(),
  titleTemplateEn: text("title_template_en"),
  titleTemplateAr: text("title_template_ar"),
  metaDescription: text("meta_description").notNull(),
  metaDescriptionEn: text("meta_description_en"),
  metaDescriptionAr: text("meta_description_ar"),
  metaKeywordsEn: text("meta_keywords_en"),
  metaKeywordsAr: text("meta_keywords_ar"),
  metaAuthor: text("meta_author"),
  metaViewport: text("meta_viewport"),
  ogTitle: text("og_title"),
  ogTitleEn: text("og_title_en"),
  ogTitleAr: text("og_title_ar"),
  ogDescription: text("og_description"),
  ogDescriptionEn: text("og_description_en"),
  ogDescriptionAr: text("og_description_ar"),
  ogImageUrl: text("og_image_url"),
  ogType: text("og_type"),
  ogSiteName: text("og_site_name"),
  ogLocale: text("og_locale"),
  ogLocaleAlternates: json("og_locale_alternates").$type<string[]>().default([]),
  twitterTitle: text("twitter_title"),
  twitterTitleEn: text("twitter_title_en"),
  twitterTitleAr: text("twitter_title_ar"),
  twitterDescription: text("twitter_description"),
  twitterDescriptionEn: text("twitter_description_en"),
  twitterDescriptionAr: text("twitter_description_ar"),
  twitterImageUrl: text("twitter_image_url"),
  twitterCardType: text("twitter_card_type"),
  twitterSite: text("twitter_site"),
  twitterCreator: text("twitter_creator"),
  facebookTitleEn: text("facebook_title_en"),
  facebookTitleAr: text("facebook_title_ar"),
  facebookDescriptionEn: text("facebook_description_en"),
  facebookDescriptionAr: text("facebook_description_ar"),
  facebookImageUrl: text("facebook_image_url"),
  instagramTitleEn: text("instagram_title_en"),
  instagramTitleAr: text("instagram_title_ar"),
  instagramDescriptionEn: text("instagram_description_en"),
  instagramDescriptionAr: text("instagram_description_ar"),
  instagramImageUrl: text("instagram_image_url"),
  xTitleEn: text("x_title_en"),
  xTitleAr: text("x_title_ar"),
  xDescriptionEn: text("x_description_en"),
  xDescriptionAr: text("x_description_ar"),
  xImageUrl: text("x_image_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  xUrl: text("x_url"),
  robotsIndex: boolean("robots_index").notNull().default(true),
  robotsFollow: boolean("robots_follow").notNull().default(true),
  canonicalBaseUrl: text("canonical_base_url"),
  hreflangMap: json("hreflang_map").$type<Record<string, string>>().default({}),
  sitemapIncludes: json("sitemap_includes").$type<string[]>().default([]),
  sitemapExcludes: json("sitemap_excludes").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Branding settings (central and tenant scoped)
export const brandingSettings = pgTable("branding_settings", {
  id: serial("id").primaryKey(),
  primaryColor: text("primary_color").notNull().default("#dc2626"),
  secondaryColor: text("secondary_color").notNull().default("#f3f4f6"),
  accentColor: text("accent_color").notNull().default("#f97316"),
  announcementBarBackgroundColor: text("announcement_bar_background_color").notNull().default("#111827"),
  announcementBarTextColor: text("announcement_bar_text_color").notNull().default("#ffffff"),
  headerBackgroundColor: text("header_background_color").notNull().default("#ffffff"),
  sidebarBackgroundColor: text("sidebar_background_color").notNull().default("#7c2525"),
  sidebarHoverColor: text("sidebar_hover_color").notNull().default("#4a1616"),
  badgeBackgroundColor: text("badge_background_color").notNull().default("#dc2626"),
  logoUrl: text("logo_url").notNull().default(""),
  faviconUrl: text("favicon_url").notNull().default(""),
  heroMediaItems: json("hero_media_items").$type<Array<{ url: string; type: "image" | "video" }>>().notNull().default([]),
  heroBackgroundType: text("hero_background_type").notNull().default("image"),
  heroBackgroundUrl: text("hero_background_url").notNull().default(""),
  heroBackgroundVideoUrl: text("hero_background_video_url").notNull().default(""),
  heroTitle: text("hero_title").notNull().default(""),
  heroSubtitle: text("hero_subtitle").notNull().default(""),
  statsCourses: integer("stats_courses").notNull().default(0),
  statsCoaches: integer("stats_coaches").notNull().default(0),
  statsUsers: integer("stats_users").notNull().default(0),
  statsWorkoutsCompleted: integer("stats_workouts_completed").notNull().default(0),
  statsNutritionPlans: integer("stats_nutrition_plans").notNull().default(0),
  statsMealsLogged: integer("stats_meals_logged").notNull().default(0),
  showHeroSection: boolean("show_hero_section").notNull().default(true),
  showFeaturesSection: boolean("show_features_section").notNull().default(true),
  showPricingSection: boolean("show_pricing_section").notNull().default(true),
  showCtaSection: boolean("show_cta_section").notNull().default(true),
  updatedByUserId: integer("updated_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FooterQuickLink = {
  id: string;
  labelEn: string;
  labelAr: string;
  href: string;
  enabled: boolean;
  visibleOnCentral: boolean;
  visibleOnTenant: boolean;
  order: number;
};

export const publicSiteSettings = pgTable("public_site_settings", {
  id: serial("id").primaryKey(),
  quickLinks: json("quick_links").$type<FooterQuickLink[]>().notNull().default([]),
  socialLinks: json("social_links").$type<Record<string, string>>().notNull().default({}),
  contactEmail: text("contact_email").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  contactAddress: text("contact_address").notNull().default(""),
  footerGradientFrom: text("footer_gradient_from").notNull().default("#0f172a"),
  footerGradientTo: text("footer_gradient_to").notNull().default("#1e293b"),
  updatedByUserId: integer("updated_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const staticPages = pgTable("static_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull().default(""),
  titleAr: text("title_ar").notNull().default(""),
  contentEn: text("content_en").notNull().default(""),
  contentAr: text("content_ar").notNull().default(""),
  updatedByUserId: integer("updated_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("static_pages_slug_idx").on(table.slug),
}));

export const insertPublicSiteSettingsSchema = createInsertSchema(publicSiteSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaticPageSchema = createInsertSchema(staticPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PublicSiteSettings = typeof publicSiteSettings.$inferSelect;
export type InsertPublicSiteSettings = z.infer<typeof insertPublicSiteSettingsSchema>;
export type StaticPage = typeof staticPages.$inferSelect;
export type InsertStaticPage = z.infer<typeof insertStaticPageSchema>;

export type BrandingSettings = typeof brandingSettings.$inferSelect;
export type InsertProgressSnapshot = z.infer<typeof insertProgressSnapshotSchema>;