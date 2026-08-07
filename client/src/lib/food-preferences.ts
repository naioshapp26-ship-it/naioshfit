import { translations, type TranslationKey } from '@/lib/translations-data';
import {
  FOOD_PREFERENCE_LABEL_KEYS,
  FOOD_PREFERENCE_OPTIONS,
  type FoodPreferenceCategory,
} from '@shared/foodPreferenceOptions';

type Language = 'en' | 'ar';

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

/** Legacy / seed-data aliases → canonical stored keys. */
const VALUE_ALIASES: Record<string, string> = {
  beef: 'meat',
  eggs: 'egg',
  egg: 'egg',
  'sweet potato': 'sweet_potato',
  'brown rice': 'rice',
  'white rice': 'rice',
  bread: 'brown_toast',
  'brown toast': 'brown_toast',
  potato: 'potatoes',
  potatoes: 'potatoes',
  'cottage cheese': 'cottage_cheese',
  mozzarella: 'mozzarella_cheese',
  cheddar: 'cheddar_cheese',
  'green beans': 'green_beans',
  'white beans': 'white_beans',
  'red beans': 'red_beans',
  'olive oil': 'olive_oil',
  'coconut oil': 'coconut_oil',
  'peanut butter': 'peanut_butter',
  'beef liver': 'beef_liver',
  'chicken liver': 'chicken_liver',
};

const labelToValueCache = new Map<string, string>();

function ensureLabelLookup(): void {
  if (labelToValueCache.size > 0) return;

  for (const category of Object.keys(FOOD_PREFERENCE_OPTIONS) as FoodPreferenceCategory[]) {
    for (const option of FOOD_PREFERENCE_OPTIONS[category]) {
      labelToValueCache.set(normalizeLookupKey(option.value), option.value);
      labelToValueCache.set(normalizeLookupKey(option.value.replace(/_/g, ' ')), option.value);
    }
  }

  for (const labelKey of FOOD_PREFERENCE_LABEL_KEYS) {
    for (const lang of ['en', 'ar'] as const) {
      const label = translations[lang][labelKey as TranslationKey];
      if (typeof label === 'string' && label.trim()) {
        const option = Object.values(FOOD_PREFERENCE_OPTIONS)
          .flat()
          .find((entry) => entry.labelKey === labelKey);
        if (option) {
          labelToValueCache.set(normalizeLookupKey(label), option.value);
        }
      }
    }
  }

  for (const [alias, canonical] of Object.entries(VALUE_ALIASES)) {
    labelToValueCache.set(normalizeLookupKey(alias), canonical);
  }
}

function resolvePreferenceValue(rawToken: string): string {
  const trimmed = rawToken.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('other:') || trimmed.startsWith('none:')) {
    return trimmed;
  }

  ensureLabelLookup();

  const direct = trimmed.toLowerCase();
  if (labelToValueCache.has(normalizeLookupKey(direct))) {
    return labelToValueCache.get(normalizeLookupKey(direct))!;
  }

  const underscored = direct.replace(/\s+/g, '_');
  if (labelToValueCache.has(normalizeLookupKey(underscored))) {
    return labelToValueCache.get(normalizeLookupKey(underscored))!;
  }

  const alias = VALUE_ALIASES[normalizeLookupKey(trimmed)];
  if (alias) return alias;

  return underscored;
}

function translatePreferenceToken(token: string, language: Language): string {
  const trimmed = token.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('other:')) {
    const custom = trimmed.slice(6).trim();
    const otherLabel = translations[language].other || 'Other';
    return custom ? `${otherLabel}: ${custom}` : otherLabel;
  }

  if (trimmed.startsWith('none:')) {
    const custom = trimmed.slice(5).trim();
    const noneLabel = translations[language].doNotPreferAny || trimmed;
    return custom ? `${noneLabel}: ${custom}` : noneLabel;
  }

  const canonical = resolvePreferenceValue(trimmed);

  if (canonical === 'other') {
    return translations[language].other || 'Other';
  }

  if (canonical === 'none') {
    return translations[language].doNotPreferAny || trimmed;
  }

  const lookupKeys = [canonical, snakeToCamel(canonical)] as TranslationKey[];
  for (const key of lookupKeys) {
    const translated = translations[language][key];
    if (translated) {
      return translated;
    }
  }

  // Unknown custom text — show as entered (may already be Arabic).
  return trimmed.replace(/_/g, ' ');
}

/** Render stored comma-separated food preference keys in the active UI language. */
export function formatFoodPreferences(
  value: string | null | undefined,
  language: Language,
): string {
  if (!value?.trim()) return '';

  return value
    .split(/,\s*/)
    .map((part) => translatePreferenceToken(part, language))
    .filter(Boolean)
    .join(language === 'ar' ? '، ' : ', ');
}

export function getFoodPreferenceOptions(category: FoodPreferenceCategory) {
  return FOOD_PREFERENCE_OPTIONS[category];
}
