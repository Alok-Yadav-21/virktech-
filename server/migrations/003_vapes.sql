-- Vape range: a separate catalogue, stock, deliveries and orders from the electronics side, so nothing is mixed in
-- revenue or profit reports. Collection only, 18+ confirmed at checkout. Disposable vapes are deliberately not a product kind.
CREATE SEQUENCE vape_ord_seq START 5001;
CREATE SEQUENCE vape_del_seq START 1001;

CREATE TABLE vape_brands (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true
);

-- One row per flavour and strength, so each has its own stock count and price.
CREATE TABLE vape_products (
  id SERIAL PRIMARY KEY,
  brand_id INT NOT NULL REFERENCES vape_brands(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('Pod kit', 'Refill pod', 'E-liquid', 'Coil', 'Accessory')),
  flavour TEXT,
  flavour_group TEXT CHECK (flavour_group IN ('Fruit', 'Menthol & ice', 'Tobacco', 'Sweet & dessert', 'Drinks', 'Unflavoured')),
  nicotine_mg INT NOT NULL DEFAULT 0 CHECK (nicotine_mg BETWEEN 0 AND 20), -- mg/ml; 20 is the UK legal maximum
  size_ml INT CHECK (size_ml > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  was_price NUMERIC(10,2) CHECK (was_price >= 0),
  image TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX vape_products_brand_idx ON vape_products (brand_id);

CREATE TABLE vape_stock (
  branch_id INT NOT NULL REFERENCES branches(id),
  product_id INT NOT NULL REFERENCES vape_products(id),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  PRIMARY KEY (branch_id, product_id)
);
CREATE INDEX vape_stock_product_idx ON vape_stock (product_id);

CREATE TABLE vape_deliveries (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL,
  branch_id INT NOT NULL REFERENCES branches(id),
  received_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vape_deliveries_branch_idx ON vape_deliveries (branch_id, received_on DESC);

CREATE TABLE vape_delivery_items (
  id SERIAL PRIMARY KEY,
  delivery_id INT NOT NULL REFERENCES vape_deliveries(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES vape_products(id),
  qty INT NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
  UNIQUE (delivery_id, product_id)
);
CREATE INDEX vape_delivery_items_product_idx ON vape_delivery_items (product_id);

CREATE TABLE vape_orders (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_id INT NOT NULL REFERENCES users(id),
  branch_id INT NOT NULL REFERENCES branches(id),
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0), -- [{productId, name, price, qty}]
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card_in_store')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'collected', 'cancelled', 'refunded')),
  age_confirmed BOOLEAN NOT NULL CHECK (age_confirmed), -- the customer said they are 18 or over; staff still check ID on collection
  history JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(history) = 'array'),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((payment_status = 'unpaid') = (paid_at IS NULL))
);
CREATE INDEX vape_orders_customer_idx ON vape_orders (customer_id, id DESC);
CREATE INDEX vape_orders_branch_status_idx ON vape_orders (branch_id, status);
CREATE INDEX vape_orders_paid_idx ON vape_orders (paid_at) WHERE payment_status = 'paid';
