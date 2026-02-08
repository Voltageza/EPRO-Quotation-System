import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getDb } from '../database/connection';
import { generateBom } from '../services/rule-engine';
import { getPricingConfig, calculateLinePrice, calculateTotals } from '../services/pricing.service';
import { QuoteInput } from '../services/rule-engine/types';

export const quoteRoutes = Router();
quoteRoutes.use(authenticate);

// === CLIENTS ===

// GET /api/v1/quotes/clients
quoteRoutes.get('/clients', (_req: Request, res: Response) => {
  const db = getDb();
  const clients = db.prepare('SELECT * FROM clients ORDER BY name').all();
  res.json({ clients });
});

// POST /api/v1/quotes/clients
quoteRoutes.post('/clients', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const { name, phone, email, address } = req.body;
  if (!name) { res.status(400).json({ error: 'Client name required' }); return; }
  const result = db.prepare('INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)').run(name, phone || null, email || null, address || null);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Client created' });
});

// PATCH /api/v1/quotes/clients/:id
quoteRoutes.patch('/clients/:id', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const { name, phone, email, address } = req.body;
  db.prepare('UPDATE clients SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address) WHERE id = ?')
    .run(name, phone, email, address, id);
  res.json({ message: 'Client updated' });
});

// === QUOTES ===

// Generate next quote number
function nextQuoteNumber(): string {
  const db = getDb();
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`EPQ-${year}-%`) as any;
  if (!last) return `EPQ-${year}-0001`;
  const num = parseInt(last.quote_number.split('-')[2], 10) + 1;
  return `EPQ-${year}-${String(num).padStart(4, '0')}`;
}

// GET /api/v1/quotes
quoteRoutes.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const status = req.query.status as string | undefined;
  let query = `
    SELECT q.*, c.name as client_name
    FROM quotes q
    JOIN clients c ON q.client_id = c.id
  `;
  if (status) {
    query += ` WHERE q.status = ?`;
    const quotes = db.prepare(query + ' ORDER BY q.created_at DESC').all(status);
    res.json({ quotes });
  } else {
    const quotes = db.prepare(query + ' ORDER BY q.created_at DESC').all();
    res.json({ quotes });
  }
});

// GET /api/v1/quotes/:id
quoteRoutes.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);

  const quote = db.prepare(`
    SELECT q.*, c.name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address
    FROM quotes q JOIN clients c ON q.client_id = c.id WHERE q.id = ?
  `).get(id) as any;

  if (!quote) { res.status(404).json({ error: 'Quote not found' }); return; }

  const bomItems = db.prepare(`
    SELECT bi.*, p.sku, p.name as product_name, p.unit
    FROM quote_bom_items bi
    JOIN products p ON bi.product_id = p.id
    WHERE bi.quote_id = ?
    ORDER BY bi.section, bi.sort_order
  `).all(id);

  const flags = db.prepare('SELECT * FROM quote_flags WHERE quote_id = ?').all(id);

  res.json({ quote, bom_items: bomItems, flags });
});

