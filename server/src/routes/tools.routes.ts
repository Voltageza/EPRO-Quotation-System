import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getDb } from '../database/connection';
import { resolveMounting } from '../services/rule-engine/mounting.engine';
import { PanelData } from '../services/rule-engine/types';
import { getPricingConfig, calculateLinePrice } from '../services/pricing.service';

export const toolsRoutes = Router();
toolsRoutes.use(authenticate);

// POST /api/v1/tools/mounting-calculate
toolsRoutes.post('/mounting-calculate', (req: Request, res: Response) => {
  const { mounting_type, panel_id, width_mm, rows, cols } = req.body;

  // Validate mounting_type
  const validTypes = ['ibr', 'corrugated', 'tile', 'tilt_frame_ibr', 'tilt_frame_corrugated'];
  if (!validTypes.includes(mounting_type)) {
    res.status(400).json({ error: `mounting_type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  // Validate rows/cols
  if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 1) {
    res.status(400).json({ error: 'rows and cols must be positive integers' });
    return;
  }

  // Exactly one of panel_id or width_mm
  if ((panel_id && width_mm) || (!panel_id && !width_mm)) {
    res.status(400).json({ error: 'Provide exactly one of panel_id or width_mm' });
    return;
  }

  const db = getDb();
  let panel: PanelData;

  if (panel_id) {
    const row = db.prepare(`
      SELECT p.*, pr.sku FROM panels p JOIN products pr ON p.product_id = pr.id WHERE p.id = ?
    `).get(panel_id) as PanelData | undefined;

    if (!row) {
      res.status(404).json({ error: 'Panel not found' });
      return;
    }
    panel = row;
  } else {
    // Construct minimal PanelData with just width_mm
    panel = {
      id: 0, product_id: 0, power_w: 0, voc: 0, vmp: 0,
      isc: 0, imp: 0, temp_coeff_voc: 0,
      width_mm: width_mm, height_mm: null,
    };
  }

  const panelQty = rows * cols;
  const result = resolveMounting(panel, panelQty, mounting_type, rows, cols);

  // Enrich items with product name, sku, price
  const pricing = getPricingConfig();
  let grandTotal = 0;
  const enrichedItems = result.items.map((item) => {
    const product = db.prepare(
      'SELECT id, name, sku, retail_price FROM products WHERE id = ?'
    ).get(item.product_id) as any;

    if (!product) {
      return { ...item, name: 'Unknown', unit_price_cents: 0, line_total_cents: 0 };
    }

    const unitPrice = calculateLinePrice(product.retail_price, pricing.pricing_factor);
    const lineTotal = Math.round(unitPrice * item.quantity);
    grandTotal += lineTotal;

    return {
      ...item,
      name: product.name,
      sku: product.sku,
      unit_price_cents: unitPrice,
      line_total_cents: lineTotal,
    };
  });

  res.json({
    items: enrichedItems,
    flags: result.flags,
    grand_total_cents: grandTotal,
  });
});
