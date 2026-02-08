import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  db.exec(`
    -- USERS & AUTH
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      display_name  TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL CHECK(role IN ('admin','sales','viewer')),
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT    PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      expires_at  TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- PRODUCT CATALOG
    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      sku             TEXT    NOT NULL UNIQUE,
      name            TEXT    NOT NULL,
      category        TEXT    NOT NULL,
      subcategory     TEXT,
      unit            TEXT    NOT NULL DEFAULT 'each',
      retail_price    INTEGER NOT NULL DEFAULT 0,
      is_active       INTEGER NOT NULL DEFAULT 1,
      notes           TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id   INTEGER NOT NULL REFERENCES products(id),
      old_price    INTEGER NOT NULL,
      new_price    INTEGER NOT NULL,
      changed_by   INTEGER NOT NULL REFERENCES users(id),
      changed_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      reason       TEXT
    );

    -- PRICING ENGINE CONFIGURATION (singleton row id=1)
    CREATE TABLE IF NOT EXISTS pricing_config (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      pricing_factor  REAL    NOT NULL DEFAULT 0.72,
      vat_rate        REAL    NOT NULL DEFAULT 0.15,
      min_margin      REAL    NOT NULL DEFAULT 0.15,
      travel_rate     INTEGER NOT NULL DEFAULT 495,
      labour_rate     INTEGER NOT NULL DEFAULT 49500,
      updated_by      INTEGER REFERENCES users(id),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- PANELS (extended product with electrical specs)
    CREATE TABLE IF NOT EXISTS panels (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL UNIQUE REFERENCES products(id),
      power_w         REAL    NOT NULL,
      voc             REAL    NOT NULL,
      vmp             REAL    NOT NULL,
      isc             REAL    NOT NULL,
      imp             REAL    NOT NULL,
      temp_coeff_voc  REAL    NOT NULL,
      width_mm        INTEGER,
      height_mm       INTEGER,
      depth_mm        INTEGER,
      weight_kg       REAL,
      datasheet_path  TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','approved','rejected')),
      approved_by     INTEGER REFERENCES users(id),
      approved_at     TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- INVERTERS (extended product with Victron specs)
    CREATE TABLE IF NOT EXISTS inverters (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL UNIQUE REFERENCES products(id),
      system_class    TEXT    NOT NULL CHECK(system_class IN ('V5','V8','V10','V15')),
      rated_va        INTEGER NOT NULL,
      max_dc_voltage  REAL    NOT NULL,
      ac_output_amps  REAL    NOT NULL,
      dc_input_amps   REAL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- MPPT CHARGE CONTROLLERS
    CREATE TABLE IF NOT EXISTS mppts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL UNIQUE REFERENCES products(id),
      max_pv_voltage  REAL    NOT NULL,
      max_charge_a    REAL    NOT NULL,
      model_code      TEXT    NOT NULL,
      max_pv_power_w  INTEGER,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- BATTERIES
    CREATE TABLE IF NOT EXISTS batteries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id      INTEGER NOT NULL UNIQUE REFERENCES products(id),
      capacity_kwh    REAL    NOT NULL,
      voltage         REAL    NOT NULL,
      max_charge_a    REAL,
      max_discharge_a REAL,
      chemistry       TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- VICTRON RULE TABLES
    CREATE TABLE IF NOT EXISTS rule_tables (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type       TEXT    NOT NULL,
      version         INTEGER NOT NULL DEFAULT 1,
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_by      INTEGER NOT NULL REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rule_entries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_table_id   INTEGER NOT NULL REFERENCES rule_tables(id),
      system_class    TEXT,
      condition_json  TEXT    NOT NULL,
      result_json     TEXT    NOT NULL,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- CLIENTS
    CREATE TABLE IF NOT EXISTS clients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      phone           TEXT,
      email           TEXT,
      address         TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- QUOTES
    CREATE TABLE IF NOT EXISTS quotes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number    TEXT    NOT NULL UNIQUE,
      version         INTEGER NOT NULL DEFAULT 1,
      client_id       INTEGER NOT NULL REFERENCES clients(id),
      system_class    TEXT    NOT NULL CHECK(system_class IN ('V5','V8','V10','V15')),
      status          TEXT    NOT NULL DEFAULT 'draft'
                      CHECK(status IN ('draft','review','approved','sent','accepted','rejected')),
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
    );

    -- QUOTE BOM ITEMS
    CREATE TABLE IF NOT EXISTS quote_bom_items (
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
    );

    -- QUOTE VERSION HISTORY
    CREATE TABLE IF NOT EXISTS quote_versions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id        INTEGER NOT NULL REFERENCES quotes(id),
      version         INTEGER NOT NULL,
      snapshot_json   TEXT    NOT NULL,
      changed_by      INTEGER NOT NULL REFERENCES users(id),
      change_summary  TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- AUDIT LOG
    CREATE TABLE IF NOT EXISTS audit_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER REFERENCES users(id),
      action          TEXT    NOT NULL,
      entity_type     TEXT    NOT NULL,
      entity_id       INTEGER,
      old_value       TEXT,
      new_value       TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- QUOTE FLAGS & WARNINGS
    CREATE TABLE IF NOT EXISTS quote_flags (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id        INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      severity        TEXT    NOT NULL CHECK(severity IN ('info','warning','error')),
      code            TEXT    NOT NULL,
      message         TEXT    NOT NULL,
      is_blocking     INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- INDEXES
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number);
    CREATE INDEX IF NOT EXISTS idx_quote_bom_quote ON quote_bom_items(quote_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
  `);
}
