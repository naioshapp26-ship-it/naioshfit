import { db } from "./db";
import { foodItems, type FoodItem, type InsertFoodItem } from "@shared/schema";
import { eq, or, ilike, desc, sql } from "drizzle-orm";

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
