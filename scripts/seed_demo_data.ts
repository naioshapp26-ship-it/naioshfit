import { db } from "../server/db";
import {
  users,
  workouts,
  contentLibrary,
  products,
  messages,
  meals,
  progress,
  dailyStats,
  userPlans,
} from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

type DemoUserKey = "client" | "coach" | "admin" | "gym";

interface DemoUserDefinition {
  key: DemoUserKey;
  username: string;
  firstName: string;
  lastName: string;
  role: "user" | "coach" | "admin" | "gym";
  whatsappWithCode: string;
  gender?: "male" | "female";
  country?: string;
  city?: string;
  howFoundUs?: string;
  isApproved?: boolean;
}

const DEMO_ACCOUNT_PASSWORD = "Demo123!";

const demoUsers: DemoUserDefinition[] = [
  {
    key: "client",
    username: "demo_client",
    firstName: "Amelia",
    lastName: "Adel",
    role: "user",
    whatsappWithCode: "20155001111",
    gender: "female",
    country: "Egypt",
    city: "Cairo",
    howFoundUs: "instagram",
  },
  {
    key: "coach",
    username: "demo_coach",
    firstName: "Naiosh",
    lastName: "Coach",
    role: "coach",
    whatsappWithCode: "20155002222",
    gender: "male",
    country: "Egypt",
    city: "New Cairo",
    howFoundUs: "facebook",
    isApproved: true,
  },
  {
    key: "gym",
    username: "demo_gym",
    firstName: "Naiosh",
    lastName: "Gym",
    role: "gym",
    whatsappWithCode: "20155003333",
    gender: "male",
    country: "Egypt",
    city: "Giza",
    howFoundUs: "youtube",
  },
  {
    key: "admin",
    username: "demo_admin",
    firstName: "Naiosh",
    lastName: "Admin",
    role: "admin",
    whatsappWithCode: "20155004444",
    gender: "male",
    country: "UAE",
    city: "Dubai",
    howFoundUs: "whatsapp",
  },
];

async function upsertUsers() {
  const passwordHash = await bcrypt.hash(DEMO_ACCOUNT_PASSWORD, 10);
  const userMap = new Map<DemoUserKey, number>();

  for (const definition of demoUsers) {
    const baseData = {
      username: definition.username,
      email: `${definition.username}@demo.naioshfit.com`,
      password: passwordHash,
      pinNumber: "1234",
      firstName: definition.firstName,
      lastName: definition.lastName,
      whatsappWithCode: definition.whatsappWithCode,
      gender: definition.gender ?? null,
      country: definition.country ?? null,
      city: definition.city ?? null,
      howFoundUs: definition.howFoundUs ?? null,
      role: definition.role,
      isApproved: definition.isApproved ?? true,
      approvedAt: definition.isApproved ? new Date() : null,
      subscriptionType: "1_month",
      subscriptionStartDate: new Date(),
      subscriptionDuration: "1_month",
      activityLevel: "moderate",
      fitnessGoal: "weight_loss",
      trainingLevel: "intermediate",
      preferredWorkoutTime: "midday",
      preferredProgram: "push_pull_legs",
      workIntensity: "moderate",
      hasKitchenScale: true,
      lunchHasProtein: true,
    } as const;

    const [inserted] = await db
      .insert(users)
      .values(baseData)
      .onConflictDoUpdate({
        target: users.username,
        set: baseData,
      })
      .returning();

    if (inserted) {
      userMap.set(definition.key, inserted.id);
      continue;
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, definition.username));
    if (existing[0]) {
      userMap.set(definition.key, existing[0].id);
    }
  }

  const clientId = userMap.get("client");
  const coachId = userMap.get("coach");
  const gymId = userMap.get("gym");

  if (clientId && (coachId || gymId)) {
    await db
      .update(users)
      .set({
        coachId: coachId ?? null,
        gymId: gymId ?? null,
      })
      .where(eq(users.id, clientId));
  }

  return userMap;
}

async function seedWorkouts(coachId: number) {
  const demoWorkouts = [
    {
      name: "Total Body Ignite",
      description: "High-energy strength circuit to wake up every muscle group.",
      duration: 45,
      difficulty: "intermediate",
      type: "strength",
      coachId,
      exercises: [
        { name: "Kettlebell swings", sets: 4, reps: 15 },
        { name: "Reverse lunges", sets: 4, reps: 12 },
        { name: "Push-ups", sets: 4, reps: 15 },
      ],
    },
    {
      name: "Metabolic Finisher",
      description: "Short explosive conditioning block for busy professionals.",
      duration: 25,
      difficulty: "advanced",
      type: "conditioning",
      coachId,
      exercises: [
        { name: "Rowing machine", rounds: 5, interval: "40s on / 20s off" },
        { name: "Battle ropes", rounds: 5, interval: "30s on / 30s off" },
      ],
    },
  ];

  await db.delete(workouts).where(inArray(workouts.name, demoWorkouts.map((w) => w.name)));
  await db.insert(workouts).values(demoWorkouts);
}

async function seedContentLibrary(coachId: number) {
  const entries = [
    {
      coachId,
      title: "Mobility Reset Sequence",
      description: "5-minute daily sequence to keep shoulders and hips open.",
      type: "video",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      category: "mobility",
      tags: ["mobility", "daily", "warmup"],
      duration: 300,
    },
    {
      coachId,
      title: "Protein-packed Smoothie",
      description: "Quick recipe with macros for training mornings.",
      type: "article",
      url: "https://naioshfit.com/library/protein-smoothie",
      thumbnailUrl: null,
      category: "nutrition",
      tags: ["breakfast", "protein"],
      duration: null,
    },
  ];

  await db
    .delete(contentLibrary)
    .where(inArray(contentLibrary.title, entries.map((e) => e.title)));
  await db.insert(contentLibrary).values(entries);
}

