-- Gives every product that has no barcode a made-up but valid EAN-13 number (500... electronics, 501... vapes), so the
-- screens and scanners have something to show. Real codes typed by an admin or linked at the till are never touched.
UPDATE products p SET barcode = x.code FROM (
  SELECT id, base || ((10 - (SELECT sum(d::int * CASE WHEN i % 2 = 1 THEN 1 ELSE 3 END)
                             FROM unnest(string_to_array(base, NULL)) WITH ORDINALITY t(d, i)) % 10) % 10)::text AS code
  FROM (SELECT id, '500' || lpad(id::text, 9, '0') AS base FROM products) s
) x WHERE p.id = x.id AND (p.barcode IS NULL OR p.barcode = '');

UPDATE vape_products p SET barcode = x.code FROM (
  SELECT id, base || ((10 - (SELECT sum(d::int * CASE WHEN i % 2 = 1 THEN 1 ELSE 3 END)
                             FROM unnest(string_to_array(base, NULL)) WITH ORDINALITY t(d, i)) % 10) % 10)::text AS code
  FROM (SELECT id, '501' || lpad(id::text, 9, '0') AS base FROM vape_products) s
) x WHERE p.id = x.id AND (p.barcode IS NULL OR p.barcode = '');
