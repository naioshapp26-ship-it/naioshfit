/** Normalize English food names for duplicate comparison. */
export function normalizeEnglishFoodName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize Arabic food names (article, hamza, ta marbuta, diacritics). */
export function normalizeArabicFoodName(value: string | null | undefined): string {
  let text = (value ?? '').trim().toLowerCase();
  if (!text) return '';

  // Remove harakat / tatweel
  text = text.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
  // Alef / ya / ta marbuta variants
  text = text.replace(/[أإآ]/g, 'ا');
  text = text.replace(/ى/g, 'ي');
  text = text.replace(/ة/g, 'ه');
  // Definite article at start or after whitespace
  text = text.replace(/(?:^|\s+)ال(?=\S)/g, ' ');
  text = text.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

export function foodNamesMatch(
  a: { name?: string | null; nameAr?: string | null },
  b: { name?: string | null; nameAr?: string | null },
): boolean {
  const nameA = normalizeEnglishFoodName(a.name);
  const nameB = normalizeEnglishFoodName(b.name);
  if (nameA && nameB && nameA === nameB) {
    return true;
  }

  const nameArA = normalizeArabicFoodName(a.nameAr);
  const nameArB = normalizeArabicFoodName(b.nameAr);
  if (nameArA && nameArB && nameArA === nameArB) {
    return true;
  }

  return false;
}
