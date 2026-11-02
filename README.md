# Virktech (Smart Phones Repair)

A multi-branch UK shop app: **repairs, retail, refurbished sales and trade-ins** for customers, branch staff and admins.
React + Vite + Bootstrap on the front, Express + PostgreSQL on the back. Payments are on collection or delivery only.

- [Run it locally (demo data)](#run-it-locally-demo-data)
- [Tests](#tests)
- [Going live with real data](#going-live-with-real-data)
- [Running the shop day to day](#running-the-shop-day-to-day)
- [Who can do what](#who-can-do-what)
- [How the money is reported](#how-the-money-is-reported)
- [Known limits](#known-limits)

## Run it locally (demo data)

You need Node 20.18+ and a PostgreSQL database (a local install, or a free hosted one such as [Neon](https://neon.tech)).

```bash
cd server
npm install
cp .env.example .env      # set DATABASE_URL and JWT_SECRET
npm run seed              # DEMO data. Wipes the database it points at. Refuses production and refuses real users.
npm run dev               # http://localhost:5000

cd ../client              # second terminal
npm install
npm run dev               # http://localhost:5173
```

Demo logins (password `Password123!`): `customer@demo.com`, `admin@demo.com`. Staff sign in at `/staff-login` with a 4-digit PIN: `1234` (Belvedere).
The demo seed gives every product 10 in stock at every branch.

## Tests

`npm test` (in `server/`) **rebuilds a separate test database every run**, so it can never touch real data. It refuses to start unless the database name contains `test`.

One-time setup:

1. Create an empty second database next to the first, named e.g. `virktech_test` (Neon: Console > Databases > New database. Local: `createdb virktech_test`).
2. `cp server/.env.test.example server/.env.test` and point `DATABASE_URL` at it.
3. `cd server && npm test`.

What is covered: every business rule (`utils/rules.test.js`), who can see and change what across roles and branches (`access.test.js`), complete flows for repairs, orders, trade-ins, loyalty, stock, dashboards and user management including races (`flows.test.js`), login/headers/limits/sessions (`security.test.js`), and that the schema matches the rules (`schema.test.js`).

## Going live with real data

Never run `npm run seed` against the live database. Real shops use these three commands instead, all safe to read and re-run:

| Command | What it does |
|---|---|
| `npm run migrate` | Creates or upgrades the tables. Applies each numbered file in `server/migrations/` once. Never deletes data. |
| `npm run seed:starter` | Optional. Loads the 8 branches, services, categories and sample products with **zero stock**. Only works on an empty database. |
| `npm run create-admin -- --email you@shop.com --name "Your Name" --password "a-long-password"` | Creates an admin (12+ characters). The app itself can never create an admin. |

### 1. A production database

Use a managed PostgreSQL (Neon, Supabase, Railway, AWS RDS...) or your own server. Create a database and note its connection string. Enable automatic backups (see [Backups](#backups)).

### 2. Environment variables

Set these on the server (or in `server/.env`):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production`. Turns on secure cookies, HSTS and the strict checks below. |
| `DATABASE_URL` | Your connection string (hosted databases need `?sslmode=verify-full`). |
| `JWT_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. The server refuses to start with a short or placeholder one. Changing it logs everyone out. |
| `TRUST_PROXY` | `1` when behind one reverse proxy or load balancer (almost always). Without it every visitor shares one rate-limit bucket. |
| `PORT` | Port to listen on (hosts usually set this for you). |
| `CLIENT_URL` | Leave **unset** when this server also serves the website (the default). Set only if the site is hosted somewhere else. |
| `DB_POOL_MAX` | Optional, default 10. |

### 3. Build and start (one deploy serves both the site and the API)

```bash
npm run build      # from the repo root: installs, builds the website into client/dist
npm start          # migrates the database, then starts the server
```

On a VPS keep it running with systemd or `pm2 start "npm start" --name virktech`, and put it behind Caddy or nginx for HTTPS (the session cookie is `Secure`, so the site must be served over HTTPS). A minimal Caddyfile: `yourshop.co.uk { reverse_proxy localhost:5000 }`.
On a platform host (Render, Railway, Fly...), set the build command to `npm run build`, the start command to `npm start`, and the health check path to `/api/health/db`.

### 4. First-time setup

```bash
cd server
npm run migrate
npm run seed:starter                     # optional starter catalogue
npm run create-admin -- --email you@shop.com --name "Your Name" --password "a-long-password"
```

Then log in and, in this order:

1. **Admin > Branches:** check addresses, postcodes, **phone numbers** and map coordinates for each of the 8 branches.
2. **Admin > Staff:** add each staff member with a unique 4-digit PIN, a daily wage and their branch. They only ever see that branch's repairs, orders, trade-ins and stock.
3. **Staff > Stock** (or **Admin > Stock by branch**): enter the real counts. Until you do, everything shows "Out of stock".
4. **Admin > Products / Services:** replace the sample products, photos and prices with real ones. Set service "from" prices.
5. Have the Terms, Privacy and Warranty wording reviewed (`client/src/pages/public/staticContent.js` is placeholder text).

### 5. Updating later

Deploy the new code and run `npm start` (which runs `npm run migrate` first). Database changes always ship as a new `server/migrations/NNN_name.sql`; applied files are never edited.

## Running the shop day to day

- **New branch:** Admin > Branches > Add, then add its staff and stock counts.
- **Customer forgot their password:** Admin > Customers > find them > Edit > set a new password. Their old sessions end immediately.
- **Staff member leaves:** Admin > Staff > Deactivate. They are locked out on their next click; their history stays.
- **Walk-in customer without an account:** they must register first (guest bookings are not supported). Staff can ask them to register on a tablet at the counter.
- **Another admin:** `npm run create-admin` on the server. Admins cannot be created or edited from the website.
- **Logs:** one JSON line per request on the server's standard output (`level`, `method`, `path`, `status`, `ms`, `user`). No bodies, no query strings, no passwords.
- **Health:** `/api/health` (process is up) and `/api/health/db` (database answers).

### Backups

The database is the only thing worth backing up (the site is rebuilt from the code).
- Managed databases: turn on automatic backups / point-in-time restore, and check how many days they keep.
- Your own copy at any time: `pg_dump "$DATABASE_URL" -Fc -f virktech-$(date +%F).dump`. Restore into an empty database with `pg_restore -d "$NEW_DATABASE_URL" virktech-2026-01-01.dump`.
- Test a restore once before you need it.

### Security in place

Passwords hashed with bcrypt; sessions in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie; a password change or reset ends all other sessions; deactivated accounts are locked out immediately; failed logins are throttled (10 per 15 minutes per address) and sign-ups limited; helmet security headers with a strict Content-Security-Policy; request size capped; every list and record is scoped to the caller's role and branch **on the server**; the database itself rejects impossible statuses, negative stock and similar.

## Who can do what

| | Repairs / orders / trade-ins | Catalogue | Users | Loyalty |
|---|---|---|---|---|
| Customer | own only; books, approves quotes, cancels where allowed | read | own profile | own balance |
| Staff | own branch; status, notes, parts, quotes, take payment; set their branch's stock | read | none | redeem at the counter |
| Admin | everything; assigns technicians | full CRUD | staff and customers | adjust, with a note |

## How the money is reported

- **Order revenue** = paid orders that were not cancelled or refunded, by the day they were marked paid.
- **Repair takings** = repairs marked paid (quote minus any loyalty discount). Shown as a separate figure, never added into order revenue. A repair cannot be completed until it is paid; cancelling a paid repair marks it refunded.
- Stock is counted per branch. A customer picks the branch at checkout, and the order takes stock from that branch; cancelling returns it there.
- Loyalty: 5 points per full £10 on orders over £10 and completed repairs; 10 points = £2 off, up to 20% of a bill. A refunded order takes its earned points back (never below zero) and returns the points spent.

## Known limits

- Rate limiting is per server process: fine for one server, not shared across several.
- No password reset by email and no email or SMS notifications (customers contact a branch; an admin resets passwords).
- Trade-in photos are links, not uploads.
- Product photos are stock images; branch phone numbers and service prices start empty.
- No customer data export / delete tool yet (UK GDPR requests are handled by an admin deactivating the account and, if required, by hand in the database).

## Layout

```
server/  index.js app.js config.js db.js migrate.js seed.js create-admin.js
         migrations/  routes/(auth, catalogue+crud, stock, repairs, orders, tradeins, loyalty, dashboard, users)
         middleware/(auth, error, limits, logger)  utils/(rules, scope, reference, loyalty, users, validate, paging, geo)
client/src/  api.js constants.js context/ hooks/ components/ layouts/ pages/(public, auth, customer, staff, admin)
```

The plan and original decisions are in `PLAN.md`; working rules for contributors are in `CLAUDE.md`.
