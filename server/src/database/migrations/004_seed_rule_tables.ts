import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  const adminId = 1; // admin user

  const insertRuleTable = db.prepare(`
    INSERT INTO rule_tables (rule_type, version, is_active, created_by) VALUES (?, 1, 1, ?)
  `);

  const insertEntry = db.prepare(`
    INSERT INTO rule_entries (rule_table_id, system_class, condition_json, result_json, sort_order, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // =============================================
  // DC BATTERY CABLE RULES
  // Cable size and fuse per system class
  // =============================================
  const dcBattery = insertRuleTable.run('dc_battery_cable', adminId);
  const dcBatteryId = dcBattery.lastInsertRowid;

  // V5: 35mm cable, 250A Mega fuse
  insertEntry.run(dcBatteryId, 'V5',
    JSON.stringify({ distance_min: 0, distance_max: 999 }),
    JSON.stringify({
      items: [
        { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery', note: '35mm battery cable' },
        { sku: 'FU/MEGA', qty: 1, section: 'dc_battery', note: '250A Mega fuse' },
        { sku: 'FU/HOL', qty: 1, section: 'dc_battery', note: 'Mega fuse holder' }
      ],
      flags: [
        { condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m — verify voltage drop is acceptable' }
      ]
    }), 1, 'V5 DC battery cable — 35mm welding cable');

  // V8: 35mm cable, 300A fuse
  insertEntry.run(dcBatteryId, 'V8',
    JSON.stringify({ distance_min: 0, distance_max: 999 }),
    JSON.stringify({
      items: [
        { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery' },
        { sku: 'FU/MEGA', qty: 1, section: 'dc_battery' },
        { sku: 'FU/HOL', qty: 1, section: 'dc_battery' }
      ],
      flags: [
        { condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m — verify voltage drop is acceptable' }
      ]
    }), 2, 'V8 DC battery cable — 35mm welding cable');

  // V10: 35mm cable, 400/500A ANL fuse
  insertEntry.run(dcBatteryId, 'V10',
    JSON.stringify({ distance_min: 0, distance_max: 999 }),
    JSON.stringify({
      items: [
        { sku: 'C/CAB', qty_formula: 'distance_m * 2', section: 'dc_battery' },
        { sku: 'FU9', qty: 1, section: 'dc_battery', note: '400/500A ANL fuse' },
        { sku: 'FU10', qty: 1, section: 'dc_battery', note: 'ANL fuse holder' }
      ],
      flags: [
        { condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m — verify voltage drop is acceptable' }
      ]
    }), 3, 'V10 DC battery cable — 35mm welding cable, ANL fuse');

  // V15: 50mm cable (or 2x 35mm), 500A fuse
  insertEntry.run(dcBatteryId, 'V15',
    JSON.stringify({ distance_min: 0, distance_max: 999 }),
    JSON.stringify({
      items: [
        { sku: 'C/CAB', qty_formula: 'distance_m * 4', section: 'dc_battery', note: '2x 35mm runs (pos+neg) for V15' },
        { sku: 'FU9', qty: 2, section: 'dc_battery', note: '2x ANL fuse for parallel cables' },
        { sku: 'FU10', qty: 2, section: 'dc_battery' }
      ],
      flags: [
        { condition: 'distance_m > 3', code: 'DC_BATTERY_OVER_3M', severity: 'warning', message: 'DC battery cable exceeds 3m — verify voltage drop is acceptable' }
      ]
    }), 4, 'V15 DC battery cable — 2x 35mm welding cable runs');

  // =============================================
  // AC CABLE RULES
  // Cable size per system class + distance bucket
  // =============================================
  const acCable = insertRuleTable.run('ac_cable', adminId);
  const acCableId = acCable.lastInsertRowid;

  // V5 AC cables
  insertEntry.run(acCableId, 'V5',
    JSON.stringify({ distance_min: 0, distance_max: 30 }),
    JSON.stringify({
      items: [
        { sku: 'W/PAN10', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '10mm 4-core (L,N,E,N) for V5' }
      ],
      flags: [
        { condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m — verify voltage drop' }
      ]
    }), 1, 'V5 AC cable — 10mm panel wire');

  // V8 AC cables
  insertEntry.run(acCableId, 'V8',
    JSON.stringify({ distance_min: 0, distance_max: 30 }),
    JSON.stringify({
      items: [
        { sku: 'P/W16', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '16mm 4-core for V8' }
      ],
      flags: [
        { condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m — verify voltage drop' }
      ]
    }), 2, 'V8 AC cable — 16mm panel wire');

  // V10 AC cables
  insertEntry.run(acCableId, 'V10',
    JSON.stringify({ distance_min: 0, distance_max: 30 }),
    JSON.stringify({
      items: [
        { sku: 'P/W16', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '16mm 4-core for V10' }
      ],
      flags: [
        { condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m — verify voltage drop' }
      ]
    }), 3, 'V10 AC cable — 16mm panel wire');

  // V15 AC cables
  insertEntry.run(acCableId, 'V15',
    JSON.stringify({ distance_min: 0, distance_max: 30 }),
    JSON.stringify({
      items: [
        { sku: 'P/W16', qty_formula: 'ac_total_m * 4', section: 'ac_cabling', note: '16mm 4-core for V15 (consider 25mm for long runs)' }
      ],
      flags: [
        { condition: 'ac_total_m > 30', code: 'AC_OVER_30M', severity: 'warning', message: 'AC cable run exceeds 30m — consider upgrading to 25mm cable' }
      ]
    }), 4, 'V15 AC cable — 16mm panel wire');

  // =============================================
  // AC PROTECTION RULES
  // Breakers, changeover, SPD per system class
  // =============================================
  const acProtection = insertRuleTable.run('ac_protection', adminId);
  const acProtectionId = acProtection.lastInsertRowid;

  // V5 AC protection
  insertEntry.run(acProtectionId, 'V5',
    JSON.stringify({}),
    JSON.stringify({
      items: [
        { sku: 'CIR18', qty: 2, section: 'ac_protection', note: '2x 63A DP breakers (grid + inverter)' },
        { sku: 'C/OVER4', qty: 1, section: 'ac_protection', note: '63A changeover switch' },
        { sku: 'SUR/AC', qty: 1, section: 'ac_protection', note: 'AC surge protection' },
        { sku: 'ENCLVE', qty: 1, section: 'ac_protection', note: '18-way DB enclosure' },
        { sku: 'SVN121', qty: 1, section: 'ac_protection', note: 'Green pilot (grid)' },
        { sku: 'SVN122', qty: 1, section: 'ac_protection', note: 'Red pilot (inverter)' }
      ]
    }), 1, 'V5 AC protection');

  // V8 AC protection
  insertEntry.run(acProtectionId, 'V8',
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
    }), 2, 'V8 AC protection');

  // V10 AC protection
  insertEntry.run(acProtectionId, 'V10',
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
    }), 3, 'V10 AC protection');

  // V15 AC protection
  insertEntry.run(acProtectionId, 'V15',
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
    }), 4, 'V15 AC protection');

  // =============================================
  // LABOUR RULES
  // Base hours per system class + adders
  // =============================================
  const labour = insertRuleTable.run('labour', adminId);
  const labourId = labour.lastInsertRowid;

  insertEntry.run(labourId, 'V5',
    JSON.stringify({}),
    JSON.stringify({ base_hours: 8, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 2 }),
    1, 'V5 labour — 8 base + 2 per battery + 2 per 6 panels + 2 programming');

  insertEntry.run(labourId, 'V8',
    JSON.stringify({}),
    JSON.stringify({ base_hours: 10, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 2 }),
    2, 'V8 labour — 10 base');

  insertEntry.run(labourId, 'V10',
    JSON.stringify({}),
    JSON.stringify({ base_hours: 12, battery_adder_hours: 2, panels_per_adder: 6, panel_adder_hours: 2, programming_hours: 3 }),
    3, 'V10 labour — 12 base');

  insertEntry.run(labourId, 'V15',
    JSON.stringify({}),
    JSON.stringify({ base_hours: 16, battery_adder_hours: 3, panels_per_adder: 6, panel_adder_hours: 3, programming_hours: 4 }),
    4, 'V15 labour — 16 base');

  // =============================================
  // MOUNTING RULES
  // Standard parameters for roof mount calculation
  // =============================================
  const mounting = insertRuleTable.run('mounting', adminId);
  const mountingId = mounting.lastInsertRowid;

  insertEntry.run(mountingId, null,
    JSON.stringify({}),
    JSON.stringify({
      rail_length_mm: 5850,
      brackets_per_rail: 4,
      panels_landscape: true,
      end_clamp_sku: 'SOLAR40',
      mid_clamp_sku: 'SOLAR39',
      rail_sku: 'SOLAR42',
      joiner_sku: 'SOLAR41',
      bracket_sku: 'SOLAR43',
      hangerbolt_sku: 'SOLAR44'
    }),
    1, 'Standard mounting parameters — landscape orientation');
}
