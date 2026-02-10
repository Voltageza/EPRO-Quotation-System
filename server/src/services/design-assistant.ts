/**
 * PV Design Assistant — MPPT auto-suggestion service.
 * Given a panel and quantity, calculates optimal MPPT configuration.
 */

import { getDb } from '../database/connection';
import { calculateColdVoc } from './panel-validation.service';

export interface MpptRecommendation {
  mppt_id: number;
  mppt_name: string;
  model_code: string;
  mppt_qty: number;
  strings_count: number;
  panels_per_string: number;
  oversize_pct: number;
  total_pv_w: number;
  total_mppt_capacity_w: number;
  warnings: string[];
  score: number;
}

interface PanelRow {
  id: number;
  power_w: number;
  voc: number;
  imp: number;
  temp_coeff_voc: number;
}

interface MpptRow {
  id: number;
  product_id: number;
  max_pv_voltage: number;
  max_charge_a: number;
  model_code: string;
  max_pv_power_w: number | null;
  name: string;
}

export function recommendMppt(panelId: number, panelQty: number): MpptRecommendation[] {
  const db = getDb();

  // Load panel specs
  const panel = db.prepare(`
    SELECT p2.id, p2.power_w, p2.voc, p2.imp, p2.temp_coeff_voc
    FROM panels p2
    WHERE p2.id = ?
  `).get(panelId) as PanelRow | undefined;

  if (!panel) {
    throw new Error(`Panel with id ${panelId} not found`);
  }

  // Load all active MPPTs
  const mppts = db.prepare(`
    SELECT m.*, p.name
    FROM mppts m
    JOIN products p ON m.product_id = p.id
    WHERE p.is_active = 1
    ORDER BY m.max_pv_voltage, m.max_charge_a
  `).all() as MpptRow[];

  if (mppts.length === 0) {
    return [];
  }

  const coldVoc = calculateColdVoc(panel.voc, panel.temp_coeff_voc);
  const totalPvW = panelQty * panel.power_w;

  // Find all divisors of panelQty — strings must have equal panel counts (Victron rule)
  const divisors: number[] = [];
  for (let i = 1; i <= panelQty; i++) {
    if (panelQty % i === 0) divisors.push(i);
  }

  const recommendations: MpptRecommendation[] = [];

  for (const mppt of mppts) {
    // Check current limit: Imp × 1.25 should not exceed 20A (MPPT standard input limit)
    const imp125 = panel.imp * 1.25;
    const currentBlocked = imp125 > 20;

    const mpptPowerW = mppt.max_pv_power_w || (mppt.max_pv_voltage * mppt.max_charge_a);

    // Try each valid string configuration (divisors give equal panels per string)
    let bestConfig: {
      strings: number;
      panelsPerString: number;
      score: number;
      warnings: string[];
      blocked: boolean;
    } | null = null;

    for (const numStrings of divisors) {
      const pps = panelQty / numStrings; // panels per string — always integer
      const stringVoltage = pps * coldVoc;
      const warnings: string[] = [];
      let blocked = currentBlocked;

      if (currentBlocked) {
        warnings.push(`Panel Imp × 1.25 = ${imp125.toFixed(1)}A exceeds 20A MPPT input limit`);
      }

      // String voltage must not exceed MPPT max PV voltage
      if (stringVoltage >= mppt.max_pv_voltage) {
        continue; // skip — too many panels per string for this MPPT
      }

      const mpptQtyNeeded = numStrings; // 1 MPPT per string (SmartSolar single-tracker)
      const totalMpptCapacityW = mpptPowerW * mpptQtyNeeded;
      const oversizeRatio = totalPvW / totalMpptCapacityW;
      const oversizePct = Math.round(oversizeRatio * 100);

      if (oversizeRatio > 1.3) {
        warnings.push(`PV array significantly oversized (${oversizePct}%) — may cause clipping losses`);
      } else if (oversizeRatio > 1.2) {
        warnings.push(`Slight PV oversizing (${oversizePct}%) — acceptable but not optimal`);
      } else if (oversizeRatio < 0.5) {
        warnings.push(`MPPT heavily underutilized (${oversizePct}%) — consider smaller unit`);
      }

      // Score calculation: higher is better
      let score = 100;
      if (blocked) score -= 200;
      score -= (mpptQtyNeeded - 1) * 15; // prefer fewer MPPTs
      if (oversizeRatio >= 0.8 && oversizeRatio <= 1.2) {
        score += 20;
      } else if (oversizeRatio > 1.3) {
        score -= (oversizeRatio - 1.3) * 50;
      } else if (oversizeRatio < 0.5) {
        score -= 15;
      }
      score -= Math.abs(1.0 - oversizeRatio) * 10;

      if (!bestConfig || score > bestConfig.score) {
        bestConfig = { strings: numStrings, panelsPerString: pps, score, warnings, blocked };
      }
    }

    if (!bestConfig) continue; // no valid equal-string config for this MPPT

    const mpptQtyNeeded = bestConfig.strings;
    const totalMpptCapacityW = mpptPowerW * mpptQtyNeeded;
    const oversizeRatio = totalPvW / totalMpptCapacityW;

    recommendations.push({
      mppt_id: mppt.id,
      mppt_name: mppt.name || mppt.model_code,
      model_code: mppt.model_code,
      mppt_qty: mpptQtyNeeded,
      strings_count: bestConfig.strings,
      panels_per_string: bestConfig.panelsPerString,
      oversize_pct: Math.round(oversizeRatio * 100),
      total_pv_w: totalPvW,
      total_mppt_capacity_w: totalMpptCapacityW,
      warnings: bestConfig.warnings,
      score: bestConfig.score,
    });
  }

  // Sort by score descending, return top 3
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 3);
}
