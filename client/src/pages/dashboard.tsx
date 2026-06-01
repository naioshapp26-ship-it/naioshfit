import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { DailyStats, UserPlan } from '@shared/schema';
import DailyStatsCards from '@/components/dashboard/CalorieCard';
import ProgressChart from '@/components/dashboard/ProgressChart';
import WorkoutsChart from '@/components/dashboard/WorkoutsChart';
import CoachPlan from '@/components/dashboard/CoachPlan';
import NutritionSummary from '@/components/dashboard/NutritionSummary';
import StreakPointsCard from '@/components/dashboard/StreakPointsCard';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/context/LanguageContext';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import { AdBanner } from '@/components/ads/AdBanner';

interface UserPointsData {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  rank: string;
  nextLevelPoints: number;
}

interface CreditSummaryData {
  balance: number;
  isLow?: boolean;
  exhausted?: boolean;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Fetch daily stats
  const { data: dailyStats, isLoading: isLoadingStats } = useQuery<DailyStats>({
    queryKey: ['/api/daily-stats'],
  });

  // Fetch weekly stats for chart
  const { data: weeklyStats, isLoading: isLoadingWeekly } = useQuery<DailyStats[]>({
    queryKey: ['/api/weekly-stats'],
  });

  // Fetch user's latest plan
  const { data: userPlan, isLoading: isLoadingPlan } = useQuery<UserPlan>({
    queryKey: ['/api/user-plans', { latest: true }],
  });

  // Fetch user points and streaks
  const { data: userPoints, isLoading: isLoadingPoints } = useQuery<UserPointsData>({
    queryKey: ['/api/user-points'],
  });

  const { data: creditSummary, isLoading: isLoadingCredits } = useQuery<CreditSummaryData>({
    queryKey: ['/api/credits/summary'],
  });

  return (
    <section className="p-4 md:p-6 lg:p-8 relative min-h-screen">
      <AnimatedBackground />
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-zinc-100">{t("dashboard")}</h2>
        <p className="text-gray-600 dark:text-zinc-300">{t("welcomeBack")}, {user?.firstName}! {t("fitnessSummary")}</p>

        <div className="mt-4 rounded-2xl border border-teal-100 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/90 shadow-sm p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-zinc-300">{t('availableCredits')}</p>
            <p className="text-3xl font-bold text-teal-700 dark:text-teal-300 mt-1">
              {isLoadingCredits
                ? '...'
                : Number(creditSummary?.balance ?? 0).toLocaleString()}
            </p>
            {!isLoadingCredits && (
              <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
                {creditSummary?.exhausted || creditSummary?.isLow ? t('lowBalance') : t('balanceOk')}
              </p>
            )}
          </div>
          <Link href="/settings?tab=billing" className="text-sm font-semibold text-teal-700 hover:text-teal-800 underline underline-offset-4">
            {t('topUpCredits')}
          </Link>
        </div>
      </div>

      {/* Ad Banners */}
      <AdBanner />

      {/* Streak and Points Section */}
      <div className="mb-8">
        <StreakPointsCard data={userPoints} loading={isLoadingPoints} />
      </div>

      {/* Today's Summary */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-100 mb-3">{t("todaysSummary")}</h3>
        <DailyStatsCards data={dailyStats} loading={isLoadingStats} />
      </div>

      {/* Weekly Progress Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-100 mb-3">{t("caloriesProgress")}</h3>
          <ProgressChart weeklyStats={weeklyStats} loading={isLoadingWeekly} />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-100 mb-3">{t("workoutsProgress")}</h3>
          <WorkoutsChart loading={false} />
        </div>
      </div>

      {/* Coach's Plan */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-100 mb-3">{t("yourCoachsPlan")}</h3>
        <CoachPlan userPlan={userPlan} loading={isLoadingPlan} />
      </div>

      {/* Technical Issue Widget */}
      <TechnicalIssueWidget />
    </section>
  );
};

export default Dashboard;
