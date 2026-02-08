import api from './client';

export async function getPricing() {
  const { data } = await api.get('/admin/pricing');
  return data.pricing;
}

export async function updatePricing(updates: {
  pricing_factor?: number;
  vat_rate?: number;
  min_margin?: number;
  travel_rate?: number;
  labour_rate?: number;
}) {
  const { data } = await api.patch('/admin/pricing', updates);
  return data;
}

export async function getAuditLog(limit = 50, offset = 0) {
  const { data } = await api.get('/admin/audit', { params: { limit, offset } });
  return data;
}
