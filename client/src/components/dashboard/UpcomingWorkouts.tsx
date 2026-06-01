import React from 'react';
import { Link } from 'wouter';
import { UserWorkout } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { DumbbellIcon, Terminal, HeartPulseIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Helper function to translate weekday names
const translateDay = (day: string, t: (key: string) => string): string => {
  const dayMap: { [key: string]: string } = {
    'Monday': 'monday',
    'Tuesday': 'tuesday',
    'Wednesday': 'wednesday',
    'Thursday': 'thursday',
    'Friday': 'friday',
    'Saturday': 'saturday',
    'Sunday': 'sunday'
  };
  return dayMap[day] ? t(dayMap[day]) : day;
};

interface WorkoutItemProps {
  workout: {
    id: number;
    name: string;
    type: string;
    duration: number;
    time: string;
    day: string;
    isToday: boolean;
  };
}

const WorkoutItem: React.FC<WorkoutItemProps> = ({ workout }) => {
  const { t } = useLanguage();
  let icon;
  let bgColor;

  switch (workout.type) {
    case 'strength':
      icon = <DumbbellIcon className="text-primary" />;
      bgColor = 'bg-blue-100';
      break;
    case 'cardio':
      icon = <Terminal className="text-secondary" />;
      bgColor = 'bg-green-100';
      break;
    case 'flexibility':
      icon = <HeartPulseIcon className="text-purple-600" />;
      bgColor = 'bg-purple-100';
      break;
    default:
      icon = <DumbbellIcon className="text-primary" />;
      bgColor = 'bg-blue-100';
  }

  return (
    <div className="p-4 border-b">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-md ${bgColor} flex items-center justify-center mr-3`}>
            {icon}
          </div>
          <div>
            <h5 className="font-medium">{workout.name}</h5>
            <p className="text-sm text-gray-500">
              {translateDay(workout.day, t)} · {workout.duration} min · {workout.time}
            </p>
          </div>
        </div>
        <Button variant={workout.isToday ? "default" : "outline"}>
          {workout.isToday ? "Start" : "Details"}
        </Button>
      </div>
    </div>
  );
};

interface UpcomingWorkoutsProps {
  workouts?: UserWorkout[];
  loading?: boolean;
}

const UpcomingWorkouts: React.FC<UpcomingWorkoutsProps> = ({ workouts, loading = false }) => {
  // Default workouts if none provided
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const defaultWorkouts = [
    {
      id: 1,
      name: "Upper Body Strength",
      type: "strength",
      duration: 45,
      time: "7:00 PM",
      day: "Today",
      isToday: true
    },
    {
      id: 2,
      name: "HIIT Cardio",
      type: "cardio",
      duration: 30,
      time: "6:30 AM",
      day: "Tomorrow",
      isToday: false
    },
    {
      id: 3,
      name: "Yoga & Flexibility",
      type: "flexibility",
      duration: 40,
      time: "8:00 PM",
      day: "Thursday",
      isToday: false
    }
  ];

  const displayWorkouts = defaultWorkouts;

  if (loading) {
    return (
      <Card className="h-[350px] animate-pulse">
        <CardContent className="p-0 h-full bg-gray-100"></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b flex justify-between items-center">
          <h4 className="font-medium">This Week</h4>
          <Link href="/workouts">
            <Button variant="link" className="text-primary text-sm font-medium p-0">View All</Button>
          </Link>
        </div>
        
        {displayWorkouts.map(workout => (
          <WorkoutItem key={workout.id} workout={workout} />
        ))}
      </CardContent>
    </Card>
  );
};

export default UpcomingWorkouts;
