# Bhel Puri — Phase 15F Production Launch Checklist

This checklist defines merchant, seller, webhook, and configuration checks required for production readiness.

---

## 🏁 Production Readiness Checklist

### A. Merchant Integration Setup
*   [ ] Cashfree production account active and signed
*   [ ] Payment collections verified in production
*   [ ] Easy Split / split transfers activated on Cashfree dashboard
*   [ ] Live credentials registered in Supabase Edge Secrets (`CASHFREE_PROD_APP_ID`, `CASHFREE_PROD_SECRET_KEY`)

### B. Seller Onboarding Setup
*   [ ] Account table `payment_provider_accounts` initialized
*   [ ] Seller KYC validation completed
*   [ ] Linked vendor accounts activated

### C. Webhook Signature Validation
*   [ ] Webhook secret registered in Supabase secrets (`CASHFREE_PROD_WEBHOOK_SECRET`)
*   [ ] SHA256 HMAC verification configured on incoming requests

### D. Production Safety Switch
*   [ ] Active toggle for `production_payments_enabled` in Super Admin dashboard
*   [ ] Verify Edge Functions block calls if toggle is disabled
