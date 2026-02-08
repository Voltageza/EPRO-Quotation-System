import api from './client';

export async function getPanels(status?: string) {
  const params = status ? { status } : {};
  const { data } = await api.get('/panels', { params });
  return data.panels;
}

export async function getPanel(id: number) {
  const { data } = await api.get(`/panels/${id}`);
  return data.panel;
}

export async function uploadDatasheet(file: File) {
  const formData = new FormData();
  formData.append('datasheet', file);
  const { data } = await api.post('/panels/upload-datasheet', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function createPanel(panelData: {
  sku: string; name: string; retail_price?: number;
  power_w: number; voc: number; vmp: number; isc: number; imp: number;
  temp_coeff_voc: number; width_mm?: number; height_mm?: number;
  depth_mm?: number; weight_kg?: number; datasheet_path?: string;
}) {
  const { data } = await api.post('/panels', panelData);
  return data;
}

export async function updatePanel(id: number, updates: Record<string, unknown>) {
  const { data } = await api.patch(`/panels/${id}`, updates);
  return data;
}

export async function validatePanel(id: number) {
  const { data } = await api.get(`/panels/${id}/validate`);
  return data.validation;
}

export async function approvePanel(id: number) {
  const { data } = await api.post(`/panels/${id}/approve`);
  return data;
}

export async function rejectPanel(id: number) {
  const { data } = await api.post(`/panels/${id}/reject`);
  return data;
}
