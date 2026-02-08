import { getDb } from '../database/connection';
import { PricingConfig } from '../types';

export function getPricingConfig(): PricingConfig {
  const db = getDb();
  return db.prepare('SELECT * FROM pricing_config WHERE id = 1').get() as PricingConfig;
}

export function updatePricingConfig(updates: Partial<PricingConfig>, userId: number): void {
  const db = getDb();
  const current = getPricingConfig();

  // Log change to audit
  db.prepare(`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
    VALUES (?, 'update', 'pricing_config', 1, ?, ?)
  `).run(userId, JSON.stringify(current), JSON.stringify(updates));

  const fields: string[] = [];
  const values: any[] = [];

  const allowed = ['pricing_factor', 'vat_rate', 'min_margin', 'travel_rate', 'labour_rate'] as const;
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_by = ?');
  values.push(userId);
  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE pricing_config SET ${fields.join(', ')} WHERE id = 1`).run(...values);
}

export function calculateLinePrice(retailPriceCents: number, pricingFactor: number): number {
  return Math.round(retailPriceCents * pricingFactor);
}

export function calculateTotals(lineItems: Array<{ unit_price_cents: number; quantity: number }>, vatRate: number) {
  let subtotal = 0;
  for (const item of lineItems) {
    subtotal += Math.round(item.unit_price_cents * item.quantity);
  }
  const vat = Math.round(subtotal * vatRate);
  const total = subtotal + vat;
  return { subtotal_cents: subtotal, vat_cents: vat, total_cents: total };
}

export function formatCurrency(cents: number): string {
  return `R ${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
