import { describe, expect, it } from 'vitest';
import {
  resolvePaymobSignature,
  verifyPaymobWebhookSignature,
} from '../payment/paymobClient';

describe('paymobClient', () => {
  it('resolvePaymobSignature reads x-paymob-signature header', () => {
    const signature = resolvePaymobSignature(
      {
        'x-paymob-signature': 'abc123',
      },
      {}
    );

    expect(signature).toBe('abc123');
  });

  it('resolvePaymobSignature falls back to body.hmac', () => {
    const signature = resolvePaymobSignature({}, { hmac: 'from-body' });
    expect(signature).toBe('from-body');
  });

  it('verifyPaymobWebhookSignature validates correct HMAC', () => {
    const secret = 'test-secret';
    const payload = JSON.stringify({ hello: 'world' });

    // Precomputed by calling the function under test twice would be circular,
    // so we just ensure it returns true for its own digest and false for a wrong one.
    const correct = (() => {
      const crypto = require('crypto') as typeof import('crypto');
      return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    })();

    expect(verifyPaymobWebhookSignature(payload, correct, secret)).toBe(true);
    expect(verifyPaymobWebhookSignature(payload, 'deadbeef', secret)).toBe(false);
  });
});
