/** Direct signup / payment bypass — controlled by env on the host. */

export function isDirectSignupAllowed(): boolean {
  if (process.env.SAAS_REQUIRE_PAYMENT === '1') {
    return process.env.SAAS_ALLOW_DIRECT_SIGNUP === '1';
  }
  return (
    process.env.SAAS_ALLOW_DIRECT_SIGNUP === '1' ||
    process.env.SAAS_SKIP_PAYMENT === '1' ||
    process.env.SAAS_SKIP_PAYMENT !== '0'
  );
}

/** Payment step bypassed unless SAAS_REQUIRE_PAYMENT=1 is set on the host. */
export function isSaasPaymentSkipped(): boolean {
  if (process.env.SAAS_REQUIRE_PAYMENT === '1') return false;
  if (process.env.SAAS_SKIP_PAYMENT === '0') return false;
  return true;
}
