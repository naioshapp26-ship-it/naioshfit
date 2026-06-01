# PayPal Embedded/In-App Checkout Plan

Goal: Add PayPal as a payment gateway with the same scope isolation as Stripe, supporting:
- Central-main domain: tenant signup (subscription + 14-day trial), store checkout, credit bundles.
- Tenant-subdomain: store checkout, credit bundles.

This plan mirrors existing Stripe patterns for scope resolution, settings isolation, and embedded/in-app checkout UI.

## 1) Scope and isolation
- Platform (central-main domain) uses platform PayPal keys and settings.
- Tenant (subdomain) uses tenant PayPal keys and settings.
- Each scope has its own sandbox/live toggle and independent credentials.
- Route decisions follow the existing host/tenant resolution logic.

## 2) Database changes
Add PayPal settings to platform and tenant payment settings tables.
- Fields (per scope):
  - paypal_client_id
  - paypal_client_secret
  - paypal_webhook_id
  - paypal_merchant_id (optional but recommended)
  - paypal_mode (sandbox|live)
- Encrypt secrets using the same encryption utility used for Stripe secrets.

Add or reuse transaction records to store:
- Internal metadata (full user/platform/tenant context).
- PayPal identifiers (order_id, subscription_id, capture_id, payer_id).

## 3) Server services and routes
Implement PayPal service layer with platform and tenant variants.

Order flow (store checkout + credit bundles):
- Server creates PayPal order with amount, currency, and required metadata.
- Client approves order via PayPal JS SDK (embedded/in-app).
- Server captures order after approval.
- Webhook confirms capture and finalizes order/credit fulfillment.

Subscription flow (tenant signup with 14-day trial):
- Server creates PayPal subscription (trial configured per plan).
- Client approves subscription via PayPal JS SDK.
- Webhook confirms activation and triggers provisioning.

Endpoints (suggested):
- GET /api/paypal/client-id (platform or tenant scope)
- POST /api/paypal/orders (create order)
- POST /api/paypal/orders/:id/capture
- POST /api/paypal/subscriptions (create subscription)
- POST /api/paypal/subscriptions/:id/capture-or-confirm
- POST /api/paypal/webhook (platform/tenant routing)

Keep existing Stripe endpoints and add PayPal alongside; choose gateway based on settings or explicit gateway param.

## 4) UI implementation
Add PayPal embedded checkout UI that mirrors the current Stripe embedded flow.

New UI components:
- PayPalEmbeddedCheckout component
  - Uses PayPal JS SDK Buttons or Hosted Fields embedded on page.
  - Handles createOrder/createSubscription via server endpoints.
  - Handles onApprove to call server capture/confirm endpoints.
  - Shows loading, errors, and success state consistent with Stripe UI.

Update existing screens to support PayPal:
- Store checkout (/cart): add a gateway switch and render Stripe or PayPal component.
- Credit bundles: same approach, using the credit purchase session endpoints.
- Tenant signup: use PayPal subscription approval in the signup flow.

Settings UI:
- Platform admin: add PayPal settings fields in the central payment settings screen.
- Tenant admin: add PayPal settings fields in the tenant payment settings screen.
- Include a gateway selection (Stripe/PayPal) per scope and a sandbox/live toggle.

## 5) Webhooks and reconciliation
- Add PayPal webhooks per scope; map events to:
  - Order capture success -> order/credit fulfillment
  - Subscription activated -> tenant provisioning
  - Refunds/chargebacks -> optional follow-up handling
- Persist PayPal identifiers alongside internal transaction records.
- Use PayPal-allowed metadata fields for required identifiers and keep full data in internal DB only.

## 6) Testing checklist
- Central-main domain:
  - Tenant signup (subscription + 14-day trial)
  - Store checkout
  - Credit bundles
- Tenant-subdomain:
  - Store checkout
  - Credit bundles

Verify:
- Scope isolation works (platform vs tenant keys).
- Embedded approval flows work without redirects.
- Webhooks finalize orders/credits and provisioning.
- UI errors are consistent with Stripe UX.

## 7) Rollout
- Add PayPal behind a feature flag or gateway setting.
- Enable sandbox testing first.
- Switch to live after validation.
