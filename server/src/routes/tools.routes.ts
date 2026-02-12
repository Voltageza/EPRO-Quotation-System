import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { authenticate } from '../middleware/auth';
import { getDb } from '../database/connection';
import { resolveMounting, resolveMountingIrregular } from '../services/rule-engine/mounting.engine';
import { PanelData } from '../services/rule-engine/types';
import { getPricingConfig, calculateLinePrice } from '../services/pricing.service';
import { config } from '../config';

export const toolsRoutes = Router();
toolsRoutes.use(authenticate);

// Multer for photo uploads
const photoStorage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `photo-${unique}${path.extname(file.originalname)}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/png', 'image/jpeg'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed'));
    }
  },
});

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

// POST /api/v1/tools/mounting-calculate-multi
toolsRoutes.post('/mounting-calculate-multi', (req: Request, res: Response) => {
  const { groups } = req.body;

  if (!Array.isArray(groups) || groups.length === 0 || groups.length > 50) {
    res.status(400).json({ error: 'groups must be a non-empty array (max 50)' });
    return;
  }

  const validTypes = ['ibr', 'corrugated', 'tile', 'tilt_frame_ibr', 'tilt_frame_corrugated'];
  const db = getDb();
  const pricing = getPricingConfig();

  const groupResults: Array<{
    label: string;
    panel_count: number;
    items: any[];
    flags: any[];
    subtotal_cents: number;
  }> = [];

  const allFlags: any[] = [];
  const combinedMap = new Map<string, { sku: string; product_id: number | undefined; section: string; name: string; unit_price_cents: number; quantity: number; line_total_cents: number }>();
  let totalPanels = 0;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const label = g.label || `Array ${i + 1}`;

    // Validate mounting_type
    if (!validTypes.includes(g.mounting_type)) {
      res.status(400).json({ error: `[${label}] mounting_type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    // Validate rows/cols
    if (!Number.isInteger(g.rows) || g.rows < 1 || !Number.isInteger(g.cols) || g.cols < 1) {
      res.status(400).json({ error: `[${label}] rows and cols must be positive integers` });
      return;
    }

    // Exactly one of panel_id or width_mm
    if ((g.panel_id && g.width_mm) || (!g.panel_id && !g.width_mm)) {
      res.status(400).json({ error: `[${label}] Provide exactly one of panel_id or width_mm` });
      return;
    }

    let panel: PanelData;
    if (g.panel_id) {
      const row = db.prepare(`
        SELECT p.*, pr.sku FROM panels p JOIN products pr ON p.product_id = pr.id WHERE p.id = ?
      `).get(g.panel_id) as PanelData | undefined;

      if (!row) {
        res.status(404).json({ error: `[${label}] Panel not found (id=${g.panel_id})` });
        return;
      }
      panel = row;
    } else {
      panel = {
        id: 0, product_id: 0, power_w: 0, voc: 0, vmp: 0,
        isc: 0, imp: 0, temp_coeff_voc: 0,
        width_mm: g.width_mm, height_mm: null,
      };
    }

    const panelQty = g.rows * g.cols;
    totalPanels += panelQty;

    const mountResult = resolveMounting(panel, panelQty, g.mounting_type, g.rows, g.cols);

    // Enrich items with prices
    let subtotal = 0;
    const enrichedItems = mountResult.items.map((item) => {
      const product = db.prepare(
        'SELECT id, name, sku, retail_price FROM products WHERE id = ?'
      ).get(item.product_id) as any;

      if (!product) {
        return { ...item, name: 'Unknown', sku: '', unit_price_cents: 0, line_total_cents: 0 };
      }

      const unitPrice = calculateLinePrice(product.retail_price, pricing.pricing_factor);
      const lineTotal = Math.round(unitPrice * item.quantity);
      subtotal += lineTotal;

      return {
        ...item,
        name: product.name,
        sku: product.sku,
        unit_price_cents: unitPrice,
        line_total_cents: lineTotal,
      };
    });

    // Prefix flags with group label
    const prefixedFlags = mountResult.flags.map((f) => ({
      ...f,
      message: `[${label}] ${f.message}`,
    }));

    groupResults.push({
      label,
      panel_count: panelQty,
      items: enrichedItems,
      flags: prefixedFlags,
      subtotal_cents: subtotal,
    });

    allFlags.push(...prefixedFlags);

    // Aggregate into combined map by SKU
    for (const item of enrichedItems) {
      const key = item.sku || `pid-${item.product_id}`;
      if (combinedMap.has(key)) {
        const existing = combinedMap.get(key)!;
        existing.quantity += item.quantity;
        existing.line_total_cents += item.line_total_cents;
      } else {
        combinedMap.set(key, {
          sku: item.sku,
          product_id: item.product_id,
          section: item.section,
          name: item.name,
          unit_price_cents: item.unit_price_cents,
          quantity: item.quantity,
          line_total_cents: item.line_total_cents,
        });
      }
    }
  }

  const grandTotal = groupResults.reduce((sum, g) => sum + g.subtotal_cents, 0);

  res.json({
    groups: groupResults,
    combined: {
      items: Array.from(combinedMap.values()),
      flags: allFlags,
      grand_total_cents: grandTotal,
      total_panels: totalPanels,
    },
  });
});

