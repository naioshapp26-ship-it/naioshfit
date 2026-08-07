import { XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

export default function PaymentsCancelPage() {
  const { t } = useLanguage();

  return (
    <section className="p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <XCircle className="h-7 w-7 text-amber-600" />
              <div>
                <CardTitle className="text-2xl">{t('paymentCancelled')}</CardTitle>
                <CardDescription>{t('paymentCancelledDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button className="sm:w-auto" asChild>
              <a href="/billing">{t('billing')}</a>
            </Button>
            <Button variant="ghost" className="sm:w-auto" asChild>
              <a href="/dashboard">{t('dashboard')}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
