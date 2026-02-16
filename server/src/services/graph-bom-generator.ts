import { getDb } from '../database/connection';
import { BomItem, Flag, PanelData, MpptData, InverterData } from './rule-engine/types';
import { resolveDCBattery } from './rule-engine/dc-battery.engine';
import { resolvePVStrings } from './rule-engine/pv-string.engine';
import { resolveDCProtection } from './rule-engine/dc-protection.engine';
import { resolveACCable } from './rule-engine/ac-cable.engine';
import { resolveACProtection } from './rule-engine/ac-protection.engine';
import { resolveMounting } from './rule-engine/mounting.engine';
import { resolveLabour } from './rule-engine/labour.engine';
import { resolveSystemAccessories } from './rule-engine/system-accessories.engine';

interface GraphNode {
  id: string;
  type: string;
  data: Record<string, any>;
  position: { x: number; y: number };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  data?: {
    wireType?: string;
    distanceM?: number;
    wireGauge?: string;
    systemClass?: string;
  };
}

interface DesignInput {
  nodes: GraphNode[];
  edges: GraphEdge[];
  // Side panel inputs
  mountingType?: string;
  mountingRows?: number;
  mountingCols?: number;
  travelDistanceKm?: number;
  pvStringLengthM?: number;
}

export interface GraphBomResult {
  items: BomItem[];
  flags: Flag[];
  strings_count: number;
  panels_per_string: number;
}

/**
 * Graph-to-BoM Generator: Traverses the design graph and generates a complete BoM.
 *
 * Algorithm:
 * 1. Parse graph → extract component nodes + edge data
 * 2. Determine system class from inverter node
 * 3. Resolve PV strings (panel + MPPT data)
 * 4. Resolve wiring from edge distances
 * 5. Auto-insert protection
 * 6. Brand-specific accessories
 * 7. Mounting from side panel
 * 8. Labour/travel from side panel
 */
