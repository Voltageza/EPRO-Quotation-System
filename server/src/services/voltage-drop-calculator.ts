/**
 * Voltage Drop Calculator
 *
 * Based on Victron "Wiring Unlimited" PDF Ch. 2.7
 * Formula: V_drop = 2 × I × ρ × L / A
 *
 * ρ (copper resistivity) = 0.0175 Ω·mm²/m
 * L = cable length (one-way) in meters
 * A = cable cross-section in mm²
 * I = operating current in amps
 * Factor of 2 = round trip (positive + negative)
 */

const COPPER_RESISTIVITY = 0.0175; // Ω·mm²/m

/** System current specs from inverter datasheets */
interface SystemCurrents {
  systemVoltage: number; // V (DC bus voltage)
  dcBatteryA: number;    // DC battery current
  acA: number;           // AC output current
  pvPerStringA: number;  // PV current per string
}

const SYSTEM_CURRENTS: Record<string, SystemCurrents> = {
  // Victron Multiplus-II (low-voltage 48V DC bus, single-phase 230V AC)
  V5:    { systemVoltage: 48, dcBatteryA: 110, acA: 21.7,  pvPerStringA: 15 },
  V8:    { systemVoltage: 48, dcBatteryA: 175, acA: 34.8,  pvPerStringA: 15 },
  V10:   { systemVoltage: 48, dcBatteryA: 220, acA: 43.5,  pvPerStringA: 15 },
  V15:   { systemVoltage: 48, dcBatteryA: 330, acA: 65.2,  pvPerStringA: 15 },
  // Atess HPS commercial (high-voltage 400V 3-phase)
  ATT30:  { systemVoltage: 400, dcBatteryA: 93,  acA: 43,  pvPerStringA: 10 },
  ATT50:  { systemVoltage: 400, dcBatteryA: 156, acA: 72,  pvPerStringA: 10 },
  ATT100: { systemVoltage: 400, dcBatteryA: 313, acA: 144, pvPerStringA: 10 },
  ATT120: { systemVoltage: 400, dcBatteryA: 374, acA: 173, pvPerStringA: 10 },
  ATT150: { systemVoltage: 400, dcBatteryA: 467, acA: 217, pvPerStringA: 10 },
};

/** Map wire gauge labels to cross-section area in mm² */
const GAUGE_TO_MM2: Record<string, number> = {
  '4mm²':  4,
  '6mm²':  6,
  '10mm²': 10,
  '16mm²': 16,
  '25mm²': 25,
  '35mm²': 35,
  '50mm²': 50,
  '70mm²': 70,
  '95mm²': 95,
  '120mm²': 120,
  '150mm²': 150,
  '185mm²': 185,
  '240mm²': 240,
};

export interface VoltageDropResult {
  dropV: number;
  dropPercent: number;
  acceptable: boolean;  // ≤ 2.5%
  currentA: number;
  voltageV: number;
  gaugeMm2: number;
}

/**
 * Calculate voltage drop for a cable run.
 *
 * @param systemClass  e.g. 'V10', 'ATT5'
 * @param edgeType     'battery-dc' | 'ac-power' | 'ac-grid' | 'pv-dc' | 'mppt-dc'
 * @param wireGauge    e.g. '35mm²', '16mm²'
 * @param distanceM    one-way cable length in meters
 */
export function calculateVoltageDrop(
  systemClass: string,
  edgeType: string,
  wireGauge: string,
  distanceM: number
): VoltageDropResult | null {
  const sys = SYSTEM_CURRENTS[systemClass];
  if (!sys) return null;

  const gaugeMm2 = GAUGE_TO_MM2[wireGauge];
  if (!gaugeMm2) return null;

  // Determine current and reference voltage based on edge type
  let currentA: number;
  let voltageV: number;

  switch (edgeType) {
    case 'battery-dc':
      currentA = sys.dcBatteryA;
      voltageV = sys.systemVoltage;
      break;
    case 'ac-power':
    case 'ac-grid':
      currentA = sys.acA;
      voltageV = sys.systemVoltage > 100 ? sys.systemVoltage : 230; // 400V for 3-phase, 230V for single-phase
      break;
    case 'pv-dc':
      currentA = sys.pvPerStringA;
      // PV string voltage — use typical Vmp (~35V × panels, approximate with system voltage)
      voltageV = sys.systemVoltage > 48 ? sys.systemVoltage : 400; // Typical string Vmp
      break;
    case 'mppt-dc':
      currentA = sys.dcBatteryA;
      voltageV = sys.systemVoltage;
      break;
    default:
      return null;
  }

  if (currentA <= 0 || distanceM <= 0) return null;

  // V_drop = 2 × I × ρ × L / A
  const dropV = (2 * currentA * COPPER_RESISTIVITY * distanceM) / gaugeMm2;
  const dropPercent = (dropV / voltageV) * 100;

  return {
    dropV: Math.round(dropV * 100) / 100,
    dropPercent: Math.round(dropPercent * 100) / 100,
    acceptable: dropPercent <= 2.5,
    currentA,
    voltageV,
    gaugeMm2,
  };
}
