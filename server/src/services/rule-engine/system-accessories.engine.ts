import { getDb } from '../../database/connection';
import { EngineResult } from './types';

/**
 * SystemAccessoriesEngine: Brand-aware accessories.
 * Replaces the hardcoded VE Direct / GX Cerbo logic in system-class.engine.ts
 * for non-Victron brands that use different accessories.
 */
export function resolveSystemAccessories(
  brand: string,
  systemClass: string,
  mpptQty: number
): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  const addProduct = (sku: string, qty: number, note: string) => {
    const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(sku) as any;
    if (product) {
      items.push({
        sku, product_id: product.id,
        section: 'inverter', quantity: qty,
        is_locked: false, source_rule: 'system_accessories',
        note,
      });
    }
  };

  switch (brand) {
    case 'Victron':
      // VE Direct cables (1 per MPPT)
      if (mpptQty > 0) addProduct('C/G17', mpptQty, 'VE Direct cable per MPPT');
      // RJ45 cable
      addProduct('B/P4', 1, 'RJ45 communication cable');
      // GX Cerbo monitoring
      addProduct('GX1', 1, 'GX Cerbo monitoring');
      break;

    case 'Atess':
      addProduct('ATESS/COM', 1, 'Atess CAN/RS485 communication cable');
      break;

    default:
      flags.push({
        code: 'UNKNOWN_BRAND',
        severity: 'warning',
        message: `Unknown brand "${brand}" — no accessories configured`,
        is_blocking: false,
      });
  }

  return { items, flags };
}
