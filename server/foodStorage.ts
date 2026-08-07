import { db } from "./db";
import { foodItems, type FoodItem, type InsertFoodItem } from "@shared/schema";
import { eq, or, ilike, desc, sql } from "drizzle-orm";
import {
  foodNamesMatch,
  normalizeArabicFoodName,
  normalizeEnglishFoodName,
} from "@shared/foodNormalize";

function englishSearchTokens(value: string | null | undefined): string[] {
  const normalized = normalizeEnglishFoodName(value);
  if (!normalized) return [];
  return [...new Set(normalized.split(/\s+/).filter((part) => part.length >= 2))];
}

function arabicSearchTokens(value: string | null | undefined): string[] {
  const raw = (value ?? '').trim();
  if (!raw) return [];

  const tokens = new Set<string>();
  for (const word of raw.split(/\s+/)) {
    const stripped = word.replace(/^ال/u, '').trim();
    if (stripped.length >= 2) tokens.add(stripped);
  }

  const normalized = normalizeArabicFoodName(raw);
  for (const word of normalized.split(/\s+/)) {
    if (word.length >= 2) tokens.add(word);
  }

  return [...tokens];
}

/**
 * Search for food items in the global database
 * @param query - Search query string (searches name, nameAr, brand, brandAr)
 * @param limit - Maximum number of results to return (default: 30)
 * @returns Array of matching food items
 */
export async function searchFoods(
  query?: string,
  limit: number = 30,
  database: typeof db = db
): Promise<FoodItem[]> {
  try {
    // If no query provided, return most recent items
    if (!query || query.trim() === '') {
      return await database
        .select()
        .from(foodItems)
        .orderBy(desc(foodItems.createdAt))
        .limit(limit);
    }

    // Search with case-insensitive partial match on name, nameAr, brand, and brandAr
    const searchPattern = `%${query}%`;
    
    return await database
      .select()
      .from(foodItems)
      .where(
        or(
          ilike(foodItems.name, searchPattern),
          // Use sql template to handle null values
          sql`${foodItems.nameAr} ILIKE ${searchPattern}`,
          sql`${foodItems.brand} ILIKE ${searchPattern}`,
          sql`${foodItems.brandAr} ILIKE ${searchPattern}`
        )
      )
      .orderBy(desc(foodItems.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Error searching foods:', error);
    throw error;
  }
}

/**
 * Find an existing food item with the same English or Arabic name (normalized).
 */
export async function findDuplicateFood(
  data: Pick<InsertFoodItem, 'name' | 'nameAr' | 'category' | 'servingSizeGrams' | 'calories'>,
  database: typeof db = db,
): Promise<FoodItem | undefined> {
  try {
    const tokens = [
      ...englishSearchTokens(data.name),
      ...arabicSearchTokens(data.nameAr),
    ];

    if (tokens.length === 0) {
      return undefined;
    }

    const filters = tokens.flatMap((token) => [
      ilike(foodItems.name, `%${token}%`),
      sql`${foodItems.nameAr} ILIKE ${'%' + token + '%'}`,
    ]);

    const candidates = await database
      .select()
      .from(foodItems)
      .where(or(...filters))
      .limit(100);

    return candidates.find((candidate) => foodNamesMatch(data, candidate));
  } catch (error) {
    console.error('Error finding duplicate food:', error);
    throw error;
  }
}

/**
 * Create a new food item in the global database
 * @param data - Food item data to insert
 * @returns The created food item
 */
export async function createFood(
  data: InsertFoodItem,
  database: typeof db = db
): Promise<FoodItem> {
  try {
    const [newFood] = await database
      .insert(foodItems)
      .values(data)
      .returning();
    
    return newFood;
  } catch (error) {
    console.error('Error creating food:', error);
    throw error;
  }
}

/**
 * Get a food item by ID
 * @param id - Food item ID
 * @returns The food item or undefined if not found
 */
export async function getFoodById(
  id: number,
  database: typeof db = db
): Promise<FoodItem | undefined> {
  try {
    const [food] = await database
      .select()
      .from(foodItems)
      .where(eq(foodItems.id, id))
      .limit(1);
    
    return food;
  } catch (error) {
    console.error('Error getting food by ID:', error);
    throw error;
  }
}

/**
 * Get food items by category
 * @param category - Food category
 * @param limit - Maximum number of results to return
 * @returns Array of food items in the category
 */
export async function getFoodsByCategory(
  category: string,
  limit: number = 100,
  database: typeof db = db
): Promise<FoodItem[]> {
  try {
    return await database
      .select()
      .from(foodItems)
      .where(eq(foodItems.category, category))
      .orderBy(desc(foodItems.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Error getting foods by category:', error);
    throw error;
  }
}

/**
 * Get all unique food categories
 * @returns Array of category names
 */
export async function deleteFood(
  id: number,
  database: typeof db = db,
): Promise<boolean> {
  try {
    const result = await database
      .delete(foodItems)
      .where(eq(foodItems.id, id))
      .returning({ id: foodItems.id });

    return result.length > 0;
  } catch (error) {
    console.error('Error deleting food:', error);
    throw error;
  }
}

export async function getFoodCategories(database: typeof db = db): Promise<string[]> {
  try {
    const result = await database
      .selectDistinct({ category: foodItems.category })
      .from(foodItems)
      .orderBy(foodItems.category);
    
    return result.map(r => r.category);
  } catch (error) {
    console.error('Error getting food categories:', error);
    throw error;
  }
}
