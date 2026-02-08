import { getDb } from '../../database/connection';
import { QuoteInput, BomItem, Flag, PanelData, MpptData } from './types';
import { resolveSystemClass } from './system-class.engine';
import { resolveDCBattery } from './dc-battery.engine';
import { resolvePVStrings } from './pv-string.engine';
import { resolveDCProtection } from './dc-protection.engine';
import { resolveACCable } from './ac-cable.engine';
import { resolveACProtection } from './ac-protection.engine';
import { resolveMounting } from './mounting.engine';
import { resolveLabour } from './labour.engine';

export interface BomGenerationResult {
  items: BomItem[];
  flags: Flag[];
  strings_count: number;
  panels_per_string: number;
}

/**
 * Rule Engine Orchestrator: Runs all 8 engine modules in sequence,
 * collects BoM items and flags, returns the complete BoM.
 */
export function generateBom(input: QuoteInput): BomGenerationResult {
  const db = getDb();
  const allItems: BomItem[] = [];
  const allFlags: Flag[] = [];
  let stringsCount = 0;
  let panelsPerString = 0;

  // Load component data
  const panel = db.prepare(`
    SELECT p.*, pr.sku FROM panels p JOIN products pr ON p.product_id = pr.id WHERE p.id = ?
  `).get(input.panel_id) as PanelData | undefined;

  const mppt = db.prepare(`
    SELECT m.*, p.sku FROM mppts m JOIN products p ON m.product_id = p.id WHERE m.product_id = ?
  `).get(input.mppt_id) as (MpptData & { sku: string }) | undefined;

  const battery = db.prepare(`
    SELECT b.*, p.sku FROM batteries b JOIN products p ON b.product_id = p.id WHERE b.product_id = ?
  `).get(input.battery_id) as any;

  if (!panel) {
    allFlags.push({ code: 'NO_PANEL', severity: 'error', message: 'Selected panel not found', is_blocking: true });
  }
  if (!mppt) {
    allFlags.push({ code: 'NO_MPPT', severity: 'error', message: 'Selected MPPT not found', is_blocking: true });
  }
  if (!battery) {
    allFlags.push({ code: 'NO_BATTERY', severity: 'error', message: 'Selected battery not found', is_blocking: true });
  }

  // If critical data missing, return early
  if (!panel || !mppt || !battery) {
    return { items: allItems, flags: allFlags, strings_count: 0, panels_per_string: 0 };
  }

  // 1. System Class → Inverter + MPPT + accessories
  const systemResult = resolveSystemClass(input.system_class, input.mppt_id, input.mppt_qty);
  allItems.push(...systemResult.items);
  allFlags.push(...systemResult.flags);

  // 2. DC Battery → Cables + fuses
  const dcBatteryResult = resolveDCBattery(input.system_class, input.dc_battery_distance_m);
  allItems.push(...dcBatteryResult.items);
  allFlags.push(...dcBatteryResult.flags);

  // Battery product itself
  allItems.push({
    sku: battery.sku, product_id: battery.product_id,
    section: 'battery', quantity: input.battery_qty,
    is_locked: false, source_rule: 'system_class',
  });

  // 3. PV Strings → Panels, solar cable, connectors
  const pvResult = resolvePVStrings(panel, mppt, input.panel_qty, input.mppt_qty, input.pv_string_length_m);
  allItems.push(...pvResult.items);
  allFlags.push(...pvResult.flags);
  stringsCount = pvResult.strings_count;
  panelsPerString = pvResult.panels_per_string;

  // 4. DC Protection → LOCKED breakers + SPDs per string
  const dcProtResult = resolveDCProtection(stringsCount);
  allItems.push(...dcProtResult.items);
  allFlags.push(...dcProtResult.flags);

  // 5. AC Cable → Cable sizes by distance
  const acCableResult = resolveACCable(input.system_class, input.ac_inverter_db_distance_m, input.ac_db_grid_distance_m);
  allItems.push(...acCableResult.items);
  allFlags.push(...acCableResult.flags);

  // 6. AC Protection → Breakers, changeover, SPD
  const acProtResult = resolveACProtection(input.system_class);
  allItems.push(...acProtResult.items);
  allFlags.push(...acProtResult.flags);

  // 7. Mounting → Rails, clamps, joiners, brackets
  const mountingResult = resolveMounting(panel, input.panel_qty);
  allItems.push(...mountingResult.items);
  allFlags.push(...mountingResult.flags);

  // 8. Labour → Hours + travel
  const labourResult = resolveLabour(input.system_class, input.battery_qty, input.panel_qty, input.travel_distance_km);
  allItems.push(...labourResult.items);
  allFlags.push(...labourResult.flags);

  // Resolve product_ids for any items that only have SKU
  for (const item of allItems) {
    if (!item.product_id) {
      const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(item.sku) as any;
      if (product) item.product_id = product.id;
    }
  }

  return { items: allItems, flags: allFlags, strings_count: stringsCount, panels_per_string: panelsPerString };
}
