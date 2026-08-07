import React, { createContext, useState, useEffect } from "react";
import { translations, TranslationKey } from "@/lib/translations-data";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>("ar");

  useEffect(() => {
    // Only access browser APIs if we're in the browser
    if (typeof window !== 'undefined') {
      // Check for stored language preference
      const storedLanguage = localStorage.getItem("language") as Language | null;
      if (storedLanguage) {
        setLanguage(storedLanguage);
      }
      // If no stored preference, use Arabic as default (no browser detection)
    }
  }, []);

  useEffect(() => {
    // Only update DOM if we're in the browser
    if (typeof window !== 'undefined') {
      // Update document direction and lang attribute when language changes
      if (language === "ar") {
        document.documentElement.setAttribute("dir", "rtl");
        document.documentElement.setAttribute("lang", "ar");
      } else {
        document.documentElement.setAttribute("dir", "ltr");
        document.documentElement.setAttribute("lang", "en");
      }
      
      // Store preference
      localStorage.setItem("language", language);
    }
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prevLanguage => (prevLanguage === "en" ? "ar" : "en"));
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = React.useContext(LanguageContext);
  if (context === undefined) {
    // Provide a fallback that still works properly
    console.warn("useLanguage is being used outside of LanguageProvider, providing fallback");
    
    // Get language from localStorage as fallback
    const fallbackLanguage = (typeof window !== 'undefined' ? localStorage.getItem("language") as Language : null) || "ar";
    
    return {
      language: fallbackLanguage,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: TranslationKey) => translations[fallbackLanguage][key] || key
    };
  }
  return context;
};