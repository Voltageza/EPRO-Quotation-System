import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getPricingConfig, updatePricingConfig } from '../services/pricing.service';
import { getDb } from '../database/connection';

export const adminRoutes = Router();

// All admin routes require auth + admin role
adminRoutes.use(authenticate);

// GET /api/v1/admin/pricing
adminRoutes.get('/pricing', (req: Request, res: Response) => {
  const config = getPricingConfig();
  res.json({ pricing: config });
});

// PATCH /api/v1/admin/pricing (admin only)
adminRoutes.patch('/pricing', requireRole('admin'), (req: Request, res: Response) => {
  const { pricing_factor, vat_rate, min_margin, travel_rate, labour_rate } = req.body;

  updatePricingConfig(
    { pricing_factor, vat_rate, min_margin, travel_rate, labour_rate },
    req.user!.userId
  );

  const updated = getPricingConfig();
  res.json({ pricing: updated, message: 'Pricing updated' });
});

// GET /api/v1/admin/audit
adminRoutes.get('/audit', requireRole('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const logs = db.prepare(`
    SELECT al.*, u.display_name as user_name
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = (db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as any).count;

  res.json({ logs, total, limit, offset });
});

// === RULE TABLES ===

// GET /api/v1/admin/rules
adminRoutes.get('/rules', requireRole('admin'), (_req: Request, res: Response) => {
  const db = getDb();
  const tables = db.prepare('SELECT * FROM rule_tables ORDER BY rule_type, version DESC').all();
  res.json({ rules: tables });
});

// GET /api/v1/admin/rules/:id/entries
adminRoutes.get('/rules/:id/entries', requireRole('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const table = db.prepare('SELECT * FROM rule_tables WHERE id = ?').get(id);
  if (!table) { res.status(404).json({ error: 'Rule table not found' }); return; }
  const entries = db.prepare('SELECT * FROM rule_entries WHERE rule_table_id = ? ORDER BY sort_order').all(id);
  res.json({ table, entries });
});

// PATCH /api/v1/admin/rules/entries/:id — update a rule entry's result_json
adminRoutes.patch('/rules/entries/:id', requireRole('admin'), (req: Request, res: Response) => {
  const db = getDb();
  const id = parseInt(req.params.id as string, 10);
  const { result_json } = req.body;

  if (!result_json) { res.status(400).json({ error: 'result_json required' }); return; }

  // Validate it's valid JSON
  try { JSON.parse(result_json); } catch { res.status(400).json({ error: 'Invalid JSON' }); return; }

  db.prepare("UPDATE rule_entries SET result_json = ?, updated_at = datetime('now') WHERE id = ?").run(result_json, id);
  res.json({ message: 'Rule entry updated' });
});
