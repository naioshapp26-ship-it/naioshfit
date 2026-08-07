import type { FoodItem } from '@shared/schema';

export function getFoodApiHeaders(language: 'en' | 'ar', json = false): HeadersInit {
  const headers: Record<string, string> = {
    'X-Language': language,
  };
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export function getDuplicateFoodToastDescription(
  t: (key: string) => string,
  language: 'en' | 'ar',
  existingItem?: Partial<FoodItem> | null,
): string {
  const label =
    language === 'ar'
      ? existingItem?.nameAr || existingItem?.name
      : existingItem?.name || existingItem?.nameAr;

  if (label) {
    return `${t('foodAlreadyExists')} ${label}`;
  }
  return t('foodAlreadyExists');
}
