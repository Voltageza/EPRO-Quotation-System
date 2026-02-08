import { getDb } from '../../database/connection';
import { EngineResult } from './types';
import { getPricingConfig } from '../pricing.service';

/**
 * LabourEngine: Calculates labour hours + travel costs based on system class.
 */
export function resolveLabour(
  systemClass: string,
  batteryQty: number,
  panelQty: number,
  travelKm: number
): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  const ruleTable = db.prepare(`
    SELECT id FROM rule_tables WHERE rule_type = 'labour' AND is_active = 1 ORDER BY version DESC LIMIT 1
  `).get() as any;

  if (!ruleTable) {
    flags.push({ code: 'NO_LABOUR_RULES', severity: 'warning', message: 'No labour rules configured', is_blocking: false });
    return { items, flags };
  }

  const entry = db.prepare(`
    SELECT * FROM rule_entries WHERE rule_table_id = ? AND system_class = ? ORDER BY sort_order LIMIT 1
  `).get(ruleTable.id, systemClass) as any;

  if (!entry) {
    flags.push({ code: 'NO_LABOUR_MATCH', severity: 'warning', message: `No labour rule for ${systemClass}`, is_blocking: false });
    return { items, flags };
  }

  const config = JSON.parse(entry.result_json);

  // Calculate total labour hours
  let totalHours = config.base_hours || 8;

  // Battery adder
  if (batteryQty > 1 && config.battery_adder_hours) {
    totalHours += (batteryQty - 1) * config.battery_adder_hours;
  }

  // Panel adder (per N panels)
  if (config.panels_per_adder && config.panel_adder_hours) {
    const adderSets = Math.floor(panelQty / config.panels_per_adder);
    if (adderSets > 1) {
      totalHours += (adderSets - 1) * config.panel_adder_hours;
    }
  }

  // Labour line item
  const labourProduct = db.prepare("SELECT id FROM products WHERE sku = 'LAB' AND is_active = 1").get() as any;
  if (labourProduct) {
    items.push({
      sku: 'LAB', product_id: labourProduct.id,
      section: 'labour', quantity: totalHours,
      is_locked: false, source_rule: 'labour',
      note: `${config.base_hours}h base + adders for ${batteryQty} batteries, ${panelQty} panels`,
    });
  }

  // Programming
  const programmingHours = config.programming_hours || 2;
  const progProduct = db.prepare("SELECT id FROM products WHERE sku = 'AA' AND is_active = 1").get() as any;
  if (progProduct) {
    items.push({
      sku: 'AA', product_id: progProduct.id,
      section: 'labour', quantity: programmingHours,
      is_locked: false, source_rule: 'labour',
      note: 'Programming & commissioning',
    });
  }

  // Travel
  if (travelKm > 0) {
    const travelProduct = db.prepare("SELECT id FROM products WHERE sku = 'TRAV' AND is_active = 1").get() as any;
    if (travelProduct) {
      items.push({
        sku: 'TRAV', product_id: travelProduct.id,
        section: 'travel', quantity: travelKm * 2, // round trip
        is_locked: false, source_rule: 'labour',
        note: `Travel: ${travelKm}km × 2 (round trip)`,
      });
    }

    // Travel time as labour (assume ~80km/h average, round to nearest hour)
    const travelTimeHours = Math.ceil((travelKm * 2) / 80);
    if (labourProduct && travelTimeHours > 0) {
      items.push({
        sku: 'LAB', product_id: labourProduct.id,
        section: 'travel', quantity: travelTimeHours,
        is_locked: false, source_rule: 'labour',
        note: `Travel time: ~${travelTimeHours}h (${travelKm}km each way)`,
      });
    }
  }

  return { items, flags };
}
