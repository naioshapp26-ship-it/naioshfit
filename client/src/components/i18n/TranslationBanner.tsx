import React from 'react';
import { X } from 'lucide-react';

// Simple persistent dismissal using localStorage
const STORAGE_KEY = 'hideTranslationBanner';

export const TranslationBanner: React.FC = () => {
  const [hidden, setHidden] = React.useState(true);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHidden = localStorage.getItem(STORAGE_KEY) === '1';
      setHidden(isHidden);
    }
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  if (hidden) return null;

  return (
    <div
      className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-4 py-2 flex items-center gap-3 animate-slideDown z-40"
      translate="no"
      data-no-translate
    >
      <span className="flex-1">
        الرجاء تعطيل الترجمة التلقائية في المتصفح. التطبيق يدعم العربية بشكل كامل دون الحاجة للترجمة.
      </span>
      <button
        onClick={dismiss}
        className="p-1 rounded hover:bg-amber-100 text-amber-900"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default TranslationBanner;
