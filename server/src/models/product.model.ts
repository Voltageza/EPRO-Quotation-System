import { getDb } from '../database/connection';
import { Product } from '../types';

export function findAllProducts(category?: string): Product[] {
  const db = getDb();
  if (category) {
    return db.prepare('SELECT * FROM products WHERE is_active = 1 AND category = ? ORDER BY category, name').all(category) as Product[];
  }
  return db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY category, name').all() as Product[];
}

export function findProductById(id: number): Product | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
}

export function findProductBySku(sku: string): Product | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as Product | undefined;
}

export function createProduct(data: {
  sku: string; name: string; category: string; subcategory?: string;
  unit?: string; retail_price: number; notes?: string;
}): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO products (sku, name, category, subcategory, unit, retail_price, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.sku, data.name, data.category, data.subcategory || null,
    data.unit || 'each', data.retail_price, data.notes || null);
  return result.lastInsertRowid as number;
}

export function updateProduct(id: number, data: Partial<Product>, userId?: number): void {
  const db = getDb();
  const current = findProductById(id);
  if (!current) return;

  // Log price change if price changed
  if (data.retail_price !== undefined && data.retail_price !== current.retail_price && userId) {
    db.prepare(`
      INSERT INTO price_history (product_id, old_price, new_price, changed_by)
      VALUES (?, ?, ?, ?)
    `).run(id, current.retail_price, data.retail_price, userId);
  }

  const fields: string[] = [];
  const values: any[] = [];

  const allowed = ['sku', 'name', 'category', 'subcategory', 'unit', 'retail_price', 'notes'] as const;
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function softDeleteProduct(id: number): void {
  const db = getDb();
  db.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
}

export function getPriceHistory(productId: number) {
  const db = getDb();
  return db.prepare(`
    SELECT ph.*, u.display_name as changed_by_name
    FROM price_history ph
    LEFT JOIN users u ON ph.changed_by = u.id
    WHERE ph.product_id = ?
    ORDER BY ph.changed_at DESC
  `).all(productId);
}
