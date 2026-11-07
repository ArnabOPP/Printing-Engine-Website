# Printing Engine delivery deployment

The delivery code is locally tested. `printingengine.in` still needs a deployed backend before customers can place orders or receive courier tracking updates.

## Backend

Run **one Node process and one replica**, with a persistent disk. R2 holds artwork; the disk still holds order records, admin accounts, booking-recovery markers and public content images. The startup writer lock prevents two processes sharing the same local database directory. Do not use multiple containers with separate disks or a serverless host for this JSON-store version.

Use Node 24.12 or newer for the repository's dependencies. Run from the repository root:

```sh
npm ci
npm start -w server
```

For an API-only Docker deployment, build from the repository root:

```sh
docker build -f server/Dockerfile -t printing-engine-api .
```

Mount persistent storage at `/var/data/printing-engine`. Set secrets in the hosting service, never in the Docker image or repository. Container building has not been verified in this local environment.

Required production environment:

```dotenv
NODE_ENV=production
API_ONLY=true
PORT=5000
DATA_DIR=/var/data/printing-engine
CLIENT_ORIGIN=https://printingengine.in,https://www.printingengine.in
JWT_SECRET=YOUR_EXISTING_LONG_RANDOM_SECRET
DELHIVERY_ENV=production
DELHIVERY_TOKEN=YOUR_PRODUCTION_TOKEN
DELHIVERY_PICKUP_LOCATION=EXACT_REGISTERED_WAREHOUSE_NAME
DELHIVERY_WEBHOOK_SECRET=YOUR_EXISTING_WEBHOOK_SECRET
R2_REQUIRED=true
R2_BUCKET=YOUR_PRIVATE_BUCKET
R2_ENDPOINT=YOUR_R2_S3_ENDPOINT
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
```

Use `COOKIE_SAMESITE=lax` when the API is at `api.printingengine.in`, with HTTPS on both sites. If using a different site's hosting domain, set `COOKIE_SAMESITE=none`; browser third-party cookie restrictions can still prevent admin sign-in, so prefer the same-site API subdomain.

Copy the existing `server/data` to the persistent directory while the old server is stopped if keeping the existing admin accounts and records. Otherwise create the owner once using `npm run admin:create -w server` in the deployed service. Back up this disk. Do not copy a running process's `.writer.lock`; a stale lock after an unclean stop can be removed only after confirming that no process owns the directory.

## Frontend

Set `VITE_API_URL` in the frontend hosting environment to the actual HTTPS backend address, then rebuild and redeploy the frontend. For example, use `https://api.printingengine.in` only after that hostname points to the deployed backend and HTTPS works. Vite settings are baked into the build; adding the variable without rebuilding is insufficient.

## Courier callbacks

Ask Delhivery to configure scan pushes to:

```text
https://YOUR_BACKEND/api/webhooks/delhivery
```

Prefer a configured `x-webhook-key` header containing the backend webhook secret. If Delhivery only supports a URL key for the account, use `?key=YOUR_SECRET`; the backend redacts this parameter in its request logs. Confirm the payload and secret delivery method with Delhivery. A configured local secret is not proof that scan pushes are active.

The receiver saves scans before acknowledging them. File deletion runs asynchronously and retries every minute and after restart. Tracking polling runs at startup and every 30 minutes to catch missed callbacks. Older scans remain in history but cannot overwrite newer progress. Return-to-origin shipments remain trackable until their final RTO scan.

## Admin operation

- For COD, confirm the final cash-to-collect amount when booking, especially for items quoted after checkout.
- For UPI/online orders, first verify receipt in the bank/payment service. Enter the final amount and UTR/reference in the order's **Confirm payment received** form. This is a manual receipt confirmation, not a payment gateway integration.
- If booking times out or the courier returns an ambiguous error, use **Find existing shipment** or attach the correct AWB. Automatic rebooking stays blocked. Only the owner can reset an uncertain attempt after checking the courier portal and confirming no shipment exists; the server also checks the courier API.
- Delivery availability and COD/prepaid eligibility are checked by the server at checkout and again before booking.
- Artwork and mockups are deleted only after courier dispatch evidence is durably saved. Manual Shipped status and AWB creation do not trigger deletion.

## Validation before opening checkout

```sh
npm run test -w server
npm run build
npm run delivery:check -w server
npm run r2:check -w server
```

The local suite uses an isolated temporary database and a simulated courier HTTP service. It covers payment gating, concurrent booking, ambiguous-response recovery, duplicate AWBs, PDF labels, pickups, cancellation, authenticated callbacks, stale/duplicate scans, customer tracking, polling, storage failure/recovery, retention and the single-writer lock.

After deployment, verify `/api/health` through the public HTTPS address, admin sign-in, public content images, and persistence across restart. Test a courier booking, label and pickup using a **staging token with the staging environment** first; the currently configured production token must not be used as a test token. Finally verify a controlled real parcel and public scan push, including R2 cleanup at dispatch and final delivery. These account-specific operations cannot be certified by a mocked local test.
