import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getDb } from '../database/connection';

export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate);

// GET /api/v1/dashboard/stats
dashboardRoutes.get('/stats', (_req: Request, res: Response) => {
  const db = getDb();

  const totalQuotes = (db.prepare('SELECT COUNT(*) as count FROM quotes').get() as any).count;
  const totalClients = (db.prepare('SELECT COUNT(*) as count FROM clients').get() as any).count;

  const revenueRow = db.prepare(
    "SELECT COALESCE(SUM(total_cents), 0) as total FROM quotes WHERE status IN ('approved', 'sent', 'accepted')"
  ).get() as any;
  const revenueCents = revenueRow.total;

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const quotesThisMonth = (db.prepare(
    'SELECT COUNT(*) as count FROM quotes WHERE created_at LIKE ?'
  ).get(`${monthPrefix}%`) as any).count;

  const statusBreakdown = db.prepare(
    'SELECT status, COUNT(*) as count FROM quotes GROUP BY status'
  ).all() as Array<{ status: string; count: number }>;

  const systemClassDistribution = db.prepare(
    'SELECT system_class, COUNT(*) as count FROM quotes GROUP BY system_class'
  ).all() as Array<{ system_class: string; count: number }>;

  const revenueBySystemClass = db.prepare(
    "SELECT system_class, COALESCE(SUM(total_cents), 0) as total FROM quotes WHERE status IN ('approved', 'sent', 'accepted') GROUP BY system_class"
  ).all() as Array<{ system_class: string; total: number }>;

  const recentQuotes = db.prepare(`
    SELECT q.id, q.quote_number, q.system_class, q.status, q.total_cents, q.created_at,
           c.name as client_name
    FROM quotes q
    JOIN clients c ON q.client_id = c.id
    ORDER BY q.created_at DESC
    LIMIT 10
  `).all();

  res.json({
    total_quotes: totalQuotes,
    total_clients: totalClients,
    revenue_cents: revenueCents,
    quotes_this_month: quotesThisMonth,
    status_breakdown: statusBreakdown,
    system_class_distribution: systemClassDistribution,
    revenue_by_system_class: revenueBySystemClass,
    recent_quotes: recentQuotes,
  });
});
