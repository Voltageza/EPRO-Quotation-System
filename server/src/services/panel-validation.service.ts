/**
 * Panel validation rules for Victron systems.
 * Enforces electrical safety limits before a panel can be approved.
 */

export interface PanelValidationResult {
  valid: boolean;
  checks: {
    name: string;
    passed: boolean;
    value: number;
    limit: number;
    message: string;
  }[];
}

export interface PanelSpecs {
  imp: number;
  voc: number;
  temp_coeff_voc: number;  // negative percentage, e.g. -0.27
}

/**
 * Calculate the cold Voc at minimum design temperature.
 * South Africa design temp: -10°C, STC reference: 25°C, delta = 35°C
 */
export function calculateColdVoc(voc: number, tempCoeffVoc: number): number {
  const deltaT = 35; // 25°C - (-10°C)
  return voc * (1 + (Math.abs(tempCoeffVoc) / 100) * deltaT);
}

/**
 * Validate a panel against Victron design rules.
 *
 * Rule 1: Imp × 1.25 ≤ 20A (MPPT input current limit with safety factor)
 * Rule 2: Cold Voc < 250V (single string voltage limit at -10°C)
 */
export function validatePanel(specs: PanelSpecs): PanelValidationResult {
  const checks: PanelValidationResult['checks'] = [];

  // Rule 1: Current check — Imp × 1.25 must be ≤ 20A
  const imp125 = specs.imp * 1.25;
  checks.push({
    name: 'MPPT Current Limit',
    passed: imp125 <= 20,
    value: Math.round(imp125 * 100) / 100,
    limit: 20,
    message: imp125 <= 20
      ? `Imp × 1.25 = ${imp125.toFixed(2)}A — within 20A MPPT limit`
      : `FAIL: Imp × 1.25 = ${imp125.toFixed(2)}A exceeds 20A MPPT input limit`,
  });

  // Rule 2: Voltage check — Cold Voc must be < 250V (per single panel)
  const coldVoc = calculateColdVoc(specs.voc, specs.temp_coeff_voc);
  checks.push({
    name: 'Cold Voc (Single Panel)',
    passed: coldVoc < 250,
    value: Math.round(coldVoc * 100) / 100,
    limit: 250,
    message: coldVoc < 250
      ? `Cold Voc at -10°C = ${coldVoc.toFixed(2)}V — within 250V limit`
      : `FAIL: Cold Voc at -10°C = ${coldVoc.toFixed(2)}V exceeds 250V limit`,
  });

  return {
    valid: checks.every((c) => c.passed),
    checks,
  };
}
