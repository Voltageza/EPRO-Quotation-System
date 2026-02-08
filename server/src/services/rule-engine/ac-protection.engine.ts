import { getDb } from '../../database/connection';
import { EngineResult } from './types';

/**
 * ACProtectionEngine: Resolves AC breakers, changeover, SPD per system class.
 */
export function resolveACProtection(systemClass: string): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  const ruleTable = db.prepare(`
    SELECT id FROM rule_tables WHERE rule_type = 'ac_protection' AND is_active = 1 ORDER BY version DESC LIMIT 1
  `).get() as any;

  if (!ruleTable) {
    flags.push({ code: 'NO_AC_PROT_RULES', severity: 'error', message: 'No AC protection rules configured', is_blocking: true });
    return { items, flags };
  }

  const entry = db.prepare(`
    SELECT * FROM rule_entries WHERE rule_table_id = ? AND system_class = ? ORDER BY sort_order LIMIT 1
  `).get(ruleTable.id, systemClass) as any;

  if (!entry) {
    flags.push({ code: 'NO_AC_PROT_MATCH', severity: 'error', message: `No AC protection rule for ${systemClass}`, is_blocking: true });
    return { items, flags };
  }

  const result = JSON.parse(entry.result_json);

  for (const ruleItem of result.items) {
    const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(ruleItem.sku) as any;
    if (!product) continue;

    items.push({
      sku: ruleItem.sku, product_id: product.id,
      section: ruleItem.section || 'ac_protection',
      quantity: ruleItem.qty || 1,
      is_locked: false, source_rule: 'ac_protection',
      note: ruleItem.note,
    });
  }

  // Busbar + insulators for AC DB
  const busbar = db.prepare("SELECT id FROM products WHERE sku = 'BUSBAR20' AND is_active = 1").get() as any;
  if (busbar) {
    items.push({ sku: 'BUSBAR20', product_id: busbar.id, section: 'ac_protection', quantity: 1, is_locked: false, source_rule: 'ac_protection', note: 'Neutral/earth busbar' });
  }
  const insulator = db.prepare("SELECT id FROM products WHERE sku = 'INS' AND is_active = 1").get() as any;
  if (insulator) {
    items.push({ sku: 'INS', product_id: insulator.id, section: 'ac_protection', quantity: 4, is_locked: false, source_rule: 'ac_protection', note: 'Busbar insulators' });
  }

  return { items, flags };
}
