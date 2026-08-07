import AnimatedBackground from '@/components/layout/AnimatedBackground';
import BillingPanel from '@/components/billing/BillingPanel';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import { ThemeProvider } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';

export default function BillingPage() {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <ThemeProvider>
      <section
        className={`p-4 md:p-6 lg:p-8 relative min-h-screen ${isRTL ? 'text-right' : 'text-left'}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <AnimatedBackground />
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">{t('billing')}</h2>
          <p className="text-gray-600">{t('manageBillingInfo')}</p>
        </div>
        <BillingPanel />
        <TechnicalIssueWidget />
      </section>
    </ThemeProvider>
  );
}
