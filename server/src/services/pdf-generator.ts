import PDFDocument from 'pdfkit';
import { getDb } from '../database/connection';
import { formatCurrency } from './pricing.service';

interface BomRow {
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  section: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  sort_order: number;
}

interface QuoteRow {
  id: number;
  quote_number: string;
  system_class: string;
  status: string;
  panel_qty: number;
  battery_qty: number;
  mppt_qty: number;
  strings_count: number;
  panels_per_string: number;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  vat_rate: number;
  dc_battery_distance_m: number;
  ac_inverter_db_distance_m: number;
  ac_db_grid_distance_m: number;
  pv_string_length_m: number;
  travel_distance_km: number;
  notes: string | null;
  created_at: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  inverter: 'Inverter',
  solar_panels: 'Solar Panels',
  battery: 'Battery',
  dc_battery: 'DC Battery Cabling',
  pv_cabling: 'PV String Cabling',
  pv_dc_protection: 'PV DC Protection',
  ac_cabling: 'AC Cabling',
  ac_protection: 'AC Protection',
  mounting: 'Mounting & Hardware',
  labour: 'Labour & Installation',
  travel: 'Travel',
};

const SECTION_ORDER = ['inverter', 'solar_panels', 'battery', 'dc_battery', 'pv_cabling', 'pv_dc_protection', 'ac_cabling', 'ac_protection', 'mounting', 'labour', 'travel'];

