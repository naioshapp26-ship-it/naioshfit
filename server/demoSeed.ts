import bcrypt from 'bcryptjs';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { products, users } from '@shared/schema';

/** Must match client/src/components/auth/SignIn.tsx DEMO_PASSWORD */
export const DEMO_PASSWORD = 'Demo123!';

const DEMO_ACCOUNTS = [
  {
    username: 'demo_client',
    email: 'demo_client@demo.naioshfit.com',
    firstName: 'Amelia',
    lastName: 'Adel',
    role: 'user' as const,
    whatsappWithCode: '20155001111',
    gender: 'female' as const,
    country: 'Egypt',
    city: 'Cairo',
  },
  {
    username: 'demo_coach',
    email: 'demo_coach@demo.naioshfit.com',
    firstName: 'Naiosh',
    lastName: 'Coach',
    role: 'coach' as const,
    whatsappWithCode: '20155002222',
    gender: 'male' as const,
    country: 'Egypt',
    city: 'New Cairo',
    isApproved: true,
  },
  {
    username: 'demo_gym',
    email: 'demo_gym@demo.naioshfit.com',
    firstName: 'Naiosh',
    lastName: 'Gym',
    role: 'gym' as const,
    whatsappWithCode: '20155003333',
    gender: 'male' as const,
    country: 'Egypt',
    city: 'Giza',
  },
  {
    username: 'demo_admin',
    email: 'demo_admin@demo.naioshfit.com',
    firstName: 'Naiosh',
    lastName: 'Admin',
    role: 'admin' as const,
    whatsappWithCode: '20155004444',
    gender: 'male' as const,
    country: 'UAE',
    city: 'Dubai',
  },
];

const DEMO_PRODUCTS = [
  {
    name: 'Naioshfit Smart Bottle',
    description: 'Tracks hydration reminders and pairs with the dashboard.',
    price: 79,
    category: 'accessories',
    rating: 4.9,
    reviewCount: 184,
    stock: 120,
    imageUrl: '/products/bottle.jpg',
  },
  {
    name: 'Resistance Bands Pro Pack',
    description: 'Stackable bands covering 10lb-150lb for home workouts.',
    price: 59,
    category: 'equipment',
    rating: 4.7,
    reviewCount: 241,
    stock: 80,
    imageUrl: '/products/bands.jpg',
  },
];

export async function seedDemoAccountsIfNeeded(): Promise<void> {
  if (process.env.SKIP_DEMO_SEED === '1') {
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const account of DEMO_ACCOUNTS) {
    const baseData = {
      username: account.username,
      email: account.email,
      password: passwordHash,
      pinNumber: '1234',
      firstName: account.firstName,
      lastName: account.lastName,
      whatsappWithCode: account.whatsappWithCode,
      gender: account.gender,
      country: account.country,
      city: account.city,
      role: account.role,
      isApproved: account.isApproved ?? true,
      approvedAt: account.isApproved ? new Date() : null,
      subscriptionDuration: '1_month',
      subscriptionStartDate: new Date(),
      activityLevel: 'moderate',
      fitnessGoal: 'weight_loss',
      trainingLevel: 'intermediate',
      preferredWorkoutTime: 'midday',
      preferredProgram: 'push_pull_legs',
      workIntensity: 'moderate',
      hasKitchenScale: true,
      lunchHasProtein: true,
    };

    await db
      .insert(users)
      .values(baseData)
      .onConflictDoUpdate({
        target: users.username,
        set: {
          email: baseData.email,
          password: baseData.password,
          pinNumber: baseData.pinNumber,
          firstName: baseData.firstName,
          lastName: baseData.lastName,
          role: baseData.role,
          isApproved: baseData.isApproved,
        },
      });
  }

  const [client] = await db.select().from(users).where(eq(users.username, 'demo_client')).limit(1);
  const [coach] = await db.select().from(users).where(eq(users.username, 'demo_coach')).limit(1);
  const [gym] = await db.select().from(users).where(eq(users.username, 'demo_gym')).limit(1);

  if (client && (coach || gym)) {
    await db
      .update(users)
      .set({
        coachId: coach?.id ?? null,
        gymId: gym?.id ?? null,
      })
      .where(eq(users.id, client.id));
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products);

  if (Number(count) === 0) {
    await db.insert(products).values(DEMO_PRODUCTS);
  } else {
    await db
      .delete(products)
      .where(inArray(products.name, DEMO_PRODUCTS.map((p) => p.name)));
    await db.insert(products).values(DEMO_PRODUCTS);
  }

  console.log('[INIT] Demo accounts ready (password: Demo123!)');
}
