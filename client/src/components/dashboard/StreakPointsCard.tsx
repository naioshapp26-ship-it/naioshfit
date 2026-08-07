import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, Award, Flame } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface UserPointsData {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  rank: string;
  nextLevelPoints: number;
}

interface StreakPointsCardProps {
  data?: UserPointsData;
  loading?: boolean;
}

const StreakPointsCard: React.FC<StreakPointsCardProps> = ({ data, loading }) => {
  const { t } = useLanguage();

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {t("yourProgress") || "Your Progress"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const getBadgeColor = (rank: string) => {
    switch (rank) {
      case 'Elite':
        return 'text-purple-600 bg-purple-100';
      case 'Athlete':
        return 'text-blue-600 bg-blue-100';
      case 'Dedicated':
        return 'text-green-600 bg-green-100';
      case 'Consistent':
        return 'text-yellow-600 bg-yellow-100';
      case 'Starter':
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStreakMessage = (streak: number) => {
    if (streak === 0) {
      return t("startYourStreak") || "Start your streak today!";
    } else if (streak === 1) {
      return t("greatStart") || "Great start! Keep it going!";
    } else if (streak < 7) {
      return t("buildingMomentum") || "Building momentum! 🔥";
    } else if (streak < 30) {
      return t("onFire") || "You're on fire! 🔥🔥";
    } else {
      return t("unstoppable") || "Unstoppable! 🚀";
    }
  };

  const calculateProgressToNextLevel = (totalPoints: number, nextLevelPoints: number): number => {
    if (nextLevelPoints === 0) return 100; // Max level reached
    
    // Define level thresholds
    const levelThresholds = [
      { min: 0, max: 200 },      // Level 1
      { min: 200, max: 500 },    // Level 2
      { min: 500, max: 1000 },   // Level 3
      { min: 1000, max: 2500 },  // Level 4
      { min: 2500, max: Infinity } // Level 5
    ];
    
    // Find current level threshold
    const currentLevel = levelThresholds.find(
      level => totalPoints >= level.min && totalPoints < level.max
    );
    
    if (!currentLevel) return 100;
    
    const pointsInCurrentLevel = totalPoints - currentLevel.min;
    const pointsNeededForLevel = currentLevel.max - currentLevel.min;
    
    return (pointsInCurrentLevel / pointsNeededForLevel) * 100;
  };

  const progressToNextLevel = calculateProgressToNextLevel(data.totalPoints, data.nextLevelPoints);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {t("yourProgress") || "Your Progress"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Streak Section */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-orange-500" />
              <div>
                <h3 className="font-semibold text-gray-800">
                  {data.currentStreak} {t("dayStreak") || "Day Streak"}
                </h3>
                <p className="text-sm text-gray-600">{getStreakMessage(data.currentStreak)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{t("longest") || "Longest"}</p>
              <p className="text-lg font-bold text-orange-600">{data.longestStreak}</p>
            </div>
          </div>
        </div>

        {/* Points and Level Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <h4 className="text-sm font-medium text-gray-700">{t("totalPoints") || "Total Points"}</h4>
            </div>
            <p className="text-2xl font-bold text-blue-600">{data.totalPoints}</p>
            {data.nextLevelPoints > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {data.nextLevelPoints - data.totalPoints} {t("toNextLevel") || "to next level"}
              </p>
            )}
          </div>

          <div className={`p-4 rounded-lg ${getBadgeColor(data.rank)}`}>
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-5 w-5" />
              <h4 className="text-sm font-medium">{t("level") || "Level"} {data.level}</h4>
            </div>
            <p className="text-2xl font-bold">{data.rank}</p>
            {data.nextLevelPoints > 0 && (
              <div className="w-full bg-white/50 rounded-full h-2 mt-2">
                <div 
                  className="bg-current h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressToNextLevel}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* How to Earn Points */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{t("earnPoints") || "Earn Points:"}</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>• {t("logMeal") || "Log Meal"}: +5</div>
            <div>• {t("logWorkout") || "Log Workout"}: +20</div>
            <div>• {t("logSnack") || "Log Snack"}: +3</div>
            <div>• {t("logWeight") || "Log Weight"}: +10</div>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic">
            {t("keepStreakMessage") || "Keep your streak alive by logging at least 1 meal or workout each day!"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StreakPointsCard;
