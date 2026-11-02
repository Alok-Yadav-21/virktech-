-- "Bought for" price typed on a product, for stock that arrived before deliveries were being recorded.
-- Profit uses the delivery average when there is one, and this price otherwise.
ALTER TABLE products ADD COLUMN cost_price NUMERIC(10,2) CHECK (cost_price >= 0);
ALTER TABLE vape_products ADD COLUMN cost_price NUMERIC(10,2) CHECK (cost_price >= 0);