export function generateBomFromDesign(input: DesignInput): GraphBomResult {
  const db = getDb();
  const allItems: BomItem[] = [];
  const allFlags: Flag[] = [];
  let stringsCount = 0;
  let panelsPerString = 0;

  // 1. Extract nodes by type
  const inverterNodes = input.nodes.filter((n) => n.type === 'inverter');
  const panelNodes = input.nodes.filter((n) => n.type === 'solarPanelArray');
  const mpptNodes = input.nodes.filter((n) => n.type === 'mppt');
  const batteryNodes = input.nodes.filter((n) => n.type === 'battery');

  // Must have at least an inverter
  if (inverterNodes.length === 0) {
    allFlags.push({ code: 'NO_INVERTER_NODE', severity: 'error', message: 'No inverter in design', is_blocking: true });
    return { items: allItems, flags: allFlags, strings_count: 0, panels_per_string: 0 };
  }

  // Use first inverter for system identification
  const invNode = inverterNodes[0];
  const brand = invNode.data.brand || 'Victron';
  const systemClass = invNode.data.systemClass || 'V10';
  const inverterId = invNode.data.inverterId;
  const hasMppt = invNode.data.hasMppt;
  const hasBatteryPort = invNode.data.hasBatteryPort !== false;

  // Topology safety warnings
  if (mpptNodes.length > 0 && hasMppt) {
    allFlags.push({
      code: 'MPPT_WITH_INTEGRATED',
      severity: 'warning',
      message: `MPPT nodes found but ${brand} inverter has integrated MPPT — external MPPTs will be ignored`,
      is_blocking: false,
    });
  }
  if (batteryNodes.length > 0 && !hasBatteryPort) {
    allFlags.push({
      code: 'BATTERY_NO_PORT',
      severity: 'warning',
      message: `Battery nodes found but ${brand} inverter has no battery port (grid-tie only) — batteries will be ignored`,
      is_blocking: false,
    });
  }

  if (!inverterId) {
    allFlags.push({ code: 'NO_INVERTER_SELECTED', severity: 'error', message: 'Inverter node has no model selected', is_blocking: true });
    return { items: allItems, flags: allFlags, strings_count: 0, panels_per_string: 0 };
  }

  // 2. Resolve inverter product
  const inverter = db.prepare(`
    SELECT i.*, p.sku FROM inverters i JOIN products p ON i.product_id = p.id WHERE i.id = ?
  `).get(inverterId) as (InverterData & { sku: string }) | undefined;

  if (inverter) {
    allItems.push({
      sku: inverter.sku, product_id: inverter.product_id,
      section: 'inverter', quantity: 1,
      is_locked: false, source_rule: 'graph_inverter',
    });
  }

  // 3. Resolve panels + PV strings
  let totalPanelQty = 0;
  let panelData: PanelData | undefined;

  for (const pNode of panelNodes) {
    if (!pNode.data.panelId) continue;

    const panel = db.prepare(`
      SELECT p.*, pr.sku FROM panels p JOIN products pr ON p.product_id = pr.id WHERE p.id = ?
    `).get(pNode.data.panelId) as PanelData | undefined;

    if (panel) {
      panelData = panel;
      totalPanelQty += pNode.data.quantity || 0;
    }
  }

  // 4. Resolve MPPT
  let mpptData: MpptData | undefined;
  let totalMpptQty = 0;
  let mpptProductId = 0;

  if (!hasMppt) {
    // External MPPTs (Victron style)
    for (const mNode of mpptNodes) {
      if (!mNode.data.mpptId) continue;

      const mppt = db.prepare(`
        SELECT m.*, p.sku FROM mppts m JOIN products p ON m.product_id = p.id WHERE m.id = ?
      `).get(mNode.data.mpptId) as (MpptData & { sku: string }) | undefined;

      if (mppt) {
        mpptData = mppt;
        mpptProductId = mppt.product_id;
        totalMpptQty += mNode.data.quantity || 1;

        // Add MPPT to BoM
        allItems.push({
          sku: mppt.sku, product_id: mppt.product_id,
          section: 'inverter', quantity: mNode.data.quantity || 1,
          is_locked: false, source_rule: 'graph_mppt',
        });
      }
    }
  }

  // PV String resolution
  const pvStringLengthM = input.pvStringLengthM || 20;

  if (panelData && totalPanelQty > 0) {
    if (hasMppt && inverter) {
      // Integrated MPPT (Sungrow/Atess) — create synthetic MPPT data from inverter
      const syntheticMppt: MpptData = {
        id: 0,
        product_id: inverter.product_id,
        max_pv_voltage: inverter.max_dc_voltage || 500,
        max_charge_a: 30, // Default
        model_code: 'integrated',
        max_pv_power_w: invNode.data.maxPvInputW || null,
      };

      const mpptCount = invNode.data.mpptCount || 1;
      const pvResult = resolvePVStrings(panelData, syntheticMppt, totalPanelQty, mpptCount, pvStringLengthM);
      allItems.push(...pvResult.items);
      allFlags.push(...pvResult.flags);
      stringsCount = pvResult.strings_count;
      panelsPerString = pvResult.panels_per_string;
    } else if (mpptData) {
      // External MPPT (Victron)
      const pvResult = resolvePVStrings(panelData, mpptData, totalPanelQty, totalMpptQty, pvStringLengthM);
      allItems.push(...pvResult.items);
      allFlags.push(...pvResult.flags);
      stringsCount = pvResult.strings_count;
      panelsPerString = pvResult.panels_per_string;
    } else {
      allFlags.push({ code: 'NO_MPPT', severity: 'warning', message: 'No MPPT configured — PV strings not calculated', is_blocking: false });
    }
  }

  // 5. Resolve batteries
  for (const bNode of batteryNodes) {
    if (!bNode.data.batteryId) continue;

    const battery = db.prepare(`
      SELECT b.*, p.sku FROM batteries b JOIN products p ON b.product_id = p.id WHERE b.id = ?
    `).get(bNode.data.batteryId) as any;

    if (battery) {
      allItems.push({
        sku: battery.sku, product_id: battery.product_id,
        section: 'battery', quantity: bNode.data.quantity || 1,
        is_locked: false, source_rule: 'graph_battery',
      });
    }
  }

  // 5b. DC battery isolator switch (Victron recommendation — on positive battery cable)
  if (batteryNodes.length > 0 && hasBatteryPort) {
    allItems.push({
      sku: 'DC/ISO', product_id: 0,
      section: 'dc_battery', quantity: 1,
      is_locked: false, source_rule: 'graph_dc_isolator',
      note: 'Battery isolator switch (positive cable)',
    });
  }

  // 6. Resolve wiring from edges
  let batteryDistance = 0;
  let acInvToDbDistance = 0;
  let acDbToGridDistance = 0;
  let hasPvConnection = false;
  let hasAcConnection = false;

  for (const edge of input.edges) {
    const wireType = edge.data?.wireType || '';
    const distance = edge.data?.distanceM || 0;

    switch (wireType) {
      case 'battery-dc':
        batteryDistance += distance;
        break;
      case 'ac-power':
        acInvToDbDistance += distance;
        hasAcConnection = true;
        break;
      case 'ac-grid':
        acDbToGridDistance += distance;
        break;
      case 'pv-dc':
        hasPvConnection = true;
        break;
    }
  }

  // DC Battery cables
  if (hasBatteryPort && batteryDistance > 0) {
    const dcBatResult = resolveDCBattery(systemClass, batteryDistance);
    allItems.push(...dcBatResult.items);
    allFlags.push(...dcBatResult.flags);
  }

  // AC cables
  if (hasAcConnection) {
    const acCableResult = resolveACCable(systemClass, acInvToDbDistance, acDbToGridDistance);
    allItems.push(...acCableResult.items);
    allFlags.push(...acCableResult.flags);
  }

  // 7. Auto-insert protection
  if (hasPvConnection && stringsCount > 0) {
    const dcProtResult = resolveDCProtection(stringsCount);
    allItems.push(...dcProtResult.items);
    allFlags.push(...dcProtResult.flags);
  }

  if (hasAcConnection) {
    const acProtResult = resolveACProtection(systemClass);
    allItems.push(...acProtResult.items);
    allFlags.push(...acProtResult.flags);

    // RCD / Earth Leakage breaker — standard AC safety requirement
    allItems.push({
      sku: 'RCD/2P', product_id: 0,
      section: 'ac_protection', quantity: 1,
      is_locked: false, source_rule: 'graph_rcd',
      note: 'RCD Earth Leakage 2P 40A 30mA',
    });
  }

  // 8. Brand-specific accessories
  const accessoriesResult = resolveSystemAccessories(brand, systemClass, totalMpptQty);
  allItems.push(...accessoriesResult.items);
  allFlags.push(...accessoriesResult.flags);

  // 9. Mounting
  const mountingType = input.mountingType || 'tile';
  const mountingRows = input.mountingRows || 2;
  const mountingCols = input.mountingCols || Math.ceil(totalPanelQty / mountingRows) || 6;

  if (panelData && totalPanelQty > 0) {
    const mountingResult = resolveMounting(panelData, totalPanelQty, mountingType, mountingRows, mountingCols);
    allItems.push(...mountingResult.items);
    allFlags.push(...mountingResult.flags);
  }

  // 10. Labour + travel
  const totalBatteryQty = batteryNodes.reduce((sum, n) => sum + (n.data.quantity || 1), 0);
  const travelKm = input.travelDistanceKm || 0;
  const labourResult = resolveLabour(systemClass, totalBatteryQty, totalPanelQty, travelKm);
  allItems.push(...labourResult.items);
  allFlags.push(...labourResult.flags);

  // Resolve product_ids for items that only have SKU
  for (const item of allItems) {
    if (!item.product_id) {
      const product = db.prepare("SELECT id FROM products WHERE sku = ? AND is_active = 1").get(item.sku) as any;
      if (product) item.product_id = product.id;
    }
  }

  return { items: allItems, flags: allFlags, strings_count: stringsCount, panels_per_string: panelsPerString };
}
