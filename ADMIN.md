# Admin panel

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

## Good to know

- Pictures you upload for the website are stored in `server/data/public/` and are public once uploaded (PNG, JPG, WebP or GIF, up to 8 MB). Back this folder up too.
- Content changes (products, sections, prices) are loaded when a visitor opens the website, so they appear on the next page load, not instantly on pages already open.
- Coupons are never sent to visitors' browsers; the server checks them (and re-checks them when the order is placed).
- Passwords need 10+ characters with letters and a number. After 10 wrong sign-ins in 15 minutes, sign-in pauses.
- Shoppers do not have logins. A customer's saved details and wishlist live in their own browser; the admin sees the wishlist they had when they ordered.
- If one customer has several custom designs of the same product in one order, only the latest saved design of that product is attached.
- The data store is a JSON file, which is fine for a small shop. If orders grow large, move to a real database by replacing `server/src/store.js`.