// POST /api/v1/tools/mounting-calculate-irregular
// Accepts groups with row_counts (panels per row) for irregular layouts
toolsRoutes.post('/mounting-calculate-irregular', (req: Request, res: Response) => {
  const { groups } = req.body;

  if (!Array.isArray(groups) || groups.length === 0 || groups.length > 50) {
    res.status(400).json({ error: 'groups must be a non-empty array (max 50)' });
    return;
  }

  const validTypes = ['ibr', 'corrugated', 'tile', 'tilt_frame_ibr', 'tilt_frame_corrugated'];
  const db = getDb();
  const pricing = getPricingConfig();

  const groupResults: Array<{
    label: string;
    panel_count: number;
    items: any[];
    flags: any[];
    subtotal_cents: number;
  }> = [];

  const allFlags: any[] = [];
  const combinedMap = new Map<string, { sku: string; product_id: number | undefined; section: string; name: string; unit_price_cents: number; quantity: number; line_total_cents: number }>();
  let totalPanels = 0;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const label = g.label || `Array ${i + 1}`;

    if (!validTypes.includes(g.mounting_type)) {
      res.status(400).json({ error: `[${label}] mounting_type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    if (!Array.isArray(g.row_counts) || g.row_counts.length === 0) {
      res.status(400).json({ error: `[${label}] row_counts must be a non-empty array of positive integers` });
      return;
    }

    const rowCounts: number[] = g.row_counts.filter((r: number) => r > 0);
    if (rowCounts.length === 0) {
      continue; // skip empty groups
    }

    if ((g.panel_id && g.width_mm) || (!g.panel_id && !g.width_mm)) {
      res.status(400).json({ error: `[${label}] Provide exactly one of panel_id or width_mm` });
      return;
    }

    let panel: PanelData;
    if (g.panel_id) {
      const row = db.prepare(`
        SELECT p.*, pr.sku FROM panels p JOIN products pr ON p.product_id = pr.id WHERE p.id = ?
      `).get(g.panel_id) as PanelData | undefined;
      if (!row) {
        res.status(404).json({ error: `[${label}] Panel not found (id=${g.panel_id})` });
        return;
      }
      panel = row;
    } else {
      panel = {
        id: 0, product_id: 0, power_w: 0, voc: 0, vmp: 0,
        isc: 0, imp: 0, temp_coeff_voc: 0,
        width_mm: g.width_mm, height_mm: null,
      };
    }

    const panelQty = rowCounts.reduce((s: number, r: number) => s + r, 0);
    totalPanels += panelQty;

    const rowColumns: number[][] | undefined = Array.isArray(g.row_columns) ? g.row_columns.filter((cols: number[]) => cols.length > 0) : undefined;
    const mountResult = resolveMountingIrregular(panel, rowCounts, g.mounting_type, rowColumns);

    let subtotal = 0;
    const enrichedItems = mountResult.items.map((item) => {
      const product = db.prepare(
        'SELECT id, name, sku, retail_price FROM products WHERE id = ?'
      ).get(item.product_id) as any;

      if (!product) {
        return { ...item, name: 'Unknown', sku: '', unit_price_cents: 0, line_total_cents: 0 };
      }

      const unitPrice = calculateLinePrice(product.retail_price, pricing.pricing_factor);
      const lineTotal = Math.round(unitPrice * item.quantity);
      subtotal += lineTotal;

      return {
        ...item,
        name: product.name,
        sku: product.sku,
        unit_price_cents: unitPrice,
        line_total_cents: lineTotal,
      };
    });

    const prefixedFlags = mountResult.flags.map((f) => ({
      ...f,
      message: `[${label}] ${f.message}`,
    }));

    groupResults.push({ label, panel_count: panelQty, items: enrichedItems, flags: prefixedFlags, subtotal_cents: subtotal });
    allFlags.push(...prefixedFlags);

    for (const item of enrichedItems) {
      const key = item.sku || `pid-${item.product_id}`;
      if (combinedMap.has(key)) {
        const existing = combinedMap.get(key)!;
        existing.quantity += item.quantity;
        existing.line_total_cents += item.line_total_cents;
      } else {
        combinedMap.set(key, {
          sku: item.sku,
          product_id: item.product_id,
          section: item.section,
          name: item.name,
          unit_price_cents: item.unit_price_cents,
          quantity: item.quantity,
          line_total_cents: item.line_total_cents,
        });
      }
    }
  }

  const grandTotal = groupResults.reduce((sum, g) => sum + g.subtotal_cents, 0);

  res.json({
    groups: groupResults,
    combined: {
      items: Array.from(combinedMap.values()),
      flags: allFlags,
      grand_total_cents: grandTotal,
      total_panels: totalPanels,
    },
  });
});

// POST /api/v1/tools/mounting-analyze-photo
toolsRoutes.post('/mounting-analyze-photo', photoUpload.single('photo'), async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    res.status(501).json({
      error: 'Gemini API key not configured. Add GEMINI_API_KEY to your .env file. Get a free key at https://aistudio.google.com/app/apikey',
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No photo uploaded. Send a file in the "photo" field.' });
    return;
  }

  const filePath = req.file.path;

  try {
    // Read file as base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype as 'image/png' | 'image/jpeg';

    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
        {
          text: `You are an expert solar panel installer analyzing an aerial/roof photo.

TASK: Count every single solar panel visible in this photo with high accuracy.

INSTRUCTIONS:
1. First, identify ALL distinct clusters/arrays of panels on the roof. Panels on different roof faces or separated by gaps are different clusters.
2. For each cluster, carefully count row by row from top to bottom. A "row" is a horizontal line of panels.
3. Count each panel individually — do NOT estimate. Zoom into each section mentally.
4. Clusters are often NOT perfect rectangles. Roofs have hips, valleys, and angles, so rows may have different panel counts.
5. If panels are in portrait orientation (tall and narrow), each tall rectangle is one panel. If landscape (wide and short), each wide rectangle is one panel.
6. Double-check your count. This is for a mounting hardware quote — accuracy matters.

RESPONSE FORMAT (JSON only):
{ "groups": [{ "label": "descriptive name", "rows": [6, 6, 6, 5, 3] }] }

The "rows" array has one number per row = how many panels in that row, top to bottom.
Example: a hip roof section might be { "label": "North Face", "rows": [2, 4, 6, 8, 8] }

If no solar panels are visible, return: { "groups": [] }`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 8000 },
      },
    });

    const jsonStr = (response.text ?? '').trim();
    if (!jsonStr) {
      res.status(502).json({ error: 'No response from AI model' });
      return;
    }

    let parsed: { groups: Array<{ label: string; rows: number[] }> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      res.status(502).json({ error: 'Failed to parse AI response as JSON', raw: jsonStr });
      return;
    }

    if (!parsed.groups || !Array.isArray(parsed.groups)) {
      res.status(502).json({ error: 'AI response missing "groups" array', raw: jsonStr });
      return;
    }

    // Sanitize: ensure each row value is a positive integer
    const groups = parsed.groups.map((g, i) => {
      const rows = Array.isArray(g.rows)
        ? g.rows.map((r) => Math.max(1, Math.round(Number(r) || 1)))
        : [1];
      return {
        label: g.label || `Array ${i + 1}`,
        rows,
      };
    });

    const total_panels = groups.reduce((sum, g) => sum + g.rows.reduce((s, r) => s + r, 0), 0);

    res.json({ groups, total_panels });
  } catch (err: any) {
    console.error('Photo analysis error:', err);
    if (err.message?.includes('API key')) {
      res.status(502).json({ error: 'Invalid Gemini API key. Check your GEMINI_API_KEY in .env.' });
    } else {
      res.status(500).json({ error: err.message || 'Photo analysis failed' });
    }
  } finally {
    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
});
