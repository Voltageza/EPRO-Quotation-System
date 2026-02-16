import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // =============================================
  // 1a. Deactivate old placeholder products
  // =============================================
  const deactivate = db.prepare("UPDATE products SET is_active = 0 WHERE sku = ?");
  for (const sku of ['ATESS1', 'ATESS2', 'ATESS-BAT1', 'SUNGROW1', 'SUNGROW2']) {
    deactivate.run(sku);
  }

  // =============================================
  // 1b. Insert real Atess HPS inverters
  // =============================================
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, unit, retail_price, brand, is_active)
    VALUES (?, ?, ?, 'each', ?, ?, 1)
  `);

  const insertInverter = db.prepare(`
    INSERT OR IGNORE INTO inverters (product_id, system_class, brand, rated_va, max_dc_voltage, ac_output_amps, has_mppt, has_battery_port, max_pv_input_w)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
  `);

  // ATT-HPS30: 30kW 3-phase hybrid
  insertProduct.run('ATT-HPS30', 'INVERTER ATESS HPS30 30kW 3PH HYBRID', 'inverter', 14053000, 'Atess');
  const attHps30 = db.prepare("SELECT id FROM products WHERE sku = 'ATT-HPS30'").get() as any;
  if (attHps30) insertInverter.run(attHps30.id, 'ATT5', 'Atess', 33000, 1000, 43, 45000);

  // ATT-HPS50: 50kW 3-phase hybrid
  insertProduct.run('ATT-HPS50', 'INVERTER ATESS HPS50 50kW 3PH HYBRID', 'inverter', 19028600, 'Atess');
  const attHps50 = db.prepare("SELECT id FROM products WHERE sku = 'ATT-HPS50'").get() as any;
  if (attHps50) insertInverter.run(attHps50.id, 'ATT10', 'Atess', 55000, 1000, 72, 75000);

  // =============================================
  // 1c. Insert real Atess batteries
  // =============================================
  const insertBattery = db.prepare(`
    INSERT OR IGNORE INTO batteries (product_id, capacity_kwh, voltage, max_charge_a, max_discharge_a, chemistry, brand)
    VALUES (?, ?, ?, ?, ?, 'LiFePO4', 'Atess')
  `);

  insertProduct.run('ATT-VS512', 'ATESS VOLTSTACK 5.12kWh MODULE LFP', 'battery', 2500000, 'Atess');
  const attVs512 = db.prepare("SELECT id FROM products WHERE sku = 'ATT-VS512'").get() as any;
  if (attVs512) insertBattery.run(attVs512.id, 5.12, 51.2, 100, 100);

  insertProduct.run('ATT-BR114', 'ATESS BR114R RACK 114.7kWh LFP', 'battery', 25000000, 'Atess');
  const attBr114 = db.prepare("SELECT id FROM products WHERE sku = 'ATT-BR114'").get() as any;
  if (attBr114) insertBattery.run(attBr114.id, 114.7, 409.6, 200, 200);

  insertProduct.run('ATT-BR143', 'ATESS BR143R RACK 143.4kWh LFP', 'battery', 30000000, 'Atess');
  const attBr143 = db.prepare("SELECT id FROM products WHERE sku = 'ATT-BR143'").get() as any;
  if (attBr143) insertBattery.run(attBr143.id, 143.4, 512, 200, 200);

  // =============================================
  // 1d. Insert real Sungrow hybrid inverters
  // =============================================
  const insertSungrowInv = db.prepare(`
    INSERT OR IGNORE INTO inverters (product_id, system_class, brand, rated_va, max_dc_voltage, ac_output_amps, has_mppt, has_battery_port, max_pv_input_w)
    VALUES (?, ?, 'Sungrow', ?, ?, ?, 1, 1, ?)
  `);

  // SH5.0RS — 5kW single-phase hybrid
  insertProduct.run('SG-SH5RS', 'INVERTER SUNGROW SH5.0RS 5kW HYBRID', 'inverter', 2127400, 'Sungrow');
  const sgSh5 = db.prepare("SELECT id FROM products WHERE sku = 'SG-SH5RS'").get() as any;
  if (sgSh5) insertSungrowInv.run(sgSh5.id, 'SG5', 5000, 600, 22.7, 12000);

  // SH8.0RS — 8kW single-phase hybrid
  insertProduct.run('SG-SH8RS', 'INVERTER SUNGROW SH8.0RS 8kW HYBRID', 'inverter', 3500000, 'Sungrow');
  const sgSh8 = db.prepare("SELECT id FROM products WHERE sku = 'SG-SH8RS'").get() as any;
  if (sgSh8) insertSungrowInv.run(sgSh8.id, 'SG8', 8000, 600, 36.3, 16000);

  // SH10RS — 10kW single-phase hybrid
  insertProduct.run('SG-SH10RS', 'INVERTER SUNGROW SH10RS 10kW HYBRID', 'inverter', 4128400, 'Sungrow');
  const sgSh10 = db.prepare("SELECT id FROM products WHERE sku = 'SG-SH10RS'").get() as any;
  if (sgSh10) insertSungrowInv.run(sgSh10.id, 'SG10', 10000, 600, 45.5, 16000);

  // SH10RT — 10kW three-phase hybrid
  insertProduct.run('SG-SH10RT', 'INVERTER SUNGROW SH10RT 10kW 3PH HYBRID', 'inverter', 4500000, 'Sungrow');
  const sgSh10rt = db.prepare("SELECT id FROM products WHERE sku = 'SG-SH10RT'").get() as any;
  if (sgSh10rt) insertSungrowInv.run(sgSh10rt.id, 'SG10RT', 10000, 1000, 16, 15000);

  // =============================================
  // 1e. Insert Sungrow SBR batteries
  // =============================================
  const insertSgBattery = db.prepare(`
    INSERT OR IGNORE INTO batteries (product_id, capacity_kwh, voltage, max_charge_a, max_discharge_a, chemistry, brand)
    VALUES (?, ?, ?, ?, ?, 'LiFePO4', 'Sungrow')
  `);

  insertProduct.run('SG-SBR064', 'SUNGROW SBR064 6.4kWh LFP', 'battery', 2800000, 'Sungrow');
  const sgBat64 = db.prepare("SELECT id FROM products WHERE sku = 'SG-SBR064'").get() as any;
  if (sgBat64) insertSgBattery.run(sgBat64.id, 6.4, 128, 30, 30);

  insertProduct.run('SG-SBR128', 'SUNGROW SBR128 12.8kWh LFP', 'battery', 5200000, 'Sungrow');
  const sgBat128 = db.prepare("SELECT id FROM products WHERE sku = 'SG-SBR128'").get() as any;
  if (sgBat128) insertSgBattery.run(sgBat128.id, 12.8, 256, 30, 30);

  insertProduct.run('SG-SBR256', 'SUNGROW SBR256 25.6kWh LFP', 'battery', 9800000, 'Sungrow');
  const sgBat256 = db.prepare("SELECT id FROM products WHERE sku = 'SG-SBR256'").get() as any;
  if (sgBat256) insertSgBattery.run(sgBat256.id, 25.6, 512, 30, 30);

  // =============================================
  // 1f. Fix Freedom battery brand
  // =============================================
  db.prepare("UPDATE batteries SET brand = 'FreedomWON' WHERE product_id = (SELECT id FROM products WHERE sku = 'BATT/FREE2')").run();
  db.prepare("UPDATE products SET brand = 'FreedomWON' WHERE sku = 'BATT/FREE2'").run();

  // =============================================
  // 1g. Add rule_entries for new system classes (SG8, SG10RT)
  // =============================================
  const acCableTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'ac_cable'").get() as any;
  const acProtTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'ac_protection'").get() as any;
  const labourTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'labour'").get() as any;
  const dcBatteryTable = db.prepare("SELECT id FROM rule_tables WHERE rule_type = 'dc_battery_cable'").get() as any;

  const insertEntry = db.prepare(`
    INSERT INTO rule_entries (rule_table_id, system_class, condition_json, result_json, sort_order, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  if (acCableTable) {
    // SG8 AC cables — 10mm (single-phase 8kW, ~36A)
    insertEntry.run(acCableTable.id, 'SG8',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'W/PAN10', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '10mm 4-core for SG8' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 14, 'SG8 AC cable');

    // SG10RT AC cables — 16mm (three-phase 10kW, 16A per phase)
    insertEntry.run(acCableTable.id, 'SG10RT',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'P/W16', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '16mm 4-core for SG10RT 3-phase' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 15, 'SG10RT AC cable');
  }

  if (acProtTable) {
    // SG8 AC protection (hybrid — 2 breakers + changeover)
    insertEntry.run(acProtTable.id, 'SG8',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 2, section: 'ac_protection', note: '2x 63A DP breakers (hybrid)' },
          { sku: 'C/OVER4', qty: 1, section: 'ac_protection', note: '63A changeover switch' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' },
          { sku: 'SVN121', qty: 1, section: 'ac_protection' },
          { sku: 'SVN122', qty: 1, section: 'ac_protection' }
        ]
      }), 14, 'SG8 AC protection (hybrid)');

    // SG10RT AC protection (hybrid 3-phase — 2 breakers + changeover)
    insertEntry.run(acProtTable.id, 'SG10RT',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 2, section: 'ac_protection', note: '2x 63A DP breakers (3PH hybrid)' },
          { sku: 'C/OVER4', qty: 1, section: 'ac_protection', note: '63A changeover switch' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' },
          { sku: 'SVN121', qty: 1, section: 'ac_protection' },
          { sku: 'SVN122', qty: 1, section: 'ac_protection' }
        ]
      }), 15, 'SG10RT AC protection (hybrid 3-phase)');
  }

  if (labourTable) {
    // SG8 labour (hybrid with battery)
    insertEntry.run(labourTable.id, 'SG8',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 8, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 2 }),
      14, 'SG8 labour (hybrid)');

    // SG10RT labour (3-phase hybrid)
    insertEntry.run(labourTable.id, 'SG10RT',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 10, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 2 }),
      15, 'SG10RT labour (3-phase hybrid)');
  }

  // =============================================
  // 1h. Add DC battery rules for SG5/SG10 (now hybrid, previously grid-tie)
  //     and SG8, SG10RT
  // =============================================
  if (dcBatteryTable) {
    // SG5 DC battery cable
    insertEntry.run(dcBatteryTable.id, 'SG5',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '35mm battery cable' },
          { sku: 'FU/MEGA', qty: 1, section: 'dc_battery', note: '250A Mega fuse' },
          { sku: 'FU/HOL', qty: 1, section: 'dc_battery', note: 'Mega fuse holder' }
        ],
        flags: [{ condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m' }]
      }), 20, 'SG5 DC battery cable (hybrid)');

    // SG8 DC battery cable
    insertEntry.run(dcBatteryTable.id, 'SG8',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '35mm battery cable' },
          { sku: 'FU/MEGA', qty: 1, section: 'dc_battery', note: '250A Mega fuse' },
          { sku: 'FU/HOL', qty: 1, section: 'dc_battery', note: 'Mega fuse holder' }
        ],
        flags: [{ condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m' }]
      }), 21, 'SG8 DC battery cable (hybrid)');

    // SG10 DC battery cable
    insertEntry.run(dcBatteryTable.id, 'SG10',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '35mm battery cable' },
          { sku: 'FU/MEGA', qty: 1, section: 'dc_battery', note: '250A Mega fuse' },
          { sku: 'FU/HOL', qty: 1, section: 'dc_battery', note: 'Mega fuse holder' }
        ],
        flags: [{ condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m' }]
      }), 22, 'SG10 DC battery cable (hybrid)');

    // SG10RT DC battery cable
    insertEntry.run(dcBatteryTable.id, 'SG10RT',
      JSON.stringify({ distance_min: 0, distance_max: 999 }),
      JSON.stringify({
        items: [
          { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '35mm battery cable' },
          { sku: 'FU/MEGA', qty: 1, section: 'dc_battery', note: '250A Mega fuse' },
          { sku: 'FU/HOL', qty: 1, section: 'dc_battery', note: 'Mega fuse holder' }
        ],
        flags: [{ condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m' }]
      }), 23, 'SG10RT DC battery cable (hybrid)');
  }

  // =============================================
  // 1i. Update SG5/SG10 AC protection: grid-tie → hybrid
  //     Delete old entries and re-insert with hybrid config
  // =============================================
  if (acProtTable) {
    db.prepare("DELETE FROM rule_entries WHERE rule_table_id = ? AND system_class = 'SG5'").run(acProtTable.id);
    db.prepare("DELETE FROM rule_entries WHERE rule_table_id = ? AND system_class = 'SG10'").run(acProtTable.id);

    // SG5 AC protection (hybrid — 2 breakers + changeover)
    insertEntry.run(acProtTable.id, 'SG5',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 2, section: 'ac_protection', note: '2x 63A DP breakers (hybrid)' },
          { sku: 'C/OVER4', qty: 1, section: 'ac_protection', note: '63A changeover switch' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' },
          { sku: 'SVN121', qty: 1, section: 'ac_protection' },
          { sku: 'SVN122', qty: 1, section: 'ac_protection' }
        ]
      }), 12, 'SG5 AC protection (hybrid)');

    // SG10 AC protection (hybrid — 2 breakers + changeover)
    insertEntry.run(acProtTable.id, 'SG10',
      JSON.stringify({}),
      JSON.stringify({
        items: [
          { sku: 'CIR18', qty: 2, section: 'ac_protection', note: '2x 63A DP breakers (hybrid)' },
          { sku: 'C/OVER4', qty: 1, section: 'ac_protection', note: '63A changeover switch' },
          { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
          { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' },
          { sku: 'SVN121', qty: 1, section: 'ac_protection' },
          { sku: 'SVN122', qty: 1, section: 'ac_protection' }
        ]
      }), 13, 'SG10 AC protection (hybrid)');
  }

  // =============================================
  // 1j. Update SG5/SG10 labour: add battery_adder_hours
  // =============================================
  if (labourTable) {
    db.prepare("DELETE FROM rule_entries WHERE rule_table_id = ? AND system_class = 'SG5'").run(labourTable.id);
    db.prepare("DELETE FROM rule_entries WHERE rule_table_id = ? AND system_class = 'SG10'").run(labourTable.id);

    // SG5 labour (hybrid with battery)
    insertEntry.run(labourTable.id, 'SG5',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 6, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 1 }),
      12, 'SG5 labour (hybrid)');

    // SG10 labour (hybrid with battery)
    insertEntry.run(labourTable.id, 'SG10',
      JSON.stringify({}),
      JSON.stringify({ base_hours: 8, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 2 }),
      13, 'SG10 labour (hybrid)');
  }

  // =============================================
  // 1k. Update ATT5/ATT10 AC cable rules
  //     ATT5 (30kW 43A 3PH) → 16mm cable
  //     ATT10 (50kW 72A 3PH) → 25mm cable (new P/W25 product)
  // =============================================

  // Add P/W25 product (25mm 4-core cable)
  insertProduct.run('P/W25', 'CABLE 25mm² 4-CORE PVC/PVC', 'cable', 6500, 'Generic');

  if (acCableTable) {
    // Delete old ATT5/ATT10 AC cable rules and re-insert
    db.prepare("DELETE FROM rule_entries WHERE rule_table_id = ? AND system_class = 'ATT5'").run(acCableTable.id);
    db.prepare("DELETE FROM rule_entries WHERE rule_table_id = ? AND system_class = 'ATT10'").run(acCableTable.id);

    // ATT5 → 16mm cable (43A 3-phase)
    insertEntry.run(acCableTable.id, 'ATT5',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'P/W16', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '16mm 4-core for ATT5 (30kW 3PH)' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 10, 'ATT5 AC cable (16mm)');

    // ATT10 → 25mm cable (72A 3-phase)
    insertEntry.run(acCableTable.id, 'ATT10',
      JSON.stringify({ distance_min: 0, distance_max: 30 }),
      JSON.stringify({
        items: [{ sku: 'P/W25', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '25mm 4-core for ATT10 (50kW 3PH)' }],
        flags: [{ condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m' }]
      }), 11, 'ATT10 AC cable (25mm)');
  }

  // =============================================
  // 1l. Add mppt_count column to inverters table
  // =============================================
  try {
    db.exec("ALTER TABLE inverters ADD COLUMN mppt_count INTEGER NOT NULL DEFAULT 1");
  } catch (e) {
    // Column may already exist
  }

  // Set mppt_count values for each system class
  // Victron V5-V15: 1 MPPT (external MPPTs are separate nodes)
  // Already defaults to 1

  // Atess HPS: 1 integrated MPPT tracker
  // Already defaults to 1

  // Sungrow SH RS/RT: multiple MPPT trackers
  db.prepare("UPDATE inverters SET mppt_count = 2 WHERE system_class = 'SG5'").run();
  db.prepare("UPDATE inverters SET mppt_count = 3 WHERE system_class = 'SG8'").run();
  db.prepare("UPDATE inverters SET mppt_count = 4 WHERE system_class = 'SG10'").run();
  db.prepare("UPDATE inverters SET mppt_count = 2 WHERE system_class = 'SG10RT'").run();
}
