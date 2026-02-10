import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // Add mounting columns to quotes table
  db.exec(`ALTER TABLE quotes ADD COLUMN mounting_type TEXT NOT NULL DEFAULT 'tile' CHECK(mounting_type IN ('ibr', 'corrugated', 'tile', 'tilt_frame'))`);
  db.exec(`ALTER TABLE quotes ADD COLUMN mounting_rows INTEGER NOT NULL DEFAULT 2`);
  db.exec(`ALTER TABLE quotes ADD COLUMN mounting_cols INTEGER NOT NULL DEFAULT 6`);

  // Seed IBR bracket product
  db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, subcategory, unit, retail_price, is_active)
    VALUES ('SOLAR45', 'SOLAR IBR BRACKET AA', 'mounting', 'ibr_bracket', 'each', 4500, 1)
  `).run();

  // Seed Corrugated bracket product
  db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, subcategory, unit, retail_price, is_active)
    VALUES ('SOLAR46', 'SOLAR CORRUGATED BRACKET AA', 'mounting', 'corr_bracket', 'each', 4500, 1)
  `).run();

  // Seed Tilt frame bracket product
  db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, subcategory, unit, retail_price, is_active)
    VALUES ('SOLAR47', 'SOLAR TILT FRAME BRACKET AA', 'mounting', 'tilt_bracket', 'each', 15000, 1)
  `).run();
}
