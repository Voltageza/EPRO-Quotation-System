/**
 * Parses Electrical Pro Sales Order HTM files.
 * Extracts product data from HTML tables: SKU, description, quantity, unit price.
 */

export interface ParsedProduct {
  sku: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit: string;
  retail_price_cents: number;
  quantity: number;
}

// Auto-detect category from product name
function categorize(name: string): { category: string; subcategory: string | null } {
  const n = name.toUpperCase();

  if (n.includes('SOLAR PANEL') || n.includes('PANEL JA') || n.includes('PANEL CANADIAN')) return { category: 'panel', subcategory: null };
  if (n.includes('MPPT') || n.includes('CHARGE CONTROLLER')) return { category: 'mppt', subcategory: null };
  if (n.includes('INVERTER VICTRON') || n.includes('INVERTER MULTI')) return { category: 'inverter', subcategory: null };
  if (n.includes('BATTERY') || n.includes('BATT ')) return { category: 'battery', subcategory: null };

  if (n.includes('END CLAMP')) return { category: 'mounting', subcategory: 'end_clamp' };
  if (n.includes('MID CLAMP')) return { category: 'mounting', subcategory: 'mid_clamp' };
  if (n.includes('RAIL') || n.includes('ALUMINIUM RAIL')) return { category: 'mounting', subcategory: 'rail' };
  if (n.includes('JOINER') || n.includes('SPLICE')) return { category: 'mounting', subcategory: 'joiner' };
  if (n.includes('L-BRACKET')) return { category: 'mounting', subcategory: 'bracket' };
  if (n.includes('HANGERBOLT')) return { category: 'mounting', subcategory: 'hangerbolt' };

  if (n.includes('CIR/BREAKER') && n.includes('DC')) return { category: 'protection', subcategory: 'dc_breaker' };
  if (n.includes('CIR/BREAKER')) return { category: 'protection', subcategory: 'ac_breaker' };
  if (n.includes('SURGE') && n.includes('DC')) return { category: 'protection', subcategory: 'spd_dc' };
  if (n.includes('SURGE')) return { category: 'protection', subcategory: 'spd_ac' };
  if (n.includes('CHANGEOVER') || n.includes('C/O ')) return { category: 'protection', subcategory: 'changeover' };
  if (n.includes('FUSE HOLDER')) return { category: 'protection', subcategory: 'fuse_holder' };
  if (n.includes('FUSE')) return { category: 'protection', subcategory: 'fuse' };
  if (n.includes('EARTH SPIKE')) return { category: 'protection', subcategory: 'earthing' };

  if (n.includes('CABLE') || n.includes('WIRE') || n.includes('WELDING')) return { category: 'cable', subcategory: null };

  if (n.includes('ENCL') || n.includes('BOX ')) return { category: 'enclosure', subcategory: null };

  if (n.includes('LABOUR') || n.includes('PROGRAMMING')) return { category: 'labour', subcategory: null };
  if (n.includes('TRAVEL')) return { category: 'travel', subcategory: null };

  return { category: 'accessory', subcategory: null };
}

export function parseHTM(html: string): ParsedProduct[] {
  const products: ParsedProduct[] = [];

  // Match table rows with product data
  // Pattern: <td>CODE</td> <td>DESCRIPTION</td> <td>QTY</td> <td>UNIT</td> <td>UNIT PRICE</td> ...
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>[\s\S]*?<font[^>]*>([\s\S]*?)<\/font>[\s\S]*?<\/td>/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells: string[] = [];

    let cellMatch;
    const cellRe = /<td[^>]*>[\s\S]*?<font[^>]*[^>]*>([\s\S]*?)<\/font>[\s\S]*?<\/td>/gi;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      // Strip HTML tags and decode entities
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      cells.push(text);
    }

    // Product rows have 7+ cells: Code, Description, Qty, Unit, Unit Price, Tax, Disc, Nett Price
    if (cells.length >= 7) {
      const sku = cells[0].trim();
      const name = cells[1].trim();
      const qty = parseFloat(cells[2]) || 0;
      const unitPrice = parseFloat(cells[4]?.replace(/[^\d.]/g, '') || '0') || 0;

      // Skip header rows and empty rows
      if (sku && name && sku !== 'Code' && !name.includes('Description')) {
        const { category, subcategory } = categorize(name);
        const unit = category === 'cable' ? 'm' : category === 'travel' ? 'km' : category === 'labour' ? 'hr' : 'each';

        products.push({
          sku,
          name,
          category,
          subcategory,
          unit,
          retail_price_cents: Math.round(unitPrice * 100),
          quantity: qty,
        });
      }
    }
  }

  return products;
}
