import { describe, expect, it } from 'vitest';
import { buildTenantPublicUrl, normalizeSaasMainDomain } from '../../shared/saasUrls';

describe('saasUrls / MAIN_DOMAIN', () => {
  it('normalizes bare, www, and URL forms to apex host', () => {
    expect(normalizeSaasMainDomain('naioshfit.com')).toBe('naioshfit.com');
    expect(normalizeSaasMainDomain('www.naioshfit.com')).toBe('naioshfit.com');
    expect(normalizeSaasMainDomain('https://www.naioshfit.com/')).toBe('naioshfit.com');
    expect(normalizeSaasMainDomain(undefined)).toBe('naioshfit.com');
  });

  it('builds tenant public URLs on the main domain', () => {
    expect(buildTenantPublicUrl('acme', 'naioshfit.com')).toBe('https://acme.naioshfit.com');
    expect(buildTenantPublicUrl('acme', 'https://www.naioshfit.com', { path: '/auth' }))
      .toBe('https://acme.naioshfit.com/auth');
  });
});
