import { Connection, Edge } from '@xyflow/react';
import { DesignerNodeType } from '../nodes/nodeTypes';

export type BrandKey = 'Victron' | 'Atess' | 'Sungrow';

interface HandlePair {
  sourceHandle: string;
  targetHandle: string;
}

export interface BrandTopology {
  label: string;
  type: string;
  description: string;
  allowedNodeTypes: DesignerNodeType[];
  validConnections: HandlePair[];
  integratedMppt: boolean;
  hasBattery: boolean;
}

export const BRAND_TOPOLOGIES: Record<BrandKey, BrandTopology> = {
  Victron: {
    label: 'Victron',
    type: 'Low Voltage 48V',
    description: 'Panel → MPPT → Inverter ← Battery, Inverter → DB → Grid',
    allowedNodeTypes: ['solarPanelArray', 'mppt', 'battery', 'inverter', 'distributionBoard', 'gridConnection'],
    validConnections: [
      { sourceHandle: 'dc-pv-out', targetHandle: 'pv-in' },         // Panel → MPPT
      { sourceHandle: 'dc-out', targetHandle: 'dc-mppt-in' },       // MPPT → Inverter
      { sourceHandle: 'dc-out', targetHandle: 'dc-battery-in' },    // Battery → Inverter
      { sourceHandle: 'ac-out', targetHandle: 'ac-in' },            // Inverter → DB
      { sourceHandle: 'ac-grid-out', targetHandle: 'ac-in' },       // DB → Grid
    ],
    integratedMppt: false,
    hasBattery: true,
  },
  Atess: {
    label: 'Atess',
    type: 'High Voltage Hybrid',
    description: 'Panel → Inverter (integrated MPPT) ← Battery, Inverter → DB → Grid',
    allowedNodeTypes: ['solarPanelArray', 'battery', 'inverter', 'distributionBoard', 'gridConnection'],
    validConnections: [
      { sourceHandle: 'dc-pv-out', targetHandle: 'dc-pv-in' },     // Panel → Inverter (integrated MPPT)
      { sourceHandle: 'dc-out', targetHandle: 'dc-battery-in' },    // Battery → Inverter
      { sourceHandle: 'ac-out', targetHandle: 'ac-in' },            // Inverter → DB
      { sourceHandle: 'ac-grid-out', targetHandle: 'ac-in' },       // DB → Grid
    ],
    integratedMppt: true,
    hasBattery: true,
  },
  Sungrow: {
    label: 'Sungrow',
    type: 'Hybrid (SH Series)',
    description: 'Panel → Inverter (integrated MPPT) ← Battery, Inverter → DB → Grid',
    allowedNodeTypes: ['solarPanelArray', 'battery', 'inverter', 'distributionBoard', 'gridConnection'],
    validConnections: [
      { sourceHandle: 'dc-pv-out', targetHandle: 'dc-pv-in' },     // Panel → Inverter (integrated MPPT)
      { sourceHandle: 'dc-out', targetHandle: 'dc-battery-in' },    // Battery → Inverter
      { sourceHandle: 'ac-out', targetHandle: 'ac-in' },            // Inverter → DB
      { sourceHandle: 'ac-grid-out', targetHandle: 'ac-in' },       // DB → Grid
    ],
    integratedMppt: true,
    hasBattery: true,
  },
};

export const BRAND_OPTIONS: BrandKey[] = ['Victron', 'Atess', 'Sungrow'];

export function getValidConnectionsForBrand(brand: BrandKey): HandlePair[] {
  return BRAND_TOPOLOGIES[brand]?.validConnections ?? BRAND_TOPOLOGIES.Victron.validConnections;
}

export function createConnectionValidator(brand: BrandKey): (connection: Connection | Edge) => boolean {
  const validPairs = getValidConnectionsForBrand(brand);
  return (connection: Connection | Edge) => {
    const sourceHandle = connection.sourceHandle;
    const targetHandle = connection.targetHandle;
    if (!sourceHandle || !targetHandle) return false;
    return validPairs.some(
      (pair) => pair.sourceHandle === sourceHandle && pair.targetHandle === targetHandle
    );
  };
}

export function isNodeAllowedForBrand(brand: BrandKey, nodeType: DesignerNodeType): boolean {
  const topology = BRAND_TOPOLOGIES[brand];
  if (!topology) return true;
  return topology.allowedNodeTypes.includes(nodeType);
}
