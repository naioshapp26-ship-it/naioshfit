/**
 * Comprehensive Data Seeding Script
 * Populates all database tables with realistic data
 * 
 * Usage: npx tsx scripts/seed_real_data.ts
 */

import { db } from "../server/db";
import {
  users,
  supplements,
  supplementRecommendations,
  supplementInteractions,
  supplementReminders,
  supplementSideEffects,
  supplementEffectivenessRatings,
  notifications,
  workouts,
  meals,
  progress,
  dailyStats,
  userPlans,
  messages,
  products,
  foodItems,
} from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const PASSWORD_HASH = "$2a$10$2uVM1Lkex.TH0od5nQsTXOEM5gxs2Nt9sQ/qH4D3R9vtTKeOdNDtS"; // hashed "password"

// ============================================================================
// 1. SEED USERS (Clients, Coaches, Admin)
// ============================================================================

async function seedUsers() {
  console.log("🌱 Seeding users...");

  const usersData = [
    // Admin
    {
      username: "admin",
      password: PASSWORD_HASH,
      pinNumber: "1111",
      firstName: "Naioshfit",
      lastName: "Admin",
      whatsappWithCode: "201234567890",
      role: "admin",
      gender: "male",
      country: "Egypt",
      city: "Cairo",
      isApproved: true,
      approvedAt: new Date(),
    },
    // Coaches
    {
      username: "coach_ahmed",
      password: PASSWORD_HASH,
      pinNumber: "2222",
      firstName: "Ahmed",
      lastName: "Hassan",
      whatsappWithCode: "201111111111",
      role: "coach",
      gender: "male",
      country: "Egypt",
      city: "Cairo",
      isApproved: true,
      approvedAt: new Date(),
    },
    {
      username: "coach_sara",
      password: PASSWORD_HASH,
      pinNumber: "3333",
      firstName: "Sara",
      lastName: "Mohamed",
      whatsappWithCode: "201222222222",
      role: "coach",
      gender: "female",
      country: "Egypt",
      city: "Alexandria",
      isApproved: true,
      approvedAt: new Date(),
    },
    // Clients
    {
      username: "client_omar",
      password: PASSWORD_HASH,
      pinNumber: "4444",
      firstName: "Omar",
      lastName: "Khaled",
      whatsappWithCode: "201555555555",
      role: "user",
      gender: "male",
      age: 28,
      height: 180,
      weight: 85,
      goalWeight: 78,
      country: "Egypt",
      city: "Cairo",
      religion: "muslim",
      fitnessGoal: "weight_loss",
      trainingLevel: "intermediate",
      trainingDaysPerWeek: 4,
      preferredWorkoutTime: "morning",
      preferredProgram: "push_pull_legs",
      workIntensity: "moderate",
      activityLevel: "moderate",
      howFoundUs: "instagram",
      subscriptionType: "3_months",
      subscriptionDuration: "3_months",
      subscriptionStartDate: new Date(),
      isApproved: true,
      approvedAt: new Date(),
      dailyMeals: 4,
      preferredCarbs: "rice, oats, sweet potato",
      preferredProteins: "chicken, beef, fish, eggs",
      preferredLegumes: "lentils, chickpeas",
      preferredVegetables: "broccoli, spinach, tomatoes",
      preferredDairy: "greek yogurt, cottage cheese",
      preferredFats: "olive oil, nuts, avocado",
      preferredFruits: "banana, apple, berries",
      allergies: null,
      medicalHistory: null,
      hasKitchenScale: true,
      lunchHasProtein: true,
      wakeUpTime: "06:00",
      firstMealTime: "07:00",
      workType: "office",
      workHours: "8",
    },
    {
      username: "client_mona",
      password: PASSWORD_HASH,
      pinNumber: "5555",
      firstName: "Mona",
      lastName: "Ibrahim",
      whatsappWithCode: "201666666666",
      role: "user",
      gender: "female",
      age: 32,
      height: 165,
      weight: 72,
      goalWeight: 65,
      country: "Egypt",
      city: "Giza",
      religion: "muslim",
      fitnessGoal: "weight_loss",
      trainingLevel: "beginner",
      trainingDaysPerWeek: 3,
      preferredWorkoutTime: "evening",
      preferredProgram: "upper_lower",
      workIntensity: "easy",
      activityLevel: "light",
      howFoundUs: "facebook",
      subscriptionType: "1_month",
      subscriptionDuration: "1_month",
      subscriptionStartDate: new Date(),
      isApproved: true,
      approvedAt: new Date(),
      dailyMeals: 5,
      preferredCarbs: "brown rice, quinoa",
      preferredProteins: "chicken, fish, tofu",
      preferredLegumes: "beans, lentils",
      preferredVegetables: "cucumber, lettuce, bell peppers",
      preferredDairy: "almond milk, low-fat cheese",
      preferredFats: "nuts, seeds",
      preferredFruits: "apple, orange, grapes",
      allergies: "dairy (mild lactose intolerance)",
      medicalHistory: null,
      hasKitchenScale: true,
      lunchHasProtein: true,
      wakeUpTime: "07:00",
      firstMealTime: "08:00",
      workType: "office",
      workHours: "6",
    },
    {
      username: "client_youssef",
      password: PASSWORD_HASH,
      pinNumber: "6666",
      firstName: "Youssef",
      lastName: "Ali",
      whatsappWithCode: "201777777777",
      role: "user",
      gender: "male",
      age: 24,
      height: 175,
      weight: 68,
      goalWeight: 75,
      country: "Egypt",
      city: "Cairo",
      religion: "muslim",
      fitnessGoal: "bulking",
      trainingLevel: "advanced",
      trainingDaysPerWeek: 5,
      preferredWorkoutTime: "midday",
      preferredProgram: "bro_split",
      workIntensity: "hard",
      activityLevel: "very_active",
      howFoundUs: "youtube",
      subscriptionType: "6_months",
      subscriptionDuration: "6_months",
      subscriptionStartDate: new Date(),
      isApproved: true,
      approvedAt: new Date(),
      dailyMeals: 6,
      preferredCarbs: "white rice, pasta, bread",
      preferredProteins: "chicken, beef, eggs, protein powder",
      preferredLegumes: "chickpeas, black beans",
      preferredVegetables: "spinach, broccoli, carrots",
      preferredDairy: "whole milk, greek yogurt",
      preferredFats: "peanut butter, olive oil, almonds",
      preferredFruits: "banana, dates, mango",
      allergies: null,
      medicalHistory: null,
      hasKitchenScale: true,
      lunchHasProtein: true,
      wakeUpTime: "05:30",
      firstMealTime: "06:00",
      workType: "physical",
      workHours: "9",
    },
  ];

  const insertedUsers = await db.insert(users).values(usersData).returning();
  console.log(`✅ Inserted ${insertedUsers.length} users`);

  // Assign coaches to clients
  const ahmed = insertedUsers.find((u) => u.username === "coach_ahmed");
  const sara = insertedUsers.find((u) => u.username === "coach_sara");
  const omar = insertedUsers.find((u) => u.username === "client_omar");
  const mona = insertedUsers.find((u) => u.username === "client_mona");
  const youssef = insertedUsers.find((u) => u.username === "client_youssef");

  if (ahmed && sara && omar && mona && youssef) {
    await db.update(users).set({ coachId: ahmed.id }).where(eq(users.id, omar.id));
    await db.update(users).set({ coachId: sara.id }).where(eq(users.id, mona.id));
    await db.update(users).set({ coachId: ahmed.id }).where(eq(users.id, youssef.id));
    console.log("✅ Assigned coaches to clients");
  }

  return insertedUsers;
}

