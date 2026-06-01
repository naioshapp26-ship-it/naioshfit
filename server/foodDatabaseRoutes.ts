import { Router } from 'express';
import { drizzle } from 'drizzle-orm/node-postgres';
import OpenAI from 'openai';
import {
  buildAiNotConfiguredResponse,
  getAiFeatureConfig,
  getAiSettingsForRequest,
} from './aiSettings';
import { 
  searchFoods,
  createFood,
  getFoodById,
  getFoodsByCategory,
  getFoodCategories
} from './foodStorage';
import { db } from './db';
import * as schema from '@shared/schema';
import { insertFoodItemSchema } from '@shared/schema';
import { 
  foodDatabase, 
  getFoodCategories as getFoodCategoriesLegacy,
  getFoodItemsByCategory as getFoodItemsByCategoryLegacy,
  searchFoodItems as searchFoodItemsLegacy,
  getFoodItemById as getFoodItemByIdLegacy
} from '../shared/foodDatabase';

const foodRouter = Router();

const resolveDb = (req: any): typeof db => {
  const tenantPool = req?.tenantPool as any;
  if (tenantPool) {
    return drizzle(tenantPool, { schema }) as typeof db;
  }
  return db;
};

// Safely coerce numeric-like values (number or string with optional units) to number
function toNumber(value: unknown, fieldName: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    // Extract the first floating-point number from the string (e.g., "100g" -> 100)
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const n = Number(match[0]);
      if (Number.isFinite(n)) return n;
    }
  }
  throw new Error(`Invalid numeric value for ${fieldName}`);
}

// Helper function to check if database is available and has data
async function useDatabaseOrFallback<T>(
  dbOperation: () => Promise<T>,
  fallbackOperation: () => T
): Promise<T> {
  try {
    const result = await dbOperation();
    // If result is an array and empty, use fallback
    if (Array.isArray(result) && result.length === 0) {
      console.log('[Food DB] Empty result from database, using fallback');
      return fallbackOperation();
    }
    return result;
  } catch (error) {
    console.log('[Food DB] Database error, using fallback:', error);
    return fallbackOperation();
  }
}

// Get all food categories
foodRouter.get('/categories', async (req, res) => {
  try {
    const database = resolveDb(req);
    const categories = await useDatabaseOrFallback(
      () => getFoodCategories(database),
      () => getFoodCategoriesLegacy()
    );
    res.json(categories);
  } catch (error) {
    console.error('Error fetching food categories:', error);
    res.status(500).json({ message: "Error fetching food categories" });
  }
});

// Search food items or get recent items
foodRouter.get('/items', async (req, res) => {
  try {
    const category = req.query.category as string;
    const query = req.query.query as string;
    const limit = parseInt(req.query.limit as string) || 30;
    const database = resolveDb(req);
    
    let items;
    
    if (category) {
      items = await useDatabaseOrFallback(
        () => getFoodsByCategory(category, limit, database),
        () => getFoodItemsByCategoryLegacy(category)
      );
    } else if (query) {
      items = await useDatabaseOrFallback(
        () => searchFoods(query, limit, database),
        () => searchFoodItemsLegacy(query)
      );
    } else {
      // No query - return recent from DB or all from legacy
      items = await useDatabaseOrFallback(
        () => searchFoods(undefined, limit, database),
        () => foodDatabase
      );
    }
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching food items:', error);
    res.status(500).json({ message: "Error fetching food items" });
  }
});

// Get food item by ID
foodRouter.get('/items/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const database = resolveDb(req);
    
    const foodItem = await useDatabaseOrFallback(
      () => getFoodById(id, database),
      () => getFoodItemByIdLegacy(id)
    );
    
    if (!foodItem) {
      return res.status(404).json({ message: "Food item not found" });
    }
    
    res.json(foodItem);
  } catch (error) {
    console.error('Error fetching food item:', error);
    res.status(500).json({ message: "Error fetching food item" });
  }
});

// Create a new food item
foodRouter.post('/items', async (req, res) => {
  try {
    // Validate request body
    const validatedData = insertFoodItemSchema.parse(req.body);
    const database = resolveDb(req);
    
    // Add createdBy from authenticated user if available
    const foodData = {
      ...validatedData,
      createdBy: (req.user as any)?.id || null
    };
    
    const newFood = await createFood(foodData, database);
    res.status(201).json(newFood);
  } catch (error) {
    console.error('Error creating food item:', error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Error creating food item" });
    }
  }
});

