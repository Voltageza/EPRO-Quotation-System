import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate, requireRole } from '../middleware/auth';
import { findAllPanels, findPanelById, createPanel, updatePanel, approvePanel, rejectPanel } from '../models/panel.model';
import { createProduct, findProductBySku } from '../models/product.model';
import { parsePanelDatasheet } from '../utils/pdf-parser';
import { validatePanel } from '../services/panel-validation.service';
import { config } from '../config';

export const panelRoutes = Router();
panelRoutes.use(authenticate);

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `panel-${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG, and JPG files are allowed'));
    }
  },
});

// GET /api/v1/panels
panelRoutes.get('/', (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const panels = findAllPanels(status);
  res.json({ panels });
});

// GET /api/v1/panels/:id
panelRoutes.get('/:id', (req: Request, res: Response) => {
  const panel = findPanelById(parseInt(req.params.id as string, 10));
  if (!panel) {
    res.status(404).json({ error: 'Panel not found' });
    return;
  }
  res.json({ panel });
});

// GET /api/v1/panels/:id/validate
panelRoutes.get('/:id/validate', (req: Request, res: Response) => {
  const panel = findPanelById(parseInt(req.params.id as string, 10));
  if (!panel) {
    res.status(404).json({ error: 'Panel not found' });
    return;
  }

  const result = validatePanel({
    imp: panel.imp,
    voc: panel.voc,
    temp_coeff_voc: panel.temp_coeff_voc,
  });

  res.json({ validation: result });
});

// POST /api/v1/panels/upload-datasheet (admin only)
panelRoutes.post('/upload-datasheet', requireRole('admin'), upload.single('datasheet'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'PDF or image file required' });
      return;
    }

    const filePath = req.file.path;
    const extracted = await parsePanelDatasheet(filePath);

    res.json({
      extracted,
      file: {
        filename: req.file.filename,
        path: filePath,
        size: req.file.size,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to parse datasheet: ${err.message}` });
  }
});

// POST /api/v1/panels (admin only) — create panel with specs (after reviewing extracted data)
panelRoutes.post('/', requireRole('admin'), (req: Request, res: Response) => {
  const {
    sku, name, retail_price,
    power_w, voc, vmp, isc, imp, temp_coeff_voc,
    width_mm, height_mm, depth_mm, weight_kg, datasheet_path,
  } = req.body;

  // Validate required fields
  if (!sku || !name || !power_w || !voc || !vmp || !isc || !imp || !temp_coeff_voc) {
    res.status(400).json({ error: 'SKU, name, and all electrical specs (Pmax, Voc, Vmp, Isc, Imp, temp coeff) are required' });
    return;
  }

  // Run validation
  const validation = validatePanel({ imp, voc, temp_coeff_voc });

  try {
    // Create or find product
    let product = findProductBySku(sku);
    let productId: number;

    if (product) {
      productId = product.id;
    } else {
      productId = createProduct({
        sku,
        name,
        category: 'panel',
        unit: 'each',
        retail_price: retail_price || 0,
      });
    }

    // Create panel record
    const panelId = createPanel({
      product_id: productId,
      power_w, voc, vmp, isc, imp, temp_coeff_voc,
      width_mm, height_mm, depth_mm, weight_kg, datasheet_path,
    });

    res.status(201).json({
      id: panelId,
      product_id: productId,
      validation,
      message: 'Panel created — awaiting approval',
    });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Panel already exists for this product' });
    } else {
      throw err;
    }
  }
});

// PATCH /api/v1/panels/:id (admin only) — edit specs
panelRoutes.patch('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  updatePanel(id, req.body);

  // Return updated validation
  const panel = findPanelById(id);
  if (panel) {
    const validation = validatePanel({ imp: panel.imp, voc: panel.voc, temp_coeff_voc: panel.temp_coeff_voc });
    res.json({ message: 'Panel updated', validation });
  } else {
    res.json({ message: 'Panel updated' });
  }
});

// POST /api/v1/panels/:id/approve (admin only)
panelRoutes.post('/:id/approve', requireRole('admin'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const panel = findPanelById(id);

  if (!panel) {
    res.status(404).json({ error: 'Panel not found' });
    return;
  }

  // Must pass validation to approve
  const validation = validatePanel({ imp: panel.imp, voc: panel.voc, temp_coeff_voc: panel.temp_coeff_voc });
  if (!validation.valid) {
    res.status(400).json({
      error: 'Cannot approve — panel fails validation',
      validation,
    });
    return;
  }

  // Check all mandatory fields present
  if (!panel.power_w || !panel.voc || !panel.vmp || !panel.isc || !panel.imp || !panel.temp_coeff_voc) {
    res.status(400).json({ error: 'Cannot approve — missing mandatory electrical specs' });
    return;
  }

  approvePanel(id, req.user!.userId);
  res.json({ message: 'Panel approved' });
});

// POST /api/v1/panels/:id/reject (admin only)
panelRoutes.post('/:id/reject', requireRole('admin'), (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  rejectPanel(id, req.user!.userId);
  res.json({ message: 'Panel rejected' });
});
