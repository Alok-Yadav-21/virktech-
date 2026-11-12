-- More electronics categories for the stock screens. Skips any that already exist; admin can add more under Categories.
INSERT INTO categories (name) VALUES ('Speakers'), ('Phone covers'), ('Chargers & cables') ON CONFLICT (name) DO NOTHING;
