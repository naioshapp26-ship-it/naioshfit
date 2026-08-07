import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import SignIn from "@/components/auth/SignIn";
import { useLanguage } from "@/context/LanguageContext";
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from "@/context/BrandingContext";
import { useLocation } from "wouter";
import BackButton from "@/components/navigation/BackButton";

interface AuthProps {
  onLogin?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const { settings: branding } = useBranding();
  const [, navigate] = useLocation();
  const [coachName, setCoachName] = useState<string>('');
  const [isLoadingCoach, setIsLoadingCoach] = useState<boolean>(false);
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);

  useEffect(() => {
    // Check if there's a stored coach ID in localStorage
    const storedCoachId = localStorage.getItem('referralCoachId');
    const storedCoachName = localStorage.getItem('referralCoachName');

    if (storedCoachName) {
      // Use cached name if available
      setCoachName(storedCoachName);
    } else if (storedCoachId) {
      // Fetch coach name if only ID is stored
      setIsLoadingCoach(true);
      fetch(`/api/coach/${storedCoachId}/name`)
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Coach not found');
        })
        .then(data => {
          setCoachName(data.fullName);
          localStorage.setItem('referralCoachName', data.fullName);
        })
        .catch(error => {
          console.error('Error fetching coach name:', error);
        })
        .finally(() => {
          setIsLoadingCoach(false);
        });
    }
  }, []);

  // Redirect to /signup instead of toggling an inline sign-up form
  const goToSignup = () => {
    navigate('/signup');
  };

  // Function to handle successful login/signup
  const handleSuccess = () => {
    if (onLogin) {
      onLogin();
    }
  };

  return (
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
        <p className="text-gray-600">
          {t('yourPersonalFitnessCoach')}
        </p>
        {/* Display coach name if available */}
        {isLoadingCoach ? (
          <div className="mt-2">
            <span className="text-sm text-gray-400">...</span>
          </div>
        ) : coachName ? (
          <div className="mt-3">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg shadow-lg inline-block">
              <p className="text-2xl font-bold">{coachName}</p>
            </div>
          </div>
        ) : null}
      </div>

      <SignIn onToggleForm={goToSignup} onSuccess={handleSuccess} />

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          {t('byUsingXTraining')} {" "}
          <Button
            variant="link"
            className="p-0 h-auto align-baseline text-primary"
            onClick={() => navigate('/tos')}
            aria-label="View Terms of Service"
          >
            {t('termsOfService')}
          </Button>{" "}
          {t('and')} {" "}
          <Button
            variant="link"
            className="p-0 h-auto align-baseline text-primary"
            onClick={() => navigate('/privacy-policy')}
            aria-label="View Privacy Policy"
          >
            {t('privacyPolicy')}
          </Button>
        </p>
      </div>
    </div>
  );
};

const AuthWrapper = () => <Auth />;
export { AuthWrapper };

export default Auth;
