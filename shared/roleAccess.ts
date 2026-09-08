export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "super_admin";
}

export function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Who can manage SaaS platforms from the central (www) admin.
 * Includes central `admin` (site owner) and `super_admin`.
 * Tenant-subdomain context is still blocked separately in SaaS admin routes.
 */
export function isTenantManagerRole(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "admin";
}
