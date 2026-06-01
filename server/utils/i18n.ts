import type { Request } from 'express';

export type UiLanguage = 'en' | 'ar';

export const getRequestLanguage = (req: Request, fallback: UiLanguage = 'en'): UiLanguage => {
  const header = (req.header('x-language') || req.header('x-lang') || req.header('accept-language') || '').toLowerCase();
  if (header.includes('ar')) return 'ar';
  if (header.includes('en')) return 'en';
  return fallback;
};

export const getInsufficientCreditsMessage = (language: UiLanguage): string => {
  if (language === 'ar') {
    return 'رصيدك غير كاف لإتمام هذه العملية. الرجاء شراء المزيد من الرصيد.';
  }
  return 'You do not have enough credits to complete this action.';
};

export const getPaymentNotCompletedMessage = (language: UiLanguage): string => {
  if (language === 'ar') {
    return 'لم يتم اكتمال الدفع بعد. يرجى المحاولة مرة اخرى بعد قليل.';
  }
  return 'Payment has not been completed yet. Please try again shortly.';
};

export const getTenantPaymentRequiredMessage = (language: UiLanguage): string => {
  if (language === 'ar') {
    return 'الدفع مطلوب للوصول الى هذا النظام. يرجى اتمام الدفع او التواصل مع الدعم.';
  }
  return 'Payment is required to access this tenant. Please complete payment or contact support.';
};

export const getBundleDeleteHasTransactionsMessage = (language: UiLanguage): string => {
  if (language === 'ar') {
    return 'لا يمكن حذف الباقة لوجود معاملات مرتبطة بها.';
  }
  return 'Cannot delete bundle that has related transactions.';
};
