# Stripe Embedded Checkout Migration Plan

## Goals
- Replace Stripe-hosted redirect Checkout with embedded, in-app checkout for all payment flows.
- Keep PCI scope minimal by never handling card data on our servers (SAQ-A aligned).
- Preserve existing settlement, crediting, and logging behavior with minimal backend changes.
- Provide clear traceability of payment references (Checkout session id, PaymentIntent id, transaction id).

## Scope
1. Credits purchases (BillingPanel)
2. SaaS subscription signup (SignupWithPayment)
3. Tenant store/custom purchases (/api/stripe/create-checkout-session)

## Current State Summary
- Backend creates Stripe Checkout sessions and returns `url` for redirect.
- Webhooks settle payments and credit balances (platform and tenant).
- Frontend redirects to success/cancel pages after Checkout.

## Target State Summary
- Backend creates Checkout sessions with `ui_mode=embedded` and returns `client_secret`.
- Frontend mounts Stripe Embedded Checkout using Stripe.js.
- Webhooks continue to settle purchases and update transaction status.
- Success/cancel pages replaced by in-app completion states.

## Architecture Overview
- Stripe Checkout session (embedded) is created server-side.
- Client uses Stripe.js `EmbeddedCheckout` with `clientSecret`.
- Webhooks remain the source of truth for settlement and credits.
- Session and PaymentIntent ids are stored for auditability.

## Detailed Work Plan

### 1) Backend: Session Creation Changes
**Files:**
- server/payment/platformStripe.ts
- server/payment/tenantStripe.ts
- server/saas/routes.ts

**Changes:**
- When creating Checkout sessions, add:
  - `ui_mode: "embedded"`
  - `return_url`: required by embedded flow for post-payment redirect to a route in-app
- Return `client_secret` from session creation instead of only `url`.
- Keep `mode` as `payment` or `subscription` depending on flow.
- Preserve metadata currently used by webhook settlement.

**Outputs:**
- API response includes:
  - `clientSecret`
  - `sessionId`
  - `publishableKey` (already used for Stripe.js init)

### 2) Backend: API Route Updates
**Files:**
- server/payment/routes.ts
- server/creditBillingRoutes.ts
- server/saas/routes.ts

**Changes:**
- Update endpoints that currently return `url` to return `clientSecret` and `sessionId`.
- Ensure tenant vs platform routing is unchanged.
- Return 400 if session creation fails or missing Stripe keys.

**Endpoints to update:**
- POST /api/credits/purchase-session
- POST /api/stripe/create-checkout-session
- POST /saas/create-payment-session

### 3) Backend: Webhooks and Logging
**Files:**
- server/payment/routes.ts
- server/services/creditBilling.ts
- server/payment/platformStripe.ts
- server/payment/tenantStripe.ts

**Changes:**
- Ensure webhook handlers capture and persist:
  - `checkout.session.id`
  - `payment_intent` id
  - Any client-provided reference id
- Confirm `checkout.session.completed` still settles credits and logs transactions.
- Confirm `payment_intent.succeeded` can be used as fallback for settlement if needed.

**Notes:**
- Use metadata to map session to internal transaction record.
- Keep signature verification required in production.

### 4) Frontend: Embedded Checkout UI
**Files:**
- client/src/components/billing/BillingPanel.tsx
- client/src/pages/saas/SignupWithPayment.tsx
- Tenant purchase page(s) that call /api/stripe/create-checkout-session

**Changes:**
- Use Stripe.js Embedded Checkout:
  - Initialize Stripe with publishable key
  - Fetch `clientSecret` from backend
  - Render Embedded Checkout component in-place
- Add in-app completion state (success and cancel) without leaving the app.

**UI Behavior:**
- Loading state while session is created.
- Render embedded checkout once `clientSecret` is available.
- On completion, show confirmation and prompt refresh/verify.

### 5) Client Verification and Completion
**Files:**
- client/src/pages/payments-success.tsx
- client/src/pages/payments-cancel.tsx

**Options:**
- Option A: keep pages but navigate to them internally after embedded flow
- Option B: replace with in-app status component

**Server Support:**
- Reuse existing `GET /api/stripe/verify-session/:sessionId` where applicable.
- Use it to refresh transaction status client-side.

### 6) Configuration and Security
**Settings:**
- Publishable keys must be available to client for Stripe.js init.
- Webhook secrets must be present and verified in production.
- Continue to encrypt Stripe secret keys with existing encryption service.

**PCI:**
- Embedded Checkout keeps card data in Stripe-hosted UI.
- Our servers never receive raw card data.

## API Contract (Example)
**Request:** POST /api/credits/purchase-session

**Response:**
```json
{
  "clientSecret": "cs_...",
  "sessionId": "cs_test_...",
  "publishableKey": "pk_test_..."
}
```

## Rollout Plan
1. Implement server session creation changes and return payloads.
2. Update BillingPanel with embedded checkout and test in dev.
3. Update SaaS signup flow and test subscription creation.
4. Update tenant purchase flow and test custom items.
5. Validate webhook handling and transaction logging.
6. Remove legacy redirect-only UI.

## Test Checklist
- Credits purchase completes and balances update.
- SaaS subscription completes and tenant provisioning succeeds.
- Tenant purchase completes and transaction record is updated.
- Webhooks verify signatures and update status.
- `payment_intent` and `checkout.session` ids are logged.
- Error handling shows user-friendly messages on failure.

## Open Questions
- Whether to consolidate success/cancel routes into a single in-app component.
- Whether to add a post-payment status polling UI for long-running webhook delays.
- Whether to add customer billing portal for subscription management.
