import { getDb } from '../../database/connection';
import { EngineResult } from './types';

/**
 * DCProtectionEngine: LOCKED — 1× 20A DC breaker + 1× DC SPD per string.
 * No user override possible. No rule table — hardcoded.
 */
export function resolveDCProtection(stringsCount: number): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  // DC breaker: 1 per string
  const breaker = db.prepare("SELECT id FROM products WHERE sku = 'CIR34' AND is_active = 1").get() as any;
  if (breaker) {
    items.push({
      sku: 'CIR34', product_id: breaker.id,
      section: 'pv_dc_protection', quantity: stringsCount,
      is_locked: true, source_rule: 'dc_protection_locked',
      note: '20A DC breaker per string (LOCKED)',
    });
  }

  // DC SPD: 1 per string
  const spd = db.prepare("SELECT id FROM products WHERE sku = 'SUR16' AND is_active = 1").get() as any;
  if (spd) {
    items.push({
      sku: 'SUR16', product_id: spd.id,
      section: 'pv_dc_protection', quantity: stringsCount,
      is_locked: true, source_rule: 'dc_protection_locked',
      note: 'DC surge protection per string (LOCKED)',
    });
  }

  // PV DC DB enclosure
  const encl = db.prepare("SELECT id FROM products WHERE sku = 'BOXSC4' AND is_active = 1").get() as any;
  if (encl) {
    items.push({
      sku: 'BOXSC4', product_id: encl.id,
      section: 'pv_dc_protection', quantity: 1,
      is_locked: false, source_rule: 'dc_protection',
      note: 'PV DC combiner box',
    });
  }

  // Earth spike
  const earth = db.prepare("SELECT id FROM products WHERE sku = 'E/S' AND is_active = 1").get() as any;
  if (earth) {
    items.push({
      sku: 'E/S', product_id: earth.id,
      section: 'pv_dc_protection', quantity: 1,
      is_locked: false, source_rule: 'dc_protection',
      note: 'Earth spike & clamp',
    });
  }

  // Earth wire
  const earthWire = db.prepare("SELECT id FROM products WHERE sku = 'WIR6' AND is_active = 1").get() as any;
  if (earthWire) {
    items.push({
      sku: 'WIR6', product_id: earthWire.id,
      section: 'pv_dc_protection', quantity: 10,
      is_locked: false, source_rule: 'dc_protection',
      note: '6mm earth wire',
    });
  }

  return { items, flags };
}
