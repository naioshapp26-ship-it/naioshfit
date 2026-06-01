import { DailyStats } from '@shared/schema';
import { cn } from '@/lib/utils';
import { FlameIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface CalorieCardProps {
  title: string;
  current: number;
  goal: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export const CalorieCard = ({ title, current, goal, icon, color, bgColor }: CalorieCardProps) => {
  const { t } = useLanguage();
  const percentage = Math.min(Math.round((current / goal) * 100), 100);

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-gray-500 text-sm font-medium">{title}</h4>
          <div className="flex items-baseline">
            <span className="text-2xl font-semibold text-gray-800">{current.toLocaleString()}</span>
            <span className="text-sm text-gray-500 ml-1">/ {goal.toLocaleString()}</span>
          </div>
        </div>
        <div className={cn("p-2 rounded-md", bgColor)}>
          {icon}
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={cn("h-2 rounded-full", color)} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="mt-2 text-xs text-gray-500 flex justify-between">
        <span>0</span>
        <span>{t("target")}: {goal.toLocaleString()}</span>
      </div>
    </div>
  );
};

interface DailyStatsCardProps {
  data?: DailyStats | null;
  loading?: boolean;
}

export const DailyStatsCards = ({ data, loading = false }: DailyStatsCardProps) => {
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-5 h-[140px]">
            <div className="h-full bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const defaultData = {
    calories: 0,
    caloriesGoal: 2200,
    protein: 0,
    proteinGoal: 140,
  };

  const stats = data || defaultData;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CalorieCard
        title={t("calories")}
        current={stats.calories ?? 0}
        goal={stats.caloriesGoal ?? 0}
        icon={<FlameIcon className="text-primary" />}
        color="bg-primary"
        bgColor="bg-blue-100"
      />
      <CalorieCard
        title={t("protein")}
        current={Math.round(stats.protein ?? 0)}
        goal={stats.proteinGoal ?? 0}
        icon={<span className="text-secondary">🍖</span>}
        color="bg-secondary"
        bgColor="bg-green-100"
      />
    </div>
  );
};

export default DailyStatsCards;