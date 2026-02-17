import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // =============================================
  // 1. Fix Freedom battery brand
  // =============================================
  db.prepare("UPDATE batteries SET brand = 'FreedomWON' WHERE product_id = (SELECT id FROM products WHERE sku = 'BATT/FREE2')").run();
  db.prepare("UPDATE products SET brand = 'FreedomWON' WHERE sku = 'BATT/FREE2'").run();

  // =============================================
  // 2. Add P/W25 product (25mm 4-core cable)
  // =============================================
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, unit, retail_price, brand, is_active)
    VALUES (?, ?, ?, 'each', ?, ?, 1)
  `);
  insertProduct.run('P/W25', 'CABLE 25mm² 4-CORE PVC/PVC', 'cable', 6500, 'Generic');

  // =============================================
  // 3. Add mppt_count column to inverters table
  // =============================================
  try {
    db.exec("ALTER TABLE inverters ADD COLUMN mppt_count INTEGER NOT NULL DEFAULT 1");
  } catch (e) {
    // Column may already exist
  }
}