// ============================================================================
// 2. SEED SUPPLEMENTS
// ============================================================================

async function seedSupplements() {
  console.log("🌱 Seeding supplements...");

  const supplementsData = [
    {
      name: "Whey Protein Isolate",
      nameAr: "بروتين واي أيزوليت",
      forms: ["powder", "shake"],
      ingredients: "Whey protein isolate (90%+), natural flavors, stevia",
      dosageRangeMin: 25,
      dosageRangeMax: 50,
      dosageUnit: "g",
      contraindications: "Dairy allergy, severe lactose intolerance",
      interactions: "May reduce absorption of certain antibiotics if taken together",
      warnings: "Consult doctor if you have kidney disease",
      categories: ["protein", "muscle_building", "recovery"],
      evidenceNotes: "Extensively researched for muscle protein synthesis and recovery",
      references: "Multiple peer-reviewed studies support efficacy",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Creatine Monohydrate",
      nameAr: "كرياتين مونوهيدرات",
      forms: ["powder", "capsule"],
      ingredients: "Pure creatine monohydrate",
      dosageRangeMin: 3,
      dosageRangeMax: 5,
      dosageUnit: "g",
      contraindications: "Kidney disease, dehydration",
      interactions: "Caffeine may reduce effectiveness. NSAIDs may increase risk of kidney stress.",
      warnings: "Ensure adequate hydration (3-4L water daily). Loading phase optional but not required.",
      categories: ["performance", "strength", "muscle_building"],
      evidenceNotes: "Most researched supplement for athletic performance. Improves high-intensity exercise capacity.",
      references: "International Society of Sports Nutrition position stand on creatine",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Omega-3 Fish Oil",
      nameAr: "أوميغا 3 زيت السمك",
      forms: ["softgel", "liquid"],
      ingredients: "EPA 180mg, DHA 120mg per capsule",
      dosageRangeMin: 1000,
      dosageRangeMax: 3000,
      dosageUnit: "mg",
      contraindications: "Fish/shellfish allergy, bleeding disorders, upcoming surgery",
      interactions: "Blood thinners (warfarin), antiplatelet drugs, NSAIDs - increases bleeding risk",
      warnings: "Stop 2 weeks before surgery. Consult doctor if on blood-thinning medication.",
      categories: ["health", "heart", "inflammation", "general_wellness"],
      evidenceNotes: "Reduces inflammation, supports cardiovascular health, brain function",
      references: "American Heart Association, NIH Office of Dietary Supplements",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Vitamin D3",
      nameAr: "فيتامين د3",
      forms: ["capsule", "softgel", "liquid", "spray"],
      ingredients: "Cholecalciferol (Vitamin D3)",
      dosageRangeMin: 2000,
      dosageRangeMax: 5000,
      dosageUnit: "IU",
      contraindications: "Hypercalcemia, kidney stones, sarcoidosis",
      interactions: "Some heart medications (digoxin), steroids, weight loss drugs",
      warnings: "Do not exceed 10,000 IU daily. Monitor calcium levels with high doses.",
      categories: ["vitamins", "bone_health", "immunity", "general_wellness"],
      evidenceNotes: "Essential for bone health, immune function, mood regulation, hormone production",
      references: "NIH Office of Dietary Supplements, Endocrine Society Clinical Practice Guidelines",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Caffeine Anhydrous",
      nameAr: "كافيين لامائي",
      forms: ["capsule", "tablet", "powder"],
      ingredients: "Pure caffeine anhydrous (98%+)",
      dosageRangeMin: 100,
      dosageRangeMax: 400,
      dosageUnit: "mg",
      contraindications: "Heart conditions, anxiety disorders, high blood pressure, pregnancy",
      interactions: "Reduces creatine absorption. Interacts with medications (MAO inhibitors, stimulants).",
      warnings: "Start with low dose (100mg). Avoid within 6 hours of sleep. Do not exceed 400mg/day.",
      categories: ["pre_workout", "performance", "energy", "focus"],
      evidenceNotes: "Proven ergogenic aid. Improves endurance, power output, alertness, fat oxidation.",
      references: "International Society of Sports Nutrition position stand",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Multivitamin",
      nameAr: "فيتامينات متعددة",
      forms: ["tablet", "capsule", "gummy"],
      ingredients: "Vitamins A, C, D, E, K, B-complex, Zinc, Magnesium, Selenium",
      dosageRangeMin: 1,
      dosageRangeMax: 2,
      dosageUnit: "tablet",
      contraindications: "Hemochromatosis (iron overload), hypervitaminosis",
      interactions: "May reduce absorption of certain medications (thyroid, antibiotics)",
      warnings: "Take with food. Do not exceed recommended dose. Iron can be toxic in high amounts.",
      categories: ["vitamins", "minerals", "general_wellness"],
      evidenceNotes: "Fills nutritional gaps in diet. Most beneficial for those with dietary restrictions.",
      references: "Various nutritional guidelines, NIH recommendations",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "BCAA (2:1:1 Ratio)",
      nameAr: "أحماض أمينية متفرعة السلسلة",
      forms: ["powder", "capsule"],
      ingredients: "L-Leucine (2g), L-Isoleucine (1g), L-Valine (1g) per serving",
      dosageRangeMin: 5,
      dosageRangeMax: 10,
      dosageUnit: "g",
      contraindications: "ALS (Lou Gehrig's disease), branched-chain ketoaciduria, upcoming surgery",
      interactions: "May affect blood sugar levels. Interact with diabetes medications.",
      warnings: "Monitor blood sugar if diabetic. Limited evidence when adequate protein intake is met.",
      categories: ["amino_acids", "recovery", "muscle_building"],
      evidenceNotes: "May reduce muscle soreness. Less beneficial when total protein intake is adequate.",
      references: "Mixed evidence - whole protein sources preferred by most researchers",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Magnesium Glycinate",
      nameAr: "مغنيسيوم غليسينات",
      forms: ["capsule", "tablet", "powder"],
      ingredients: "Magnesium (as magnesium glycinate) 200mg",
      dosageRangeMin: 200,
      dosageRangeMax: 400,
      dosageUnit: "mg",
      contraindications: "Kidney disease, heart block, myasthenia gravis",
      interactions: "Antibiotics (tetracyclines, quinolones), bisphosphonates, muscle relaxants",
      warnings: "Take 2-3 hours apart from antibiotics. High doses may cause diarrhea.",
      categories: ["minerals", "sleep", "recovery", "general_wellness"],
      evidenceNotes: "Supports muscle function, sleep quality, stress management, bone health",
      references: "NIH Office of Dietary Supplements",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Zinc (Picolinate)",
      nameAr: "زنك بيكولينات",
      forms: ["capsule", "tablet"],
      ingredients: "Zinc (as zinc picolinate) 25mg",
      dosageRangeMin: 15,
      dosageRangeMax: 40,
      dosageUnit: "mg",
      contraindications: "Zinc allergy (rare), copper deficiency",
      interactions: "Antibiotics, penicillamine. Reduces copper absorption with chronic high doses.",
      warnings: "Take with food to reduce nausea. Long-term high doses may cause copper deficiency.",
      categories: ["minerals", "immunity", "general_wellness"],
      evidenceNotes: "Supports immune function, testosterone production, wound healing",
      references: "NIH Office of Dietary Supplements",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
    {
      name: "Pre-Workout Complex",
      nameAr: "مكمل ما قبل التمرين",
      forms: ["powder"],
      ingredients: "Caffeine 200mg, Beta-Alanine 3g, Citrulline Malate 6g, Creatine 3g, B-vitamins",
      dosageRangeMin: 1,
      dosageRangeMax: 1,
      dosageUnit: "scoop",
      contraindications: "Heart conditions, high blood pressure, anxiety, pregnancy",
      interactions: "Caffeine interactions. May affect blood pressure medications.",
      warnings: "Beta-alanine may cause harmless tingling. Start with half scoop to assess tolerance.",
      categories: ["pre_workout", "performance", "energy"],
      evidenceNotes: "Combination shown to improve workout performance, endurance, and pump",
      references: "Individual ingredients well-researched (caffeine, creatine, citrulline)",
      isGlobal: true,
      createdBy: null,
      scopeCoachId: null,
    },
  ];

  const insertedSupplements = await db.insert(supplements).values(supplementsData).returning();
  console.log(`✅ Inserted ${insertedSupplements.length} supplements`);

  return insertedSupplements;
}

// ============================================================================
// 3. SEED SUPPLEMENT INTERACTIONS
// ============================================================================

async function seedSupplementInteractions(supplementsList: any[]) {
  console.log("🌱 Seeding supplement interactions...");

  const wheyProtein = supplementsList.find((s) => s.name === "Whey Protein Isolate");
  const omega3 = supplementsList.find((s) => s.name === "Omega-3 Fish Oil");
  const caffeine = supplementsList.find((s) => s.name === "Caffeine Anhydrous");
  const creatine = supplementsList.find((s) => s.name === "Creatine Monohydrate");
  const bcaa = supplementsList.find((s) => s.name === "BCAA (2:1:1 Ratio)");
  const magnesium = supplementsList.find((s) => s.name === "Magnesium Glycinate");

  const interactionsData = [];

  if (wheyProtein) {
    interactionsData.push(
      {
        supplementId: wheyProtein.id,
        interactsWith: "dairy",
        interactionType: "allergy",
        severity: "critical",
        description: "Whey protein is derived from milk. Individuals with dairy allergies must avoid this supplement.",
        actionRequired: "hard_block",
      },
      {
        supplementId: wheyProtein.id,
        interactsWith: "lactose intolerance",
        interactionType: "medical_condition",
        severity: "moderate",
        description: "May cause digestive discomfort. Whey isolate has less lactose than concentrate. Consider plant-based alternatives.",
        actionRequired: "warning",
      }
    );
  }

  if (omega3) {
    interactionsData.push(
      {
        supplementId: omega3.id,
        interactsWith: "warfarin",
        interactionType: "medication",
        severity: "severe",
        description: "Omega-3 fish oil increases bleeding risk when combined with blood thinners like warfarin. Close medical monitoring required.",
        actionRequired: "confirmation_required",
      },
      {
        supplementId: omega3.id,
        interactsWith: "fish",
        interactionType: "allergy",
        severity: "critical",
        description: "Fish oil supplements are derived from fish and must be avoided by individuals with fish/shellfish allergies.",
        actionRequired: "hard_block",
      },
      {
        supplementId: omega3.id,
        interactsWith: "aspirin",
        interactionType: "medication",
        severity: "moderate",
        description: "May increase bleeding risk when combined with aspirin or other NSAIDs. Monitor for bruising.",
        actionRequired: "warning",
      }
    );
  }

  if (caffeine && creatine) {
    interactionsData.push(
      {
        supplementId: caffeine.id,
        interactsWith: "Creatine Monohydrate",
        interactionType: "supplement",
        severity: "mild",
        description: "Caffeine may reduce creatine absorption and negate some benefits. Consider separating intake by 3-4 hours.",
        actionRequired: "warning",
      },
      {
        supplementId: caffeine.id,
        interactsWith: "anxiety",
        interactionType: "medical_condition",
        severity: "moderate",
        description: "Caffeine can worsen anxiety symptoms, increase heart rate, and cause jitters.",
        actionRequired: "confirmation_required",
      },
      {
        supplementId: caffeine.id,
        interactsWith: "high blood pressure",
        interactionType: "medical_condition",
        severity: "moderate",
        description: "Caffeine may temporarily increase blood pressure. Consult doctor before use.",
        actionRequired: "confirmation_required",
      }
    );
  }

  if (bcaa) {
    interactionsData.push({
      supplementId: bcaa.id,
      interactsWith: "diabetes medication",
      interactionType: "medication",
      severity: "moderate",
      description: "BCAAs may affect blood sugar levels. Monitor glucose if on diabetes medication.",
      actionRequired: "warning",
    });
  }

  if (magnesium) {
    interactionsData.push(
      {
        supplementId: magnesium.id,
        interactsWith: "antibiotics",
        interactionType: "medication",
        severity: "moderate",
        description: "Magnesium binds to certain antibiotics (tetracyclines, quinolones) and reduces their absorption. Take 2-3 hours apart.",
        actionRequired: "warning",
      },
      {
        supplementId: magnesium.id,
        interactsWith: "kidney disease",
        interactionType: "medical_condition",
        severity: "severe",
        description: "Individuals with kidney disease may not properly excrete magnesium, leading to dangerous accumulation.",
        actionRequired: "confirmation_required",
      }
    );
  }

  if (interactionsData.length > 0) {
    await db.insert(supplementInteractions).values(interactionsData);
    console.log(`✅ Inserted ${interactionsData.length} supplement interactions`);
  }
}

// ============================================================================
// 4. SEED SUPPLEMENT RECOMMENDATIONS & REMINDERS
// ============================================================================

async function seedSupplementRecommendations(usersList: any[], supplementsList: any[]) {
  console.log("🌱 Seeding supplement recommendations...");

  const omar = usersList.find((u) => u.username === "client_omar");
  const mona = usersList.find((u) => u.username === "client_mona");
  const youssef = usersList.find((u) => u.username === "client_youssef");
  const ahmed = usersList.find((u) => u.username === "coach_ahmed");
  const sara = usersList.find((u) => u.username === "coach_sara");

  const wheyProtein = supplementsList.find((s) => s.name === "Whey Protein Isolate");
  const creatine = supplementsList.find((s) => s.name === "Creatine Monohydrate");
  const omega3 = supplementsList.find((s) => s.name === "Omega-3 Fish Oil");
  const vitaminD = supplementsList.find((s) => s.name === "Vitamin D3");
  const caffeine = supplementsList.find((s) => s.name === "Caffeine Anhydrous");
  const magnesium = supplementsList.find((s) => s.name === "Magnesium Glycinate");
  const preWorkout = supplementsList.find((s) => s.name === "Pre-Workout Complex");

  const recommendationsData = [];

  // Omar's recommendations (weight loss, intermediate)
  if (omar && ahmed && wheyProtein && omega3 && vitaminD) {
    recommendationsData.push(
      {
        userId: omar.id,
        supplementId: wheyProtein.id,
        coachId: ahmed.id,
        dosageAmount: 30,
        dosageUnit: "g",
        dosageFrequency: "twice_daily",
        maxDailyLimit: 60,
        isCustomDosage: false,
        dosageRationale: "Helps meet protein targets while in calorie deficit for fat loss",
        coachNotes: "Mix with water post-workout and as afternoon snack to control hunger",
        timingType: "post_workout",
        timingDetails: { relativeToWorkout: "after", minutesOffset: 30 },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      },
      {
        userId: omar.id,
        supplementId: omega3.id,
        coachId: ahmed.id,
        dosageAmount: 2000,
        dosageUnit: "mg",
        dosageFrequency: "daily",
        maxDailyLimit: 3000,
        isCustomDosage: false,
        dosageRationale: "Supports heart health, reduces inflammation from training",
        coachNotes: "Take with breakfast for better absorption",
        timingType: "with_meals",
        timingDetails: { relativeToMeal: "with", mealType: "breakfast" },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      },
      {
        userId: omar.id,
        supplementId: vitaminD.id,
        coachId: ahmed.id,
        dosageAmount: 4000,
        dosageUnit: "IU",
        dosageFrequency: "daily",
        maxDailyLimit: 5000,
        isCustomDosage: false,
        dosageRationale: "Common deficiency in Egypt, supports immunity and hormone health",
        coachNotes: "Take with largest meal for fat-soluble vitamin absorption",
        timingType: "with_meals",
        timingDetails: { relativeToMeal: "with", mealType: "lunch" },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      }
    );
  }

  // Mona's recommendations (weight loss, beginner)
  if (mona && sara && omega3 && vitaminD && magnesium) {
    recommendationsData.push(
      {
        userId: mona.id,
        supplementId: omega3.id,
        coachId: sara.id,
        dosageAmount: 1500,
        dosageUnit: "mg",
        dosageFrequency: "daily",
        maxDailyLimit: 2000,
        isCustomDosage: false,
        dosageRationale: "Anti-inflammatory support, heart health",
        coachNotes: "Start with lower dose, take with breakfast",
        timingType: "with_meals",
        timingDetails: { relativeToMeal: "with", mealType: "breakfast" },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      },
      {
        userId: mona.id,
        supplementId: vitaminD.id,
        coachId: sara.id,
        dosageAmount: 3000,
        dosageUnit: "IU",
        dosageFrequency: "daily",
        maxDailyLimit: 4000,
        isCustomDosage: false,
        dosageRationale: "Support immunity and mood during weight loss",
        coachNotes: "Take with lunch or dinner",
        timingType: "with_meals",
        timingDetails: { relativeToMeal: "with", mealType: "lunch" },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      },
      {
        userId: mona.id,
        supplementId: magnesium.id,
        coachId: sara.id,
        dosageAmount: 300,
        dosageUnit: "mg",
        dosageFrequency: "daily",
        maxDailyLimit: 400,
        isCustomDosage: false,
        dosageRationale: "Improve sleep quality and recovery, reduce stress",
        coachNotes: "Take 30-60 minutes before bed",
        timingType: "before_sleep",
        timingDetails: { specificTime: "22:00" },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      }
    );
  }

  // Youssef's recommendations (bulking, advanced)
  if (youssef && ahmed && wheyProtein && creatine && preWorkout && vitaminD) {
    recommendationsData.push(
      {
        userId: youssef.id,
        supplementId: wheyProtein.id,
        coachId: ahmed.id,
        dosageAmount: 40,
        dosageUnit: "g",
        dosageFrequency: "twice_daily",
        maxDailyLimit: 80,
        isCustomDosage: false,
        dosageRationale: "Meet high protein requirements for muscle gain (2g/kg bodyweight)",
        coachNotes: "Post-workout + before bed to maximize protein synthesis",
        timingType: "post_workout",
        timingDetails: { relativeToWorkout: "after", minutesOffset: 30 },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      },
      {
        userId: youssef.id,
        supplementId: creatine.id,
        coachId: ahmed.id,
        dosageAmount: 5,
        dosageUnit: "g",
        dosageFrequency: "daily",
        maxDailyLimit: 5,
        isCustomDosage: false,
        dosageRationale: "Proven strength and muscle mass gains, supports high-intensity training",
        coachNotes: "Take post-workout with carbs for better absorption. Stay well hydrated (4L/day).",
        timingType: "post_workout",
        timingDetails: { relativeToWorkout: "after", minutesOffset: 0 },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      },
      {
        userId: youssef.id,
        supplementId: preWorkout.id,
        coachId: ahmed.id,
        dosageAmount: 1,
        dosageUnit: "scoop",
        dosageFrequency: "daily",
        maxDailyLimit: 1,
        isCustomDosage: false,
        dosageRationale: "Boost energy, focus, and performance for intense training sessions",
        coachNotes: "Take 30 minutes pre-workout on training days only (5x/week). Avoid on rest days.",
        timingType: "pre_workout",
        timingDetails: { relativeToWorkout: "before", minutesOffset: 30 },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      },
      {
        userId: youssef.id,
        supplementId: vitaminD.id,
        coachId: ahmed.id,
        dosageAmount: 5000,
        dosageUnit: "IU",
        dosageFrequency: "daily",
        maxDailyLimit: 5000,
        isCustomDosage: false,
        dosageRationale: "Support testosterone production and recovery",
        coachNotes: "Take with largest meal",
        timingType: "with_meals",
        timingDetails: { relativeToMeal: "with", mealType: "lunch" },
        status: "active",
        warningsChecked: true,
        warningsAcknowledged: true,
      }
    );
  }

  const insertedRecommendations = await db
    .insert(supplementRecommendations)
    .values(recommendationsData)
    .returning();
  console.log(`✅ Inserted ${insertedRecommendations.length} supplement recommendations`);

  // Seed reminders for each recommendation
  const remindersData = insertedRecommendations.map((rec) => ({
    userId: rec.userId,
    recommendationId: rec.id,
    enabled: true,
    reminderTimes:
      rec.timingType === "morning"
        ? ["07:00"]
        : rec.timingType === "pre_workout"
        ? ["10:00"]
        : rec.timingType === "post_workout"
        ? ["12:00"]
        : rec.timingType === "before_sleep"
        ? ["22:00"]
        : ["08:00"],
    reminderDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  }));

  await db.insert(supplementReminders).values(remindersData);
  console.log(`✅ Inserted ${remindersData.length} supplement reminders`);

  return insertedRecommendations;
}

// ============================================================================
// 5. SEED SUPPLEMENT SIDE EFFECTS & EFFECTIVENESS RATINGS
// ============================================================================

async function seedSupplementFollowUps(recommendationsList: any[]) {
  console.log("🌱 Seeding supplement follow-ups (side effects & ratings)...");

  // Add a mild side effect for one user
  if (recommendationsList.length > 0) {
    const omarWheyRec = recommendationsList.find(
      (rec) => rec.dosageUnit === "g" && rec.dosageAmount === 30
    );

    if (omarWheyRec) {
      await db.insert(supplementSideEffects).values({
        userId: omarWheyRec.userId,
        recommendationId: omarWheyRec.id,
        supplementId: omarWheyRec.supplementId,
        severity: "mild",
        symptoms: "Minor stomach bloating after taking whey protein shake",
        notes: "Only happens if I take it on empty stomach. Fine when taken with food.",
        occurredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        status: "resolved",
      });
      console.log("✅ Inserted 1 side effect example");
    }

    // Add effectiveness ratings
    const ratingsData = [];
    for (let i = 0; i < Math.min(3, recommendationsList.length); i++) {
      const rec = recommendationsList[i];
      ratingsData.push({
        userId: rec.userId,
        recommendationId: rec.id,
        supplementId: rec.supplementId,
        rating: 4 + Math.floor(Math.random() * 2), // 4 or 5 stars
        notes: "Feeling good progress with this supplement. Energy levels improved.",
        ratingPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        ratingPeriodEnd: new Date(),
      });
    }

    if (ratingsData.length > 0) {
      await db.insert(supplementEffectivenessRatings).values(ratingsData);
      console.log(`✅ Inserted ${ratingsData.length} effectiveness ratings`);
    }
  }
}

// ============================================================================
// 6. SEED WORKOUTS
// ============================================================================

async function seedWorkouts(usersList: any[]) {
  console.log("🌱 Seeding workouts...");

  const ahmed = usersList.find((u) => u.username === "coach_ahmed");
  const sara = usersList.find((u) => u.username === "coach_sara");

  if (!ahmed || !sara) return;

  const workoutsData = [
    {
      name: "Push Day - Chest, Shoulders, Triceps",
      description: "Compound and isolation exercises for upper body pushing muscles",
      duration: 60,
      difficulty: "intermediate",
      type: "strength",
      coachId: ahmed.id,
      exercises: [
        { name: "Barbell Bench Press", sets: 4, reps: 8 },
        { name: "Overhead Press", sets: 4, reps: 10 },
        { name: "Incline Dumbbell Press", sets: 3, reps: 12 },
        { name: "Lateral Raises", sets: 3, reps: 15 },
        { name: "Tricep Dips", sets: 3, reps: 12 },
        { name: "Cable Flyes", sets: 3, reps: 15 },
      ],
    },
    {
      name: "Pull Day - Back, Biceps",
      description: "Complete back development and arm training",
      duration: 55,
      difficulty: "intermediate",
      type: "strength",
      coachId: ahmed.id,
      exercises: [
        { name: "Deadlifts", sets: 4, reps: 6 },
        { name: "Pull-ups", sets: 4, reps: 8 },
        { name: "Barbell Rows", sets: 4, reps: 10 },
        { name: "Face Pulls", sets: 3, reps: 15 },
        { name: "Barbell Curls", sets: 3, reps: 12 },
        { name: "Hammer Curls", sets: 3, reps: 12 },
      ],
    },
    {
      name: "Leg Day - Quads, Hamstrings, Glutes",
      description: "Lower body strength and hypertrophy",
      duration: 65,
      difficulty: "intermediate",
      type: "strength",
      coachId: ahmed.id,
      exercises: [
        { name: "Back Squats", sets: 4, reps: 8 },
        { name: "Romanian Deadlifts", sets: 4, reps: 10 },
        { name: "Leg Press", sets: 3, reps: 12 },
        { name: "Walking Lunges", sets: 3, reps: "12 each leg" },
        { name: "Leg Curls", sets: 3, reps: 15 },
        { name: "Calf Raises", sets: 4, reps: 20 },
      ],
    },
    {
      name: "Full Body Beginner",
      description: "Perfect for beginners to build foundation",
      duration: 45,
      difficulty: "beginner",
      type: "strength",
      coachId: sara.id,
      exercises: [
        { name: "Goblet Squats", sets: 3, reps: 12 },
        { name: "Push-ups (modified if needed)", sets: 3, reps: 10 },
        { name: "Dumbbell Rows", sets: 3, reps: 12 },
        { name: "Dumbbell Shoulder Press", sets: 3, reps: 10 },
        { name: "Plank", sets: 3, duration: "30-45 seconds" },
      ],
    },
    {
      name: "HIIT Cardio Blast",
      description: "High intensity interval training for fat loss",
      duration: 30,
      difficulty: "intermediate",
      type: "conditioning",
      coachId: sara.id,
      exercises: [
        { name: "Jump Squats", rounds: 6, interval: "30s on / 30s rest" },
        { name: "Burpees", rounds: 6, interval: "30s on / 30s rest" },
        { name: "Mountain Climbers", rounds: 6, interval: "30s on / 30s rest" },
        { name: "High Knees", rounds: 6, interval: "30s on / 30s rest" },
      ],
    },
  ];

  await db.insert(workouts).values(workoutsData);
  console.log(`✅ Inserted ${workoutsData.length} workouts`);
}

// ============================================================================
// 7. SEED MEALS & FOOD ITEMS
// ============================================================================

async function seedMealsAndFoodItems(usersList: any[]) {
  console.log("🌱 Seeding meals and food items...");

  // Seed food items first
  const foodItemsData = [
    {
      name: "Chicken Breast (Grilled)",
      nameAr: "صدر دجاج مشوي",
      brand: null,
      calories: 165,
      proteins: 31,
      carbs: 0,
      fats: 3.6,
      fiber: 0,
      servingSize: "100g",
      servingSizeGrams: 100,
      category: "protein",
    },
    {
      name: "Brown Rice (Cooked)",
      nameAr: "أرز بني مطبوخ",
      brand: null,
      calories: 112,
      proteins: 2.6,
      carbs: 24,
      fats: 0.9,
      fiber: 1.8,
      servingSize: "100g",
      servingSizeGrams: 100,
      category: "carbs",
    },
    {
      name: "Broccoli (Steamed)",
      nameAr: "بروكلي مطهو على البخار",
      brand: null,
      calories: 35,
      proteins: 2.4,
      carbs: 7,
      fats: 0.4,
      fiber: 3.3,
      servingSize: "100g",
      servingSizeGrams: 100,
      category: "vegetables",
    },
    {
      name: "Olive Oil",
      nameAr: "زيت زيتون",
      brand: null,
      calories: 119,
      proteins: 0,
      carbs: 0,
      fats: 13.5,
      fiber: 0,
      servingSize: "1 tbsp (15ml)",
      servingSizeGrams: 15,
      category: "fats",
    },
    {
      name: "Eggs (Large)",
      nameAr: "بيض كبير",
      brand: null,
      calories: 72,
      proteins: 6.3,
      carbs: 0.4,
      fats: 4.8,
      fiber: 0,
      servingSize: "1 egg",
      servingSizeGrams: 50,
      category: "protein",
    },
    {
      name: "Oatmeal (Raw)",
      nameAr: "شوفان خام",
      brand: null,
      calories: 389,
      proteins: 16.9,
      carbs: 66.3,
      fats: 6.9,
      fiber: 10.6,
      servingSize: "100g",
      servingSizeGrams: 100,
      category: "carbs",
    },
    {
      name: "Banana",
      nameAr: "موز",
      brand: null,
      calories: 89,
      proteins: 1.1,
      carbs: 23,
      fats: 0.3,
      fiber: 2.6,
      servingSize: "1 medium (118g)",
      servingSizeGrams: 118,
      category: "fruits",
    },
    {
      name: "Greek Yogurt (Non-fat)",
      nameAr: "زبادي يوناني خالي الدسم",
      brand: null,
      calories: 59,
      proteins: 10.2,
      carbs: 3.6,
      fats: 0.4,
      fiber: 0,
      servingSize: "100g",
      servingSizeGrams: 100,
      category: "dairy",
    },
  ];

  await db.insert(foodItems).values(foodItemsData);
  console.log(`✅ Inserted ${foodItemsData.length} food items`);

  // Seed meals for clients
  const omar = usersList.find((u) => u.username === "client_omar");
  const mona = usersList.find((u) => u.username === "client_mona");
  const youssef = usersList.find((u) => u.username === "client_youssef");

  const mealsData = [];

  if (omar) {
    mealsData.push(
      {
        userId: omar.id,
        name: "Breakfast - Oatmeal & Eggs",
        type: "breakfast",
        calories: 520,
        proteins: 35,
        carbs: 52,
        fats: 16,
        fiber: 8,
        date: new Date(),
        foodItems: [
          { item: "Oatmeal", grams: 60 },
          { item: "Eggs", count: 3 },
          { item: "Banana", count: 1 },
        ],
      },
      {
        userId: omar.id,
        name: "Lunch - Grilled Chicken & Rice",
        type: "lunch",
        calories: 585,
        proteins: 52,
        carbs: 60,
        fats: 10,
        fiber: 6,
        date: new Date(),
        foodItems: [
          { item: "Chicken Breast", grams: 180 },
          { item: "Brown Rice", grams: 200 },
          { item: "Broccoli", grams: 150 },
          { item: "Olive Oil", tbsp: 1 },
        ],
      }
    );
  }

  if (mona) {
    mealsData.push({
      userId: mona.id,
      name: "Breakfast - Greek Yogurt Bowl",
      type: "breakfast",
      calories: 280,
      proteins: 22,
      carbs: 35,
      fats: 5,
      fiber: 4,
      date: new Date(),
      foodItems: [
        { item: "Greek Yogurt", grams: 200 },
        { item: "Banana", count: 1 },
        { item: "Oatmeal", grams: 30 },
      ],
    });
  }

  if (youssef) {
    mealsData.push({
      userId: youssef.id,
      name: "Post-Workout Meal",
      type: "lunch",
      calories: 780,
      proteins: 68,
      carbs: 85,
      fats: 14,
      fiber: 8,
      date: new Date(),
      foodItems: [
        { item: "Chicken Breast", grams: 220 },
        { item: "Brown Rice", grams: 300 },
        { item: "Broccoli", grams: 200 },
        { item: "Olive Oil", tbsp: 2 },
      ],
    });
  }

  if (mealsData.length > 0) {
    await db.insert(meals).values(mealsData);
    console.log(`✅ Inserted ${mealsData.length} meals`);
  }
}

// ============================================================================
// 8. SEED PROGRESS & DAILY STATS
// ============================================================================

async function seedProgressAndStats(usersList: any[]) {
  console.log("🌱 Seeding progress and daily stats...");

  const clients = usersList.filter((u) => u.role === "user");

  for (const client of clients) {
    // Progress entries for last 7 days
    const progressData = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      progressData.push({
        userId: client.id,
        date,
        weight: client.weight - i * 0.2, // Simulating gradual weight change
        caloriesConsumed: 1800 + Math.floor(Math.random() * 300),
        caloriesBurned: 400 + Math.floor(Math.random() * 200),
        steps: 7000 + Math.floor(Math.random() * 4000),
        waterGlasses: 6 + Math.floor(Math.random() * 3),
        notes: i === 0 ? "Feeling strong today!" : null,
      });
    }
    await db.insert(progress).values(progressData);

    // Daily stats for last 3 days
    const statsData = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      statsData.push({
        userId: client.id,
        date,
        calories: 1850 + i * 50,
        caloriesGoal: 2000,
        protein: 140 + i * 5,
        proteinGoal: 150,
        carbs: 200 + i * 10,
        carbsGoal: 220,
        fat: 55 + i * 3,
        fatGoal: 65,
        fiber: 25 + i * 2,
        fiberGoal: 30,
        steps: 8500 + i * 500,
        stepsGoal: 10000,
        water: 7 + (i % 2),
        waterGoal: 8,
      });
    }
    await db.insert(dailyStats).values(statsData);
  }

  console.log(`✅ Inserted progress and daily stats for ${clients.length} clients`);
}

