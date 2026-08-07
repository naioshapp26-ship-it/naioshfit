import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import PublicHeader from "@/components/layout/PublicHeader";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const TermsOfService = () => {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const isArabic = language === "ar";

  const { data } = useQuery({
    queryKey: ["/api/public/pages/tos"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/public/pages/tos");
      return response.json();
    },
  });

  const page = data?.page;
  const customTitle = isArabic ? page?.titleAr : page?.titleEn;
  const customContent = isArabic ? page?.contentAr : page?.contentEn;
  const hasCustomContent = Boolean(customContent && String(customContent).trim().length > 0);

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? "rtl" : "ltr"} lang={language}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <PublicHeader title={customTitle || t('termsOfServiceTitle')} stickyTopClassName="top-[72px]" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{customTitle || t('termsOfServiceTitle')}</h1>

        {hasCustomContent ? (
          <div className="prose prose-gray mt-8 max-w-none whitespace-pre-line">{customContent}</div>
        ) : (
        <div className="prose prose-gray mt-8 max-w-none">
          <p>
            {t('tosIntro')}
          </p>

          <h2>{t('tosSection1Title')}</h2>
          <ul>
            <li>{t('tosSection1Item1')}</li>
            <li>{t('tosSection1Item2')}</li>
            <li>{t('tosSection1Item3')}</li>
            <li>{t('tosSection1Item4')}</li>
          </ul>

          <h2>{t('tosSection2Title')}</h2>
          <ul>
            <li>{t('tosSection2Item1')}</li>
            <li>{t('tosSection2Item2')}</li>
            <li>{t('tosSection2Item3')}</li>
          </ul>

          <h2>{t('tosSection3Title')}</h2>
          <ul>
            <li>{t('tosSection3Item1')}</li>
            <li>{t('tosSection3Item2')}</li>
            <li>{t('tosSection3Item3')}</li>
            <li>{t('tosSection3Item4')}</li>
          </ul>

          <h2>{t('tosSection4Title')}</h2>
          <p>{t('tosSection4Para1')}</p>
          <ul>
            <li>{t('tosSection4Item1')}</li>
            <li>{t('tosSection4Item2')}</li>
            <li>{t('tosSection4Item3')}</li>
            <li>{t('tosSection4Item4')}</li>
          </ul>

          <h2>{t('tosSection5Title')}</h2>
          <p>
            {t('tosSection5Para1')}
          </p>

          <h2>{t('tosSection6Title')}</h2>
          <p>
            {t('tosSection6Para1')}
          </p>

          <h2>{t('tosSection7Title')}</h2>
          <p>
            {t('tosSection7Para1')}
          </p>

          <h2>{t('tosSection8Title')}</h2>
          <p>
            {t('tosSection8Para1')}
          </p>

          <h2>{t('tosSection9Title')}</h2>
          <p>
            {t('tosSection9Para1')}
          </p>

          <h2>{t('tosSection10Title')}</h2>
          <p>
            {t('tosSection10Para1')}
          </p>

          <h2>{t('tosSection11Title')}</h2>
          <p>
            {t('tosSection11Para1')} <a href="mailto:support@naioshfit.com" className="text-blue-600 underline">support@naioshfit.com</a> {t('or')}
            <a href="mailto:legal@naioshfit.com" className="text-blue-600 underline"> legal@naioshfit.com</a>.
          </p>
        </div>
        )}
      </div>
    </div>
  );
};

export default TermsOfService;
