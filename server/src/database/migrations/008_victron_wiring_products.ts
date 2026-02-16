import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, unit, retail_price, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  insert.run('DC/ISO', 'Victron Battery Switch 275A', 'protection', 'each', 800);
  insert.run('MC4/Y1', 'MC4 Y-Splitter 1M-2F', 'accessory', 'each', 85);
  insert.run('MC4/Y2', 'MC4 Y-Splitter 1F-2M', 'accessory', 'each', 85);
  insert.run('RCD/2P', 'RCD Earth Leakage 2P 40A 30mA', 'protection', 'each', 600);
}
