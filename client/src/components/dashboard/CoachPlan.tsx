import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlan } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle, Circle, User } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/hooks/use-auth';

interface CoachPlanProps {
  userPlan?: UserPlan | null;
  loading?: boolean;
}

const CoachPlan: React.FC<CoachPlanProps> = ({ userPlan, loading = false }) => {
  const { t } = useLanguage();
  // Debug log to verify updated build without Weekly Focus section
  React.useEffect(() => {
    console.log('[CoachPlan] Loaded updated component (Weekly Focus removed / WhatsApp integration)');
  }, []);
  const { user } = useAuth();
  // Fetch coach data if user has a coachId
  const { data: coach } = useQuery({
    queryKey: ['coach', user?.coachId],
    queryFn: async () => {
      if (!user?.coachId) return null;
      const res = await fetch(`/api/users/${user.coachId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load coach');
      return res.json();
    },
    enabled: !!user?.coachId
  });
  const whatsappNumber: string | undefined = coach?.whatsappNumber || coach?.phoneNumber;
  const whatsappLink = whatsappNumber ? `https://wa.me/${whatsappNumber.replace(/[^\d+]/g,'')}` : null;
  // Default coach plan if none provided
  const defaultPlan = {
    id: 1,
    userId: 1,
    coachId: null,
    title: "Weekly Plan",
    description: "Focus on strength and cardio this week",
    weeklyFocus: "This week we'll focus on improving your core strength and increasing your cardio capacity gradually. Remember to track your water intake and aim for at least 7 hours of sleep each night.",
    goals: [
      { text: "Complete all scheduled workouts (3/5 done)", completed: true },
      { text: "Stay within calorie targets at least 5 days", completed: true },
      { text: "Hit 10,000 steps daily", completed: false },
      { text: "Log all meals and snacks", completed: false }
    ],
    createdAt: new Date('2023-06-08'),
    updatedAt: new Date('2023-06-10')
  };

  const plan = userPlan || defaultPlan;
  const goals = Array.isArray(plan.goals) ? plan.goals : [];
  
  // Calculate days since update
  const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(plan.updatedAt).getTime()) / (1000 * 3600 * 24));

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
        <div className="p-4 border-b flex items-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
            <User className="text-primary text-lg" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium">
              {coach ? `${coach.firstName} ${coach.lastName}` : t("yourCoach")}
            </h4>
            <p className="text-sm text-gray-500">{t("updatedDaysAgo").replace("{days}", daysSinceUpdate.toString())}</p>
          </div>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="ml-auto">
              <Button>{t("message")}</Button>
            </a>
          )}
        </div>
        <div className="p-4">
          {/* Display plan description instead of goals */}
          {plan.description && (
            <div>
              <h5 className="font-medium mb-2">{t("planDescription")}</h5>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.description}</p>
            </div>
          )}
          <Link href="/nutrition">
            <Button variant="link" className="p-0 h-auto text-primary text-sm font-medium mt-4">
              {t("viewFullPlan")} →
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoachPlan;
