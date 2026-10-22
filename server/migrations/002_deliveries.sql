-- Wholesale deliveries: what the shop bought, how many, and at what unit cost.
-- Receiving a delivery adds its quantities to that branch's stock (done by the route, in one transaction).
-- The supplier is just a name on the delivery: no supplier table, no purchase orders.
CREATE SEQUENCE del_seq START 1001;

CREATE TABLE deliveries (
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
CREATE INDEX deliveries_branch_idx ON deliveries (branch_id, received_on DESC);

CREATE TABLE delivery_items (
  id SERIAL PRIMARY KEY,
  delivery_id INT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id),
  qty INT NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0), -- what the shop paid for ONE piece
  UNIQUE (delivery_id, product_id)
);
CREATE INDEX delivery_items_product_idx ON delivery_items (product_id);
