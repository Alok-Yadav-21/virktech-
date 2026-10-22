-- Initial schema. Never edit this file once it has run anywhere: add 002_*.sql instead.
-- Status lists below must match server/utils/rules.js (schema.test.js checks they do).

-- Reference numbers: sequences start at shop-style floors (see utils/reference.js).
CREATE SEQUENCE spr_seq START 4801;
CREATE SEQUENCE ord_seq START 10001;
CREATE SEQUENCE ti_seq START 3001;

CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  address TEXT,
  postcode TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
  branch_id INT REFERENCES branches(id), -- staff only
  loyalty_points INT NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  password_changed_at TIMESTAMPTZ,       -- sessions issued before this are rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role <> 'staff' OR branch_id IS NOT NULL)
);
CREATE INDEX users_role_branch_idx ON users (role, branch_id);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category_id INT NOT NULL REFERENCES categories(id),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  was_price NUMERIC(10,2) CHECK (was_price >= 0),
  condition TEXT NOT NULL DEFAULT 'New' CHECK (condition IN ('New', 'Used', 'Refurbished')),
  image TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX products_category_idx ON products (category_id);

-- One count per product per branch. A missing row means zero. The CHECK stops overselling.
CREATE TABLE branch_stock (
  branch_id INT NOT NULL REFERENCES branches(id),
  product_id INT NOT NULL REFERENCES products(id),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  PRIMARY KEY (branch_id, product_id)
);
CREATE INDEX branch_stock_product_idx ON branch_stock (product_id);

CREATE TABLE repairs (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_id INT NOT NULL REFERENCES users(id),
  branch_id INT NOT NULL REFERENCES branches(id),
  device_category TEXT,
  device_brand TEXT,
  device_model TEXT NOT NULL,
  problem TEXT NOT NULL,
  fulfilment TEXT NOT NULL CHECK (fulfilment IN ('in_store', 'collection', 'mail_in')),
  status TEXT NOT NULL DEFAULT 'Booking received' CHECK (status IN (
    'Booking received', 'Awaiting device', 'Device received', 'Diagnostics', 'Quote awaiting approval',
    'Repair in progress', 'Parts ordered', 'Quality check', 'Ready for collection', 'Dispatched',
    'Completed', 'Cancelled')),
  quote NUMERIC(10,2) CHECK (quote >= 0),
  technician_id INT REFERENCES users(id),
  history JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(history) = 'array'), -- [{status, at, by, reason}]
  notes JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(notes) = 'array'),     -- [{by, text, visibleToCustomer, at}]
  parts JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(parts) = 'array'),     -- [{name, cost}]
  cancel_reason TEXT,
  loyalty_discount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (loyalty_discount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(10,2) CHECK (paid_amount >= 0), -- quote minus loyalty discount at the time of payment
  points_awarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((payment_status = 'unpaid') = (paid_at IS NULL))
);
CREATE INDEX repairs_customer_idx ON repairs (customer_id, id DESC);
CREATE INDEX repairs_branch_status_idx ON repairs (branch_id, status);
CREATE INDEX repairs_paid_idx ON repairs (paid_at) WHERE payment_status = 'paid';

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_id INT NOT NULL REFERENCES users(id),
  branch_id INT NOT NULL REFERENCES branches(id), -- branch that fulfils it and holds the stock
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0), -- [{productId, name, price, qty}]
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('collection', 'delivery')),
  address JSONB,                       -- {line1, city, postcode}, delivery only
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card_in_store')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'processing', 'ready', 'dispatched', 'delivered', 'collected', 'cancelled', 'refunded')),
  history JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(history) = 'array'),
  loyalty_discount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (loyalty_discount >= 0),
  points_awarded BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,                 -- set when marked paid; revenue is reported by this date
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((delivery_method = 'delivery') = (address IS NOT NULL)),
  CHECK ((payment_status = 'unpaid') = (paid_at IS NULL))
);
CREATE INDEX orders_customer_idx ON orders (customer_id, id DESC);
CREATE INDEX orders_branch_status_idx ON orders (branch_id, status);
CREATE INDEX orders_paid_idx ON orders (paid_at) WHERE payment_status = 'paid';

CREATE TABLE trade_ins (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_id INT NOT NULL REFERENCES users(id),
  branch_id INT NOT NULL REFERENCES branches(id),
  device_category TEXT,
  device_brand TEXT,
  device_model TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('Like new', 'Good', 'Fair', 'Poor')),
  details TEXT,
  photos JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(photos) = 'array'), -- [url]; links only, no uploads
  indicative_value NUMERIC(10,2) CHECK (indicative_value >= 0), -- staff guide figure, visible to the customer
  final_offer NUMERIC(10,2) CHECK (final_offer >= 0),           -- hidden from the customer until sent
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'valuation_review', 'offer_sent', 'offer_accepted', 'offer_declined', 'paid', 'completed', 'cancelled')),
  history JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(history) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trade_ins_customer_idx ON trade_ins (customer_id, id DESC);
CREATE INDEX trade_ins_branch_status_idx ON trade_ins (branch_id, status);

CREATE TABLE loyalty_entries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  delta INT NOT NULL CHECK (delta <> 0),
  kind TEXT NOT NULL CHECK (kind IN ('earned', 'redeemed', 'adjusted')),
  source_ref TEXT, -- order/repair reference, 'COUNTER' or 'ADMIN'
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_entries_user_idx ON loyalty_entries (user_id, id DESC);
