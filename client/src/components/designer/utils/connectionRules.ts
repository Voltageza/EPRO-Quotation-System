import { Connection, Edge } from '@xyflow/react';
import { BrandKey, createConnectionValidator } from './brandTopology';

/**
 * Connection validation — brand-aware.
 *
 * The default `isValidConnection` uses Victron (all connections allowed) for backwards compat.
 * Components should use `createConnectionValidator(brand)` from brandTopology.ts for brand-specific validation.
 */

// Default validator (Victron — all connections valid) for backwards compatibility
const defaultValidator = createConnectionValidator('Victron');

export function isValidConnection(connection: Connection | Edge): boolean {
  return defaultValidator(connection);
}

// Re-export the factory for brand-aware usage
export { createConnectionValidator };
export type { BrandKey };

/**
 * Get edge color based on handle types
 */
export function getEdgeColor(sourceHandle: string | null, targetHandle: string | null): string {
  if (!sourceHandle) return '#868e96';

  if (sourceHandle === 'dc-pv-out') return '#e03131';      // PV = red
  if (sourceHandle === 'dc-out') {
    if (targetHandle === 'dc-battery-in') return '#fd7e14'; // Battery = orange
    return '#e8590c';                                        // MPPT DC = dark orange
  }
  if (sourceHandle === 'ac-out') return '#1971c2';          // AC = blue
  if (sourceHandle === 'ac-grid-out') return '#2f9e44';     // Grid = green

  return '#868e96';
}

/**
 * Determine the wire type category for an edge
 */
export function getEdgeType(sourceHandle: string | null, targetHandle: string | null): string {
  if (sourceHandle === 'dc-pv-out') return 'pv-dc';
  if (sourceHandle === 'dc-out' && targetHandle === 'dc-battery-in') return 'battery-dc';
  if (sourceHandle === 'dc-out' && targetHandle === 'dc-mppt-in') return 'mppt-dc';
  if (sourceHandle === 'ac-out') return 'ac-power';
  if (sourceHandle === 'ac-grid-out') return 'ac-grid';
  return 'unknown';
}
