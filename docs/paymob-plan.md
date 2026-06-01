# Paymob Integration Plan

Date: 2026-02-16

## Overview
We will add Paymob as a third payment provider alongside Stripe and PayPal. The integration will use Paymob Embedded (Pixel) checkout and follow the existing platform/tenant payment architecture already used across credits, store cart checkout, and SaaS signup.

Key goals:
- Support Paymob for credits purchase, store cart checkout, and SaaS signup.
- Add Paymob admin settings for both platform and tenant scopes.
- Keep webhook verification optional until HMAC credentials are available.

## Scope
- Credits purchase flow
- Store cart checkout flow
- SaaS signup payment flow
- Admin payment settings and webhook URLs

## Paymob Flow
- Embedded (Pixel) checkout only.
- Paymob API is used server-side to create a payment intention.
- Client embeds the Paymob Pixel UI with the returned client secret.
- Webhooks finalize the payment status; redirects are user experience only.

## Planned Implementation Steps

1) Add Paymob settings storage
- Extend platform and tenant payment settings to store Paymob credentials:
  - API secret key
  - Public key
  - Integration ID(s)
  - HMAC secret
  - Live/test mode flag
- Update payment settings migrations:
  - saas/migrations/central/004_platform_payment_settings.sql
  - saas/migrations/central/010_add_paypal_settings.sql
  - saas/migrations/tenant/002_tenant_payment_settings.sql
  - saas/migrations/tenant/012_add_paypal_settings.sql

2) Add Paymob API client
- Implement a Paymob API client for:
  - Intention creation
  - Callback verification (HMAC)
- Add platform and tenant wrappers to read credentials from DB, mirroring Stripe/PayPal patterns:
  - server/payment/platformStripe.ts
  - server/payment/tenantStripe.ts

3) Extend payment routing and settings
- Add Paymob provider selection in payment routes.
- Add public config endpoint(s) for Paymob client usage.
- Add webhook endpoints for platform and tenant scopes with optional HMAC validation.
- Update admin settings handling to include Paymob fields.

4) Add Paymob to credits purchase flow
- Extend credit purchase session creation to support Paymob.
- Store transaction records with paymentProvider = 'paymob'.
- Reuse existing metadata utilities.

5) Add Paymob to store cart checkout
- Extend /api/cart/checkout to support Paymob.
- Create Paymob intention for the order total.
- Return client secret for Paymob Pixel embed.

6) Add Paymob to SaaS signup
- Extend /saas/create-payment-session to support Paymob.
- Store pending signup metadata and attach Paymob intention reference.
- Finalize provisioning based on Paymob webhook status.

7) Add Paymob client UI integration
- Create a Paymob Embedded Checkout component.
- Integrate in:
  - client/src/components/billing/BillingPanel.tsx
  - client/src/pages/cart.tsx
  - client/src/pages/saas/SignupWithPayment.tsx

8) Update admin UI
- Extend admin payment settings UI to capture Paymob credentials.
- Add webhook URL hints for Paymob.

## Verification Plan
- Credits purchase: create intention, embed Pixel, confirm transaction update via webhook.
- Store cart checkout: complete order via Paymob Pixel and confirm order status update.
- SaaS signup: create subscription payment, validate tenant provisioning after payment.
- Admin settings: save/load Paymob credentials in both platform and tenant scopes.

## Notes and Assumptions
- Paymob webhook HMAC verification will be optional until credentials are available.
- Supported payment methods initially include cards + wallets + BNPL, depending on account enablement.
- All payment status changes should be driven by webhooks, not redirects.
