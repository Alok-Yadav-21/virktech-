# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

**Virktech** (trading name *Smart Phones Repair*): a multi-branch UK shop doing **repairs, retail, refurbished sales and trade-ins**. Three audiences: customers, branch staff, admins.

This is a deliberately **simple rebuild** of an older, over-complicated app (Supabase + shadcn + dual mock adapter + ERP-style inventory). Keep it simple. If a choice is between "clever" and "boring", pick boring.

Full spec: `PLAN.md`. Read it before starting any phase.

## Stack (fixed)

| Layer | Choice |
|---|---|
| Database | PostgreSQL + `pg` (plain SQL, numbered migrations in `server/migrations/`, no ORM) |
| Server | Node 20.18+, Express 4, JWT in httpOnly cookie, bcryptjs, express-validator, helmet, express-rate-limit |
| Client | React 18 + Vite, React Router 6, axios |
| UI | **Bootstrap 5 + react-bootstrap** (utility classes first, almost no custom CSS) |
| Map | react-leaflet (branch finder only) |
| Toasts | react-hot-toast |
| Tests | vitest for `server/utils/rules.js`; supertest for role-access, business flows and security, against a separate test database |

Plain **JavaScript**, not TypeScript. No Redux, no TanStack Query, no Tailwind, no shadcn, no Framer Motion.
**Do not add a dependency without asking the user.**

## Commands

```bash
# server (development)
cd server && npm install && npm run seed && npm run dev   # http://localhost:5000 (seed = DEMO data, wipes the DB)
npm test                                                  # needs server/.env.test pointing at a *_test database; it rebuilds that DB

# server (real shop)
npm run migrate && npm run seed:starter && npm run create-admin -- --email ... --name ... --password ...

# client
cd client && npm install && npm run dev                   # http://localhost:5173
```

`server/.env`: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `PORT` (+ `NODE_ENV`, `TRUST_PROXY` in production). Commit only the `.env*.example` files.

## Folder map

```
server/  db.js  config.js  migrate.js  seed.js  create-admin.js  migrations/  routes/  middleware/(auth, error, limits, logger)
         utils/(rules.js, scope.js, reference.js, loyalty.js, users.js, validate.js, paging.js, ...)  test/global-setup.js
client/src/  api.js  context/(Auth,Cart)  hooks/useFetch.js  components/  layouts/  pages/(public,auth,customer,staff,admin)
```

## Coding rules

1. **Small files.** Aim for under ~250 lines. One concern per file. Split before it grows.
2. **All business rules live in `server/utils/rules.js`** (status lists, transitions, loyalty math, cancel rules) with a test next to it. Routes call these; they never re-write a rule inline.
3. **Authorize on the server.** Hiding a button is UX only. Every route uses `protect` + `requireRole(...)`, and every list/get query goes through a scope filter (customer = own records, staff = own branch, admin = all). Never trust role or user id sent from the client.
4. **Customer-facing repair stage is computed from the stored status**, never stored.
5. **Hide unsent quotes** from customers in the API response, not in React.
6. **One helper per cross-cutting job**: `nextReference(key)` for reference numbers, `postLoyalty(user, delta, kind, ref, note)` for points. Do not duplicate.
7. **Money:** order revenue = orders with `paymentStatus: 'paid'` and status not cancelled/refunded. Repair takings (paid repairs) are reported as their own figure and are never added into order revenue. Never widen either to flatter a report.
8. **Comments explain *why*,** not what. Keep them short.
9. **Bootstrap first.** Use components/utilities (`container`, `row`, `col-md-*`, `card`, `table`, `modal`, `badge`, `offcanvas`). Custom CSS lives only in `client/src/styles/theme.css` (tokens that re-skin Bootstrap) and `app.css` (what Bootstrap lacks: tab bar, swipe rails, sticky bars, skeletons, timeline). Read `PRODUCT.md` and `DESIGN.md` before changing any UI; icons are the inline set in `components/ui/Icon.jsx`, the font is self-hosted in `client/public/fonts` (no new icon or font package).
10. **One layout per audience type**: `PublicLayout` and a single `WorkspaceLayout` whose sidebar links depend on role. One generic `DataTable` + `FormModal` for admin CRUD.
11. **Errors:** server sends `{ message }` with a correct status code; client shows it in a toast. No silent failures; no empty `catch`.
12. **Schema changes are new migrations.** Add `server/migrations/NNN_name.sql`; never edit one that has run anywhere. Keep status lists in step with `rules.js` (`schema.test.js` checks).
13. **Never point the demo seed or the tests at real data.** `npm run seed` wipes the database and refuses production; tests refuse any database not named `*test*`.
14. **Lists are paged and searchable on the server** (`pageOf`, `likeOf`, `X-Total-Count`); never load a whole table into the browser.
15. **Tell the user before** doing anything outside `PLAN.md`.

