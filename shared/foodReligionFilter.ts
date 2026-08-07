type FoodLike = {
  name: string;
  nameAr?: string | null;
  brand?: string | null;
  brandAr?: string | null;
};

function foodSearchText(food: FoodLike): string {
  return [food.name, food.nameAr, food.brand, food.brandAr]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Returns true when a food item should be hidden for the given religion. */
export function isFoodForbiddenForReligion(
  food: FoodLike,
  religion: string | null | undefined,
): boolean {
  if (!religion || religion !== 'muslim') {
    return false;
  }

  const text = foodSearchText(food);

  if (/خنزير/.test(text)) {
    return true;
  }

  if (/\bpork\b/.test(text)) {
    return true;
  }

  if (/\bbacon\b/.test(text)) {
    return true;
  }

  if (/\blard\b/.test(text)) {
    return true;
  }

  if (/\bham\b/.test(text)) {
    return true;
  }

  return false;
}

export function filterFoodsByReligion<T extends FoodLike>(
  foods: T[],
  religion: string | null | undefined,
): T[] {
  if (!religion || religion !== 'muslim') {
    return foods;
  }
  return foods.filter((food) => !isFoodForbiddenForReligion(food, religion));
}
