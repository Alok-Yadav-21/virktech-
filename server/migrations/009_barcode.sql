-- Barcode / QR text printed on a product, so the till can find it by scanning. Optional; one product per code.
-- Blank text counts as "no code", so the unique index ignores it.
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE vape_products ADD COLUMN barcode TEXT;
CREATE UNIQUE INDEX products_barcode_uq ON products (barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE UNIQUE INDEX vape_products_barcode_uq ON vape_products (barcode) WHERE barcode IS NOT NULL AND barcode <> '';
