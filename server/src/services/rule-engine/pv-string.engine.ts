import { getDb } from '../../database/connection';
import { EngineResult, PanelData, MpptData } from './types';
import { calculateColdVoc } from '../panel-validation.service';

/**
 * PVStringEngine: Calculates PV string configuration, validates against MPPT limits,
 * and generates solar cable + connector BoM items.
 */
export function resolvePVStrings(
  panel: PanelData,
  mppt: MpptData,
  panelQty: number,
  mpptQty: number,
  stringLengthM: number
): EngineResult & { strings_count: number; panels_per_string: number } {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  // Calculate cold Voc for string sizing
  const coldVoc = calculateColdVoc(panel.voc, panel.temp_coeff_voc);

  // Max panels per string (limited by MPPT max voltage)
  const maxPanelsPerString = Math.floor(mppt.max_pv_voltage / coldVoc);

  if (maxPanelsPerString < 1) {
    flags.push({
      code: 'PANEL_VOC_EXCEEDS_MPPT', severity: 'error',
      message: `Cold Voc (${coldVoc.toFixed(1)}V) exceeds MPPT max voltage (${mppt.max_pv_voltage}V) — cannot use this panel with this MPPT`,
      is_blocking: true,
    });
    return { items, flags, strings_count: 0, panels_per_string: 0 };
  }

  // Calculate optimal string configuration
  // Total MPPT inputs = mpptQty (each MPPT has 1 tracker with 1 input for SmartSolar)
  const totalInputs = mpptQty;

  // Distribute panels across strings
  let stringsCount = Math.ceil(panelQty / maxPanelsPerString);
  // Ensure at least as many strings as MPPTs can handle
  if (stringsCount < totalInputs && panelQty >= totalInputs) {
    stringsCount = totalInputs;
  }

  const panelsPerString = Math.floor(panelQty / stringsCount);
  const remainder = panelQty % stringsCount;

  // Validate string voltage
  const stringVoltage = coldVoc * panelsPerString;
  if (stringVoltage >= mppt.max_pv_voltage) {
    flags.push({
      code: 'STRING_VOLTAGE_LIMIT', severity: 'error',
      message: `String voltage (${stringVoltage.toFixed(1)}V with ${panelsPerString} panels) exceeds MPPT limit (${mppt.max_pv_voltage}V)`,
      is_blocking: true,
    });
  }

  // Validate current: Imp × 1.25 ≤ MPPT max charge current per string
  const imp125 = panel.imp * 1.25;
  if (imp125 > 20) {
    flags.push({
      code: 'STRING_CURRENT_LIMIT', severity: 'error',
      message: `Imp × 1.25 = ${imp125.toFixed(2)}A exceeds 20A per-string limit`,
      is_blocking: true,
    });
  }

  // Check oversize
  const totalPvWatts = panelQty * panel.power_w;
  const maxPvWatts = mppt.max_pv_power_w ? mppt.max_pv_power_w * mpptQty : Infinity;
  if (totalPvWatts > maxPvWatts * 1.5) {
    flags.push({
      code: 'PV_OVERSIZE_EXTREME', severity: 'warning',
      message: `Total PV (${totalPvWatts}W) exceeds 150% of MPPT capacity (${maxPvWatts}W) — significant clipping expected`,
      is_blocking: false,
    });
  } else if (totalPvWatts > maxPvWatts) {
    flags.push({
      code: 'PV_OVERSIZE', severity: 'info',
      message: `Total PV (${totalPvWatts}W) exceeds MPPT capacity (${maxPvWatts}W) — some clipping expected, acceptable for production optimization`,
      is_blocking: false,
    });
  }

  if (remainder > 0) {
    flags.push({
      code: 'UNEVEN_STRINGS', severity: 'info',
      message: `${remainder} string(s) will have ${panelsPerString + 1} panels, rest will have ${panelsPerString}`,
      is_blocking: false,
    });
  }

  // Solar panels
  const panelProduct = db.prepare("SELECT sku FROM products WHERE id = ?").get(panel.product_id) as any;
  if (panelProduct) {
    items.push({
      sku: panelProduct.sku, product_id: panel.product_id,
      section: 'solar_panels', quantity: panelQty,
      is_locked: false, source_rule: 'pv_string',
    });
  }

  // Solar DC cable (4mm per string, × 2 for pos/neg, × string length)
  const solarCable = db.prepare("SELECT id FROM products WHERE sku = 'FU7' AND is_active = 1").get() as any;
  if (solarCable) {
    const cableQty = Math.ceil(stringsCount * stringLengthM * 2);
    items.push({
      sku: 'FU7', product_id: solarCable.id,
      section: 'pv_cabling', quantity: cableQty,
      is_locked: false, source_rule: 'pv_string',
      note: `4mm DC cable: ${stringsCount} strings × ${stringLengthM}m × 2 (pos+neg)`,
    });
  }

  // MC4 connectors (1 pair per string)
  const mc4Male = db.prepare("SELECT id FROM products WHERE sku = 'SOLAR1' AND is_active = 1").get() as any;
  const mc4Female = db.prepare("SELECT id FROM products WHERE sku = 'SOLAR2' AND is_active = 1").get() as any;
  if (mc4Male) {
    items.push({ sku: 'SOLAR1', product_id: mc4Male.id, section: 'pv_cabling', quantity: stringsCount * 2, is_locked: false, source_rule: 'pv_string', note: 'MC4 male connectors' });
  }
  if (mc4Female) {
    items.push({ sku: 'SOLAR2', product_id: mc4Female.id, section: 'pv_cabling', quantity: stringsCount * 2, is_locked: false, source_rule: 'pv_string', note: 'MC4 female connectors' });
  }

  // MC4 Y-splitters for parallel strings (when strings > MPPT inputs)
  if (stringsCount > mpptQty) {
    const parallelJoins = stringsCount - mpptQty;
    const y1 = db.prepare("SELECT id FROM products WHERE sku = 'MC4/Y1' AND is_active = 1").get() as any;
    const y2 = db.prepare("SELECT id FROM products WHERE sku = 'MC4/Y2' AND is_active = 1").get() as any;
    if (y1) {
      items.push({ sku: 'MC4/Y1', product_id: y1.id, section: 'pv_cabling', quantity: parallelJoins, is_locked: false, source_rule: 'pv_string_y_splitter', note: `MC4 Y-Splitter 1M-2F (${parallelJoins} parallel joins)` });
    }
    if (y2) {
      items.push({ sku: 'MC4/Y2', product_id: y2.id, section: 'pv_cabling', quantity: parallelJoins, is_locked: false, source_rule: 'pv_string_y_splitter', note: `MC4 Y-Splitter 1F-2M (${parallelJoins} parallel joins)` });
    }
  }

  // Panel wire from MPPT to DB (6mm)
  const panelWire = db.prepare("SELECT id FROM products WHERE sku = 'P/W' AND is_active = 1").get() as any;
  if (panelWire) {
    items.push({ sku: 'P/W', product_id: panelWire.id, section: 'pv_cabling', quantity: Math.ceil(stringsCount * 3), is_locked: false, source_rule: 'pv_string', note: '6mm panel wire MPPT to DB' });
  }

  return { items, flags, strings_count: stringsCount, panels_per_string: panelsPerString };
}
