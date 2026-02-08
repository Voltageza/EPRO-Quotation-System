import { getDb } from '../../database/connection';
import { EngineResult } from './types';

/**
 * DCBatteryEngine: Resolves DC battery cabling + fuses based on system class and distance.
 */
export function resolveDCBattery(systemClass: string, distanceM: number): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  // Find active rule table for dc_battery_cable
  const ruleTable = db.prepare(`
    SELECT id FROM rule_tables WHERE rule_type = 'dc_battery_cable' AND is_active = 1 ORDER BY version DESC LIMIT 1
  `).get() as any;

  if (!ruleTable) {
    flags.push({ code: 'NO_DC_BATTERY_RULES', severity: 'error', message: 'No DC battery cable rules configured', is_blocking: true });
    return { items, flags };
  }

  // Find matching entry for this system class
  const entry = db.prepare(`
    SELECT * FROM rule_entries WHERE rule_table_id = ? AND system_class = ? ORDER BY sort_order LIMIT 1
  `).get(ruleTable.id, systemClass) as any;

  if (!entry) {
    flags.push({ code: 'NO_DC_BATTERY_RULE_MATCH', severity: 'error', message: `No DC battery rule for ${systemClass}`, is_blocking: true });
    return { items, flags };
  }

  const result = JSON.parse(entry.result_json);

  // Process items
  for (const ruleItem of result.items) {
    const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(ruleItem.sku) as any;
    if (!product) continue;

    let qty = ruleItem.qty || 0;
    if (ruleItem.qty_formula) {
      // Evaluate simple formulas like "distance_m * 2"
      qty = Math.ceil(eval(ruleItem.qty_formula.replace(/distance_m/g, String(distanceM))));
    }

    items.push({
      sku: ruleItem.sku,
      product_id: product.id,
      section: ruleItem.section || 'dc_battery',
      quantity: qty,
      is_locked: false,
      source_rule: 'dc_battery',
      note: ruleItem.note,
    });
  }

  // Process flags
  if (result.flags) {
    for (const flagRule of result.flags) {
      // Evaluate condition
      const conditionMet = eval(flagRule.condition.replace(/distance_m/g, String(distanceM)));
      if (conditionMet) {
        flags.push({
          code: flagRule.code,
          severity: flagRule.severity,
          message: flagRule.message,
          is_blocking: false,
        });
      }
    }
  }

  // Battery product itself
  // (battery is added by the orchestrator, not here)

  return { items, flags };
}
