/** Direct signup / payment bypass — controlled by env on the host. */

/**
 * Allow creating tenants without a live payment gateway.
 * - Default: allowed (so onboarding is not blocked when Stripe/PayPal/Paymob are unset)
 * - Set SAAS_REQUIRE_PAYMENT=1 to force real payment unless SAAS_ALLOW_DIRECT_SIGNUP=1
 * - Set SAAS_ALLOW_DIRECT_SIGNUP=0 or SAAS_SKIP_PAYMENT=0 to disable bypass
 */
export function isDirectSignupAllowed(): boolean {
  if (process.env.SAAS_REQUIRE_PAYMENT === '1') {
    return process.env.SAAS_ALLOW_DIRECT_SIGNUP === '1';
  }

  if (process.env.SAAS_ALLOW_DIRECT_SIGNUP === '0') {
    return false;
  }

  if (process.env.SAAS_SKIP_PAYMENT === '0') {
    return false;
  }

  return true;
}

/**
 * Payment step bypassed unless SAAS_REQUIRE_PAYMENT=1 is set on the host.
 */
export function isSaasPaymentSkipped(): boolean {
  if (process.env.SAAS_REQUIRE_PAYMENT === '1') return false;
  if (process.env.SAAS_SKIP_PAYMENT === '0') return false;
  if (process.env.SAAS_ALLOW_DIRECT_SIGNUP === '0') return false;
  return true;
}
