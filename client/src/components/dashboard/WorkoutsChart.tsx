import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { format } from 'date-fns';
import { formatInAppTz } from '@/lib/timezone';
import { useLanguage } from '@/context/LanguageContext';

interface WorkoutsChartProps {
  loading?: boolean;
}

export const WorkoutsChart: React.FC<WorkoutsChartProps> = ({ 
  loading = false 
}) => {
  const { t } = useLanguage();
  // Fetch workout sessions data
  const { data: workoutSessions, isLoading } = useQuery({
    queryKey: ['/api/workout-sessions'],
  });

  // Generate empty week data structure
  const generateEmptyWeekData = () => {
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      weekData.push({
        date: formatInAppTz(date, 'MMM dd'),
        workouts: 0,
      });
    }
    
    return weekData;
  };

  // Format workout sessions data for chart
  const formatWorkoutsData = () => {
    // Ensure workoutSessions is an array and has data
    const sessionsArray = Array.isArray(workoutSessions) ? workoutSessions : [];
    if (sessionsArray.length === 0) return generateEmptyWeekData();
    
    // Get the last 7 days
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Count workout sessions for this day
      const dayWorkouts = sessionsArray.filter((session: any) => {
        const sessionDate = new Date(session.completedAt);
        const sessionDateString = formatInAppTz(sessionDate, 'yyyy-MM-dd');
        const targetDateString = formatInAppTz(date, 'yyyy-MM-dd');
        return sessionDateString === targetDateString;
      }).length;
      
      weekData.push({
        date: formatInAppTz(date, 'MMM dd'),
        workouts: dayWorkouts,
      });
    }
    
    return weekData;
  };

  const chartData = formatWorkoutsData();

  // Handle loading state
  if (loading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("workoutsProgress")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">{t("loading")}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t("workoutsProgress")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="workouts" stroke="#82ca9d" name={t("workoutsCompleted")} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default WorkoutsChart;