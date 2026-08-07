export type FoodPreferenceCategory =
  | 'carbs'
  | 'proteins'
  | 'legumes'
  | 'vegetables'
  | 'dairy'
  | 'fats'
  | 'fruits';

export interface FoodPreferenceOption {
  value: string;
  labelKey: string;
}

/** Canonical stored values + translation keys (matches SignUp.tsx). */
export const FOOD_PREFERENCE_OPTIONS: Record<FoodPreferenceCategory, FoodPreferenceOption[]> = {
  carbs: [
    { value: 'rice', labelKey: 'rice' },
    { value: 'potatoes', labelKey: 'potatoes' },
    { value: 'sweet_potato', labelKey: 'sweetPotato' },
    { value: 'pasta', labelKey: 'pasta' },
    { value: 'oats', labelKey: 'oats' },
    { value: 'quinoa', labelKey: 'quinoa' },
    { value: 'brown_toast', labelKey: 'brownToast' },
    { value: 'other', labelKey: 'other' },
    { value: 'none', labelKey: 'doNotPreferAny' },
  ],
  proteins: [
    { value: 'meat', labelKey: 'meat' },
    { value: 'chicken', labelKey: 'chicken' },
    { value: 'fish', labelKey: 'fish' },
    { value: 'tuna', labelKey: 'tuna' },
    { value: 'salmon', labelKey: 'salmon' },
    { value: 'beef_liver', labelKey: 'beefLiver' },
    { value: 'chicken_liver', labelKey: 'chickenLiver' },
    { value: 'egg', labelKey: 'egg' },
    { value: 'other', labelKey: 'other' },
    { value: 'none', labelKey: 'doNotPreferAny' },
  ],
  legumes: [
    { value: 'foul', labelKey: 'foul' },
    { value: 'corn', labelKey: 'corn' },
    { value: 'chickpeas', labelKey: 'chickpeas' },
    { value: 'white_beans', labelKey: 'whiteBeans' },
    { value: 'red_beans', labelKey: 'redBeans' },
    { value: 'peas', labelKey: 'peas' },
    { value: 'other', labelKey: 'other' },
    { value: 'none', labelKey: 'doNotPreferAny' },
  ],
  vegetables: [
    { value: 'green_beans', labelKey: 'greenBeans' },
    { value: 'okra', labelKey: 'okra' },
    { value: 'broccoli', labelKey: 'broccoli' },
    { value: 'zucchini', labelKey: 'zucchini' },
    { value: 'lettuce', labelKey: 'lettuce' },
    { value: 'spinach', labelKey: 'spinach' },
    { value: 'other', labelKey: 'other' },
    { value: 'none', labelKey: 'doNotPreferAny' },
  ],
  dairy: [
    { value: 'cottage_cheese', labelKey: 'cottageCheese' },
    { value: 'milk', labelKey: 'milk' },
    { value: 'mozzarella_cheese', labelKey: 'mozzarellaCheese' },
    { value: 'yogurt', labelKey: 'yogurt' },
    { value: 'cheddar_cheese', labelKey: 'cheddarCheese' },
    { value: 'other', labelKey: 'other' },
    { value: 'none', labelKey: 'doNotPreferAny' },
  ],
  fats: [
    { value: 'olive_oil', labelKey: 'oliveOil' },
    { value: 'coconut_oil', labelKey: 'coconutOil' },
    { value: 'butter', labelKey: 'butter' },
    { value: 'nuts', labelKey: 'nuts' },
    { value: 'avocado', labelKey: 'avocado' },
    { value: 'peanut_butter', labelKey: 'peanutButter' },
    { value: 'other', labelKey: 'other' },
    { value: 'none', labelKey: 'doNotPreferAny' },
  ],
  fruits: [
    { value: 'banana', labelKey: 'banana' },
    { value: 'apple', labelKey: 'apple' },
    { value: 'strawberry', labelKey: 'strawberry' },
    { value: 'watermelon', labelKey: 'watermelon' },
    { value: 'orange', labelKey: 'orange' },
    { value: 'other', labelKey: 'other' },
    { value: 'none', labelKey: 'doNotPreferAny' },
  ],
};

export const FOOD_PREFERENCE_LABEL_KEYS = Array.from(
  new Set(Object.values(FOOD_PREFERENCE_OPTIONS).flat().map((option) => option.labelKey)),
);

export const FOOD_PREFERENCE_CATEGORY_LABEL_KEYS: Record<FoodPreferenceCategory, string> = {
  carbs: 'preferredCarbohydrates',
  proteins: 'preferredProteins',
  legumes: 'preferredLegumes',
  vegetables: 'preferredVegetables',
  dairy: 'preferredDairy',
  fats: 'preferredFats',
  fruits: 'preferredFruits',
};

export const FOOD_PREFERENCE_CATEGORY_SHORT_LABEL_KEYS: Record<FoodPreferenceCategory, string> = {
  carbs: 'preferredCarbohydratesShort',
  proteins: 'preferredProteinsShort',
  legumes: 'preferredLegumesShort',
  vegetables: 'preferredVegetablesShort',
  dairy: 'preferredDairyShort',
  fats: 'preferredFatsShort',
  fruits: 'preferredFruitsShort',
};
