import { getDb } from '../database/connection';

export interface Panel {
  id: number;
  product_id: number;
  power_w: number;
  voc: number;
  vmp: number;
  isc: number;
  imp: number;
  temp_coeff_voc: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  weight_kg: number | null;
  datasheet_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined from products
  sku?: string;
  name?: string;
  retail_price?: number;
}

export function findAllPanels(status?: string): Panel[] {
  const db = getDb();
  let query = `
    SELECT p.*, pr.sku, pr.name, pr.retail_price
    FROM panels p
    JOIN products pr ON p.product_id = pr.id
    WHERE pr.is_active = 1
  `;
  if (status) {
    query += ` AND p.status = ?`;
    return db.prepare(query + ' ORDER BY p.created_at DESC').all(status) as Panel[];
  }
  return db.prepare(query + ' ORDER BY p.created_at DESC').all() as Panel[];
}

export function findPanelById(id: number): Panel | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT p.*, pr.sku, pr.name, pr.retail_price
    FROM panels p
    JOIN products pr ON p.product_id = pr.id
    WHERE p.id = ?
  `).get(id) as Panel | undefined;
}

export function createPanel(data: {
  product_id: number;
  power_w: number;
  voc: number;
  vmp: number;
  isc: number;
  imp: number;
  temp_coeff_voc: number;
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  weight_kg?: number;
  datasheet_path?: string;
}): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO panels (product_id, power_w, voc, vmp, isc, imp, temp_coeff_voc,
      width_mm, height_mm, depth_mm, weight_kg, datasheet_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.product_id, data.power_w, data.voc, data.vmp, data.isc, data.imp,
    data.temp_coeff_voc, data.width_mm || null, data.height_mm || null,
    data.depth_mm || null, data.weight_kg || null, data.datasheet_path || null
  );
  return result.lastInsertRowid as number;
}

export function updatePanel(id: number, data: Partial<Panel>): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  const allowed = [
    'power_w', 'voc', 'vmp', 'isc', 'imp', 'temp_coeff_voc',
    'width_mm', 'height_mm', 'depth_mm', 'weight_kg', 'datasheet_path'
  ] as const;

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE panels SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function approvePanel(id: number, userId: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE panels SET status = 'approved', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(userId, id);
}

export function rejectPanel(id: number, userId: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE panels SET status = 'rejected', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(userId, id);
}
