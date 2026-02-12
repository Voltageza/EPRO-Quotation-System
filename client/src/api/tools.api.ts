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

// --- Multi-array types ---

export interface MountingGroupInput {
  label?: string;
  mounting_type: 'ibr' | 'corrugated' | 'tile' | 'tilt_frame_ibr' | 'tilt_frame_corrugated';
  panel_id?: number;
  width_mm?: number;
  rows: number;
  cols: number;
}

export interface MountingGroupResult {
  label: string;
  panel_count: number;
  items: MountingResultItem[];
  flags: Array<{ code: string; severity: string; message: string; is_blocking: boolean }>;
  subtotal_cents: number;
}

export interface MountingMultiResult {
  groups: MountingGroupResult[];
  combined: {
    items: MountingResultItem[];
    flags: Array<{ code: string; severity: string; message: string; is_blocking: boolean }>;
    grand_total_cents: number;
    total_panels: number;
  };
}

export async function calculateMountingMulti(groups: MountingGroupInput[]): Promise<MountingMultiResult> {
  const { data } = await api.post('/tools/mounting-calculate-multi', { groups });
  return data;
}

// --- Irregular layout types ---

export interface IrregularGroupInput {
  label?: string;
  mounting_type: 'ibr' | 'corrugated' | 'tile' | 'tilt_frame_ibr' | 'tilt_frame_corrugated';
  panel_id?: number;
  width_mm?: number;
  row_counts: number[];
  row_columns?: number[][];  // active column indices per row (position-aware)
}

export async function calculateMountingIrregular(groups: IrregularGroupInput[]): Promise<MountingMultiResult> {
  const { data } = await api.post('/tools/mounting-calculate-irregular', { groups });
  return data;
}

// --- Photo analysis types ---

export interface PhotoAnalyzeGroup {
  label: string;
  rows: number[];  // panel count per row, e.g. [6, 6, 5, 3]
}

export interface PhotoAnalyzeResult {
  groups: PhotoAnalyzeGroup[];
  total_panels: number;
}

export async function analyzePhoto(file: File): Promise<PhotoAnalyzeResult> {
  const formData = new FormData();
  formData.append('photo', file);
  const { data } = await api.post('/tools/mounting-analyze-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // Vision API can take a while
  });
  return data;
}
