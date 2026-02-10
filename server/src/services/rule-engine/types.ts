/** Shared types for the rule engine pipeline */

export interface BomItem {
  sku: string;
  product_id?: number;
  section: string;
  quantity: number;
  is_locked: boolean;
  source_rule: string;
  note?: string;
}

export interface Flag {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  is_blocking: boolean;
}

export interface EngineResult {
  items: BomItem[];
  flags: Flag[];
}

export interface QuoteInput {
  system_class: 'V5' | 'V8' | 'V10' | 'V15';
  // Panel
  panel_id: number;
  panel_qty: number;
  // Battery
  battery_id: number;
  battery_qty: number;
  // MPPT
  mppt_id: number;
  mppt_qty: number;
  // Distances (meters)
  dc_battery_distance_m: number;
  ac_inverter_db_distance_m: number;
  ac_db_grid_distance_m: number;
  pv_string_length_m: number;
  // Travel
  travel_distance_km: number;
  // Mounting
  mounting_type: 'ibr' | 'corrugated' | 'tile' | 'tilt_frame_ibr' | 'tilt_frame_corrugated';
  mounting_rows: number;
  mounting_cols: number;
}

export interface PanelData {
  id: number;
  product_id: number;
  power_w: number;
  voc: number;
  vmp: number;
  isc: number;
  imp: number;
  temp_coeff_voc: number;
  width_mm: number | null;
  height_mm: number | null;
}

export interface MpptData {
  id: number;
  product_id: number;
  max_pv_voltage: number;
  max_charge_a: number;
  model_code: string;
  max_pv_power_w: number | null;
}

export interface BatteryData {
  id: number;
  product_id: number;
  capacity_kwh: number;
  voltage: number;
}

export interface InverterData {
  id: number;
  product_id: number;
  system_class: string;
  rated_va: number;
  ac_output_amps: number;
}
