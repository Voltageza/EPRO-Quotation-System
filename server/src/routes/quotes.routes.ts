import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getDb } from '../database/connection';
import { generateBom } from '../services/rule-engine';
import { generateBomFromDesign } from '../services/graph-bom-generator';
import { getPricingConfig, calculateLinePrice, calculateTotals } from '../services/pricing.service';
import { generateQuotePdf } from '../services/pdf-generator';
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
  const { client_id, system_class, design_mode, brand } = req.body;

  if (!client_id) {
    res.status(400).json({ error: 'client_id required' });
    return;
  }

  const pricing = getPricingConfig();
  const quoteNumber = nextQuoteNumber();
  const mode = design_mode || 'wizard';
  const sysClass = system_class || 'V10';
  const quoteBrand = brand || 'Victron';

  const result = db.prepare(`
    INSERT INTO quotes (quote_number, client_id, system_class, design_mode, brand, pricing_factor, vat_rate, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(quoteNumber, client_id, sysClass, mode, quoteBrand, pricing.pricing_factor, pricing.vat_rate, req.user!.userId);

  const quoteId = result.lastInsertRowid as number;

  // For designer mode, create initial empty design
  if (mode === 'designer') {
    db.prepare(`
      INSERT INTO quote_designs (quote_id, version, graph_json)
      VALUES (?, 1, '{"nodes":[],"edges":[]}')
    `).run(quoteId);
  }

  res.status(201).json({ id: quoteId, quote_number: quoteNumber });
});

// PATCH /api/v1/quotes/:id — update quote details
quoteRoutes.patch('/:id', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const allowed = [
    'system_class', 'design_mode', 'dc_battery_distance_m', 'ac_inverter_db_distance_m',
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
    mounting_type: req.body.mounting_type || 'tile',
    mounting_rows: req.body.mounting_rows || 2,
    mounting_cols: req.body.mounting_cols || 6,
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

// POST /api/v1/quotes/:id/clone — duplicate a quote with fresh BoM
quoteRoutes.post('/:id/clone', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);

  const source = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as any;
  if (!source) { res.status(404).json({ error: 'Quote not found' }); return; }

  const pricing = getPricingConfig();
  const quoteNumber = nextQuoteNumber();

  // Create new quote copying component selections and distances
  const result = db.prepare(`
    INSERT INTO quotes (quote_number, client_id, system_class, design_mode, brand, panel_id, panel_qty,
      battery_id, battery_qty, mppt_id, mppt_qty,
      dc_battery_distance_m, ac_inverter_db_distance_m, ac_db_grid_distance_m,
      pv_string_length_m, travel_distance_km,
      pricing_factor, vat_rate, status, version, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?)
  `).run(
    quoteNumber, source.client_id, source.system_class, source.design_mode || 'wizard', source.brand || 'Victron',
    source.panel_id, source.panel_qty,
    source.battery_id, source.battery_qty,
    source.mppt_id, source.mppt_qty,
    source.dc_battery_distance_m, source.ac_inverter_db_distance_m,
    source.ac_db_grid_distance_m, source.pv_string_length_m, source.travel_distance_km,
    pricing.pricing_factor, pricing.vat_rate,
    `Cloned from ${source.quote_number}.`,
    req.user!.userId,
  );

  const newId = result.lastInsertRowid as number;

  // Copy design graph if source was designer mode
  if (source.design_mode === 'designer') {
    const sourceDesign = db.prepare('SELECT graph_json FROM quote_designs WHERE quote_id = ? ORDER BY version DESC LIMIT 1').get(source.id) as any;
    if (sourceDesign) {
      db.prepare("INSERT INTO quote_designs (quote_id, version, graph_json) VALUES (?, 1, ?)").run(newId, sourceDesign.graph_json);
    }
  }

  // Copy BoM items with current pricing
  const sourceBomItems = db.prepare(`
    SELECT bi.*, p.retail_price FROM quote_bom_items bi
    JOIN products p ON bi.product_id = p.id
    WHERE bi.quote_id = ?
    ORDER BY bi.section, bi.sort_order
  `).all(source.id) as any[];

  const insertBom = db.prepare(`
    INSERT INTO quote_bom_items (quote_id, product_id, section, quantity, unit_price_cents, line_total_cents, is_locked, source_rule, sort_order, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let sortOrder = 0;
  const pricedItems: Array<{ unit_price_cents: number; quantity: number }> = [];

  for (const item of sourceBomItems) {
    const unitPrice = calculateLinePrice(item.retail_price, pricing.pricing_factor);
    const lineTotal = Math.round(unitPrice * item.quantity);

    insertBom.run(newId, item.product_id, item.section, item.quantity, unitPrice, lineTotal,
      item.is_locked ? 1 : 0, item.source_rule, sortOrder++, item.notes || null);

    pricedItems.push({ unit_price_cents: unitPrice, quantity: item.quantity });
  }

  // If no BoM items exist yet (source had none), try regenerating for wizard-mode quotes
  if (sourceBomItems.length === 0 && source.design_mode !== 'designer') {
    const mpptRecord = db.prepare('SELECT product_id FROM mppts WHERE id = ?').get(source.mppt_id) as any;
    const batteryRecord = db.prepare('SELECT product_id FROM batteries WHERE id = ?').get(source.battery_id) as any;

    const input: QuoteInput = {
      system_class: source.system_class,
      panel_id: source.panel_id,
      panel_qty: source.panel_qty,
      battery_id: batteryRecord?.product_id || source.battery_id,
      battery_qty: source.battery_qty,
      mppt_id: mpptRecord?.product_id || source.mppt_id,
      mppt_qty: source.mppt_qty,
      dc_battery_distance_m: source.dc_battery_distance_m,
      ac_inverter_db_distance_m: source.ac_inverter_db_distance_m,
      ac_db_grid_distance_m: source.ac_db_grid_distance_m,
      pv_string_length_m: source.pv_string_length_m,
      travel_distance_km: source.travel_distance_km,
      mounting_type: 'tile',
      mounting_rows: 2,
      mounting_cols: 6,
    };

    const bomResult = generateBom(input);

    for (const item of bomResult.items) {
      if (!item.product_id) continue;
      const product = db.prepare('SELECT retail_price FROM products WHERE id = ?').get(item.product_id) as any;
      if (!product) continue;

      const unitPrice = calculateLinePrice(product.retail_price, pricing.pricing_factor);
      const lineTotal = Math.round(unitPrice * item.quantity);

      insertBom.run(newId, item.product_id, item.section, item.quantity, unitPrice, lineTotal,
        item.is_locked ? 1 : 0, item.source_rule, sortOrder++, item.note || null);

      pricedItems.push({ unit_price_cents: unitPrice, quantity: item.quantity });
    }

    // Insert flags
    const insertFlag = db.prepare(`
      INSERT INTO quote_flags (quote_id, severity, code, message, is_blocking) VALUES (?, ?, ?, ?, ?)
    `);
    for (const flag of bomResult.flags) {
      insertFlag.run(newId, flag.severity, flag.code, flag.message, flag.is_blocking ? 1 : 0);
    }
  }

  // Calculate totals
  const totals = calculateTotals(pricedItems, pricing.vat_rate);

  db.prepare(`
    UPDATE quotes SET subtotal_cents = ?, vat_cents = ?, total_cents = ?,
      strings_count = ?, panels_per_string = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(totals.subtotal_cents, totals.vat_cents, totals.total_cents,
    source.strings_count || 0, source.panels_per_string || 0, newId);

  res.status(201).json({ id: newId, quote_number: quoteNumber });
});

// GET /api/v1/quotes/:id/pdf — generate and download PDF
quoteRoutes.get('/:id/pdf', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  try {
    const pdfBuffer = await generateQuotePdf(id);
    const db = getDb();
    const quote = db.prepare('SELECT quote_number FROM quotes WHERE id = ?').get(id) as any;
    const filename = quote ? `${quote.quote_number}.pdf` : `quote-${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: any) {
    if (err.message === 'Quote not found') {
      res.status(404).json({ error: 'Quote not found' });
    } else {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});

// GET /api/v1/quotes/:id/versions
quoteRoutes.get('/:id/versions', (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const versions = db.prepare('SELECT id, quote_id, version, changed_by, change_summary, created_at FROM quote_versions WHERE quote_id = ? ORDER BY version DESC').all(id);
  res.json({ versions });
});

// POST /api/v1/quotes/:id/generate-bom-from-design — run graph-based BoM generation
quoteRoutes.post('/:id/generate-bom-from-design', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as any;
  if (!quote) { res.status(404).json({ error: 'Quote not found' }); return; }

  // Load the design graph
  const design = db.prepare('SELECT graph_json FROM quote_designs WHERE quote_id = ? ORDER BY version DESC LIMIT 1').get(id) as any;
  if (!design) { res.status(400).json({ error: 'No design saved for this quote' }); return; }

  const graph = JSON.parse(design.graph_json);

  // Merge side panel inputs from request body
  const designInput = {
    nodes: graph.nodes || [],
    edges: graph.edges || [],
    mountingType: req.body.mountingType || 'tile',
    mountingRows: req.body.mountingRows || 2,
    mountingCols: req.body.mountingCols || 6,
    travelDistanceKm: req.body.travelDistanceKm || 0,
    pvStringLengthM: req.body.pvStringLengthM || 20,
  };

  // Generate BoM from design
  const result = generateBomFromDesign(designInput);

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

  // Determine system class from graph
  const inverterNode = (graph.nodes || []).find((n: any) => n.type === 'inverter');
  const graphSystemClass = inverterNode?.data?.systemClass || quote.system_class;

  // Update quote with totals
  db.prepare(`
    UPDATE quotes SET subtotal_cents = ?, vat_cents = ?, total_cents = ?,
      strings_count = ?, panels_per_string = ?,
      system_class = ?, design_mode = 'designer',
      updated_at = datetime('now')
    WHERE id = ?
  `).run(totals.subtotal_cents, totals.vat_cents, totals.total_cents,
    result.strings_count, result.panels_per_string,
    graphSystemClass, id);

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

// === DESIGN GRAPH (node-based designer) ===

// GET /api/v1/quotes/:id/design — load graph JSON
quoteRoutes.get('/:id/design', (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);

  const design = db.prepare('SELECT * FROM quote_designs WHERE quote_id = ? ORDER BY version DESC LIMIT 1').get(id) as any;
  if (!design) {
    res.json({ design: null });
    return;
  }

  res.json({
    design: {
      id: design.id,
      quote_id: design.quote_id,
      version: design.version,
      graph: JSON.parse(design.graph_json),
      updated_at: design.updated_at,
    },
  });
});

// POST /api/v1/quotes/:id/design — save graph JSON
quoteRoutes.post('/:id/design', requireRole('admin', 'sales'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const { graph } = req.body;

  if (!graph) {
    res.status(400).json({ error: 'graph data required' });
    return;
  }

  const graphJson = JSON.stringify(graph);

  // Upsert: update existing or insert new
  const existing = db.prepare('SELECT id, version FROM quote_designs WHERE quote_id = ? ORDER BY version DESC LIMIT 1').get(id) as any;

  if (existing) {
    db.prepare("UPDATE quote_designs SET graph_json = ?, updated_at = datetime('now') WHERE id = ?")
      .run(graphJson, existing.id);
    res.json({ message: 'Design saved', version: existing.version });
  } else {
    db.prepare("INSERT INTO quote_designs (quote_id, version, graph_json) VALUES (?, 1, ?)")
      .run(id, graphJson);
    res.json({ message: 'Design created', version: 1 });
  }

  // Also update quote's updated_at
  db.prepare("UPDATE quotes SET updated_at = datetime('now') WHERE id = ?").run(id);
});
