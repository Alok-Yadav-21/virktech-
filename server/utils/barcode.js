// Made-up but valid EAN-13 numbers (500... electronics, 501... vapes) for products that have no barcode yet.
// Same SQL as migration 011; the seeds call this because they insert products after the migrations have run.
// Real codes (typed by an admin or linked at the till) are never overwritten.
const fill = (table, prefix) => `
  UPDATE ${table} p SET barcode = x.code FROM (
    SELECT id, base || ((10 - (SELECT sum(d::int * CASE WHEN i % 2 = 1 THEN 1 ELSE 3 END)
                               FROM unnest(string_to_array(base, NULL)) WITH ORDINALITY t(d, i)) % 10) % 10)::text AS code
    FROM (SELECT id, '${prefix}' || lpad(id::text, 9, '0') AS base FROM ${table}) s
  ) x WHERE p.id = x.id AND (p.barcode IS NULL OR p.barcode = '')`

export async function fillBarcodes(db) {
  await db.query(fill('products', '500'))
  await db.query(fill('vape_products', '501'))
}
