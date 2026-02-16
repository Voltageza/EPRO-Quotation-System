import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // =============================================
  // 1. Recreate inverters table with brand support
  // =============================================

  // Back up existing inverter data
  const existingInverters = db.prepare('SELECT * FROM inverters').all() as any[];

  // Drop old table
  db.exec('DROP TABLE IF EXISTS inverters');

  // Create new table without CHECK constraint on system_class, with brand columns
  db.exec(`
    CREATE TABLE inverters (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL UNIQUE REFERENCES products(id),
      system_class    TEXT    NOT NULL,
      brand           TEXT    NOT NULL DEFAULT 'Victron',
      rated_va        INTEGER NOT NULL,
      max_dc_voltage  REAL    NOT NULL,
      ac_output_amps  REAL    NOT NULL,
      dc_input_amps   REAL,
      has_mppt        INTEGER NOT NULL DEFAULT 0,
      has_battery_port INTEGER NOT NULL DEFAULT 1,
      max_pv_input_w  INTEGER,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Restore existing Victron inverters
  const insertInverter = db.prepare(`
    INSERT INTO inverters (id, product_id, system_class, brand, rated_va, max_dc_voltage, ac_output_amps, dc_input_amps, has_mppt, has_battery_port)
    VALUES (?, ?, ?, 'Victron', ?, ?, ?, ?, 0, 1)
  `);
  for (const inv of existingInverters) {
    insertInverter.run(inv.id, inv.product_id, inv.system_class, inv.rated_va, inv.max_dc_voltage, inv.ac_output_amps, inv.dc_input_amps);
  }

  // =============================================
  // 2. Add brand column to mppts, batteries, products
  // =============================================

  // Add brand to mppts
  try { db.exec("ALTER TABLE mppts ADD COLUMN brand TEXT NOT NULL DEFAULT 'Victron'"); } catch (e) { /* column may already exist */ }

  // Add brand to batteries
  try { db.exec("ALTER TABLE batteries ADD COLUMN brand TEXT NOT NULL DEFAULT 'Victron'"); } catch (e) { /* column may already exist */ }

  // Add brand to products
  try { db.exec("ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT 'Victron'"); } catch (e) { /* column may already exist */ }

  // =============================================
  // 3. Relax quotes table — remove system_class CHECK, add design_mode
  // =============================================

  // Back up quotes
  const existingQuotes = db.prepare('SELECT * FROM quotes').all() as any[];

  // Get column info to rebuild without CHECK
  db.exec('DROP TABLE IF EXISTS quotes_backup');
  db.exec('ALTER TABLE quotes RENAME TO quotes_backup');

  db.exec(`
    CREATE TABLE quotes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number    TEXT    NOT NULL UNIQUE,
      version         INTEGER NOT NULL DEFAULT 1,
      client_id       INTEGER NOT NULL REFERENCES clients(id),
      system_class    TEXT    NOT NULL DEFAULT 'V10',
      status          TEXT    NOT NULL DEFAULT 'draft'
                      CHECK(status IN ('draft','review','approved','sent','accepted','rejected')),
      design_mode     TEXT    NOT NULL DEFAULT 'wizard'
                      CHECK(design_mode IN ('wizard','designer')),
      dc_battery_distance_m     REAL NOT NULL DEFAULT 1.5,
      ac_inverter_db_distance_m REAL NOT NULL DEFAULT 5,
      ac_db_grid_distance_m     REAL NOT NULL DEFAULT 10,
      pv_string_length_m        REAL NOT NULL DEFAULT 20,
      travel_distance_km        REAL NOT NULL DEFAULT 0,
      panel_id        INTEGER REFERENCES panels(id),
      panel_qty       INTEGER NOT NULL DEFAULT 0,
      strings_count   INTEGER NOT NULL DEFAULT 0,
      panels_per_string INTEGER NOT NULL DEFAULT 0,
      battery_id      INTEGER REFERENCES batteries(id),
      battery_qty     INTEGER NOT NULL DEFAULT 1,
      mppt_id         INTEGER REFERENCES mppts(id),
      mppt_qty        INTEGER NOT NULL DEFAULT 1,
      pricing_factor  REAL    NOT NULL DEFAULT 0.72,
      vat_rate        REAL    NOT NULL DEFAULT 0.15,
      subtotal_cents  INTEGER NOT NULL DEFAULT 0,
      vat_cents       INTEGER NOT NULL DEFAULT 0,
      total_cents     INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      design_assumptions TEXT,
      disclaimer      TEXT,
      created_by      INTEGER NOT NULL REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Restore quote data
  db.exec(`
    INSERT INTO quotes
    SELECT id, quote_number, version, client_id, system_class, status, 'wizard',
           dc_battery_distance_m, ac_inverter_db_distance_m, ac_db_grid_distance_m,
           pv_string_length_m, travel_distance_km,
           panel_id, panel_qty, strings_count, panels_per_string,
           battery_id, battery_qty, mppt_id, mppt_qty,
           pricing_factor, vat_rate, subtotal_cents, vat_cents, total_cents,
           notes, design_assumptions, disclaimer,
           created_by, created_at, updated_at
    FROM quotes_backup
  `);
  db.exec('DROP TABLE quotes_backup');

  // Recreate indexes
  db.exec('CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number)');

  // =============================================
  // 3b. Fix dependent tables whose FKs now point to quotes_backup
  //     (SQLite's ALTER TABLE RENAME updates FK refs in other tables)
  // =============================================

  // Fix quote_bom_items FK
  const bomData = db.prepare('SELECT * FROM quote_bom_items').all() as any[];
  db.exec('DROP TABLE IF EXISTS quote_bom_items');
  db.exec(`
    CREATE TABLE quote_bom_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id        INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      product_id      INTEGER NOT NULL REFERENCES products(id),
      section         TEXT    NOT NULL,
      quantity        REAL    NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      line_total_cents INTEGER NOT NULL,
      is_locked       INTEGER NOT NULL DEFAULT 0,
      is_manual_add   INTEGER NOT NULL DEFAULT 0,
      source_rule     TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const insertBomItem = db.prepare('INSERT INTO quote_bom_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const r of bomData) {
    insertBomItem.run(r.id, r.quote_id, r.product_id, r.section, r.quantity, r.unit_price_cents, r.line_total_cents, r.is_locked, r.is_manual_add, r.source_rule, r.sort_order, r.notes, r.created_at);
  }

  // Fix quote_flags FK
  const flagData = db.prepare('SELECT * FROM quote_flags').all() as any[];
  db.exec('DROP TABLE IF EXISTS quote_flags');
  db.exec(`
    CREATE TABLE quote_flags (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id        INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      severity        TEXT    NOT NULL CHECK(severity IN ('info','warning','error')),
      code            TEXT    NOT NULL,
      message         TEXT    NOT NULL,
      is_blocking     INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const insertFlagItem = db.prepare('INSERT INTO quote_flags VALUES (?,?,?,?,?,?,?)');
  for (const r of flagData) {
    insertFlagItem.run(r.id, r.quote_id, r.severity, r.code, r.message, r.is_blocking, r.created_at);
  }

  // Fix quote_versions FK
  const verData = db.prepare('SELECT * FROM quote_versions').all() as any[];
  db.exec('DROP TABLE IF EXISTS quote_versions');
  db.exec(`
    CREATE TABLE quote_versions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id        INTEGER NOT NULL REFERENCES quotes(id),
      version         INTEGER NOT NULL,
      snapshot_json   TEXT    NOT NULL,
      changed_by      INTEGER NOT NULL REFERENCES users(id),
      change_summary  TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const insertVerItem = db.prepare('INSERT INTO quote_versions VALUES (?,?,?,?,?,?,?)');
  for (const r of verData) {
    insertVerItem.run(r.id, r.quote_id, r.version, r.snapshot_json, r.changed_by, r.change_summary, r.created_at);
  }

  // =============================================
  // 4. Create quote_designs table
  // =============================================
  db.exec(`
    CREATE TABLE IF NOT EXISTS quote_designs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      version     INTEGER NOT NULL DEFAULT 1,
      graph_json  TEXT    NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_quote_designs_quote ON quote_designs(quote_id)');

  // =============================================
  // 5. Seed Atess products + inverters
  // =============================================
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, unit, retail_price, brand)
    VALUES (?, ?, ?, 'each', ?, ?)
  `);

  const insertInv = db.prepare(`
    INSERT OR IGNORE INTO inverters (product_id, system_class, brand, rated_va, max_dc_voltage, ac_output_amps, has_mppt, has_battery_port, max_pv_input_w)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Atess HPS 5kVA Hybrid (integrated MPPT, has battery)
  insertProduct.run('ATESS1', 'INVERTER ATESS HPS 5kVA HYBRID', 'inverter', 1650000, 'Atess');
  const att5 = db.prepare("SELECT id FROM products WHERE sku = 'ATESS1'").get() as any;
  if (att5) insertInv.run(att5.id, 'ATT5', 'Atess', 5000, 500, 21.7, 1, 1, 6500);

  // Atess HPS 10kVA Hybrid
  insertProduct.run('ATESS2', 'INVERTER ATESS HPS 10kVA HYBRID', 'inverter', 2800000, 'Atess');
  const att10 = db.prepare("SELECT id FROM products WHERE sku = 'ATESS2'").get() as any;
  if (att10) insertInv.run(att10.id, 'ATT10', 'Atess', 10000, 500, 43.5, 1, 1, 13000);

  // Atess batteries
  insertProduct.run('ATESS-BAT1', 'ATESS BATTERY 5.12kWh 51.2V', 'battery', 1200000, 'Atess');
  const attBat = db.prepare("SELECT id FROM products WHERE sku = 'ATESS-BAT1'").get() as any;
  if (attBat) {
    db.prepare(`
      INSERT OR IGNORE INTO batteries (product_id, capacity_kwh, voltage, max_charge_a, max_discharge_a, chemistry, brand)
      VALUES (?, 5.12, 51.2, 100, 100, 'LiFePO4', 'Atess')
    `).run(attBat.id);
  }

  // =============================================
  // 6. Seed Sungrow products + inverters
  // =============================================

  // Sungrow SG5.0RS Grid-Tie (integrated MPPT, NO battery)
  insertProduct.run('SUNGROW1', 'INVERTER SUNGROW SG5.0RS GRID-TIE', 'inverter', 1350000, 'Sungrow');
  const sg5 = db.prepare("SELECT id FROM products WHERE sku = 'SUNGROW1'").get() as any;
  if (sg5) insertInv.run(sg5.id, 'SG5', 'Sungrow', 5000, 600, 22.7, 1, 0, 6750);

  // Sungrow SG10RT Grid-Tie
  insertProduct.run('SUNGROW2', 'INVERTER SUNGROW SG10RT GRID-TIE', 'inverter', 2200000, 'Sungrow');
  const sg10 = db.prepare("SELECT id FROM products WHERE sku = 'SUNGROW2'").get() as any;
  if (sg10) insertInv.run(sg10.id, 'SG10', 'Sungrow', 10000, 600, 45.5, 1, 0, 15000);

  // =============================================
  // 7. Seed rule_entries for Atess/Sungrow system classes
  // =============================================

  // Find existing rule table IDs
  const dcBatteryTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'dc_battery_cable'").get() as any;
  const acCableTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'ac_cable'").get() as any;
  const acProtTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'ac_protection'").get() as any;
  const labourTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'labour'").get() as any;

  const insertEntry = db.prepare(`
    INSERT INTO rule_entries (rule_table_id, system_class, condition_json, result_json, sort_order, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  if (dcBatteryTable) {
    // ATT5 DC battery (similar to V5)
    insertEntry.run(dcBatteryTable.id, 'ATT5',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '35mm battery cable' },
          { sku: 'FU/MEGA', qty: 1, section: 'dc_battery', note: '250A Mega fuse' },
          { sku: 'FU/HOL', qty: 1, section: 'dc_battery', note: 'Mega fuse holder' }
        ],
        flags: [{ condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m' }]
      }), 10, 'ATT5 DC battery cable');

    // ATT10 DC battery (similar to V10)
    insertEntry.run(dcBatteryTable.id, 'ATT10',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery' },
          { sku: 'FU9', qty: 1, section: 'dc_battery', note: '400/500A ANL fuse' },
          { sku: 'FU10', qty: 1, section: 'dc_battery', note: 'ANL fuse holder' }
        ],
        flags: [{ condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m' }]
      }), 11, 'ATT10 DC battery cable');

    // Sungrow has no battery — no DC battery rules needed for SG5/SG10
  }

  if (acCableTable) {
    // ATT5 AC cables (similar to V5)
    insertEntry.run(acCableTable.id, 'ATT5',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'W/PAN10', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '10mm 4-core for ATT5' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 10, 'ATT5 AC cable');

    // ATT10 AC cables (similar to V10)
    insertEntry.run(acCableTable.id, 'ATT10',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'P/W16', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '16mm 4-core for ATT10' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 11, 'ATT10 AC cable');

    // SG5 AC cables
    insertEntry.run(acCableTable.id, 'SG5',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'W/PAN10', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '10mm 4-core for SG5' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 12, 'SG5 AC cable');

    // SG10 AC cables
    insertEntry.run(acCableTable.id, 'SG10',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'P/W16', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '16mm 4-core for SG10' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 13, 'SG10 AC cable');
  }

  if (acProtTable) {
    // ATT5 AC protection
    insertEntry.run(acProtTable.id, 'ATT5',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 2, section: 'ac_protection', note: '2x 63A DP breakers' },
          { sku: 'C/OVER4', qty: 1, section: 'ac_protection', note: '63A changeover switch' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' },
          { sku: 'SVN121', qty: 1, section: 'ac_protection' },
          { sku: 'SVN122', qty: 1, section: 'ac_protection' }
        ]
      }), 10, 'ATT5 AC protection');

    // ATT10 AC protection
    insertEntry.run(acProtTable.id, 'ATT10',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 2, section: 'ac_protection' },
          { sku: 'C/OVER4', qty: 1, section: 'ac_protection' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection' },
          { sku: 'SVN121', qty: 1, section: 'ac_protection' },
          { sku: 'SVN122', qty: 1, section: 'ac_protection' }
        ]
      }), 11, 'ATT10 AC protection');

    // SG5 AC protection (no changeover for grid-tie)
    insertEntry.run(acProtTable.id, 'SG5',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 1, section: 'ac_protection', note: '1x 63A DP breaker (grid-tie)' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' }
        ]
      }), 12, 'SG5 AC protection (grid-tie, no changeover)');

    // SG10 AC protection
    insertEntry.run(acProtTable.id, 'SG10',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 1, section: 'ac_protection', note: '1x 63A DP breaker (grid-tie)' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' }
        ]
      }), 13, 'SG10 AC protection (grid-tie, no changeover)');
  }

  if (labourTable) {
    // ATT5 labour
    insertEntry.run(labourTable.id, 'ATT5',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 8, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 2 }),
      10, 'ATT5 labour');

    // ATT10 labour
    insertEntry.run(labourTable.id, 'ATT10',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 12, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 3 }),
      11, 'ATT10 labour');

    // SG5 labour (simpler — no battery)
    insertEntry.run(labourTable.id, 'SG5',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 6, battery_adder_hours: 0, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 1 }),
      12, 'SG5 labour (grid-tie, no battery)');

    // SG10 labour
    insertEntry.run(labourTable.id, 'SG10',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 8, battery_adder_hours: 0, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 2 }),
      13, 'SG10 labour (grid-tie, no battery)');
  }
}
