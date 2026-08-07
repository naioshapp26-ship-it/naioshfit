const DEFAULT_MAIN_DOMAIN = "naioshfit.com";

/** Normalize MAIN_DOMAIN env values (bare host, www host, or full URL). */
export function normalizeSaasMainDomain(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_MAIN_DOMAIN;
  }

  const urlCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const hostname = new URL(urlCandidate).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    const fallbackHost = trimmed
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0]
      .split(":")[0]
      .toLowerCase()
      .replace(/^www\./, "");

    return fallbackHost || DEFAULT_MAIN_DOMAIN;
  }
}

export function buildTenantPublicUrl(
  subdomain: string,
  mainDomain?: string | null,
  options?: { protocol?: "http" | "https"; path?: string },
): string {
  const normalizedSubdomain = subdomain.trim().toLowerCase();
  const normalizedMain = normalizeSaasMainDomain(mainDomain);
  if (!normalizedSubdomain) {
    return "";
  }

  const protocol = options?.protocol ?? "https";
  const path = options?.path ?? "";
  return `${protocol}://${normalizedSubdomain}.${normalizedMain}${path}`;
}
