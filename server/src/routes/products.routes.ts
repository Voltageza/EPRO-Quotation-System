import { Router, Request, Response } from 'express';
import fs from 'fs';
import { authenticate, requireRole } from '../middleware/auth';
import {
  findAllProducts, findProductById, createProduct,
  updateProduct, softDeleteProduct, getPriceHistory
} from '../models/product.model';
import { parseHTM } from '../utils/htm-parser';
import { getDb } from '../database/connection';

export const productRoutes = Router();

// All product routes require authentication
productRoutes.use(authenticate);

// GET /api/v1/products
productRoutes.get('/', (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const products = findAllProducts(category);
  res.json({ products });
});

// GET /api/v1/products/:id
productRoutes.get('/:id', (req: Request, res: Response) => {
  const product = findProductById(parseInt(req.params.id as string, 10));
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ product });
});

// POST /api/v1/products (admin only)
productRoutes.post('/', requireRole('admin'), (req: Request, res: Response) => {
  const { sku, name, category, subcategory, unit, retail_price, notes } = req.body;

  if (!sku || !name || !category || retail_price === undefined) {
    res.status(400).json({ error: 'SKU, name, category, and retail_price required' });
    return;
  }

  try {
    const id = createProduct({ sku, name, category, subcategory, unit, retail_price, notes });
    res.status(201).json({ id, message: 'Product created' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'SKU already exists' });
    } else {
      throw err;
    }
  }
});

// PATCH /api/v1/products/:id (admin only)
productRoutes.patch('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  updateProduct(id, req.body, req.user!.userId);
  res.json({ message: 'Product updated' });
});

// DELETE /api/v1/products/:id (admin only)
productRoutes.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  softDeleteProduct(parseInt(req.params.id as string, 10));
  res.json({ message: 'Product deactivated' });
});

// GET /api/v1/products/:id/price-history (admin only)
productRoutes.get('/:id/price-history', requireRole('admin'), (req: Request, res: Response) => {
  const history = getPriceHistory(parseInt(req.params.id as string, 10));
  res.json({ history });
});

// POST /api/v1/products/import-htm (admin only)
productRoutes.post('/import-htm', requireRole('admin'), (req: Request, res: Response) => {
  const { filePath } = req.body;

  if (!filePath) {
    res.status(400).json({ error: 'filePath required' });
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const html = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseHTM(html);

  const db = getDb();
  let imported = 0;
  let skipped = 0;

  const insertOrUpdate = db.transaction(() => {
    for (const p of parsed) {
      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(p.sku) as any;
      if (existing) {
        skipped++;
      } else {
        db.prepare(`
          INSERT INTO products (sku, name, category, subcategory, unit, retail_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(p.sku, p.name, p.category, p.subcategory, p.unit, p.retail_price_cents);
        imported++;
      }
    }
  });

  insertOrUpdate();

  res.json({
    message: `Imported ${imported} products, skipped ${skipped} duplicates`,
    total_parsed: parsed.length,
    imported,
    skipped,
  });
});
