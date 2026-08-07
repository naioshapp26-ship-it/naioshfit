import type { Request } from 'express';

export type UiLanguage = 'en' | 'ar';

export const getRequestLanguage = (req: Request, fallback: UiLanguage = 'ar'): UiLanguage => {
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

export const getPaymentGatewayNotConfiguredMessage = (language: UiLanguage): string => {
  if (language === 'ar') {
    return 'بوابة الدفع غير مهيأة. يرجى التواصل مع الإدارة.';
  }
  return 'Payment gateway is not configured. Please contact the administrator.';
};

export const getPurchaseSessionFailedMessage = (language: UiLanguage): string => {
  if (language === 'ar') {
    return 'فشل إنشاء جلسة الدفع. تحقق من إعدادات الدفع أو جرّب طريقة دفع أخرى.';
  }
  return 'Failed to create purchase session. Check payment settings or try another payment method.';
};

const LOGIN_ERROR_MESSAGES: Record<string, { ar: string; en: string }> = {
  'Incorrect credentials.': {
    ar: 'بيانات الدخول غير صحيحة. تحقق من البريد الإلكتروني وكلمة المرور.',
    en: 'Incorrect credentials. Please check your email and password.',
  },
  'Incorrect password.': {
    ar: 'كلمة المرور غير صحيحة.',
    en: 'Incorrect password.',
  },
  'Invalid credentials.': {
    ar: 'بيانات الدخول غير صالحة.',
    en: 'Invalid credentials.',
  },
  'Your coach account is pending admin approval.': {
    ar: 'حساب المدرب بانتظار موافقة الإدارة.',
    en: 'Your coach account is pending admin approval.',
  },
  'Authentication internal error': {
    ar: 'حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.',
    en: 'An error occurred during sign-in. Please try again.',
  },
  'Login session error': {
    ar: 'تعذر إنشاء جلسة الدخول. حاول مرة أخرى.',
    en: 'Could not create login session. Please try again.',
  },
  'Session persistence error': {
    ar: 'تعذر حفظ جلسة الدخول. حاول مرة أخرى.',
    en: 'Could not save login session. Please try again.',
  },
};

export const getLoginErrorMessage = (message: string | undefined, language: UiLanguage): string => {
  const normalized = (message || '').trim();
  const mapped = LOGIN_ERROR_MESSAGES[normalized];
  if (mapped) {
    return language === 'ar' ? mapped.ar : mapped.en;
  }
  if (normalized) return normalized;
  return language === 'ar'
    ? 'فشل تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.'
    : 'Login failed. Please verify your email and password.';
};

export const getPaymobIntegrationMissingMessage = (language: UiLanguage): string => {
  if (language === 'ar') {
    return 'إعدادات Paymob غير مكتملة (معرّفات التكامل). يرجى التواصل مع الإدارة.';
  }
  return 'Paymob is not fully configured (integration IDs missing). Please contact the administrator.';
};