// POST /api/v1/quotes — create new quote
quoteRoutes.post('/', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const { client_id, system_class } = req.body;

  if (!client_id || !system_class) {
    res.status(400).json({ error: 'client_id and system_class required' });
    return;
  }

  const pricing = getPricingConfig();
  const quoteNumber = nextQuoteNumber();

  const result = db.prepare(`
    INSERT INTO quotes (quote_number, client_id, system_class, pricing_factor, vat_rate, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(quoteNumber, client_id, system_class, pricing.pricing_factor, pricing.vat_rate, req.user!.userId);

  res.status(201).json({ id: result.lastInsertRowid, quote_number: quoteNumber });
});

// PATCH /api/v1/quotes/:id — update quote details
quoteRoutes.patch('/:id', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const allowed = [
    'system_class', 'dc_battery_distance_m', 'ac_inverter_db_distance_m',
    'ac_db_grid_distance_m', 'pv_string_length_m', 'travel_distance_km',
    'panel_id', 'panel_qty', 'battery_id', 'battery_qty', 'mppt_id', 'mppt_qty',
    'notes', 'status',
  ];

  const fields: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }

  if (fields.length === 0) { res.json({ message: 'No changes' }); return; }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE quotes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ message: 'Quote updated' });
});

// POST /api/v1/quotes/:id/generate-bom — run rule engine and generate BoM
quoteRoutes.post('/:id/generate-bom', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as any;
  if (!quote) { res.status(404).json({ error: 'Quote not found' }); return; }

  // Get MPPT product_id from mppts table
  const mpptRecord = db.prepare('SELECT product_id FROM mppts WHERE id = ?').get(quote.mppt_id) as any;
  const batteryRecord = db.prepare('SELECT product_id FROM batteries WHERE id = ?').get(quote.battery_id) as any;

  const input: QuoteInput = {
    system_class: quote.system_class,
    panel_id: quote.panel_id,
    panel_qty: quote.panel_qty,
    battery_id: batteryRecord?.product_id || quote.battery_id,
    battery_qty: quote.battery_qty,
    mppt_id: mpptRecord?.product_id || quote.mppt_id,
    mppt_qty: quote.mppt_qty,
    dc_battery_distance_m: quote.dc_battery_distance_m,
    ac_inverter_db_distance_m: quote.ac_inverter_db_distance_m,
    ac_db_grid_distance_m: quote.ac_db_grid_distance_m,
    pv_string_length_m: quote.pv_string_length_m,
    travel_distance_km: quote.travel_distance_km,
  };

  // Generate BoM
  const result = generateBom(input);

  // Get pricing config
  const pricing = getPricingConfig();

  // Clear existing BoM items and flags
  db.prepare('DELETE FROM quote_bom_items WHERE quote_id = ?').run(id);
  db.prepare('DELETE FROM quote_flags WHERE quote_id = ?').run(id);

  // Insert BoM items with pricing
  const insertBom = db.prepare(`
    INSERT INTO quote_bom_items (quote_id, product_id, section, quantity, unit_price_cents, line_total_cents, is_locked, source_rule, sort_order, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let sortOrder = 0;
  const pricedItems: Array<{ unit_price_cents: number; quantity: number }> = [];

  for (const item of result.items) {
    if (!item.product_id) continue;

    const product = db.prepare('SELECT retail_price FROM products WHERE id = ?').get(item.product_id) as any;
    if (!product) continue;

    const unitPrice = calculateLinePrice(product.retail_price, pricing.pricing_factor);
    const lineTotal = Math.round(unitPrice * item.quantity);

    insertBom.run(id, item.product_id, item.section, item.quantity, unitPrice, lineTotal,
      item.is_locked ? 1 : 0, item.source_rule, sortOrder++, item.note || null);

    pricedItems.push({ unit_price_cents: unitPrice, quantity: item.quantity });
  }

  // Insert flags
  const insertFlag = db.prepare(`
    INSERT INTO quote_flags (quote_id, severity, code, message, is_blocking) VALUES (?, ?, ?, ?, ?)
  `);
  for (const flag of result.flags) {
    insertFlag.run(id, flag.severity, flag.code, flag.message, flag.is_blocking ? 1 : 0);
  }

  // Calculate totals
  const totals = calculateTotals(pricedItems, pricing.vat_rate);

  // Update quote with totals and string info
  db.prepare(`
    UPDATE quotes SET subtotal_cents = ?, vat_cents = ?, total_cents = ?,
      strings_count = ?, panels_per_string = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(totals.subtotal_cents, totals.vat_cents, totals.total_cents,
    result.strings_count, result.panels_per_string, id);

  // Return complete result
  const bomItems = db.prepare(`
    SELECT bi.*, p.sku, p.name as product_name, p.unit
    FROM quote_bom_items bi JOIN products p ON bi.product_id = p.id
    WHERE bi.quote_id = ? ORDER BY bi.section, bi.sort_order
  `).all(id);

  res.json({
    bom_items: bomItems,
    flags: result.flags,
    totals,
    strings_count: result.strings_count,
    panels_per_string: result.panels_per_string,
  });
});

// GET /api/v1/quotes/:id/versions
quoteRoutes.get('/:id/versions', (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const versions = db.prepare('SELECT id, quote_id, version, changed_by, change_summary, created_at FROM quote_versions WHERE quote_id = ? ORDER BY version DESC').all(id);
  res.json({ versions });
});
