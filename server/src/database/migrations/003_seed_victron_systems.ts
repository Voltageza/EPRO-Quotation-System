import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // Seed additional Victron inverters for V5, V8, V15 system classes
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, unit, retail_price)
    VALUES (?, ?, 'inverter', 'each', ?)
  `);

  const insertInverter = db.prepare(`
    INSERT OR IGNORE INTO inverters (product_id, system_class, rated_va, max_dc_voltage, ac_output_amps)
    VALUES (?, ?, ?, ?, ?)
  `);

  // V5 — MultiPlus-II 48/5000
  insertProduct.run('VICTRON1', 'INVERTER VICTRON 5000VA MPII 48V', 1850000);
  const v5 = db.prepare('SELECT id FROM products WHERE sku = ?').get('VICTRON1') as any;
  if (v5) insertInverter.run(v5.id, 'V5', 5000, 48, 21.7);

  // V8 — MultiPlus-II 48/8000 (NOT commonly stocked, approximate pricing)
  insertProduct.run('VICTRON2', 'INVERTER VICTRON 8000VA MPII 48V', 2150000);
  const v8 = db.prepare('SELECT id FROM products WHERE sku = ?').get('VICTRON2') as any;
  if (v8) insertInverter.run(v8.id, 'V8', 8000, 48, 34.8);

  // V10 already seeded in 002_seed_data (VICTRON3)

  // V15 — MultiPlus-II 48/15000
  insertProduct.run('VICTRON4', 'INVERTER VICTRON 15000VA MPII 48V', 3200000);
  const v15 = db.prepare('SELECT id FROM products WHERE sku = ?').get('VICTRON4') as any;
  if (v15) insertInverter.run(v15.id, 'V15', 15000, 48, 65.2);

  // Seed additional MPPT models
  insertProduct.run('SOLAR20', 'SOLAR MPPT VICTRON 250/100', 980000);
  const mppt250100 = db.prepare('SELECT id FROM products WHERE sku = ?').get('SOLAR20') as any;
  if (mppt250100) {
    db.prepare(`
      INSERT OR IGNORE INTO mppts (product_id, max_pv_voltage, max_charge_a, model_code, max_pv_power_w)
      VALUES (?, 250, 100, '250/100', 5800)
    `).run(mppt250100.id);
  }

  insertProduct.run('SOLAR21', 'SOLAR MPPT VICTRON 150/45', 450000);
  const mppt15045 = db.prepare('SELECT id FROM products WHERE sku = ?').get('SOLAR21') as any;
  if (mppt15045) {
    db.prepare(`
      INSERT OR IGNORE INTO mppts (product_id, max_pv_voltage, max_charge_a, model_code, max_pv_power_w)
      VALUES (?, 150, 45, '150/45', 2600)
    `).run(mppt15045.id);
  }

  // Seed AC surge protection
  insertProduct.run('SUR/AC', 'SURGE ARRESTOR AC 275V 40kA 2P', 35000);
}
