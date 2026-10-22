# PLAN.md: Virktech simple MERN rebuild

Old app (reference only, do not modify): `H:\WebDevlopment\clones\mobile_shop`.
Copy **seed content** from there: `src/data/branches.js` (8 branches with lat/lng), `src/data/services.js` (8 services), `src/data/products.js` (29 products, 8 categories), `src/assets/img` (check `ATTRIBUTION.md`). Copy **rules** from `src/constants/status.js` and `src/lib/{loyalty,quotes,repairRules,geo}.js` and their `.test.js` files, porting to the server.

## Decisions
- Payments: pay on collection / on delivery. No Stripe.
- Timesheets / wages: cut.
- Stock: one integer per product **per branch** (`branch_stock`). Orders take stock from the branch the customer picks; staff set their own branch's counts. No transfers, stocktakes or ledger.
- Kept optional features: branch finder (map + postcode), loyalty points, trade-in.

## Data model (PostgreSQL tables in `server/schema.sql`; snake_case columns, ids are SERIAL; repair/order `history`, `notes`, `parts`, `items` are JSONB columns; refs to other tables are `*_id` foreign keys)
- **User**: name, email (unique), password (hash), phone, role (`customer|staff|admin`), branch (ref, staff only), loyaltyPoints (int), active.
- **Branch**: name, area, address, postcode, lat, lng, phone, active.
- **Category**: name. **Service**: title, description, icon, basePrice, active.
- **Product**: name, brand, category (ref), price, wasPrice, condition (`New|Used|Refurbished`), image, description, active. Stock lives in **BranchStock** (branch, product, stock).
- **Repair**: reference (`SPR-n`), customer, branch, device {category, brand, model}, problem, fulfilment (`in_store|collection|mail_in`), status, quote, technician (ref staff), history [{status, at, by, reason}], notes [{by, text, visibleToCustomer, at}], parts [{name, cost}], cancelReason, loyaltyDiscount, paymentStatus (`unpaid|paid|refunded`), paidAt, paidAmount, pointsAwarded. A repair cannot be Completed until it is paid; takings are reported separately from order revenue.
- **Order**: reference (`VT-ORD-n`), customer, branch, items [{product, name, price, qty}] (price snapshot), total, deliveryMethod (`collection|delivery`), address {line1, city, postcode}, paymentMethod (`cash|card_in_store`), paymentStatus (`unpaid|paid|refunded`), status, history, loyaltyDiscount, pointsAwarded.
- **TradeIn**: reference (`VT-TI-n`), customer, branch, device fields, condition, photos [url], indicativeValue, finalOffer, status, history.
- **LoyaltyEntry**: user, delta, kind (`earned|redeemed|adjusted`), sourceRef, note.
- **Reference numbers**: Postgres sequences `spr_seq`, `ord_seq`, `ti_seq` (start at 4801, 10001, 3001). `nextReference(key)` = `nextval`.

## Business rules (put in `server/utils/rules.js`, with tests)

**Repair statuses (12), in order:**
Booking received, Awaiting device, Device received, Diagnostics, Quote awaiting approval, Repair in progress, Parts ordered, Quality check, Ready for collection, Dispatched, Completed, plus Cancelled.

**Transitions**
- Booking received to Awaiting device or Device received (walk-in skips Awaiting device)
- Awaiting device to Device received
- Device received to Diagnostics
- Diagnostics to Quote awaiting approval (requires quote > 0)
- Quote awaiting approval to Repair in progress: **customer approve only** (hidden from the staff dropdown)
- Repair in progress to Parts ordered or Quality check
- Parts ordered to Repair in progress
- Quality check to Ready for collection
- Ready for collection to Completed or Dispatched
- Dispatched to Completed
- Any state except Completed and Cancelled to Cancelled (reason required). Customer decline of a quote also cancels.
- Customer may cancel own repair only in Booking received or Awaiting device.

**Customer stages (7, computed from status):**
1 Booking confirmed; 2 Waiting for your device; 3 Device with us (Device received, Diagnostics); 4 Your approval needed; 5 Being repaired (Repair in progress, Parts ordered, Quality check); 6 Ready to collect (or "On its way to you" if Dispatched was reached); 7 Completed. Cancelled is a stop on the timeline.

**Quote visibility:** customer sees the quote only once history contains Quote awaiting approval. Strip it otherwise in the API response.

**Orders:** `pending, paid, processing, ready, dispatched, delivered, collected, cancelled, refunded`. Cancel allowed unless dispatched, delivered, collected or cancelled; cancelling restocks. Order creation decrements stock atomically per item (`UPDATE products SET stock = stock - $qty WHERE id = $id AND stock >= $qty` (0 rows = fail), all inside one transaction so a failure rolls back); if any item fails, restore the earlier ones and return 409.