## Roles

| Caller | Repairs / orders / trade-ins | Products, categories, services, branches | Users | Loyalty |
|---|---|---|---|---|
| Customer | own only | read | self | own balance |
| Staff | own branch only; update status, notes, parts, mark paid (orders and repairs) | read; set stock for their own branch | none | redeem at counter for a named customer |
| Admin | everything; assign technician | full CRUD | full CRUD (create staff) | adjust with mandatory note |

## Cut list: do NOT re-add

Stripe / online payments (pay on collection only), staff timesheets and wages, purchase orders / a suppliers table (a delivery just stores the supplier name) / stock transfers / stocktakes / reorder rules / stock ledger (stock is one integer per product per branch, nothing more), audit-log UI, archive/restore lifecycles, mock backend or second adapter, Supabase / RLS / edge functions, in-app notifications, force-password-change flows, username login, warranty tables, customer notes, saved-address tables, 3D/globe/meteor/aurora effects, design-lab pages, guest repair booking (user must register first).

## Status vocabulary (single source: `server/utils/rules.js`, mirrored in `client/src/constants.js`)

Never hard-code a status string inside a page. Import it.

## Deliveries and profit (added on request, after the cut list was written)

Wholesale **deliveries** (`routes/deliveries.js`) record supplier, branch, date and lines of `qty` x `unit_cost`; saving one adds the quantities to `branch_stock`, editing applies only the difference, deleting takes them back (refused with 409 if already sold). **Profit** (`routes/margins.js`) = selling price minus the quantity-weighted average buying price per product; realised profit counts only orders that pass `revenueWhere`, and only products that have a recorded cost. Cost maths lives in `rules.js`. Still no supplier table, purchase orders, transfers or stock ledger.

## Staff PIN login and wages (added on request)

Staff have **no email or password**: admin gives each a unique 4-digit PIN (`users.pin`, migration 004) and they sign in at `/staff-login` (`POST /api/auth/pin-login`, staff accounts only, tight rate limit). Admin also records a **daily wage** per staff member (migration 008). The admin branch list shows who works at each branch. Customers and admins still use email + password. The login page has no staff link (the till is the staff entry; `/staff-login` still works by direct URL). Staff cannot change their own password or PIN: only admin can. Admin also sets each staff member's **role** (Shopkeeper, Manager, Biller, Repairer; `users.staff_role`, migration 012, list in `STAFF_ROLES`) shown in the staff list. Staff have **no fixed branch**: admin saves each shop's public IP on the branch (`branches.ip`, migration 013, "Use this computer's IP" button), and at every PIN sign-in (dashboard or till) `utils/branchByIp.js` matches the caller's IP (`req.ip`, so `TRUST_PROXY` must be right in production) to a branch and sets `users.branch_id` there, so all existing branch scoping keeps working. An unregistered IP is refused (403). Shops need a fixed IP. Admin's staff list shows where and when each person last signed in. Admin's Delete on staff switches the account off, clears the PIN (so it can be reused) and hides them from the list; their shifts and sales keep their name. Staff and admin dashboards are signed out after 10 minutes without input, the till after 3 hours (`hooks/useIdleLogout.js`, browser-side timer; customers are not). Every sign-in cookie is a session cookie (no `maxAge`), so closing the browser signs everyone out.

**Bought-for price** (`cost_price`, migration 007) is required on every new product and cannot be blanked, so no product is left uncosted. Admin can also type it straight into the Profit page (`CostEdit.jsx`); a recorded delivery average still takes priority. The Profit list includes hidden products that have sold, and `?missing=1` lists products with no price.

## Reports (added on request)

Admin-only **Reports** page (`routes/reports.js`, `pages/Reports.jsx`, `/admin/reports/:branchId?`): revenue, cost and profit for all branches combined or one branch, to date or between two dates. Electronics, vapes and repairs are three separate blocks (rule 7); "Everything together" is an extra labelled line and never replaces them. Cost comes from the same `COST` queries as the Profit pages (exported, not copied); sales with no bought-for price are shown apart, not guessed. The PDF is the browser's print-to-PDF (`.print-report` print CSS), so there is no PDF library.

## Shifts and hours (added on request)

Staff press **Start shift** / **End shift** only at the till (`routes/till.js`; the dashboard has no start/end routes and no shift display). Several people can be on shift at one till, each starting their own with their PIN. Hours are read in `routes/shifts.js` (migration 005). The server stamps both times; one open shift per person is enforced by a unique index. Staff are paid **per day worked**, not per hour: each shift keeps a copy of the daily wage from when it started, and a UK calendar day pays that rate once, from its first shift, however many shifts or hours (`dayEarners` in `rules.js`). Hours are still recorded and shown (`shiftMinutes`). Only admin sees hours and wages (staff have no route for them, not even their own) and can fix a forgotten End. Gross pay only: still no breaks, overtime, tax, payslips or rotas.

