import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getDb } from '../database/connection';
import { recommendMppt } from '../services/design-assistant';

export const componentRoutes = Router();
componentRoutes.use(authenticate);

// === INVERTERS ===

// GET /api/v1/components/inverters
componentRoutes.get('/inverters', (_req: Request, res: Response) => {
  const db = getDb();
  const inverters = db.prepare(`
    SELECT i.*, p.sku, p.name, p.retail_price, p.is_active
    FROM inverters i
    JOIN products p ON i.product_id = p.id
    WHERE p.is_active = 1
    ORDER BY i.rated_va
  `).all();
  res.json({ inverters });
});

// GET /api/v1/components/inverters/by-class/:class
componentRoutes.get('/inverters/by-class/:class', (req: Request, res: Response) => {
  const db = getDb();
  const systemClass = req.params.class as string;
  const inverter = db.prepare(`
    SELECT i.*, p.sku, p.name, p.retail_price
    FROM inverters i
    JOIN products p ON i.product_id = p.id
    WHERE i.system_class = ? AND p.is_active = 1
  `).get(systemClass);
  if (!inverter) {
    res.status(404).json({ error: `No inverter found for system class ${systemClass}` });
    return;
  }
  res.json({ inverter });
});

// POST /api/v1/components/inverters (admin)
componentRoutes.post('/inverters', requireRole('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const { product_id, system_class, rated_va, max_dc_voltage, ac_output_amps, dc_input_amps } = req.body;
  if (!product_id || !system_class || !rated_va || !max_dc_voltage || !ac_output_amps) {
    res.status(400).json({ error: 'product_id, system_class, rated_va, max_dc_voltage, ac_output_amps required' });
    return;
  }
  try {
    const result = db.prepare(`
      INSERT INTO inverters (product_id, system_class, rated_va, max_dc_voltage, ac_output_amps, dc_input_amps)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(product_id, system_class, rated_va, max_dc_voltage, ac_output_amps, dc_input_amps || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Inverter created' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Inverter specs already exist for this product' });
    } else {
      throw err;
    }
  }
});

// === MPPTs ===

// GET /api/v1/components/mppts/recommend?panel_id=X&panel_qty=Y
componentRoutes.get('/mppts/recommend', (req: Request, res: Response) => {
  const panelId = parseInt(req.query.panel_id as string, 10);
  const panelQty = parseInt(req.query.panel_qty as string, 10);

  if (!panelId || !panelQty || panelQty < 1) {
    res.status(400).json({ error: 'panel_id and panel_qty (>= 1) are required' });
    return;
  }

  try {
    const recommendations = recommendMppt(panelId, panelQty);
    res.json({ recommendations });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/v1/components/mppts
componentRoutes.get('/mppts', (_req: Request, res: Response) => {
  const db = getDb();
  const mppts = db.prepare(`
    SELECT m.*, p.sku, p.name, p.retail_price, p.is_active
    FROM mppts m
    JOIN products p ON m.product_id = p.id
    WHERE p.is_active = 1
    ORDER BY m.max_pv_voltage, m.max_charge_a
  `).all();
  res.json({ mppts });
});

// POST /api/v1/components/mppts (admin)
componentRoutes.post('/mppts', requireRole('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const { product_id, max_pv_voltage, max_charge_a, model_code, max_pv_power_w } = req.body;
  if (!product_id || !max_pv_voltage || !max_charge_a || !model_code) {
    res.status(400).json({ error: 'product_id, max_pv_voltage, max_charge_a, model_code required' });
    return;
  }
  try {
    const result = db.prepare(`
      INSERT INTO mppts (product_id, max_pv_voltage, max_charge_a, model_code, max_pv_power_w)
      VALUES (?, ?, ?, ?, ?)
    `).run(product_id, max_pv_voltage, max_charge_a, model_code, max_pv_power_w || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'MPPT created' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'MPPT specs already exist for this product' });
    } else {
      throw err;
    }
  }
});

// === BATTERIES ===

// GET /api/v1/components/batteries
componentRoutes.get('/batteries', (_req: Request, res: Response) => {
  const db = getDb();
  const batteries = db.prepare(`
    SELECT b.*, p.sku, p.name, p.retail_price, p.is_active
    FROM batteries b
    JOIN products p ON b.product_id = p.id
    WHERE p.is_active = 1
    ORDER BY b.capacity_kwh
  `).all();
  res.json({ batteries });
});

// POST /api/v1/components/batteries (admin)
componentRoutes.post('/batteries', requireRole('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const { product_id, capacity_kwh, voltage, max_charge_a, max_discharge_a, chemistry } = req.body;
  if (!product_id || !capacity_kwh || !voltage) {
    res.status(400).json({ error: 'product_id, capacity_kwh, voltage required' });
    return;
  }
  try {
    const result = db.prepare(`
      INSERT INTO batteries (product_id, capacity_kwh, voltage, max_charge_a, max_discharge_a, chemistry)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(product_id, capacity_kwh, voltage, max_charge_a || null, max_discharge_a || null, chemistry || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Battery created' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Battery specs already exist for this product' });
    } else {
      throw err;
    }
  }
});