// ============================================================================
// 9. SEED USER PLANS
// ============================================================================

async function seedUserPlans(usersList: any[]) {
  console.log("🌱 Seeding user plans...");

  const omar = usersList.find((u) => u.username === "client_omar");
  const mona = usersList.find((u) => u.username === "client_mona");
  const youssef = usersList.find((u) => u.username === "client_youssef");
  const ahmed = usersList.find((u) => u.username === "coach_ahmed");
  const sara = usersList.find((u) => u.username === "coach_sara");

  const plansData = [];

  if (omar && ahmed) {
    plansData.push({
      userId: omar.id,
      coachId: ahmed.id,
      title: "Fat Loss - Push/Pull/Legs (12 Weeks)",
      description: "Structured fat loss program combining resistance training with controlled calorie deficit",
      weeklyFocus: "Progressive overload on main lifts, maintaining muscle mass during cut",
      goals: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
      weeklySchedule: {
        monday: "Push Day - Chest, Shoulders, Triceps",
        tuesday: "30min Cardio (moderate intensity)",
        wednesday: "Pull Day - Back, Biceps",
        thursday: "Rest or Active Recovery",
        friday: "Leg Day",
        saturday: "30min HIIT Cardio",
        sunday: "Rest",
      },
    });
  }

  if (mona && sara) {
    plansData.push({
      userId: mona.id,
      coachId: sara.id,
      title: "Beginner Fat Loss & Fitness (8 Weeks)",
      description: "Build healthy habits, learn proper form, establish consistency",
      weeklyFocus: "Full body workouts 3x/week, gradual calorie deficit",
      goals: { calories: 1700, protein: 120, carbs: 180, fat: 50 },
      weeklySchedule: {
        monday: "Full Body Workout A",
        tuesday: "Rest or 20min Walk",
        wednesday: "Full Body Workout B",
        thursday: "Rest",
        friday: "Full Body Workout C",
        saturday: "20-30min Light Cardio",
        sunday: "Rest",
      },
    });
  }

  if (youssef && ahmed) {
    plansData.push({
      userId: youssef.id,
      coachId: ahmed.id,
      title: "Lean Bulk - Bro Split (16 Weeks)",
      description: "Maximize muscle growth with targeted body part training and calorie surplus",
      weeklyFocus: "Volume-focused hypertrophy training, controlled weight gain",
      goals: { calories: 3200, protein: 170, carbs: 420, fat: 90 },
      weeklySchedule: {
        monday: "Chest Day",
        tuesday: "Back Day",
        wednesday: "Shoulders Day",
        thursday: "Rest or Cardio",
        friday: "Legs Day",
        saturday: "Arms Day",
        sunday: "Rest",
      },
    });
  }

  if (plansData.length > 0) {
    await db.insert(userPlans).values(plansData);
    console.log(`✅ Inserted ${plansData.length} user plans`);
  }
}

