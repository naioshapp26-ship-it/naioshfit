import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';

interface LanguageToggleProps {
  className?: string;
  variant?: 'ghost' | 'outline' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '', variant = 'outline', size = 'sm' }) => {
  const { language, toggleLanguage } = useLanguage();
  const next = language === 'ar' ? 'EN' : 'ع';
  const label = language === 'ar' ? 'English' : 'العربية';
  return (
    <Button
      type="button"
      onClick={toggleLanguage}
      variant={variant}
      size={size as any}
      className={`font-medium ${className}`}
      title={label}
    >
      {next}
    </Button>
  );
};

export default LanguageToggle;
