import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function calculateCalorieNeeds(
  weight: number,
  height: number,
  age: number,
  gender: string,
  activityLevel: string
): number {
  // BMR calculation using Mifflin-St Jeor Equation
  let bmr;
  if (gender.toLowerCase() === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // Activity multiplier
  let activityMultiplier;
  switch (activityLevel.toLowerCase()) {
    case "sedentary":
      activityMultiplier = 1.2;
      break;
    case "light":
      activityMultiplier = 1.375;
      break;
    case "moderate":
      activityMultiplier = 1.55;
      break;
    case "active":
      activityMultiplier = 1.725;
      break;
    case "very active":
      activityMultiplier = 1.9;
      break;
    default:
      activityMultiplier = 1.2;
  }

  return Math.round(bmr * activityMultiplier);
}

export function calculateMacros(
  calories: number,
  goal: string
): { protein: number; carbs: number; fat: number } {
  let proteinPct, carbsPct, fatPct;

  switch (goal.toLowerCase()) {
    case "weight loss":
      proteinPct = 0.4; // 40% protein
      fatPct = 0.35; // 35% fat
      carbsPct = 0.25; // 25% carbs
      break;
    case "muscle gain":
      proteinPct = 0.3; // 30% protein
      fatPct = 0.25; // 25% fat
      carbsPct = 0.45; // 45% carbs
      break;
    case "maintenance":
    default:
      proteinPct = 0.3; // 30% protein
      fatPct = 0.3; // 30% fat
      carbsPct = 0.4; // 40% carbs
  }

  // Protein: 4 calories per gram
  // Carbs: 4 calories per gram
  // Fat: 9 calories per gram
  return {
    protein: Math.round((calories * proteinPct) / 4),
    carbs: Math.round((calories * carbsPct) / 4),
    fat: Math.round((calories * fatPct) / 9),
  };
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`;
}

// Arabic numeral conversion utilities
const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const englishNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function convertArabicToEnglish(input: string): string {
  return input.replace(/[٠-٩]/g, (match) => {
    const index = arabicNumerals.indexOf(match);
    return index !== -1 ? englishNumerals[index] : match;
  });
}

export function convertEnglishToArabic(input: string): string {
  return input.replace(/[0-9]/g, (match) => {
    const index = englishNumerals.indexOf(match);
    return index !== -1 ? arabicNumerals[index] : match;
  });
}

// Normalize any Arabic-Indic (٠١٢٣٤٥٦٧٨٩) or Extended Arabic-Indic (۰۱۲۳۴۵۶۷۸۹) digits to Western 0-9
export function normalizeDigitsUniversal(value: string): string {
  if (!value) return value;
  const arabicIndic = /[\u0660-\u0669]/g; // ٠١٢٣٤٥٦٧٨٩
  const easternArabicIndic = /[\u06F0-\u06F9]/g; // ۰۱۲۳۴۵۶۷۸۹
  const replaceFn = (ch: string) => String(ch.charCodeAt(0) - (ch >= '\u06F0' ? 0x06F0 : 0x0660));
  return value.replace(arabicIndic, replaceFn).replace(easternArabicIndic, replaceFn);
}
