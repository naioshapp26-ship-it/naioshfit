export type FoodCategoryOption = {
  value: string;
  labelEn: string;
  labelAr: string;
};

/** Canonical food categories used across the food database. */
export const DEFAULT_FOOD_CATEGORIES: FoodCategoryOption[] = [
  { value: 'Proteins', labelEn: 'Proteins', labelAr: 'بروتينات' },
  { value: 'Carbohydrates', labelEn: 'Carbohydrates', labelAr: 'كربوهيدرات' },
  { value: 'Vegetables', labelEn: 'Vegetables', labelAr: 'خضروات' },
  { value: 'Fruits', labelEn: 'Fruits', labelAr: 'فواكه' },
  { value: 'Dairy & Alternatives', labelEn: 'Dairy & Alternatives', labelAr: 'ألبان وبدائلها' },
  { value: 'Nuts & Seeds', labelEn: 'Nuts & Seeds', labelAr: 'مكسرات وبذور' },
  { value: 'Legumes', labelEn: 'Legumes', labelAr: 'بقوليات' },
  { value: 'Biscuits & Cookies', labelEn: 'Biscuits & Cookies', labelAr: 'بسكويت وكوكيز' },
  { value: 'Processed Foods', labelEn: 'Processed Foods', labelAr: 'أطعمة مصنعة' },
  { value: 'Oils & Fats', labelEn: 'Oils & Fats', labelAr: 'زيوت ودهون' },
  { value: 'Egyptian & Arabian Dishes', labelEn: 'Egyptian & Arabian Dishes', labelAr: 'أطباق مصرية وعربية' },
];

export function mergeFoodCategories(apiCategories: string[]): FoodCategoryOption[] {
  const byValue = new Map<string, FoodCategoryOption>();
  for (const option of DEFAULT_FOOD_CATEGORIES) {
    byValue.set(option.value, option);
  }
  for (const category of apiCategories) {
    const trimmed = category?.trim();
    if (!trimmed || byValue.has(trimmed)) continue;
    byValue.set(trimmed, { value: trimmed, labelEn: trimmed, labelAr: trimmed });
  }
  return Array.from(byValue.values());
}

export function getFoodCategoryLabel(
  value: string,
  language: 'en' | 'ar',
): string {
  const match = DEFAULT_FOOD_CATEGORIES.find((item) => item.value === value);
  if (!match) return value;
  return language === 'ar' ? match.labelAr : match.labelEn;
}
