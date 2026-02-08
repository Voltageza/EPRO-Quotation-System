import { getDb } from '../../database/connection';
import { EngineResult } from './types';

/**
 * ACCableEngine: Resolves AC cable sizes based on system class and distance.
 */
export function resolveACCable(systemClass: string, inverterToDbM: number, dbToGridM: number): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  const acTotalM = inverterToDbM + dbToGridM;

  // Find active rule table
  const ruleTable = db.prepare(`
    SELECT id FROM rule_tables WHERE rule_type = 'ac_cable' AND is_active = 1 ORDER BY version DESC LIMIT 1
  `).get() as any;

  if (!ruleTable) {
    flags.push({ code: 'NO_AC_CABLE_RULES', severity: 'error', message: 'No AC cable rules configured', is_blocking: true });
    return { items, flags };
  }

  const entry = db.prepare(`
    SELECT * FROM rule_entries WHERE rule_table_id = ? AND system_class = ? ORDER BY sort_order LIMIT 1
  `).get(ruleTable.id, systemClass) as any;

  if (!entry) {
    flags.push({ code: 'NO_AC_CABLE_MATCH', severity: 'error', message: `No AC cable rule for ${systemClass}`, is_blocking: true });
    return { items, flags };
  }

  const result = JSON.parse(entry.result_json);

  for (const ruleItem of result.items) {
    const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(ruleItem.sku) as any;
    if (!product) continue;

    let qty = ruleItem.qty || 0;
    if (ruleItem.qty_formula) {
      qty = Math.ceil(eval(ruleItem.qty_formula.replace(/ac_total_m/g, String(acTotalM))));
    }

    items.push({
      sku: ruleItem.sku, product_id: product.id,
      section: ruleItem.section || 'ac_cabling',
      quantity: qty, is_locked: false, source_rule: 'ac_cable',
      note: ruleItem.note,
    });
  }

  // Process flags
  if (result.flags) {
    for (const flagRule of result.flags) {
      const conditionMet = eval(flagRule.condition.replace(/ac_total_m/g, String(acTotalM)));
      if (conditionMet) {
        flags.push({ code: flagRule.code, severity: flagRule.severity, message: flagRule.message, is_blocking: false });
      }
    }
  }

  return { items, flags };
}
