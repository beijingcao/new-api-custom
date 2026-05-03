# Alipay Official Top-Up Design

## Goal

Add an independent Alipay Open Platform computer website payment gateway for wallet top-ups only. Subscription purchases stay out of scope.

## Scope

- Add administrator settings for Alipay official payment: enabled, sandbox mode, AppID, merchant private key, Alipay public key, optional notify URL, optional return URL.
- Add wallet top-up payment method `alipay_official`.
- Create Alipay `alipay.trade.page.pay` requests with RSA2 signatures.
- Process Alipay asynchronous notifications as the only authoritative payment result.
- Verify callback signatures and cross-check `app_id`, `out_trade_no`, `total_amount`, and `trade_status`.
- Credit only pending local top-up orders whose `payment_provider` is `alipay`.

## Architecture

Backend configuration follows existing payment settings patterns: global `setting` variables are exported through `model.InitOptionMap`, persisted through `/api/option`, and updated in `model.updateOptionMap`.

Wallet creation follows the existing form-submit payment flow used by Epay. The backend returns a gateway URL plus signed form params; the frontend posts a hidden form to Alipay. The new gateway is separate from Epay because Epay already uses `type=alipay` as an aggregator payment method.

Payment settlement follows existing provider guard patterns. Alipay orders use `PaymentMethodAlipayOfficial = "alipay_official"` and `PaymentProviderAlipay = "alipay"`. Settlement is idempotent through the existing pending-order status checks.

## Data Flow

1. Admin configures Alipay official payment in system payment settings.
2. `GET /api/user/topup/info` includes `alipay_official` when enabled and configured.
3. User selects Alipay official in the wallet.
4. Frontend calls `POST /api/user/alipay/amount` for display pricing and `POST /api/user/alipay/pay` to create a pending order.
5. Backend signs `alipay.trade.page.pay` params using RSA2 and returns `{ url, data }`.
6. Frontend submits the form to the sandbox or production gateway.
7. Alipay calls `POST /api/alipay/notify`.
8. Backend verifies RSA2 signature, validates order fields, credits quota, and returns `success`.
9. `GET /api/alipay/return` redirects the browser back to the top-up history page without crediting quota.

## Error Handling

- Disabled or incomplete Alipay settings return a business error before order creation.
- Invalid request amount returns the same minimum top-up validation style as existing gateways.
- Signing errors mark the pending order failed where an order was already created.
- Notify requests that fail signature, AppID, amount, trade status, or provider validation return `failure`.
- Duplicate notifications return `success` when the order is already settled, avoiding Alipay retries for completed orders.

## Testing

- Unit tests cover RSA2 signing and verification, sign-content sorting, enabled checks, and successful callback settlement.
- Existing payment provider guard tests are extended so Alipay cannot settle Stripe/Creem/Waffo orders.
- Frontend build/type checks verify the added settings and wallet flow compile.
