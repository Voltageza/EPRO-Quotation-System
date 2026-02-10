import api from './client';

export async function getInverters() {
  const { data } = await api.get('/components/inverters');
  return data.inverters;
}

export async function getInverterByClass(systemClass: string) {
  const { data } = await api.get(`/components/inverters/by-class/${systemClass}`);
  return data.inverter;
}

export async function createInverter(inverterData: {
  product_id: number; system_class: string; rated_va: number;
  max_dc_voltage: number; ac_output_amps: number; dc_input_amps?: number;
}) {
  const { data } = await api.post('/components/inverters', inverterData);
  return data;
}

export async function getMppts() {
  const { data } = await api.get('/components/mppts');
  return data.mppts;
}

export async function createMppt(mpptData: {
  product_id: number; max_pv_voltage: number; max_charge_a: number;
  model_code: string; max_pv_power_w?: number;
}) {
  const { data } = await api.post('/components/mppts', mpptData);
  return data;
}

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

export async function getRecommendedMppt(panelId: number, panelQty: number): Promise<MpptRecommendation[]> {
  const { data } = await api.get('/components/mppts/recommend', {
    params: { panel_id: panelId, panel_qty: panelQty },
  });
  return data.recommendations;
}

export async function getBatteries() {
  const { data } = await api.get('/components/batteries');
  return data.batteries;
}

export async function createBattery(batteryData: {
  product_id: number; capacity_kwh: number; voltage: number;
  max_charge_a?: number; max_discharge_a?: number; chemistry?: string;
}) {
  const { data } = await api.post('/components/batteries', batteryData);
  return data;
}
