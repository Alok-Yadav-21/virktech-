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

## Vape range (added on request, kept apart from electronics)

Everything vape lives in its own tables (`vape_*`, migration 003), routes (`server/routes/vapes/`, mounted at `/api/vapes`), rules (`utils/vapeRules.js`), pages (`client/src/pages/vapes/`) and basket (`VapeCartContext`). It shares only helpers (scope, paging, validation, money maths in `rules.js`). Its stock, orders, revenue and profit are never added to electronics figures. Collection only, pay at the counter, customer must confirm 18+ at checkout (server refuses without `ageConfirmed: true`), staff check ID on handover. No disposables, no delivery, no loyalty points on vape orders.