export function generateQuotePdf(quoteId: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const db = getDb();

    const quote = db.prepare(`
      SELECT q.*, c.name as client_name, c.phone as client_phone,
             c.email as client_email, c.address as client_address
      FROM quotes q JOIN clients c ON q.client_id = c.id WHERE q.id = ?
    `).get(quoteId) as QuoteRow | undefined;

    if (!quote) {
      reject(new Error('Quote not found'));
      return;
    }

    const bomItems = db.prepare(`
      SELECT bi.*, p.sku, p.name as product_name, p.unit
      FROM quote_bom_items bi
      JOIN products p ON bi.product_id = p.id
      WHERE bi.quote_id = ?
      ORDER BY bi.section, bi.sort_order
    `).all(quoteId) as BomRow[];

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ──
    doc.fontSize(22).font('Helvetica-Bold').text('Electrical Pro', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
      .text('Solar Energy Solutions', 50, 75);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
      .text(quote.quote_number, 400, 50, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text(`Date: ${new Date(quote.created_at).toLocaleDateString('en-ZA')}`, 400, 67, { align: 'right' })
      .text(`System: ${quote.system_class}`, 400, 80, { align: 'right' });

    // Divider
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#cccccc').stroke();

    // ── Client Info ──
    let y = 115;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Client', 50, y);
    y += 18;
    doc.fontSize(10).font('Helvetica');
    doc.text(quote.client_name, 50, y);
    y += 14;
    if (quote.client_phone) { doc.text(`Phone: ${quote.client_phone}`, 50, y); y += 14; }
    if (quote.client_email) { doc.text(`Email: ${quote.client_email}`, 50, y); y += 14; }
    if (quote.client_address) { doc.text(`Address: ${quote.client_address}`, 50, y); y += 14; }

    // ── System Summary ──
    y += 8;
    doc.fontSize(12).font('Helvetica-Bold').text('System Summary', 50, y);
    y += 18;
    doc.fontSize(10).font('Helvetica');

    const summaryLines = [
      `System Class: ${quote.system_class}`,
      `Panels: ${quote.panel_qty} (${quote.strings_count} string${quote.strings_count !== 1 ? 's' : ''} of ${quote.panels_per_string})`,
      `Batteries: ${quote.battery_qty}`,
      `MPPTs: ${quote.mppt_qty}`,
    ];
    for (const line of summaryLines) {
      doc.text(line, 50, y);
      y += 14;
    }

    // ── BoM Table ──
    y += 12;
    doc.fontSize(12).font('Helvetica-Bold').text('Bill of Materials', 50, y);
    y += 20;

    // Group items by section
    const grouped: Record<string, BomRow[]> = {};
    for (const item of bomItems) {
      if (!grouped[item.section]) grouped[item.section] = [];
      grouped[item.section].push(item);
    }

    // Table column positions (A4 usable: 50–545 = 495pt)
    // SKU 60 | Desc 215 | Qty 55 | Unit Price 80 | Total 85
    const colX = { sku: 50, desc: 110, qty: 325, unit: 380, total: 460 };
    const colW = { sku: 58, desc: 210, qty: 53, unit: 78, total: 83 };

    for (const section of SECTION_ORDER) {
      const items = grouped[section];
      if (!items || items.length === 0) continue;

      // Check if we need a new page (section header + at least 2 rows)
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      // Section header
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#444444');
      doc.rect(50, y, 495, 16).fill('#f0f0f0');
      doc.fillColor('#444444').text(SECTION_LABELS[section] || section, 54, y + 3);
      y += 20;

      // Column headers
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#666666');
      doc.text('SKU', colX.sku, y, { width: colW.sku });
      doc.text('Description', colX.desc, y, { width: colW.desc });
      doc.text('Qty', colX.qty, y, { width: colW.qty, align: 'right' });
      doc.text('Unit Price', colX.unit, y, { width: colW.unit, align: 'right' });
      doc.text('Total', colX.total, y, { width: colW.total, align: 'right' });
      y += 14;

      doc.moveTo(50, y - 2).lineTo(545, y - 2).strokeColor('#dddddd').stroke();

      // Items
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      for (const item of items) {
        if (y > 740) {
          doc.addPage();
          y = 50;
        }

        doc.text(item.sku, colX.sku, y, { width: colW.sku, lineBreak: false });
        doc.text(item.product_name, colX.desc, y, { width: colW.desc, lineBreak: false });
        doc.text(String(item.quantity), colX.qty, y, { width: colW.qty, align: 'right', lineBreak: false });
        doc.text(formatCurrency(item.unit_price_cents), colX.unit, y, { width: colW.unit, align: 'right', lineBreak: false });
        doc.text(formatCurrency(item.line_total_cents), colX.total, y, { width: colW.total, align: 'right', lineBreak: false });
        y += 14;
      }

      y += 6;
    }

    // ── Totals ──
    if (y > 680) { doc.addPage(); y = 50; }
    y += 10;
    doc.moveTo(370, y).lineTo(545, y).strokeColor('#000000').lineWidth(1).stroke();
    y += 8;

    doc.fontSize(10).font('Helvetica');
    doc.text('Subtotal:', 370, y, { width: 90 });
    doc.text(formatCurrency(quote.subtotal_cents), 470, y, { width: 75, align: 'right' });
    y += 16;

    const vatPct = Math.round(quote.vat_rate * 100);
    doc.text(`VAT (${vatPct}%):`, 370, y, { width: 90 });
    doc.text(formatCurrency(quote.vat_cents), 470, y, { width: 75, align: 'right' });
    y += 18;

    doc.moveTo(370, y).lineTo(545, y).strokeColor('#000000').stroke();
    y += 8;
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Total:', 370, y, { width: 90 });
    doc.text(formatCurrency(quote.total_cents), 470, y, { width: 75, align: 'right' });
    y += 24;

    // ── Notes ──
    if (quote.notes) {
      if (y > 700) { doc.addPage(); y = 50; }
      doc.fontSize(10).font('Helvetica-Bold').text('Notes', 50, y);
      y += 16;
      doc.fontSize(9).font('Helvetica').text(quote.notes, 50, y, { width: 495 });
      y += doc.heightOfString(quote.notes, { width: 495 }) + 10;
    }

    // ── Disclaimer ──
    if (y > 680) { doc.addPage(); y = 50; }
    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').stroke();
    y += 10;
    doc.fontSize(7).font('Helvetica').fillColor('#999999');
    const disclaimer = [
      'This quotation is valid for 30 days from the date of issue.',
      'Prices include VAT at the rate shown. Installation is subject to site inspection.',
      'Design is based on standard assumptions. Actual installation may vary based on site conditions.',
      'Payment terms: 50% deposit on acceptance, balance on completion.',
    ];
    for (const line of disclaimer) {
      doc.text(line, 50, y, { width: 495 });
      y += 10;
    }

    // ── Footer on every page ──
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font('Helvetica').fillColor('#aaaaaa');
      doc.text(
        `Page ${i + 1} of ${pageCount}  |  Generated by EPRO Quotation System`,
        50, 780, { width: 495, align: 'center' }
      );
    }

    doc.end();
  });
}
