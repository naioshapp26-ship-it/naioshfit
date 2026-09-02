import { afterEach, describe, expect, it } from 'vitest';
import { isDirectSignupAllowed, isSaasPaymentSkipped } from '../saas/paymentConfig';

describe('saas paymentConfig', () => {
  const keys = ['SAAS_REQUIRE_PAYMENT', 'SAAS_ALLOW_DIRECT_SIGNUP', 'SAAS_SKIP_PAYMENT'] as const;
  const snapshot: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key]!;
    }
  });

  for (const key of keys) {
    snapshot[key] = process.env[key];
  }

  it('allows direct signup by default', () => {
    delete process.env.SAAS_REQUIRE_PAYMENT;
    delete process.env.SAAS_ALLOW_DIRECT_SIGNUP;
    delete process.env.SAAS_SKIP_PAYMENT;
    expect(isDirectSignupAllowed()).toBe(true);
    expect(isSaasPaymentSkipped()).toBe(true);
  });

  it('requires payment when SAAS_REQUIRE_PAYMENT=1', () => {
    process.env.SAAS_REQUIRE_PAYMENT = '1';
    delete process.env.SAAS_ALLOW_DIRECT_SIGNUP;
    expect(isDirectSignupAllowed()).toBe(false);
    expect(isSaasPaymentSkipped()).toBe(false);
  });

  it('can force direct signup even when payment is required', () => {
    process.env.SAAS_REQUIRE_PAYMENT = '1';
    process.env.SAAS_ALLOW_DIRECT_SIGNUP = '1';
    expect(isDirectSignupAllowed()).toBe(true);
    expect(isSaasPaymentSkipped()).toBe(false);
  });
});
