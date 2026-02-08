import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';

export function up(db: Database.Database): void {
  // Seed default admin user (password: changeme)
  const hash = bcryptjs.hashSync('changeme', 10);
  db.prepare(`
    INSERT OR IGNORE INTO users (username, display_name, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('admin', 'Administrator', hash, 'admin');

  // Seed pricing config singleton
  db.prepare(`
    INSERT OR IGNORE INTO pricing_config (id, pricing_factor, vat_rate, min_margin, travel_rate, labour_rate)
    VALUES (1, 0.72, 0.15, 0.15, 495, 49500)
  `).run();

  // Seed products from Sales Order HTM data
  // Prices stored in cents (multiply rand value by 100)
  const products = [
    // Panels
    ['SOLAR48', 'SOLAR PANEL JA 610w BiFacial', 'panel', null, 'each', 175680],
    // Mounting
    ['SOLAR40', 'SOLAR END CLAMP CLICK AA', 'mounting', 'end_clamp', 'each', 2446],
    ['SOLAR39', 'SOLAR MID CLAMP CLICK AA', 'mounting', 'mid_clamp', 'each', 2656],
    ['SOLAR42', 'SOLAR ALUMINIUM RAIL (5.85m) AA', 'mounting', 'rail', 'each', 65931],
    ['SOLAR41', 'SOLAR SPLICE JOINER AA', 'mounting', 'joiner', 'each', 3818],
    ['SOLAR43', 'SOLAR L-BRACKET AA', 'mounting', 'bracket', 'each', 2862],
    ['SOLAR44', 'SOLAR HANGERBOLT L-BRACKET AA', 'mounting', 'hangerbolt', 'each', 11000],
    // Connectors & Accessories
    ['SOLAR1', 'SOLAR MALE CONNECTOR MC4-MAL', 'accessory', 'mc4', 'each', 1361],
    ['SOLAR2', 'SOLAR FEMALE CONNECTOR MC4-FEM', 'accessory', 'mc4', 'each', 1361],
    ['E/S', 'EARTH SPIKE & EARTH CLAMP', 'protection', 'earthing', 'each', 22064],
    // Cables
    ['WIR6', 'WIRE HOUSE 6MM', 'cable', 'house_wire', 'm', 2176],
    ['FU7', 'SOLAR CABLE 4MM SINGLE CORE DC', 'cable', 'solar_dc', 'm', 1447],
    ['C/CAB', 'CABLE WELDING 35MM', 'cable', 'battery_cable', 'm', 13148],
    ['P/W', 'WIRE PANEL 6MM', 'cable', 'panel_wire', 'm', 2214],
    ['P/W16', 'WIRE PANEL 16MM', 'cable', 'panel_wire', 'm', 5987],
    ['W/PAN10', 'WIRE PANEL 10MM', 'cable', 'panel_wire', 'm', 3992],
    ['WIRE10', 'WIRE HOUSE 10MM', 'cable', 'house_wire', 'm', 3523],
    // Enclosures
    ['ENCLVE', 'ENCL. VE118L T/PAR SURF 18WAY', 'enclosure', 'db_enclosure', 'each', 107122],
    ['BOXSC4', 'BOX 686.208 SCAME 240X190X90', 'enclosure', 'junction_box', 'each', 25244],
    // Protection - DC
    ['CIR34', 'CIR/BREAKER D/P DC 20A MD63DK09 600VDC', 'protection', 'dc_breaker', 'each', 29110],
    ['SUR16', 'SURGE ARRESTOR DC 600V 40kA 2P', 'protection', 'spd_dc', 'each', 45093],
    // Protection - AC
    ['CIR18', 'CIR/BREAKER D/P 63A 3KA SCHNEIDER', 'protection', 'ac_breaker', 'each', 12832],
    ['C/OVER4', 'SWITCH C/O SF263 63A 2P', 'protection', 'changeover', 'each', 53750],
    // Fuses
    ['FU/MEGA', 'FUSE MEGA (INVERTERS)', 'protection', 'fuse', 'each', 49667],
    ['FU/HOL', 'FUSE HOLDER MEGA (INVERTERS)', 'protection', 'fuse_holder', 'each', 20007],
    ['FU9', 'FUSE ANL 400/500A', 'protection', 'fuse', 'each', 16585],
    ['FU10', 'FUSE HOLDER ANL', 'protection', 'fuse_holder', 'each', 16936],
    // Busbars & Insulators
    ['BUSBAR20', 'BUSBAR COPPER 25MMX5MMX1M', 'accessory', 'busbar', 'each', 88803],
    ['INS', 'INSULATOR - M8', 'accessory', 'insulator', 'each', 3375],
    // Pilot Lights
    ['SVN121', 'PILOT LIGHT SVN121 DIN GREEN', 'accessory', 'pilot_light', 'each', 18864],
    ['SVN122', 'PILOT LIGHT SVN122 DIN RED', 'accessory', 'pilot_light', 'each', 18864],
    // MPPTs
    ['SOLAR19', 'SOLAR MPPT VICTRON 250/70', 'mppt', null, 'each', 703224],
    // Inverters
    ['VICTRON3', 'INVERTER VICTRON 10000VA MPII', 'inverter', null, 'each', 2452824],
    // Batteries
    ['BATT/FREE2', 'BATTERY FREEDOM 15/12', 'battery', null, 'each', 6327000],
    // Cables & Accessories for Inverters
    ['C/G17', 'INVERTER VE DIRECT CABLE 3M', 'accessory', 've_direct', 'each', 26237],
    ['B/P4', 'INVERTER RJ45 CABLE UTP 1.8M', 'accessory', 'rj45', 'each', 18428],
    // GX Devices
    ['GX1', 'GX CERBO', 'accessory', 'gx_device', 'each', 379782],
    ['GX', 'GX TOUCH 50', 'accessory', 'gx_touch', 'each', 0],
    ['GX2', 'GX TOUCH WALL MOUNT', 'accessory', 'gx_mount', 'each', 0],
    // Labour & Travel
    ['LAB', 'LABOUR NORMAL / TRAVEL TIME', 'labour', null, 'hr', 49500],
    ['TRAV', 'TRAVEL VEHICLE EXP/FUEL', 'travel', null, 'km', 495],
    ['AA', 'PROGRAMMING / EXTRA / C&F + TRUNKING', 'labour', 'programming', 'each', 49500],
  ];

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (sku, name, category, subcategory, unit, retail_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const p of products) {
    insertProduct.run(...p);
  }

  // Seed inverter extended data
  const victron3 = db.prepare('SELECT id FROM products WHERE sku = ?').get('VICTRON3') as any;
  if (victron3) {
    db.prepare(`
      INSERT OR IGNORE INTO inverters (product_id, system_class, rated_va, max_dc_voltage, ac_output_amps)
      VALUES (?, 'V10', 10000, 48, 43.5)
    `).run(victron3.id);
  }

  // Seed MPPT extended data
  const mppt250 = db.prepare('SELECT id FROM products WHERE sku = ?').get('SOLAR19') as any;
  if (mppt250) {
    db.prepare(`
      INSERT OR IGNORE INTO mppts (product_id, max_pv_voltage, max_charge_a, model_code, max_pv_power_w)
      VALUES (?, 250, 70, '250/70', 4000)
    `).run(mppt250.id);
  }

  // Seed battery extended data
  const battFreedom = db.prepare('SELECT id FROM products WHERE sku = ?').get('BATT/FREE2') as any;
  if (battFreedom) {
    db.prepare(`
      INSERT OR IGNORE INTO batteries (product_id, capacity_kwh, voltage, chemistry)
      VALUES (?, 15, 51.2, 'LiFePO4')
    `).run(battFreedom.id);
  }

  // Seed panel extended data (JA 610W approximate specs)
  const panelJA = db.prepare('SELECT id FROM products WHERE sku = ?').get('SOLAR48') as any;
  if (panelJA) {
    db.prepare(`
      INSERT OR IGNORE INTO panels (product_id, power_w, voc, vmp, isc, imp, temp_coeff_voc, width_mm, height_mm, status)
      VALUES (?, 610, 38.73, 32.59, 16.52, 15.76, -0.27, 1134, 2465, 'approved')
    `).run(panelJA.id);
  }
}
