import React, { useEffect, useState } from 'react';
import SignUp from '@/components/auth/SignUp';
import { useLanguage } from '@/context/LanguageContext';
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import TranslationBanner from '@/components/i18n/TranslationBanner';
import BackButton from '@/components/navigation/BackButton';

const SignUpPage: React.FC = () => {
  console.log('[SignUpPage] Mounted at', new Date().toISOString());
  const { t } = useLanguage();
  const { settings: branding } = useBranding();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [coachName, setCoachName] = useState<string>('');
  const [isLoadingCoach, setIsLoadingCoach] = useState<boolean>(false);
  const [gymName, setGymName] = useState<string>('');
  const [isLoadingGym, setIsLoadingGym] = useState<boolean>(false);
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);
  const referralBadges = [
    ...(gymName ? [{ label: t('gymReferralLabel') || 'Gym', value: gymName }] : []),
    ...(coachName ? [{ label: t('coachReferralLabel') || 'Coach', value: coachName }] : []),
  ];
  const isReferralLoading = isLoadingCoach || isLoadingGym;

  useEffect(() => {
    const isNumericId = (value?: string | null) => !!value && /^\d+$/.test(value);
    const readStorage = (key: string) => {
      if (typeof localStorage === 'undefined') return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    };
    const writeStorage = (key: string, value: string) => {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key, value);
      } catch {}
    };

    const urlParams = new URLSearchParams(window.location.search);
    const coachParam = urlParams.get('coachId') || urlParams.get('ref');
    const gymParam = urlParams.get('gymId');

    const cachedCoachName = readStorage('referralCoachName');
    if (cachedCoachName) setCoachName(cachedCoachName);
    const cachedGymName = readStorage('referralGymName');
    if (cachedGymName) setGymName(cachedGymName);

    const storedCoachId = readStorage('referralCoachId');
    const storedGymId = readStorage('referralGymId');

    const hasNewCoachReferral = isNumericId(coachParam);
    const hasNewGymReferral = isNumericId(gymParam);

    if (hasNewCoachReferral && coachParam) {
      writeStorage('referralCoachId', coachParam);
    }
    if (hasNewGymReferral && gymParam) {
      writeStorage('referralGymId', gymParam);
    }

    const resolvedCoachId = hasNewCoachReferral && coachParam
      ? coachParam
      : isNumericId(storedCoachId)
        ? storedCoachId!
        : null;

    const resolvedGymId = hasNewGymReferral && gymParam
      ? gymParam
      : isNumericId(storedGymId)
        ? storedGymId!
        : null;

    if (resolvedCoachId && (hasNewCoachReferral || !cachedCoachName)) {
      setIsLoadingCoach(true);
      fetch(`/api/coach/${resolvedCoachId}/name`)
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Coach not found');
        })
        .then(data => {
          setCoachName(data.fullName);
          writeStorage('referralCoachName', data.fullName);
          writeStorage('referralCoachId', resolvedCoachId);
        })
        .catch(error => {
          console.error('Error fetching coach name:', error);
        })
        .finally(() => {
          setIsLoadingCoach(false);
        });
    }

    if (resolvedGymId && (hasNewGymReferral || !cachedGymName)) {
      setIsLoadingGym(true);
      fetch(`/api/gym/${resolvedGymId}/name`)
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Gym not found');
        })
        .then(data => {
          setGymName(data.fullName);
          writeStorage('referralGymName', data.fullName);
          writeStorage('referralGymId', resolvedGymId);
        })
        .catch(error => {
          console.error('Error fetching gym name:', error);
        })
        .finally(() => {
          setIsLoadingGym(false);
        });
    }
  }, []);

  const handleSuccess = () => {
    // optional hook after signup (SignUp component already redirects)
  };

  return (
    <>
      {/* Translation warning banner */}
      <TranslationBanner />
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md mb-4">
        <BackButton fallbackHref="/home" className="h-10 px-4 sticky top-[84px] z-30" />
      </div>
      <div className="w-full max-w-md mb-8 text-center">
        <div className="flex justify-center items-center mb-2">
          <img
            src={logoUrl}
            alt="Naiosh Fit Logo"
            className="h-16 w-auto"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = DEFAULT_LOGO_ASSET;
            }}
          />
        </div>
        <p className="text-gray-600">{t('createNewAccount')}</p>
      </div>

  {/* Display referral info if available */}
  <div className="text-center mb-4 space-y-2">
    {isReferralLoading ? (
      <span className="text-lg text-gray-400">...</span>
    ) : referralBadges.length > 0 ? (
      referralBadges.map((badge) => (
        <div
          key={`${badge.label}-${badge.value}`}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg shadow-lg"
        >
          <p className="text-xs uppercase tracking-wide opacity-80">{badge.label}</p>
          <p className="text-2xl font-bold">{badge.value}</p>
        </div>
      ))
    ) : (
      <span className="text-sm text-gray-400">مرحباً بك</span>
    )}
  </div>
  <SignUp onToggleForm={() => navigate('/auth')} onSuccess={handleSuccess} />
      {user && (
        <p className="mt-4 text-xs text-gray-500 text-center">
          You are currently logged in. You can still create another account here, or <button onClick={() => navigate('/auth')} className="underline text-blue-600">go back</button>.
        </p>
      )}

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          {t('alreadyHaveAccount')} {" "}
          <button
            onClick={() => navigate('/auth')}
            className="text-primary underline"
          >
            {t('login')}
          </button>
        </p>
      </div>
      </div>
    </>
  );
};

export default SignUpPage;
