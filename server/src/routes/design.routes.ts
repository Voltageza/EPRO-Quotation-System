import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { resolveDCBattery } from '../services/rule-engine/dc-battery.engine';
import { resolveACCable } from '../services/rule-engine/ac-cable.engine';
import { calculateVoltageDrop } from '../services/voltage-drop-calculator';
import { getDb } from '../database/connection';

export const designRoutes = Router();
designRoutes.use(authenticate);

/**
 * POST /api/v1/design/calculate-wire
 * Lightweight endpoint for the designer to auto-calculate wire specs.
 * Input: { systemClass, edgeType, distanceM }
 * Returns: { wireGauge, items[] }
 */
designRoutes.post('/calculate-wire', (req: Request, res: Response) => {
  const { systemClass, edgeType, distanceM } = req.body;

  if (!systemClass || !edgeType || distanceM == null) {
    res.status(400).json({ error: 'systemClass, edgeType, and distanceM required' });
    return;
  }

  const distance = Number(distanceM);

  try {
    let result;

    switch (edgeType) {
      case 'battery-dc': {
        result = resolveDCBattery(systemClass, distance);
        const cableItem = result.items.find((i) => i.section === 'dc_battery' && i.sku.includes('CAB'));
        const batGauge = cableItem ? '35mm²' : 'N/A';
        const batVDrop = calculateVoltageDrop(systemClass, edgeType, batGauge, distance);
        res.json({
          wireGauge: batGauge,
          items: result.items.map((i) => ({
            sku: i.sku,
            quantity: i.quantity,
            section: i.section,
            note: i.note,
          })),
          flags: result.flags,
          voltageDrop: batVDrop,
        });
        return;
      }

      case 'ac-power': {
        // Inverter → DB distance
        result = resolveACCable(systemClass, distance, 0);
        const acItem = result.items.find((i) => i.section === 'ac_cabling');
        const gauge = acItem?.sku === 'P/W25' ? '25mm²' : acItem?.sku === 'P/W16' ? '16mm²' : acItem?.sku === 'W/PAN10' ? '10mm²' : 'N/A';
        const acVDrop = calculateVoltageDrop(systemClass, edgeType, gauge, distance);
        res.json({
          wireGauge: gauge,
          items: result.items.map((i) => ({
            sku: i.sku,
            quantity: i.quantity,
            section: i.section,
            note: i.note,
          })),
          flags: result.flags,
          voltageDrop: acVDrop,
        });
        return;
      }

      case 'ac-grid': {
        // DB → Grid distance
        result = resolveACCable(systemClass, 0, distance);
        const gridItem = result.items.find((i) => i.section === 'ac_cabling');
        const gridGauge = gridItem?.sku === 'P/W25' ? '25mm²' : gridItem?.sku === 'P/W16' ? '16mm²' : gridItem?.sku === 'W/PAN10' ? '10mm²' : 'N/A';
        const gridVDrop = calculateVoltageDrop(systemClass, edgeType, gridGauge, distance);
        res.json({
          wireGauge: gridGauge,
          items: result.items.map((i) => ({
            sku: i.sku,
            quantity: i.quantity,
            section: i.section,
            note: i.note,
          })),
          flags: result.flags,
          voltageDrop: gridVDrop,
        });
        return;
      }

      case 'pv-dc': {
        // PV cable — simple: 6mm² solar DC cable, 2 runs per meter
        const db = getDb();
        const solarCable = db.prepare("SELECT id, sku FROM products WHERE sku = 'C/SC6B' AND is_active = 1").get() as any;
        const pvQty = Math.ceil(distance * 2);
        const pvVDrop = calculateVoltageDrop(systemClass, edgeType, '6mm²', distance);
        res.json({
          wireGauge: '6mm²',
          items: solarCable ? [{
            sku: solarCable.sku,
            quantity: pvQty,
            section: 'pv_cabling',
            note: `${distance}m PV DC cable run`,
          }] : [],
          flags: [],
          voltageDrop: pvVDrop,
        });
        return;
      }

      case 'mppt-dc': {
        // MPPT to inverter — typically short run, 16mm or 35mm
        const mpptVDrop = calculateVoltageDrop(systemClass, edgeType, '16mm²', distance);
        res.json({
          wireGauge: '16mm²',
          items: [],
          flags: [],
          voltageDrop: mpptVDrop,
        });
        return;
      }

      default:
        res.json({ wireGauge: 'N/A', items: [], flags: [] });
    }
  } catch (err: any) {
    res.status(500).json({ error: `Calculation failed: ${err.message}` });
  }
});
