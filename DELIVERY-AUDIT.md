# Delivery readiness audit — 7 November 2026

Update, 8 November 2026: **The eight code findings below have been fixed and covered by the expanded local suite.** The production PIN-code API still passes. Deployment and courier account acceptance tests remain outstanding because the backend is not deployed. See `DELIVERY-DEPLOYMENT.md` for the completed flow and launch instructions. The findings below preserve the initial audit for reference.

## Verified

- Delhivery token, pickup-location setting and webhook secret are present. The configured courier environment is production.
- A read-only production check for PIN 700001 returned serviceable, prepaid and COD available, Kolkata, West Bengal.
- R2 upload/read/delete passed in the preceding storage check, with the disposable test object removed.
- The six existing backend tests pass. They cover custom order files and dispatch retention, not the entire delivery workflow.
- There are zero locally saved orders and shipments. No real shipment was created, cancelled, picked up or otherwise modified for this audit.

## Findings

1. **High — unpaid online orders can be booked as prepaid.** Checkout records a UPI preference without collecting payment. Shipment booking treats every non-COD order as prepaid, without a payment-received state or check. Add an explicit verified/manual payment confirmation before prepaid booking. Sources: `client/src/pages/Checkout.jsx`, `server/src/routes/admin.js`, `server/src/delhivery.js`.

2. **High — delayed scans overwrite newer shipment state.** Reproduced in memory: a delivered shipment receiving an older In Transit update changes shipment stage to `in_transit` and timestamp to the earlier date, while order status remains delivered. Compare courier event timestamps and preserve terminal state appropriately; still merge historical scans. Source: `server/src/shipping.js:36`.

3. **High — HTTP errors with JSON bodies can appear successful.** Reproduced by substituting a local mock response: a courier HTTP 500 JSON error becomes `{ serviceable: false }`. The API helper only rejects non-OK responses when JSON parsing fails. Cancellation can similarly report success for an error object without a `status:false` or `success:false` field. Reject every non-2xx HTTP response before operation-specific parsing. Source: `server/src/delhivery.js:59`.

4. **High — duplicate booking is possible under concurrency.** The existing-shipment check happens before the awaited courier request. Two requests can both pass it and create shipments; only the last response remains on the order. Add per-order booking serialization and durable reconciliation for timeouts or failures after the courier accepts a request. Source: `server/src/routes/admin.js:197`.

5. **High — database write failures are swallowed.** `save()` logs disk errors but resolves successfully. A booking or dispatch update can therefore appear persisted when it is not. This is especially important because dispatch triggers irreversible file cleanup. Make persistence failures observable and prevent cleanup until dispatch evidence is durably recorded. Source: `server/src/store.js:32`.

6. **Medium — ordinary Pending scans are misclassified.** `stageOf('Pending', 'UD')` returns `booked`. Delhivery documents Pending as a forward shipment already at the delivery centre, before dispatch for final delivery. This can display an incorrect parcel stage and delay artwork cleanup if the first received scan is Pending. Source: `server/src/delhivery.js:100`; official reference below.

7. **Medium — serviceability is enforced only by the browser.** Order placement validates PIN format but does not recheck courier serviceability or the chosen payment method; booking also does not enforce the displayed PIN check. Direct or stale requests can bypass those restrictions. Revalidate at the backend before booking and distinguish courier downtime from a genuinely unsupported PIN. Sources: `server/src/routes/public.js`, `server/src/routes/admin.js`.

8. **Medium — manual AWB fallback has a UI/payload mismatch.** When Delhivery is unconfigured, the UI shows Save AWB, but state defaults to `create` and submission sends create-mode data until the administrator explicitly selects the manual tab. Source: `client/src/admin/Shipping.jsx:36`.

## Deployment and live acceptance checks outstanding

The inspected local settings use `NODE_ENV=development`, localhost as the allowed frontend origin, and the default local data directory. These may be appropriate locally; they do not prove the hosted backend has production configuration or persistent storage.

- Verify the deployed frontend API URL, HTTPS backend, allowed origins, cookie settings, persistent database disk and restart behavior.
- Verify that the named pickup warehouse exists and is accepted by the courier.
- Register and test the public webhook URL with Delhivery. A local secret alone does not establish that callbacks are enabled or reachable.
- Exercise shipment creation, COD amount, prepaid payment confirmation, label PDF, pickup request, cancellation, tracking, duplicate/stale callbacks and final delivery in the correct staging account before a controlled live shipment.
- Confirm dispatch deletes the correct order's R2 files and a failed deletion retries without affecting other orders.
- Browser preview verification was previously blocked by the browser permission gate; visual mockup capture remains unverified.

## References

- Delhivery forward shipment status definitions: https://delhivery-express-api-doc.readme.io/reference/prepaid-and-cod-shipments
- Official developer portal and API testing guidance: https://help.delhivery.com/home/docs/client-developer-portal-1
- Official tracking API: https://one.delhivery.com/developer-portal/document/b2c/detail/order-tracking

No application source code was changed during the initial audit. The subsequent implementation fixes these findings; this report is not a claim that the public delivery system is already live.
