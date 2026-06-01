import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { DailyStats } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

const formatMacro = (value: number, goal: number) => {
  return {
    value: Math.round(value),
    percentage: Math.min(Math.round((value / goal) * 100), 100),
    goal
  };
};

interface NutritionSummaryProps {
  dailyStats?: DailyStats | null;
  loading?: boolean;
}

export const NutritionSummary: React.FC<NutritionSummaryProps> = ({ 
  dailyStats,
  loading = false 
}) => {
  const { t } = useLanguage();
  const defaultStats = {
    calories: 1450,
    caloriesGoal: 2200,
    protein: 85,
    proteinGoal: 140,
    carbs: 180,
    carbsGoal: 240,
    fat: 48,
    fatGoal: 60,
    fiber: 12,
    fiberGoal: 30
  };

  const stats = dailyStats || defaultStats;

  // Calculate macros
  const protein = formatMacro(stats.protein ?? 0, stats.proteinGoal ?? 0);
  const carbs = formatMacro(stats.carbs ?? 0, stats.carbsGoal ?? 0);
  const fat = formatMacro(stats.fat ?? 0, stats.fatGoal ?? 0);
  const fiber = formatMacro(stats.fiber || 0, stats.fiberGoal ?? 0);

  // Calculate meal distributions - these would come from actual meals in a real implementation
  const mealDistribution = {
    breakfast: { calories: 320 },
    lunch: { calories: 520 },
    dinner: { calories: 480 },
    snacks: { calories: 130 }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow animate-pulse h-64"></div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex flex-wrap justify-between">
        <div className="mb-4 md:mb-0">
          <h4 className="text-sm text-gray-500 mb-1">{t("breakfast")}</h4>
          <div className="flex items-center">
            <span className="text-lg font-medium mr-2">{mealDistribution.breakfast.calories}</span>
            <span className="text-xs text-gray-500">{t("calories").toLowerCase()}</span>
          </div>
        </div>
        <div className="mb-4 md:mb-0">
          <h4 className="text-sm text-gray-500 mb-1">{t("lunch")}</h4>
          <div className="flex items-center">
            <span className="text-lg font-medium mr-2">{mealDistribution.lunch.calories}</span>
            <span className="text-xs text-gray-500">{t("calories").toLowerCase()}</span>
          </div>
        </div>
        <div className="mb-4 md:mb-0">
          <h4 className="text-sm text-gray-500 mb-1">{t("dinner")}</h4>
          <div className="flex items-center">
            <span className="text-lg font-medium mr-2">{mealDistribution.dinner.calories}</span>
            <span className="text-xs text-gray-500">{t("calories").toLowerCase()}</span>
          </div>
        </div>
        <div>
          <h4 className="text-sm text-gray-500 mb-1">{t("snacks")}</h4>
          <div className="flex items-center">
            <span className="text-lg font-medium mr-2">{mealDistribution.snacks.calories}</span>
            <span className="text-xs text-gray-500">{t("calories").toLowerCase()}</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <h5 className="text-xs text-gray-500 mb-1">{t("protein")}</h5>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div className="bg-secondary h-2 rounded-full" style={{ width: `${protein.percentage}%` }}></div>
            </div>
            <div className="flex justify-between text-xs">
              <span>{protein.value}g</span>
              <span className="text-gray-500">{protein.goal}g</span>
            </div>
          </div>
          <div>
            <h5 className="text-xs text-gray-500 mb-1">{t("carbs")}</h5>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${carbs.percentage}%` }}></div>
            </div>
            <div className="flex justify-between text-xs">
              <span>{carbs.value}g</span>
              <span className="text-gray-500">{carbs.goal}g</span>
            </div>
          </div>
          <div>
            <h5 className="text-xs text-gray-500 mb-1">{t("fat")}</h5>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div className="bg-accent h-2 rounded-full" style={{ width: `${fat.percentage}%` }}></div>
            </div>
            <div className="flex justify-between text-xs">
              <span>{fat.value}g</span>
              <span className="text-gray-500">{fat.goal}g</span>
            </div>
          </div>
          <div>
            <h5 className="text-xs text-gray-500 mb-1">{t("fiber")}</h5>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${fiber.percentage}%` }}></div>
            </div>
            <div className="flex justify-between text-xs">
              <span>{fiber.value}g</span>
              <span className="text-gray-500">{fiber.goal}g</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutritionSummary;