// ============================================================================
// 10. SEED NOTIFICATIONS & MESSAGES
// ============================================================================

async function seedNotificationsAndMessages(usersList: any[]) {
  console.log("🌱 Seeding notifications and messages...");

  const clients = usersList.filter((u) => u.role === "user");
  const coaches = usersList.filter((u) => u.role === "coach");

  // Notifications
  const notificationsData = [];
  for (const client of clients) {
    notificationsData.push(
      {
        userId: client.id,
        type: "supplement",
        title: "Time for your supplements!",
        titleAr: "حان وقت المكملات الغذائية!",
        message: "Don't forget to take your recommended supplements",
        messageAr: "لا تنسى تناول المكملات الموصى بها",
        scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        status: "pending",
      },
      {
        userId: client.id,
        type: "workout",
        title: "Workout Reminder",
        titleAr: "تذكير بالتمرين",
        message: "Your workout is scheduled for today",
        messageAr: "تمرينك مجدول اليوم",
        scheduledFor: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
        status: "pending",
      }
    );
  }

  if (notificationsData.length > 0) {
    await db.insert(notifications).values(notificationsData);
    console.log(`✅ Inserted ${notificationsData.length} notifications`);
  }

  // Messages between clients and coaches
  const messagesData = [];
  if (clients[0] && coaches[0]) {
    messagesData.push(
      {
        senderId: clients[0].id,
        receiverId: coaches[0].id,
        content: "Coach, I've completed today's workout. Feeling great!",
        read: false,
      },
      {
        senderId: coaches[0].id,
        receiverId: clients[0].id,
        content: "Excellent work! Keep up the consistency. Let's review your progress this weekend.",
        read: false,
      }
    );
  }

  if (messagesData.length > 0) {
    await db.insert(messages).values(messagesData);
    console.log(`✅ Inserted ${messagesData.length} messages`);
  }
}

