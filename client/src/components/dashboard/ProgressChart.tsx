import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DailyStats } from '@shared/schema';
import { format } from 'date-fns';
import { formatInAppTz } from '@/lib/timezone';
import { useLanguage } from '@/context/LanguageContext';

interface ProgressChartProps {
  weeklyStats?: DailyStats[];
  loading?: boolean;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ 
  weeklyStats, 
  loading = false 
}) => {
  const { t } = useLanguage();

  // Generate empty week data structure if none provided
  const generateEmptyWeekData = () => {
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      weekData.push({
        date: date,
        calories: 0,
        steps: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        water: 0,
      });
    }
    
    return weekData;
  };

  const emptyData = generateEmptyWeekData();

  // Debug logging
  console.log('ProgressChart props:', { weeklyStats, loading, hasData: weeklyStats && weeklyStats.length > 0 });

  // Handle loading state and empty data
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("caloriesProgress")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">{t("loading")}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = weeklyStats && weeklyStats.length > 0 ? weeklyStats : emptyData;
  
  // Format data for Recharts - same format as progress page
  const formatNutritionData = () => {
    if (!data || data.length === 0) return [];
    
    // Sort data by date
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return sortedData.map(s => ({
      date: formatInAppTz(new Date(s.date), 'MMM dd'),
      calories: s.calories,
      protein: s.protein,
      carbs: s.carbs,
      fat: s.fat,
    }));
  };

  const chartData = formatNutritionData();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t("caloriesProgress")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="calories" stroke="#8884d8" name={t("calories")} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ProgressChart;