## Till (added on request)

Staff-only counter till at `/till` (full screen, opened from the staff menu; `routes/till.js`, migration 006). The till has its **own PIN sign-in and cookie** (`till_token`, path `/api/till`, `protectTill`), apart from the dashboard login: whoever sits at it reaches the staff dashboard only through the explicit **Dashboard** button in the till header (`POST /api/till/open-dashboard`, opens the staff Stock & deliveries page in the same tab; the dashboard's "Open the till" link also opens the till in the same tab), never hours or wages, and "Log out" signs out of the till only. Staff clock in and out at the till with their own PIN (same branch only, `utils/shifts.js` shared with the dashboard); a sale needs the seller on shift. Admin sees who is working on the home page (`GET /api/shifts/now`). A till sale is an ordinary **paid, collected order** booked to the shared "Walk-in customer" account, so revenue, profit and stock reports need no special case. Electronics and vapes sell in one basket but are saved as two records (`orders`, `vape_orders`), and their totals are never added together. Vape lines need the staff member to confirm an ID check. `sold_by` marks who rang it up; a mistaken sale can be voided the same day (restocks). The cash tab has Exact, nearby round-figure and note/coin buttons (`pages/till/cash.js`, whole pence, screen only; change given is never stored). Cash/card only records how the customer paid; there is still no payment integration, discounts or loyalty on till sales. The header has **Log out** (till only, ends no shift) and **Close till**. The till stays open while anyone at the branch is on shift: when the person it is signed in as ends their shift, `/till/clock` re-issues the till cookie to the colleague who has been on shift longest (basket and screen stay); with nobody on shift the till shows a locked screen with the PIN keypad, and the first person to start a shift takes it. Every PIN screen (till sign-in, the shift window, `/staff-login`) uses the on-screen keypad `components/PinPad.jsx` (no text box, so a touch screen's own keyboard never opens) and submits at the 4th digit; the shift window has no Start/End buttons, `POST /till/clock` with `action: 'toggle'` starts your shift if you are off and ends it if you are on.

**Stock & deliveries page** (staff, `/staff/stock`, `pages/inventory/`; routes in `routes/branchStock.js` at `/api/branch`, staff dashboard sign-in; migration 009 adds `products.barcode` / `vape_products.barcode`, 010 adds Speakers, Phone covers, Chargers & cables, 011 gives every product without a barcode a made-up valid EAN-13: 500... electronics, 501... vapes; `utils/barcode.js` does the same for the seeds. Barcodes show in the admin product tables, stock lists, profit pages and item tiles, and the admin product forms have the Barcode / QR field). There is no separate till dashboard. The till's **Stock & deliveries** button calls `POST /api/till/open-dashboard`, which gives that same person a normal staff dashboard session (no second PIN) and opens the page on the delivery tab (`?tab=delivery`). It is one-way: a dashboard session never opens the till, and staff still never see hours or wages. Three big tabs: Add stock, New delivery, Stock list (the old count table). Add stock and New delivery are one guided flow (`AddFlow.jsx`): 1 Electronics or Vapes, 2 sub-category (electronics = the `categories` table, vapes = `VAPE_KINDS`), 3 tap photo tiles or scan, then one save button. Scanning: USB scanner (types code + Enter) or phone camera (browser `BarcodeDetector`, no library). Deliveries go through the same `receiveDelivery` / `receiveVapeDelivery` as the admin pages, with the price pre-filled from this branch's last delivery of that product (never the admin-only bought-for price). An unknown code is linked once to a product that has no code. Staff see and can undo **today's** deliveries only; older ones and all history are admin-only. Admin keeps the full Stock and Deliveries tables (with Electronics / Vapes buttons, `components/KindTabs.jsx`).

## Vape range (added on request, kept apart from electronics)

Everything vape lives in its own tables (`vape_*`, migration 003), routes (`server/routes/vapes/`, mounted at `/api/vapes`), rules (`utils/vapeRules.js`), pages (`client/src/pages/vapes/`) and basket (`VapeCartContext`). It shares only helpers (scope, paging, validation, money maths in `rules.js`). Its stock, orders, revenue and profit are never added to electronics figures. Collection only, pay at the counter, customer must confirm 18+ at checkout (server refuses without `ageConfirmed: true`), staff check ID on handover. No disposables, no delivery, no loyalty points on vape orders.
