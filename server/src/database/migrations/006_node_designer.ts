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
}