// Search food with AI - when food item not found in database, use OpenAI to fetch nutrition data
foodRouter.post('/search-with-ai', async (req, res) => {
  try {
    const { query } = req.body;
    const database = resolveDb(req);
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ message: "Search query is required" });
    }
    
    const aiSettings = await getAiSettingsForRequest(req as any);
    const foodConfig = getAiFeatureConfig(aiSettings, 'foodSearch');
    if (!foodConfig) {
      return res.status(400).json(buildAiNotConfiguredResponse('foodSearch'));
    }
    
    // Initialize OpenAI client with extended timeout for complex searches
    const openai = new OpenAI({ 
      apiKey: foodConfig.apiKey as string,
      timeout: 5 * 60 * 1000, // 5 minutes timeout
    });
    
    // Use pre-configured prompt with web search enabled from OpenAI dashboard
    // Prompt ID: pmpt_690cc1d5490881978b585385dc841032092083a95cb8334b
    const promptId = foodConfig.promptId || 'pmpt_690cc1d5490881978b585385dc841032092083a95cb8334b';
    const promptVersion = foodConfig.promptVersion || '2';
    
    // Call OpenAI Responses API with prompt
    // No max_output_tokens limit - let the model use as many tokens as needed
    const response = await openai.responses.create({
      model: foodConfig.model || 'gpt-5-mini-2025-08-07',
      input: query, // The food search query
      prompt: {
        id: promptId,
        version: promptVersion
      }
      // Removed max_output_tokens to allow unlimited tokens for complex food searches
    } as any);
    
    // Extract the response from Responses API
    // The response structure is different from chat.completions
    let responseText = '';
    
    console.log('[AI Food Search] Response structure:', JSON.stringify(response, null, 2));
    
    if (response.output && Array.isArray(response.output)) {
      // Find the text output in the response
      for (const item of response.output) {
        console.log('[AI Food Search] Processing output item type:', item.type);
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            console.log('[AI Food Search] Processing content type:', content.type);
            if (content.type === 'output_text' && content.text) {
              responseText = content.text;
              break;
            }
          }
        }
        if (responseText) break;
      }
    }
    
    if (!responseText) {
      console.error('[AI Food Search] No response text found. Full response:', JSON.stringify(response, null, 2));
      throw new Error('No response from OpenAI');
    }
    
    console.log('[AI Food Search] Successfully extracted response text, length:', responseText.length);
    console.log('[AI Food Search] Response text preview:', responseText.substring(0, 500));
    
    // Parse JSON from response (handle potential markdown code blocks)
    let foodData;
    try {
      // Try parsing directly first
      foodData = JSON.parse(responseText);
      console.log('[AI Food Search] Successfully parsed JSON directly');
    } catch (parseError) {
      console.log('[AI Food Search] Direct JSON parse failed, trying to extract from text');
      
      // Remove markdown code blocks if present
      let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        foodData = JSON.parse(cleanedText);
        console.log('[AI Food Search] Successfully parsed JSON after removing markdown');
      } catch (secondError) {
        // Try to extract JSON object with regex
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            foodData = JSON.parse(jsonMatch[0]);
            console.log('[AI Food Search] Successfully parsed JSON from regex match');
          } catch (regexError) {
            console.error('[AI Food Search] Failed to parse JSON. Response text:', responseText);
            throw new Error('Could not parse JSON from OpenAI response');
          }
        } else {
          console.error('[AI Food Search] No JSON object found in response. Response text:', responseText);
          throw new Error('Could not parse JSON from OpenAI response');
        }
      }
    }
    
    // Validate that we have all required fields
    if (!foodData.name || typeof foodData.calories !== 'number' || 
        typeof foodData.proteins !== 'number' || typeof foodData.carbs !== 'number' ||
        typeof foodData.fats !== 'number' || typeof foodData.fiber !== 'number' ||
        !foodData.serving_size || typeof foodData.serving_size_grams !== 'number' ||
        !foodData.category) {
      throw new Error('OpenAI response missing required fields');
    }
    
    // Normalize/coerce numbers exactly as provided by OpenAI
    const normalized = {
      name: String(foodData.name),
      nameAr: foodData.name_ar ? String(foodData.name_ar) : null,
      brand: foodData.brand ? String(foodData.brand) : null,
      brandAr: foodData.brand_ar ? String(foodData.brand_ar) : null,
      calories: toNumber(foodData.calories, 'calories'),
      proteins: toNumber(foodData.proteins, 'proteins'),
      carbs: toNumber(foodData.carbs, 'carbs'),
      fats: toNumber(foodData.fats, 'fats'),
      fiber: toNumber(foodData.fiber, 'fiber'),
      servingSize: String(foodData.serving_size),
      servingSizeGrams: toNumber(foodData.serving_size_grams, 'serving_size_grams'),
      category: String(foodData.category),
    } as const;
    
    // Create the food item in the database with strict validation
    const validatedData = insertFoodItemSchema.parse(normalized);
    
    // Add createdBy from authenticated user if available
    const insertData = {
      ...validatedData,
      createdBy: (req.user as any)?.id || null
    };
    
    const newFood = await createFood(insertData, database);
    
    res.status(201).json(newFood);
  } catch (error) {
    console.error('AI search error:', error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error) {
      res.status(500).json({ message: `AI search failed: ${error.message}` });
    } else {
      res.status(500).json({ message: "AI search failed" });
    }
  }
});

export default foodRouter;