async function seedProducts() {
  const demoProducts = [
    {
      name: "Naioshfit Smart Bottle",
      description: "Tracks hydration reminders and pairs with the dashboard.",
      price: 79,
      category: "accessories",
      rating: 4.9,
      reviewCount: 184,
      stock: 120,
      imageUrl: "/products/bottle.jpg",
    },
    {
      name: "Resistance Bands Pro Pack",
      description: "Stackable bands covering 10lb-150lb for home workouts.",
      price: 59,
      category: "equipment",
      rating: 4.7,
      reviewCount: 241,
      stock: 80,
      imageUrl: "/products/bands.jpg",
    },
  ];

  await db
    .delete(products)
    .where(inArray(products.name, demoProducts.map((p) => p.name)));
  await db.insert(products).values(demoProducts);
}

async function seedClientData(clientId: number, coachId: number) {
  await db.delete(dailyStats).where(eq(dailyStats.userId, clientId));
  await db.delete(meals).where(eq(meals.userId, clientId));
  await db.delete(progress).where(eq(progress.userId, clientId));
  await db.delete(userPlans).where(eq(userPlans.userId, clientId));

  const baseDate = new Date();

  const statsEntries = [0, 1, 2].map((offset) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - offset);
    return {
      userId: clientId,
      date,
      calories: 1800 + offset * 50,
      caloriesGoal: 2000,
      protein: 130 + offset * 5,
      proteinGoal: 150,
      carbs: 180,
      carbsGoal: 220,
      fat: 55,
      fatGoal: 65,
      fiber: 28,
      fiberGoal: 30,
      steps: 9000 + offset * 500,
      stepsGoal: 10000,
      water: 7,
      waterGoal: 8,
    };
  });

  await db.insert(dailyStats).values(statsEntries);

  const mealEntries = [
    {
      userId: clientId,
      name: "Mediterranean Bowl",
      type: "lunch",
      calories: 620,
      proteins: 42,
      carbs: 55,
      fats: 18,
      fiber: 10,
      date: baseDate,
      foodItems: [
        { item: "Grilled chicken", grams: 150 },
        { item: "Quinoa", grams: 90 },
        { item: "Fattoush salad", serving: 1 },
      ],
    },
    {
      userId: clientId,
      name: "Post-workout shake",
      type: "snack",
      calories: 320,
      proteins: 30,
      carbs: 35,
      fats: 6,
      fiber: 5,
      date: baseDate,
      foodItems: [
        { item: "Whey protein", scoop: 1 },
        { item: "Banana", unit: 1 },
        { item: "Peanut butter", tbsp: 1 },
      ],
    },
  ];

  await db.insert(meals).values(mealEntries);

  const progressEntries = [
    {
      userId: clientId,
      date: baseDate,
      weight: 72,
      caloriesConsumed: 1950,
      caloriesBurned: 520,
      steps: 9800,
      waterGlasses: 8,
      notes: "Felt great after morning training.",
    },
    {
      userId: clientId,
      date: new Date(baseDate.getTime() - 6 * 24 * 60 * 60 * 1000),
      weight: 73.5,
      caloriesConsumed: 2050,
      caloriesBurned: 480,
      steps: 8700,
      waterGlasses: 7,
      notes: "Slept less than usual.",
    },
  ];

  await db.insert(progress).values(progressEntries);

  await db.insert(userPlans).values({
    userId: clientId,
    coachId,
    title: "Lean Recomposition 4-week wave",
    description: "Progressive training + macro guidance for busy executives.",
    weeklyFocus: "Balance strength and conditioning across 4 sessions",
    goals: {
      calories: 2000,
      protein: 150,
      carbs: 210,
      fat: 60,
    },
    weeklySchedule: {
      monday: "Lower body strength",
      tuesday: "Low-impact conditioning",
      thursday: "Upper body strength",
      saturday: "Mobility & tempo work",
    },
  });
}

async function seedMessages(clientId: number, coachId: number) {
  await db
    .delete(messages)
    .where(
      inArray(messages.content, [
        "Coach, uploaded the new inbody scan for review.",
        "Great job! We'll adjust macros tomorrow.",
      ])
    );

  await db.insert(messages).values([
    {
      senderId: clientId,
      receiverId: coachId,
      content: "Coach, uploaded the new inbody scan for review.",
      read: false,
    },
    {
      senderId: coachId,
      receiverId: clientId,
      content: "Great job! We'll adjust macros tomorrow.",
      read: false,
    },
  ]);
}

async function main() {
  const userMap = await upsertUsers();
  const clientId = userMap.get("client");
  const coachId = userMap.get("coach");

  if (!clientId || !coachId) {
    throw new Error("Client and coach accounts must exist after seeding.");
  }

  await seedWorkouts(coachId);
  await seedContentLibrary(coachId);
  await seedProducts();
  await seedClientData(clientId, coachId);
  await seedMessages(clientId, coachId);

  console.log("Seed data applied successfully.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    // Allow open handles (like pg pool) to close naturally
    setTimeout(() => process.exit(0), 250);
  });
