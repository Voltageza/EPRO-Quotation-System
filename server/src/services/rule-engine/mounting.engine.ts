import { getDb } from '../../database/connection';
import { EngineResult, PanelData } from './types';

/**
 * MountingEngine: Calculates roof mount hardware (rails, clamps, joiners, brackets).
 * Assumes landscape panel orientation on standard pitched roof.
 */
export function resolveMounting(panel: PanelData, panelQty: number): EngineResult {
  const db = getDb();
  const items: EngineResult['items'] = [];
  const flags: EngineResult['flags'] = [];

  // Get mounting parameters from rule table
  const ruleTable = db.prepare(`
    SELECT id FROM rule_tables WHERE rule_type = 'mounting' AND is_active = 1 ORDER BY version DESC LIMIT 1
  `).get() as any;

  if (!ruleTable) {
    flags.push({ code: 'NO_MOUNTING_RULES', severity: 'warning', message: 'No mounting rules configured — mounting hardware not calculated', is_blocking: false });
    return { items, flags };
  }

  const entry = db.prepare(`
    SELECT * FROM rule_entries WHERE rule_table_id = ? ORDER BY sort_order LIMIT 1
  `).get(ruleTable.id) as any;

  if (!entry) return { items, flags };

  const config = JSON.parse(entry.result_json);
  const railLengthMm = config.rail_length_mm || 5850;

  // Panel dimensions (landscape: width is the longer side along the rail)
  const panelWidthMm = panel.height_mm || 2465; // landscape: height becomes width along rail
  const panelHeightMm = panel.width_mm || 1134;

  // Assume panels in a single row for simplicity
  // For larger arrays, split into rows of max ~6 panels
  const maxPanelsPerRow = 6;
  const rows = Math.ceil(panelQty / maxPanelsPerRow);
  const panelsPerRow = Math.ceil(panelQty / rows);

  // Each row needs 2 rails (top and bottom)
  const railsPerRow = 2;
  const totalRailSets = rows;

  // Rail length needed per row
  const rowSpanMm = panelsPerRow * panelWidthMm + (panelsPerRow - 1) * 20; // 20mm gap between panels
  const railsNeededPerRow = Math.ceil(rowSpanMm / railLengthMm);
  const totalRails = railsNeededPerRow * railsPerRow * totalRailSets;

  // Joiners: where rails meet end-to-end
  const joinersPerRow = Math.max(0, railsNeededPerRow - 1) * railsPerRow;
  const totalJoiners = joinersPerRow * totalRailSets;

  // Clamps
  const endClampsPerRow = 2 * railsPerRow; // 2 ends per rail pair
  const midClampsPerRow = Math.max(0, panelsPerRow - 1) * railsPerRow;
  const totalEndClamps = endClampsPerRow * totalRailSets;
  const totalMidClamps = midClampsPerRow * totalRailSets;

  // Brackets: 1 per ~1.2m of rail, minimum 2 per rail
  const bracketsPerRail = Math.max(2, Math.ceil(Math.min(rowSpanMm, railLengthMm) / 1200));
  const totalBrackets = bracketsPerRail * totalRails;

  // Add items
  const addProduct = (sku: string, qty: number, note: string) => {
    const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(sku) as any;
    if (product && qty > 0) {
      items.push({ sku, product_id: product.id, section: 'mounting', quantity: qty, is_locked: false, source_rule: 'mounting', note });
    }
  };

  addProduct(config.rail_sku || 'SOLAR42', totalRails, `${totalRails} rails (${rows} row(s) × ${railsPerRow} rails × ${railsNeededPerRow} per span)`);
  addProduct(config.end_clamp_sku || 'SOLAR40', totalEndClamps, `End clamps (${totalEndClamps})`);
  addProduct(config.mid_clamp_sku || 'SOLAR39', totalMidClamps, `Mid clamps (${totalMidClamps})`);
  if (totalJoiners > 0) {
    addProduct(config.joiner_sku || 'SOLAR41', totalJoiners, `Rail joiners (${totalJoiners})`);
  }
  addProduct(config.bracket_sku || 'SOLAR43', totalBrackets, `L-brackets (${totalBrackets})`);
  addProduct(config.hangerbolt_sku || 'SOLAR44', totalBrackets, `Hangerbolts (${totalBrackets})`);

  return { items, flags };
}
