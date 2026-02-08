import { getDb } from '../../database/connection';
import { EngineResult, InverterData } from './types';

/**
 * SystemClassEngine: Resolves inverter + accessories for the selected system class.
 */
export function resolveSystemClass(systemClass: string, mpptProductId: number, mpptQty: number): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  // Get inverter for system class
  const inverter = db.prepare(`
    SELECT i.*, p.sku FROM inverters i JOIN products p ON i.product_id = p.id
    WHERE i.system_class = ? AND p.is_active = 1
  `).get(systemClass) as (InverterData & { sku: string }) | undefined;

  if (!inverter) {
    flags.push({ code: 'NO_INVERTER', severity: 'error', message: `No inverter found for system class ${systemClass}`, is_blocking: true });
    return { items, flags };
  }

  // Inverter
  items.push({ sku: inverter.sku, product_id: inverter.product_id, section: 'inverter', quantity: 1, is_locked: false, source_rule: 'system_class' });

  // MPPT(s)
  const mppt = db.prepare('SELECT p.sku FROM mppts m JOIN products p ON m.product_id = p.id WHERE m.product_id = ?').get(mpptProductId) as any;
  if (mppt) {
    items.push({ sku: mppt.sku, product_id: mpptProductId, section: 'inverter', quantity: mpptQty, is_locked: false, source_rule: 'system_class' });
  }

  // VE Direct cables (1 per MPPT)
  const veDirect = db.prepare("SELECT id, sku FROM products WHERE sku = 'C/G17' AND is_active = 1").get() as any;
  if (veDirect) {
    items.push({ sku: 'C/G17', product_id: veDirect.id, section: 'inverter', quantity: mpptQty, is_locked: false, source_rule: 'system_class', note: 'VE Direct cable per MPPT' });
  }

  // RJ45 cable
  const rj45 = db.prepare("SELECT id, sku FROM products WHERE sku = 'B/P4' AND is_active = 1").get() as any;
  if (rj45) {
    items.push({ sku: 'B/P4', product_id: rj45.id, section: 'inverter', quantity: 1, is_locked: false, source_rule: 'system_class', note: 'RJ45 communication cable' });
  }

  // GX Cerbo
  const gx = db.prepare("SELECT id, sku FROM products WHERE sku = 'GX1' AND is_active = 1").get() as any;
  if (gx) {
    items.push({ sku: 'GX1', product_id: gx.id, section: 'inverter', quantity: 1, is_locked: false, source_rule: 'system_class', note: 'GX Cerbo monitoring' });
  }

  return { items, flags };
}
