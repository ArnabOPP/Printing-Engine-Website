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
| Products & prices | Show or hide categories and products, and edit the DTF, Sublimation and UV DTF rates and the blank T-shirt prices. Changes go live for every visitor |
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

## Good to know

- Passwords need 10+ characters with letters and a number. After 10 wrong sign-ins in 15 minutes, sign-in pauses.
- Shoppers do not have logins. A customer's saved details and wishlist live in their own browser; the admin sees the wishlist they had when they ordered.
- If one customer has several custom designs of the same product in one order, only the latest saved design of that product is attached.
- The data store is a JSON file, which is fine for a small shop. If orders grow large, move to a real database by replacing `server/src/store.js`.
