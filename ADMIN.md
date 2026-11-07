# Admin panel

**Firebase admin sign-in:** follow [FIREBASE-ADMINS.md](FIREBASE-ADMINS.md). Team members authenticate through Firebase, and `adminAccess/{uid}.status` controls access. The local-password setup below describes the legacy mode; it does not create Firebase access records.

Delivery deployment and operation are documented in [DELIVERY-DEPLOYMENT.md](DELIVERY-DEPLOYMENT.md). Online orders now require an admin-confirmed payment receipt before prepaid shipment booking. Ambiguous booking attempts must be reconciled before retrying.

The separate **Custom Admin** panel lives at `/custom-admin`, with its own sign-in screen and navigation for Custom orders, Custom products & prices, and My account. It uses the same approved Firebase identities as `/admin`. The old `/admin/custom-orders` URL redirects to it. Custom orders includes mixed baskets. Review design files and mockups first, then material, colour, print method, sizes and quantities. Status, payment confirmation, notes and shipping update the same order shown in the main panel's Orders. The displayed order amount includes every item in a mixed basket. Artwork removed after dispatch is explicitly labelled, and the custom order remains in the list. Catalogue visibility and print/base prices remain shared with the storefront.

The admin panel lives at **`/admin`** on the website. It is not linked from anywhere and is marked `noindex`, but
that is only to keep it tidy. What actually keeps it private is the server: every admin request needs a signed-in
admin (a hashed password, a signed `httpOnly` cookie, rate-limited sign-in). Without signing in, `/admin` shows only a sign-in box.

## What it does

| Area | What the team can do |
| --- | --- |
| Dashboard | Orders, today, revenue, customers, orders needing a price, 14-day chart, status counts, best sellers |
| Orders | Search and filter, open an order, move it through New → Confirmed → Printing → Ready → Shipped → Delivered (or Cancelled), see the customer's address and the **uploaded artwork** (download it), add a team note, delete (owner only) |
| Customers | Built from orders (same email or phone = one customer), with their orders and the wishlist they had at checkout |
| Customise & prices | Show or hide Print on Demand categories and products, and edit the DTF, Sublimation and UV DTF rates and the blank T-shirt prices |
| Shop products | Add, edit, reorder and remove the ready-made designs (Trending Now and the product pages): name, price, crossed-out original price (shows "% off"), pictures (uploaded), colours, sizes, description, Trending or hidden |
| Home page & content | Add your own sections (banner, offer strip with a coupon code, text, product row, picture gallery) to the Home, About or Print on Demand page and choose where they sit. Edit the announcement bar, the headings of Trending / Categories / Reviews / How it works (or hide them), the Shop by Category cards, and the "Loved by Our Customers" photos with names and quotes |
| Coupons & offers | Percentage or fixed-amount codes with a minimum order, a cap, start and end dates, a usage limit, and on/off. Customers enter them at checkout and the discount is worked out on the server |
| Shipping (Delhivery) | On every order: book the parcel with Delhivery (weight, size, cash to collect), print the shipping label, follow tracking, cancel. Or enter an AWB you booked on Delhivery's site. On the Orders page: refresh every parcel, schedule a pickup |
| Admin team | (Owner only) add admins, disable or remove them, reset their password |
| Activity | Who did what, and when |
| My account | Change your own password |

## First-time setup

1. Install and make the first admin (the owner). It asks for an email, name and password:

   ```bash
   npm install
   npm run admin:create -w server
   ```

2. Run the site and the server together, then open <http://localhost:5173/admin>:

   ```bash
   npm run dev
   ```

Orders, admin accounts and artwork are kept in `server/data/` (ignored by git). **Back this folder up.**

## Putting it online

The website on Vercel is static, so the server must run somewhere that keeps a disk (Render, Railway, Fly.io, a VPS…).

1. Deploy the `server` folder (`npm start -w server`) with the settings in `server/.env.example`, especially a long random `JWT_SECRET` and `CLIENT_ORIGIN` set to the website's address.
2. Point the data folder at a **persistent disk** (`DATA_DIR`). Without one, orders disappear whenever the host restarts.
3. Build the website with `VITE_API_URL` set to the server's address (for example in Vercel: Environment Variables).
4. If the website and server are on different domains, set `COOKIE_SAMESITE=none` on the server (https is required).
5. Run `npm run admin:create -w server` once on the server to create the owner.

Until the server is online, **checkout cannot place orders** (it tells the customer to try again later).

## Delhivery shipping and the Track page

