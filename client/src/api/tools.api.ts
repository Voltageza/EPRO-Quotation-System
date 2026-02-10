import api from './client';

export interface MountingCalculateInput {
  mounting_type: 'ibr' | 'corrugated' | 'tile' | 'tilt_frame_ibr' | 'tilt_frame_corrugated';
  panel_id?: number;
  width_mm?: number;
  rows: number;
  cols: number;
}

export interface MountingResultItem {
  sku: string;
  product_id: number;
  section: string;
  quantity: number;
  name: string;
  unit_price_cents: number;
  line_total_cents: number;
  note?: string;
}

export interface MountingCalculateResult {
  items: MountingResultItem[];
  flags: Array<{ code: string; severity: string; message: string; is_blocking: boolean }>;
  grand_total_cents: number;
}

export async function calculateMounting(input: MountingCalculateInput): Promise<MountingCalculateResult> {
  const { data } = await api.post('/tools/mounting-calculate', input);
  return data;
}
