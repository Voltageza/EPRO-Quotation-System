import { getDb } from '../../database/connection';
import { EngineResult, PanelData, BomItem } from './types';

/**
 * MountingEngine: Calculates roof mount hardware based on mounting type.
 *
 * Three calculation branches:
 * - IBR / Corrugated: direct brackets + clamps, no rails
 * - Tile: rails + hanger bolts + L-brackets + clamps
 * - Tilt Frame (Flat Roof): tilt frame brackets + end clamps only
 */
export function resolveMounting(
  panel: PanelData,
  panelQty: number,
  mountingType: string,
  rows: number,
  cols: number
): EngineResult {
  const db = getDb();
  const items: BomItem[] = [];
  const flags: EngineResult['flags'] = [];

  // Validate rows × cols matches panelQty
  const layoutTotal = rows * cols;
  if (layoutTotal !== panelQty) {
    flags.push({
      code: 'MOUNTING_LAYOUT_MISMATCH',
      severity: 'warning',
      message: `Mounting layout ${rows}×${cols}=${layoutTotal} does not match panel quantity ${panelQty}. Using layout dimensions for mounting calculation.`,
      is_blocking: false,
    });
  }

  const addProduct = (sku: string, qty: number, note: string) => {
    if (qty <= 0) return;
    const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(sku) as any;
    if (product) {
      items.push({ sku, product_id: product.id, section: 'mounting', quantity: qty, is_locked: false, source_rule: 'mounting', note });
    } else {
      flags.push({ code: 'MISSING_SKU', severity: 'warning', message: `Product ${sku} not found — mounting item skipped`, is_blocking: false });
    }
  };

  if (mountingType === 'ibr' || mountingType === 'corrugated') {
    // ── IBR / Corrugated: Panels landscape, R rows × C columns ──
    // Mounting lines = R + 1 (top, between each row pair, bottom)
    // Outer lines (top + bottom = 2): end clamps — grip one panel
    // Inner lines (between rows = R - 1): mid clamps — shared by top & bottom panels
    // Each panel position on a line gets 2 clamps
    const outerLines = 2;
    const innerLines = rows - 1;
    const endClamps = outerLines * cols * 2;
    const midClamps = innerLines * cols * 2;
    const brackets = endClamps + midClamps; // 1 bracket per clamp

    addProduct('SOLAR40', endClamps, `End clamps: ${outerLines} outer lines × ${cols} panels × 2 = ${endClamps}`);
    if (midClamps > 0) {
      addProduct('SOLAR39', midClamps, `Mid clamps: ${innerLines} inner lines × ${cols} panels × 2 = ${midClamps}`);
    }
    const bracketSku = mountingType === 'ibr' ? 'SOLAR45' : 'SOLAR46';
    addProduct(bracketSku, brackets, `${mountingType.toUpperCase()} brackets: 1 per clamp = ${brackets}`);

  } else if (mountingType === 'tilt_frame_ibr' || mountingType === 'tilt_frame_corrugated') {
    // ── Flat Roof (Tilt Frame) — each panel independent ──
    // Per panel: 2 front short + 2 rear long tilt brackets, 4 tilt ends, 4 roof brackets
    const frontShort = 2 * panelQty;
    const rearLong = 2 * panelQty;
    const tiltEnds = 4 * panelQty;
    const roofBrackets = 4 * panelQty; // 1 per tilt bracket

    addProduct('SOLAR50', frontShort, `Front short tilt brackets: 2 × ${panelQty} panels = ${frontShort}`);
    addProduct('SOLAR51', rearLong, `Rear long tilt brackets: 2 × ${panelQty} panels = ${rearLong}`);
    addProduct('SOLAR52', tiltEnds, `Tilt ends: 4 × ${panelQty} panels = ${tiltEnds}`);
    const bracketSku = mountingType === 'tilt_frame_ibr' ? 'SOLAR45' : 'SOLAR46';
    const bracketType = mountingType === 'tilt_frame_ibr' ? 'IBR' : 'Corrugated';
    addProduct(bracketSku, roofBrackets, `${bracketType} brackets: 4 × ${panelQty} panels = ${roofBrackets}`);

  } else {
    // ── Tile Roof (default): Panels portrait, R rows × C columns ──
    // Each row has independent top + bottom rails (not shared between rows)
    const railLines = 2 * rows;
    // Clamps along each rail: 1 end at each end, 1 mid between each pair of panels
    const endClamps = 2 * railLines;
    const midClamps = (cols - 1) * railLines;

    // Panel width in portrait orientation (shorter side)
    const panelWidthMm = panel.width_mm || 1134;
    const railSpanMm = panelWidthMm * cols + 200; // 100mm overhang each side
    const railLengthMm = 5850;
    const piecesPerLine = Math.ceil(railSpanMm / railLengthMm);
    // Total rails to purchase: total linear mm needed, offcuts reused across lines
    const totalLinearMm = railSpanMm * railLines;
    const totalRails = Math.ceil(totalLinearMm / railLengthMm);

    // Splices where rail pieces join on each line
    const splicesPerLine = piecesPerLine - 1;
    const totalSplices = splicesPerLine * railLines;

    // Hanger bolts: spaced max 1450mm apart along each rail line
    const hangerBoltSpacing = 1450;
    const hangerBoltsPerLine = Math.ceil(railSpanMm / hangerBoltSpacing) + 1;
    const totalHangerBolts = hangerBoltsPerLine * railLines;

    // L-brackets: 1 per hanger bolt
    const totalLBrackets = totalHangerBolts;

    addProduct('SOLAR40', endClamps, `End clamps: 2 × ${railLines} rail lines = ${endClamps}`);
    if (midClamps > 0) {
      addProduct('SOLAR39', midClamps, `Mid clamps: ${cols - 1} × ${railLines} rail lines = ${midClamps}`);
    }
    addProduct('SOLAR42', totalRails, `Rails: ${totalLinearMm}mm total ÷ ${railLengthMm}mm = ${totalRails} (${railSpanMm}mm/line × ${railLines} lines)`);
    if (totalSplices > 0) {
      addProduct('SOLAR41', totalSplices, `Rail splices: ${splicesPerLine}/line × ${railLines} lines = ${totalSplices}`);
    }
    addProduct('SOLAR44', totalHangerBolts, `Hanger bolts: ceil(${railSpanMm}mm ÷ ${hangerBoltSpacing}mm) + 1 = ${hangerBoltsPerLine}/line × ${railLines} lines = ${totalHangerBolts}`);
    addProduct('SOLAR43', totalLBrackets, `L-brackets: 1 per hanger bolt = ${totalLBrackets}`);
  }

  return { items, flags };
}
