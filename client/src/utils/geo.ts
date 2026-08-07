// Lightweight geo helpers: infer country from browser locale and map to our Arabic country list

export type IsoCountryCode = string; // e.g., 'EG', 'SA'

// Common ISO alpha-2 -> Arabic display names for better matching. Fallback to Intl.DisplayNames if available.
const ISO_TO_AR_NAME: Record<string, string> = {
  EG: "مصر",
  SA: "السعودية",
  JO: "الأردن",
  AE: "الإمارات العربية المتحدة",
  QA: "قطر",
  BH: "البحرين",
  KW: "الكويت",
  OM: "عُمان",
  IQ: "العراق",
  SY: "سوريا",
  LB: "لبنان",
  MA: "المغرب",
  DZ: "الجزائر",
  TN: "تونس",
  LY: "ليبيا",
  SD: "السودان",
  YE: "اليمن",
  PS: "فلسطين",
  TR: "تركيا",
  US: "الولايات المتحدة",
  GB: "المملكة المتحدة",
  FR: "فرنسا",
  DE: "ألمانيا",
  IT: "إيطاليا",
  ES: "إسبانيا",
  CA: "كندا",
};

// Try to get country code from navigator.languages like 'ar-EG', 'en-US'
export function inferCountryCodeFromNavigator(): IsoCountryCode | undefined {
  const langs = (typeof navigator !== 'undefined' && (navigator.languages || (navigator as any).language ? [ (navigator as any).language ] : [])) as string[] | undefined;
  if (!langs || langs.length === 0) return undefined;
  for (const l of langs) {
    const parts = l.split('-');
    if (parts.length >= 2) {
      const cc = parts[parts.length - 1];
      if (/^[A-Za-z]{2}$/.test(cc)) return cc.toUpperCase();
    }
  }
  return undefined;
}

// Map ISO code to an Arabic country name present in COUNTRIES_AR
export function mapIsoToArabicCountryName(iso: IsoCountryCode, countriesAr: string[]): string | undefined {
  const upper = iso.toUpperCase();
  const direct = ISO_TO_AR_NAME[upper];
  if (direct && countriesAr.includes(direct)) return direct;
  // Fallback to Intl.DisplayNames in Arabic and try to fuzzy match by inclusion
  try {
    // @ts-ignore - older TS lib versions may not include DisplayNames type
    const dn = new Intl.DisplayNames(['ar'], { type: 'region' } as any);
    const localized = dn.of(upper);
    if (localized) {
      // Some names may have slight variations; try exact first, then containment
      if (countriesAr.includes(localized)) return localized;
      const found = countriesAr.find(c => c.includes(localized) || localized.includes(c));
      if (found) return found;
    }
  } catch {}
  return direct && countriesAr.includes(direct) ? direct : undefined;
}

// Extract possible ISO country code from typical reverse-proxy headers
export function extractIsoFromHeadersLike(json: any): IsoCountryCode | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const v = (json.cfIpCountry || json['cf-ipcountry'] || json.xVercelIpCountry || json['x-vercel-ip-country'] || json.xCountry || json['x-country']) as string | undefined;
  if (v && /^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return undefined;
}
