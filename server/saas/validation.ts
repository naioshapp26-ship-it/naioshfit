import { SAAS_SUBDOMAIN_REGEX } from "@shared/saasConstants";

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'saas']);

export function normalizeSubdomain(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function isValidSubdomain(subdomain: string): boolean {
  return SAAS_SUBDOMAIN_REGEX.test(subdomain) && !RESERVED_SUBDOMAINS.has(subdomain);
}

export { SAAS_SUBDOMAIN_REGEX };