**Revenue:** only `paymentStatus: 'paid'` and status not cancelled/refunded.

**Trade-in:** `submitted, valuation_review, offer_sent, offer_accepted, paid, completed`, plus `offer_declined` (only before accepted) and `cancelled` (any non-final). Each step is exactly the next one. Customer acts at `offer_sent` (accept/decline).

**Loyalty**
- Earn 5 points per full £10, only when spend is strictly over £10 (£10 earns 0, £11 earns 5).
- Awarded once, when an order reaches delivered/collected or a repair reaches Completed (`pointsAwarded` flag prevents double award). Repairs earn on quote minus loyaltyDiscount.
- Redeem in steps of 10 points = £2, capped at 20% of the bill; over-asking is trimmed, not rejected. Redemption happens inside order creation (one request, no half-done state). Balance never goes negative.
- Admin adjust requires a note. Staff can redeem at counter for a named customer.

## API (`/api`)
- auth: POST register, login, logout; GET me
- products, categories, services, branches: public GET; admin POST/PUT/DELETE. Delete refuses if referenced; products use `active:false`
- GET branches/nearest?postcode= (postcodes.io lookup, haversine helper)
- repairs: POST; GET (scoped); GET /:ref; PATCH /:ref/status, /quote, /technician; POST /:ref/notes, /parts
- orders: POST; GET (scoped); GET /:ref; PATCH /:ref/status, /:ref/pay; POST /:ref/cancel
- tradeins: POST; GET; GET /:ref; PATCH /:ref (staff valuation/offer); POST /:ref/respond
- loyalty: GET /me; POST /redeem (staff, counter); POST /adjust (admin)
- users: admin CRUD (staff and customers)
- dashboard: GET /stats (counts, paid revenue by day and branch)
- Cart lives in browser localStorage and is sent on checkout.

## Pages
- **Public:** Home, Services, Shop, Product detail, Cart, Checkout, Order confirmation, Branches (map + postcode), Contact, Terms/Privacy/Warranty (one StaticPage), Login, Register, 404.
- **Customer `/app`:** Dashboard, Book repair (single form), My repairs + tracking (timeline, approve/decline quote), Sell device + tracking, My orders, Loyalty, Profile.
- **Staff `/staff`:** Dashboard, Branch repairs + workbench, Trade-ins, Branch orders (status, mark paid), Stock adjust, Counter loyalty redeem.
- **Admin `/admin`:** Dashboard, Repairs (assign tech), Orders, Trade-ins, Products, Categories, Services, Branches, Staff, Customers, Loyalty adjust.

## Phases (tick when done and manually verified)
- [x] 1. Setup: folders, Express + Postgres, `.env.example`, seed script, health route, Vite + Bootstrap, axios, router skeleton
- [x] 2. Auth + roles: User, register/login/me/logout, `protect`/`requireRole`, AuthContext, guarded routes, WorkspaceLayout
- [x] 3. Catalogue: Branch/Category/Product/Service models + routes, public pages, admin CRUD with generic DataTable + FormModal
- [x] 4. Repairs: `rules.js` + tests, model/routes with scoping, booking form, tracking + timeline, staff workbench, admin assign
- [x] 5. Orders: cart, checkout, stock decrement/restock, status, mark paid, cancel rule
- [x] 6. Trade-in: model/routes, customer form + tracking, staff valuation/offer, accept/decline
- [x] 7. Loyalty: points helper, earn, redeem at checkout and counter, admin adjust, customer page
- [x] 8. Dashboard + polish: stats, loading/empty/error states, responsive pass, README with demo logins, role-access supertest checks
- [x] 9. Production hardening (added after the first eight): numbered migrations, safe seed/bootstrap scripts (`migrate`, `seed:starter`, `create-admin`), separate test database, helmet + rate limits + config checks, JSON request logs and graceful shutdown, paged/searchable lists, DB-level CHECK constraints and indexes, stock per branch, repair payment tracking, loyalty reversal on refund, sessions ended by password change, one-deploy static serving, full business-flow test suite

## Demo logins (seeded)
`customer@demo.com`, `staff@demo.com` (branch: Belvedere), `admin@demo.com`, password `Password123!`.

## Known choices to remember
- Guest repair booking is dropped: the old app matched repairs by email/phone string, which is a data-leak risk. Customer must register first.
- Admin using `/staff/*` needs a branch picker or is redirected to `/admin`.
- Pay on collection only; the label at checkout must say so.
- Legal pages are placeholders; see the old repo's `LEGAL-CHECKLIST.md` before going live.