// ============================================================================
// 11. SEED PRODUCTS
// ============================================================================

async function seedProducts() {
  console.log("🌱 Seeding products...");

  const productsData = [
    {
      name: "Naioshfit Smart Water Bottle",
      description: "Track your daily water intake with smart reminders and app sync",
      price: 199,
      category: "accessories",
      rating: 4.8,
      reviewCount: 342,
      stock: 85,
      imageUrl: "/products/smart-bottle.jpg",
    },
    {
      name: "Resistance Bands Set (5 Bands)",
      description: "Complete resistance band set with door anchor and carrying bag",
      price: 149,
      category: "equipment",
      rating: 4.6,
      reviewCount: 527,
      stock: 120,
      imageUrl: "/products/resistance-bands.jpg",
    },
    {
      name: "Foam Roller - Premium Quality",
      description: "High-density foam roller for muscle recovery and myofascial release",
      price: 89,
      category: "equipment",
      rating: 4.7,
      reviewCount: 284,
      stock: 65,
      imageUrl: "/products/foam-roller.jpg",
    },
    {
      name: "Meal Prep Containers (7 Pack)",
      description: "BPA-free, microwave safe containers perfect for meal planning",
      price: 129,
      category: "nutrition",
      rating: 4.9,
      reviewCount: 756,
      stock: 200,
      imageUrl: "/products/meal-containers.jpg",
    },
  ];

  await db.insert(products).values(productsData);
  console.log(`✅ Inserted ${productsData.length} products`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log("\n🚀 Starting comprehensive database seeding...\n");

  try {
    // Clear all existing data using raw SQL
    console.log('🗑️  Clearing existing database data...\n');
    
    await db.execute(sql`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    
    console.log('✅ Database cleared successfully.\n');
    
    const insertedUsers = await seedUsers();
    const insertedSupplements = await seedSupplements();
    await seedSupplementInteractions(insertedSupplements);
    const insertedRecommendations = await seedSupplementRecommendations(
      insertedUsers,
      insertedSupplements
    );
    await seedSupplementFollowUps(insertedRecommendations);
    await seedWorkouts(insertedUsers);
    await seedMealsAndFoodItems(insertedUsers);
    await seedProgressAndStats(insertedUsers);
    await seedUserPlans(insertedUsers);
    await seedNotificationsAndMessages(insertedUsers);
    await seedProducts();

    console.log("\n✅ All data seeding completed successfully!\n");
    console.log("📊 Summary:");
    console.log(`   - Users: ${insertedUsers.length}`);
    console.log(`   - Supplements: ${insertedSupplements.length}`);
    console.log(`   - Recommendations: ${insertedRecommendations.length}`);
    console.log("   - Workouts, Meals, Progress, Plans, Messages: ✅");
    console.log("\n🎉 Database is now populated with real data!\n");
  } catch (error) {
    console.error("\n❌ Error during seeding:", error);
    throw error;
  } finally {
    setTimeout(() => process.exit(0), 500);
  }
}

main();
