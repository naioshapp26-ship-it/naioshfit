import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

interface CreditSummaryResponse {
  balance: number;
  lowBalanceThreshold: number;
  isLow: boolean;
  exhausted: boolean;
}

export default function PaymentsSuccessPage() {
  const { t } = useLanguage();

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<CreditSummaryResponse>({
    queryKey: ['payments', 'credits', 'summary'],
    queryFn: async () => {
      const response = await fetch('/api/credits/summary', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to load credit summary');
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      refetch();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [refetch]);

  return (
    <section className="p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              <div>
                <CardTitle className="text-2xl">{t('paymentSuccess')}</CardTitle>
                <CardDescription>{t('paymentSuccessDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-white px-4 py-3">
              <div>
                <p className="text-sm text-gray-500">{t('availableCredits')}</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {isLoading ? '—' : data?.balance?.toLocaleString() ?? '—'}
                </p>
              </div>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn('h-4 w-4 ltr:mr-2 rtl:ml-2', isFetching && 'animate-spin')} />
                {t('refresh')}
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="sm:w-auto" asChild>
                <a href="/billing">{t('billing')}</a>
              </Button>
              <Button variant="ghost" className="sm:w-auto" asChild>
                <a href="/dashboard">{t('dashboard')}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