- **Customers** track at `/track` with their order number and the mobile number used at checkout (so order numbers cannot be guessed). They see a progress bar (Placed → Confirmed → Printing → Ready → On its way → Out for delivery → Delivered), the AWB, Delhivery's scans and the expected date, plus a link to Delhivery's own page. At checkout the PIN code is checked with Delhivery: it shows whether delivery and cash on delivery are available and fills in the city and state.
- **Orders move forward by themselves**: booking a parcel sets the order to *Ready to ship*, the first courier scan to *Shipped*, and delivery to *Delivered*. Orders never move backwards.
- **Updates reach the website two ways**: Delhivery pushes each scan to `https://YOUR-SERVER/api/webhooks/delhivery?key=YOUR_SECRET` (ask Delhivery to switch this on for your account), and the server also checks every parcel that is still on its way every 30 minutes.
- **Settings** are in `server/.env` (see `server/.env.example`): `DELHIVERY_TOKEN`, `DELHIVERY_ENV` (`staging` first, then `production`), `DELHIVERY_PICKUP_LOCATION`, `DELHIVERY_WEBHOOK_SECRET`. Keep the token only in that file; never paste it in chat or commit it.
- The Delhivery calls follow their public Express API (create shipment, track, PIN code check, label, pickup, cancel). Their full documentation is behind the Delhivery One login, so **test everything on your staging account first** and check the booking, the label and a pushed scan before switching to production.

## Customer artwork in Cloudflare R2 (optional)

### Artwork, mockups and dispatch retention

New custom cart items keep an immutable design snapshot in IndexedDB, including PNG mockups of each decorated side (or every side for a blank garment). Each cart line has its own design ID, so two designs of the same product stay separate. Files upload when the customer places the order; drafts that have not been ordered stay on the customer's device. A failed preview or upload blocks completion rather than accepting an order without the files.

Create a private R2 bucket and a bucket-scoped **Object Read & Write** token. In `server/.env`, set `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and either `R2_ACCOUNT_ID` or the full `R2_ENDPOINT` from Cloudflare. Set `R2_REQUIRED=true` to refuse custom orders if R2 is not configured. These are backend settings; never put the secret key in Vite variables or chat. Restart the server after changing them.

Run `npm run r2:check -w server` to upload, download and delete a disposable test object. The bucket must permit object listing and deletion as well as reads and writes. Keep public access disabled; admins access files through the authenticated order API.

Files are kept until Delhivery reports a recognized dispatched/in-transit, out-for-delivery or delivered scan. AWB creation, pickup pending, an unknown scan and manually setting an order to Shipped do **not** delete files. Dispatch confirmation is persisted on the order. The backend deletes that order's uploaded artwork and mockups, retries failures every minute and after restart, and shows the removal time in the admin order. Order details and design layer metadata remain. Files are not restored if the status is subsequently changed or the parcel is returned.

Existing local artwork remains readable, but is not automatically migrated to R2. Old cart entries must be added again in the studio to include a separate snapshot and mockups. Static product photographs and public admin content images keep their existing storage behavior.

The backend must remain running for webhook handling and cleanup retries. Do not add an age-based R2 lifecycle expiration to the order artwork prefix: production and dispatch times vary.

By default customers' artwork is saved in `DATA_DIR/uploads` on the server. To keep it in Cloudflare R2 instead (so it does not use the server's disk), create a **private** bucket and an API token with *Object Read & Write* for it, then set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` (see `server/.env.example`) and restart.

- The files are never public: only signed-in admins can open them, through the order page. Do not turn on public access or a public domain for the bucket.
- If the bucket cannot be reached, the order is refused with "try again" rather than saved without its artwork.
- Artwork saved on the disk before R2 was switched on still opens. Deleting an order removes its files from the bucket.

## Good to know

- Pictures you upload for the website are stored in `server/data/public/` and are public once uploaded (PNG, JPG, WebP or GIF, up to 8 MB). Back this folder up too.
- Content changes (products, sections, prices) are loaded when a visitor opens the website, so they appear on the next page load, not instantly on pages already open.
- Coupons are never sent to visitors' browsers; the server checks them (and re-checks them when the order is placed).
- Passwords need 10+ characters with letters and a number. After 10 wrong sign-ins in 15 minutes, sign-in pauses.
- Shoppers do not have logins. A customer's saved details and wishlist live in their own browser; the admin sees the wishlist they had when they ordered.
- If one customer has several custom designs of the same product in one order, only the latest saved design of that product is attached.
- The data store is a JSON file, which is fine for a small shop. If orders grow large, move to a real database by replacing `server/src/store.js`.
