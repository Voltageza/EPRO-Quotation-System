import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, unit, retail_price, brand, is_active)
    VALUES (?, ?, ?, 'each', ?, ?, 1)
  `);

  const insertInverter = db.prepare(`
    INSERT INTO inverters (product_id, system_class, brand, rated_va, max_dc_voltage, ac_output_amps, dc_input_amps, has_mppt, has_battery_port, max_pv_input_w, mppt_count)
    VALUES (?, ?, 'Atess', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBattery = db.prepare(`
    INSERT INTO batteries (product_id, capacity_kwh, voltage, max_charge_a, max_discharge_a, chemistry, brand)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // =============================================
  // 1a. Atess HPS Inverters (5 models)
  // =============================================
  const atessInverters = [
    { sku: 'ATESS/HPS30',  name: 'INVERTER ATESS HPS30 30kW 3PH HYBRID',   class: 'ATT30',  va: 33000,  maxDc: 1000, acA: 43,  dcA: 100, pvW: 45000,  mpptCount: 2 },
    { sku: 'ATESS/HPS50',  name: 'INVERTER ATESS HPS50 50kW 3PH HYBRID',   class: 'ATT50',  va: 55000,  maxDc: 1000, acA: 72,  dcA: 150, pvW: 75000,  mpptCount: 4 },
    { sku: 'ATESS/HPS100', name: 'INVERTER ATESS HPS100 100kW 3PH HYBRID', class: 'ATT100', va: 110000, maxDc: 1000, acA: 144, dcA: 300, pvW: 150000, mpptCount: 6 },
    { sku: 'ATESS/HPS120', name: 'INVERTER ATESS HPS120 120kW 3PH HYBRID', class: 'ATT120', va: 132000, maxDc: 1000, acA: 173, dcA: 350, pvW: 180000, mpptCount: 8 },
    { sku: 'ATESS/HPS150', name: 'INVERTER ATESS HPS150 150kW 3PH HYBRID', class: 'ATT150', va: 165000, maxDc: 1000, acA: 217, dcA: 450, pvW: 225000, mpptCount: 10 },
  ];

  for (const inv of atessInverters) {
    insertProduct.run(inv.sku, inv.name, 'inverter', 0, 'Atess');
    const product = db.prepare("SELECT id FROM products WHERE sku = ?").get(inv.sku) as any;
    if (product) {
      insertInverter.run(product.id, inv.class, inv.va, inv.maxDc, inv.acA, inv.dcA, 1, 1, inv.pvW, inv.mpptCount);
    }
  }

  // =============================================
  // 1b. FreedomWON LiTE Commercial HV Batteries (5 models)
  // =============================================
  const hvBatteries = [
    { sku: 'BATT/FW100HV', name: 'BATTERY FREEDOMWON LiTE 100/80 HV',  kwh: 100, v: 512, chargeA: 200, dischargeA: 200 },
    { sku: 'BATT/FW200HV', name: 'BATTERY FREEDOMWON LiTE 200/160 HV', kwh: 200, v: 512, chargeA: 300, dischargeA: 300 },
    { sku: 'BATT/FW300HV', name: 'BATTERY FREEDOMWON LiTE 300/240 HV', kwh: 300, v: 512, chargeA: 700, dischargeA: 700 },
    { sku: 'BATT/FW400HV', name: 'BATTERY FREEDOMWON LiTE 400/320 HV', kwh: 400, v: 512, chargeA: 700, dischargeA: 700 },
    { sku: 'BATT/FW500HV', name: 'BATTERY FREEDOMWON LiTE 500/400 HV', kwh: 500, v: 512, chargeA: 700, dischargeA: 700 },
  ];

  for (const bat of hvBatteries) {
    insertProduct.run(bat.sku, bat.name, 'battery', 0, 'Atess');
    const product = db.prepare("SELECT id FROM products WHERE sku = ?").get(bat.sku) as any;
    if (product) {
      insertBattery.run(product.id, bat.kwh, bat.v, bat.chargeA, bat.dischargeA, 'LiFePO4', 'Atess');
    }
  }

  // =============================================
  // 1c. New cable and protection products (commercial 3-phase)
  // =============================================
  const genericProducts = [
    // Cables
    { sku: 'C/CAB50',   name: 'CABLE WELDING 50mm',              category: 'cable' },
    { sku: 'C/CAB70',   name: 'CABLE WELDING 70mm',              category: 'cable' },
    { sku: 'C/CAB95',   name: 'CABLE WELDING 95mm',              category: 'cable' },
    { sku: 'C/CAB150',  name: 'CABLE WELDING 150mm',             category: 'cable' },
    { sku: 'C/CAB185',  name: 'CABLE WELDING 185mm',             category: 'cable' },
    { sku: 'P/W70',     name: 'WIRE PANEL 70mm 4-CORE',          category: 'cable' },
    { sku: 'P/W95',     name: 'WIRE PANEL 95mm 4-CORE',          category: 'cable' },
    { sku: 'P/W150',    name: 'WIRE PANEL 150mm 4-CORE',         category: 'cable' },
    // Protection
    { sku: 'CIR/3P63',  name: 'BREAKER 3-POLE 63A',             category: 'protection' },
    { sku: 'CIR/3P100', name: 'BREAKER 3-POLE 100A',            category: 'protection' },
    { sku: 'CIR/3P160', name: 'BREAKER MCCB 3-POLE 160A',       category: 'protection' },
    { sku: 'CIR/3P200', name: 'BREAKER MCCB 3-POLE 200A',       category: 'protection' },
    { sku: 'CIR/3P250', name: 'BREAKER MCCB 3-POLE 250A',       category: 'protection' },
    { sku: 'C/OVER3P',  name: 'CHANGEOVER SWITCH 3-POLE MOTORISED', category: 'protection' },
    { sku: 'SUR/AC3P',  name: 'SURGE ARRESTOR AC 400V 3P+N',    category: 'protection' },
    { sku: 'FU/HV',     name: 'FUSE HV DC 500A gG',             category: 'protection' },
    { sku: 'FU/HVHOL',  name: 'FUSE HOLDER HV DC NH',           category: 'protection' },
    { sku: 'RCD/4P',    name: 'RCD EARTH LEAKAGE 4P 63A 30mA',  category: 'protection' },
  ];

  for (const p of genericProducts) {
    insertProduct.run(p.sku, p.name, p.category, 0, 'Generic');
  }

  // Atess communication cable
  insertProduct.run('ATESS/COM', 'ATESS CAN/RS485 COMMUNICATION CABLE', 'accessory', 0, 'Atess');

  // =============================================
  // 1d. Rule table entries (append to existing rule tables)
  // =============================================
  const insertEntry = db.prepare(`
    INSERT INTO rule_entries (rule_table_id, system_class, condition_json, result_json, sort_order, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Find existing rule table IDs
  const getRuleTableId = (ruleType: string): number => {
    const row = db.prepare("SELECT id FROM rule_tables WHERE rule_type = ? AND is_active = 1").get(ruleType) as any;
    return row?.id || 0;
  };

  const dcBatteryId = getRuleTableId('dc_battery_cable');
  const acCableId = getRuleTableId('ac_cable');
  const acProtectionId = getRuleTableId('ac_protection');
  const labourId = getRuleTableId('labour');

  // --- DC Battery Cable Rules ---
  if (dcBatteryId) {
    // ATT30 (93A): 35mm cable
    insertEntry.run(dcBatteryId, 'ATT30',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '35mm HV battery cable' },
          { sku: 'FU/HV', qty: 1, section: 'dc_battery', note: 'HV DC fuse' },
          { sku: 'FU/HVHOL', qty: 1, section: 'dc_battery', note: 'HV DC fuse holder' }
        ],
        flags: [
          { condition: 'distance_m > 5', code: 'DC_BATTERY_OVER_5M', severity: 'warning', message: 'HV DC battery cable exceeds 5m — verify voltage drop' }
        ]
      }), 10, 'ATT30 DC battery cable — 35mm welding cable');

    // ATT50 (156A): 70mm cable
    insertEntry.run(dcBatteryId, 'ATT50',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB70', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '70mm HV battery cable' },
          { sku: 'FU/HV', qty: 1, section: 'dc_battery', note: 'HV DC fuse' },
          { sku: 'FU/HVHOL', qty: 1, section: 'dc_battery', note: 'HV DC fuse holder' }
        ],
        flags: [
          { condition: 'distance_m > 5', code: 'DC_BATTERY_OVER_5M', severity: 'warning', message: 'HV DC battery cable exceeds 5m — verify voltage drop' }
        ]
      }), 11, 'ATT50 DC battery cable — 70mm welding cable');

    // ATT100 (313A): 150mm cable
    insertEntry.run(dcBatteryId, 'ATT100',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB150', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '150mm HV battery cable' },
          { sku: 'FU/HV', qty: 2, section: 'dc_battery', note: '2x HV DC fuse' },
          { sku: 'FU/HVHOL', qty: 2, section: 'dc_battery', note: '2x HV DC fuse holder' }
        ],
        flags: [
          { condition: 'distance_m > 5', code: 'DC_BATTERY_OVER_5M', severity: 'warning', message: 'HV DC battery cable exceeds 5m — verify voltage drop' }
        ]
      }), 12, 'ATT100 DC battery cable — 150mm welding cable');

    // ATT120 (374A): 185mm cable
    insertEntry.run(dcBatteryId, 'ATT120',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB185', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '185mm HV battery cable' },
          { sku: 'FU/HV', qty: 2, section: 'dc_battery', note: '2x HV DC fuse' },
          { sku: 'FU/HVHOL', qty: 2, section: 'dc_battery', note: '2x HV DC fuse holder' }
        ],
        flags: [
          { condition: 'distance_m > 5', code: 'DC_BATTERY_OVER_5M', severity: 'warning', message: 'HV DC battery cable exceeds 5m — verify voltage drop' }
        ]
      }), 13, 'ATT120 DC battery cable — 185mm welding cable');

    // ATT150 (467A): 2x 185mm parallel runs
    insertEntry.run(dcBatteryId, 'ATT150',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB185', qty_formula: 'distance_m * 4', section: 'dc_battery', note: '2x 185mm HV battery cable (parallel runs)' },
          { sku: 'FU/HV', qty: 4, section: 'dc_battery', note: '4x HV DC fuse (2 per run)' },
          { sku: 'FU/HVHOL', qty: 4, section: 'dc_battery', note: '4x HV DC fuse holder' }
        ],
        flags: [
          { condition: 'distance_m > 5', code: 'DC_BATTERY_OVER_5M', severity: 'warning', message: 'HV DC battery cable exceeds 5m — verify voltage drop' }
        ]
      }), 14, 'ATT150 DC battery cable — 2x 185mm parallel runs');
  }

  // --- AC Cable Rules (3-phase) ---
  if (acCableId) {
    // ATT30 (43A): 10mm 4-core
    insertEntry.run(acCableId, 'ATT30',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'W/PAN10', qty_formula: 'ac_total_m', section: 'ac_cabling', note: '10mm 4-core 3-phase cable for ATT30' }
        ],
        flags: [
          { condition: 'ac_total_m > 50', code: 'AC_OVER_50M', severity: 'warning', message: 'AC cable run exceeds 50m — verify voltage drop for 3-phase' }
        ]
      }), 10, 'ATT30 AC cable — 10mm panel wire (3-phase)');

    // ATT50 (72A): 25mm 4-core
    insertEntry.run(acCableId, 'ATT50',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'P/W25', qty_formula: 'ac_total_m', section: 'ac_cabling', note: '25mm 4-core 3-phase cable for ATT50' }
        ],
        flags: [
          { condition: 'ac_total_m > 50', code: 'AC_OVER_50M', severity: 'warning', message: 'AC cable run exceeds 50m — verify voltage drop for 3-phase' }
        ]
      }), 11, 'ATT50 AC cable — 25mm panel wire (3-phase)');

    // ATT100 (144A): 70mm 4-core
    insertEntry.run(acCableId, 'ATT100',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'P/W70', qty_formula: 'ac_total_m', section: 'ac_cabling', note: '70mm 4-core 3-phase cable for ATT100' }
        ],
        flags: [
          { condition: 'ac_total_m > 50', code: 'AC_OVER_50M', severity: 'warning', message: 'AC cable run exceeds 50m — verify voltage drop for 3-phase' }
        ]
      }), 12, 'ATT100 AC cable — 70mm panel wire (3-phase)');

    // ATT120 (173A): 95mm 4-core
    insertEntry.run(acCableId, 'ATT120',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'P/W95', qty_formula: 'ac_total_m', section: 'ac_cabling', note: '95mm 4-core 3-phase cable for ATT120' }
        ],
        flags: [
          { condition: 'ac_total_m > 50', code: 'AC_OVER_50M', severity: 'warning', message: 'AC cable run exceeds 50m — verify voltage drop for 3-phase' }
        ]
      }), 13, 'ATT120 AC cable — 95mm panel wire (3-phase)');

    // ATT150 (217A): 150mm 4-core
    insertEntry.run(acCableId, 'ATT150',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'P/W150', qty_formula: 'ac_total_m', section: 'ac_cabling', note: '150mm 4-core 3-phase cable for ATT150' }
        ],
        flags: [
          { condition: 'ac_total_m > 50', code: 'AC_OVER_50M', severity: 'warning', message: 'AC cable run exceeds 50m — verify voltage drop for 3-phase' }
        ]
      }), 14, 'ATT150 AC cable — 150mm panel wire (3-phase)');
  }

  // --- AC Protection Rules (3-pole breakers) ---
  if (acProtectionId) {
    insertEntry.run(acProtectionId, 'ATT30',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR/3P63', qty: 2, section: 'ac_protection', note: '2x 63A 3-pole breakers (grid + inverter)' },
          { sku: 'C/OVER3P', qty: 1, section: 'ac_protection', note: '3-pole motorised changeover switch' },
          { sku: 'SUR/AC3P', qty: 1, section: 'ac_protection', note: 'AC surge arrestor 400V 3P+N' }
        ]
      }), 10, 'ATT30 AC protection — 3-pole 63A');

    insertEntry.run(acProtectionId, 'ATT50',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR/3P100', qty: 2, section: 'ac_protection', note: '2x 100A 3-pole breakers' },
          { sku: 'C/OVER3P', qty: 1, section: 'ac_protection', note: '3-pole motorised changeover switch' },
          { sku: 'SUR/AC3P', qty: 1, section: 'ac_protection', note: 'AC surge arrestor 400V 3P+N' }
        ]
      }), 11, 'ATT50 AC protection — 3-pole 100A');

    insertEntry.run(acProtectionId, 'ATT100',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR/3P160', qty: 2, section: 'ac_protection', note: '2x 160A MCCB 3-pole breakers' },
          { sku: 'C/OVER3P', qty: 1, section: 'ac_protection', note: '3-pole motorised changeover switch' },
          { sku: 'SUR/AC3P', qty: 1, section: 'ac_protection', note: 'AC surge arrestor 400V 3P+N' }
        ]
      }), 12, 'ATT100 AC protection — MCCB 3-pole 160A');

    insertEntry.run(acProtectionId, 'ATT120',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR/3P200', qty: 2, section: 'ac_protection', note: '2x 200A MCCB 3-pole breakers' },
          { sku: 'C/OVER3P', qty: 1, section: 'ac_protection', note: '3-pole motorised changeover switch' },
          { sku: 'SUR/AC3P', qty: 1, section: 'ac_protection', note: 'AC surge arrestor 400V 3P+N' }
        ]
      }), 13, 'ATT120 AC protection — MCCB 3-pole 200A');

    insertEntry.run(acProtectionId, 'ATT150',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR/3P250', qty: 2, section: 'ac_protection', note: '2x 250A MCCB 3-pole breakers' },
          { sku: 'C/OVER3P', qty: 1, section: 'ac_protection', note: '3-pole motorised changeover switch' },
          { sku: 'SUR/AC3P', qty: 1, section: 'ac_protection', note: 'AC surge arrestor 400V 3P+N' }
        ]
      }), 14, 'ATT150 AC protection — MCCB 3-pole 250A');
  }

  // --- Labour Rules (commercial — higher base hours) ---
  if (labourId) {
    insertEntry.run(labourId, 'ATT30',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 16, battery_adder_hours: 4, panels_per_adder: 10, panel_adder_hours: 3, programming_hours: 4 }),
      10, 'ATT30 labour — 16 base + 4 per battery + 3 per 10 panels + 4 programming');

    insertEntry.run(labourId, 'ATT50',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 24, battery_adder_hours: 4, panels_per_adder: 10, panel_adder_hours: 3, programming_hours: 4 }),
      11, 'ATT50 labour — 24 base');

    insertEntry.run(labourId, 'ATT100',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 40, battery_adder_hours: 6, panels_per_adder: 10, panel_adder_hours: 4, programming_hours: 6 }),
      12, 'ATT100 labour — 40 base');

    insertEntry.run(labourId, 'ATT120',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 48, battery_adder_hours: 6, panels_per_adder: 10, panel_adder_hours: 4, programming_hours: 6 }),
      13, 'ATT120 labour — 48 base');

    insertEntry.run(labourId, 'ATT150',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 56, battery_adder_hours: 8, panels_per_adder: 10, panel_adder_hours: 4, programming_hours: 8 }),
      14, 'ATT150 labour — 56 base');
  }

  // =============================================
  // 1e. Fix FreedomWON 15kWh battery brand for Victron filtering
  // =============================================
  db.prepare("UPDATE batteries SET brand = 'Victron' WHERE product_id = (SELECT id FROM products WHERE sku = 'BATT/FREE2')").run();

  // =============================================
  // 1f. Ensure Atess inverter brand is correct (safety fix)
  // =============================================
  db.prepare("UPDATE inverters SET brand = 'Atess' WHERE system_class LIKE 'ATT%'").run();
}
