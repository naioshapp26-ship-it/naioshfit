import { useState, useEffect } from 'react';
import { FoodItem } from '@shared/schema';

// Hook for searching food items
export function useFoodSearch(initialQuery: string = '') {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.trim() === '') {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/food-database/items?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Failed to fetch food items');
        const data = await response.json();
        setResults(data);
      } catch (err) {
        console.error('Error searching food:', err);
        setError('Failed to search food items');
      } finally {
        setLoading(false);
      }
    };

    const debounceSearch = setTimeout(() => {
      fetchResults();
    }, 300);

    return () => clearTimeout(debounceSearch);
  }, [query]);

  return { query, setQuery, results, loading, error };
}

// Hook for food categories
export function useFoodCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/food-database/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setCategories(data);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError('Failed to load food categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading, error };
}

// Hook for food items by category
export function useFoodByCategory(category: string | null) {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) {
      setFoods([]);
      return;
    }

    const fetchFoods = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/food-database/items?category=${encodeURIComponent(category)}`);
        if (!response.ok) throw new Error('Failed to fetch food items');
        const data = await response.json();
        setFoods(data);
      } catch (err) {
        console.error('Error fetching foods:', err);
        setError('Failed to load food items');
      } finally {
        setLoading(false);
      }
    };

    fetchFoods();
  }, [category]);

  return { foods, loading, error };
}

// Hook for calculating nutrition values
export function useNutritionCalculation() {
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateNutrition = async (foodId: number, weight: number) => {
    setCalculating(true);
    setError(null);
    try {
      const response = await fetch(`/api/food-database/calculate?foodId=${foodId}&weight=${weight}`);
      if (!response.ok) throw new Error('Failed to calculate nutrition');
      const data = await response.json();
      setCalculating(false);
      return data;
    } catch (err) {
      console.error('Error calculating nutrition:', err);
      setError('Failed to calculate nutrition values');
      setCalculating(false);
      return null;
    }
  };

  return { calculateNutrition, calculating, error };
}

// Hook for all foods 
export function useAllFoods() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllFoods = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/food-database/items');
        if (!response.ok) throw new Error('Failed to fetch food items');
        const data = await response.json();
        setFoods(data);
      } catch (err) {
        console.error('Error fetching all foods:', err);
        setError('Failed to load food database');
      } finally {
        setLoading(false);
      }
    };

    fetchAllFoods();
  }, []);

  return { foods, loading, error };
}

// Function to fetch a single food item by ID (not a hook)
export async function getFoodItemById(id: number): Promise<FoodItem | null> {
  try {
    const response = await fetch(`/api/food-database/items/${id}`);
    if (!response.ok) throw new Error('Failed to fetch food item');
    return await response.json();
  } catch (err) {
    console.error('Error fetching food item:', err);
    return null;
  }
}