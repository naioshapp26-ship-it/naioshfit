import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import PublicHeader from "@/components/layout/PublicHeader";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function PrivacyPolicy() {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const isArabic = language === "ar";

  const { data } = useQuery({
    queryKey: ["/api/public/pages/privacy-policy"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/public/pages/privacy-policy");
      return response.json();
    },
  });

  const page = data?.page;
  const customTitle = isArabic ? page?.titleAr : page?.titleEn;
  const customContent = isArabic ? page?.contentAr : page?.contentEn;
  const hasCustomContent = Boolean(customContent && String(customContent).trim().length > 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-foreground" dir={isRTL ? "rtl" : "ltr"} lang={language}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <PublicHeader title={customTitle || t('privacyPolicyTitle')} stickyTopClassName="top-[72px]" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{customTitle || t('privacyPolicyTitle')}</h1>

        {hasCustomContent ? (
          <div className="prose prose-gray dark:prose-invert mt-8 max-w-none whitespace-pre-line">{customContent}</div>
        ) : (

        <div className="prose prose-gray dark:prose-invert mt-8 max-w-none">
          <p>
            {t('privacyPolicyIntro1')}
            {" "}
            <a href="https://www.naioshfit.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">https://www.naioshfit.com</a>{" "}
            {t('privacyPolicyIntro2')}
          </p>

          <p>
            {t('privacyPolicyIntro3')}
          </p>

          <h2>{t('privacySection1Title')}</h2>
          <p>
            {t('privacySection1Para1')}
          </p>
          <p>
            {t('privacySection1Para2')} {" "}
            <a href="mailto:privacy@naioshfit.com" className="text-blue-600 underline">privacy@naioshfit.com</a>{" "}
            {t('or')} {" "}
            <a href="mailto:support@naioshfit.com" className="text-blue-600 underline">support@naioshfit.com</a>.
          </p>

          <h2>{t('privacySection2Title')}</h2>
          <p>{t('privacySection2Para1')}</p>
          <ul>
            <li><strong>{t('privacySection2Item1')}</strong></li>
            <li><strong>{t('privacySection2Item2')}</strong></li>
            <li><strong>{t('privacySection2Item3')}</strong></li>
            <li><strong>{t('privacySection2Item4')}</strong></li>
            <li><strong>{t('privacySection2Item5')}</strong></li>
            <li><strong>{t('privacySection2Item6')}</strong></li>
          </ul>

          <h2>{t('privacySection3Title')}</h2>
          <p>{t('privacySection3Para1')}</p>
          <ul>
            <li>{t('privacySection3Item1')}</li>
            <li>{t('privacySection3Item2')}</li>
            <li>{t('privacySection3Item3')}</li>
            <li>{t('privacySection3Item4')}</li>
            <li>{t('privacySection3Item5')}</li>
            <li>{t('privacySection3Item6')}</li>
          </ul>

          <h2>{t('privacySection4Title')}</h2>
          <p>{t('privacySection4Para1')}</p>
          <ul>
            <li><strong>{t('privacySection4Item1')}</strong></li>
            <li><strong>{t('privacySection4Item2')}</strong></li>
            <li><strong>{t('privacySection4Item3')}</strong></li>
            <li><strong>{t('privacySection4Item4')}</strong></li>
          </ul>

          <h2>{t('privacySection5Title')}</h2>
          <p>{t('privacySection5Para1')}</p>
          <ul>
            <li>{t('privacySection5Item1')}</li>
            <li>{t('privacySection5Item2')}</li>
            <li>{t('privacySection5Item3')}</li>
            <li>{t('privacySection5Item4')}</li>
          </ul>
          <p>{t('privacySection5Para2')}</p>

          <h2>{t('privacySection6Title')}</h2>
          <p>
            {t('privacySection6Para1')}
          </p>

          <h2>{t('privacySection7Title')}</h2>
          <p>
            {t('privacySection7Para1')}
          </p>

          <h2>{t('privacySection8Title')}</h2>
          <p>
            {t('privacySection8Para1')}
          </p>

          <h2>{t('privacySection9Title')}</h2>
          <p>{t('privacySection9Para1')}</p>
          <ul>
            <li>{t('privacySection9Item1')}</li>
            <li>{t('privacySection9Item2')}</li>
            <li>{t('privacySection9Item3')}</li>
            <li>{t('privacySection9Item4')}</li>
            <li>{t('privacySection9Item5')}</li>
          </ul>

          <h2>{t('privacySection10Title')}</h2>
          <p>
            {t('privacySection10Para1')}
          </p>

          <h2>{t('privacySection11Title')}</h2>
          <p>
            {t('privacySection11Para1')}
          </p>

          <h2>{t('privacySection12Title')}</h2>
          <p>
            {t('privacySection12Para1')} {" "}
            <a href="mailto:privacy@naioshfit.com" className="text-blue-600 underline">privacy@naioshfit.com</a>{" "}
            {t('or')} {" "}
            <a href="mailto:support@naioshfit.com" className="text-blue-600 underline">support@naioshfit.com</a>. {t('privacySection12Para2')}
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
