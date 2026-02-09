import api from './client';

export interface DashboardStats {
  total_quotes: number;
  total_clients: number;
  revenue_cents: number;
  quotes_this_month: number;
  status_breakdown: Array<{ status: string; count: number }>;
  system_class_distribution: Array<{ system_class: string; count: number }>;
  revenue_by_system_class: Array<{ system_class: string; total: number }>;
  recent_quotes: Array<{
    id: number;
    quote_number: string;
    system_class: string;
    status: string;
    total_cents: number | null;
    created_at: string;
    client_name: string;
  }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get('/dashboard/stats');
  return data;
}

export async function cloneQuote(quoteId: number): Promise<{ id: number; quote_number: string }> {
  const { data } = await api.post(`/quotes/${quoteId}/clone`);
  return data;
}

export async function getClients() {
  const { data } = await api.get('/quotes/clients');
  return data.clients;
}

export async function createClient(client: { name: string; phone?: string; email?: string; address?: string }) {
  const { data } = await api.post('/quotes/clients', client);
  return data;
}

export async function updateClient(id: number, updates: Record<string, unknown>) {
  const { data } = await api.patch(`/quotes/clients/${id}`, updates);
  return data;
}

export async function getQuotes(status?: string) {
  const params = status ? { status } : {};
  const { data } = await api.get('/quotes', { params });
  return data.quotes;
}

export async function getQuote(id: number) {
  const { data } = await api.get(`/quotes/${id}`);
  return data;
}

export async function createQuote(input: { client_id: number; system_class: string }) {
  const { data } = await api.post('/quotes', input);
  return data;
}

export async function updateQuote(id: number, updates: Record<string, unknown>) {
  const { data } = await api.patch(`/quotes/${id}`, updates);
  return data;
}

export async function generateBom(quoteId: number) {
  const { data } = await api.post(`/quotes/${quoteId}/generate-bom`);
  return data;
}

export async function getQuoteVersions(quoteId: number) {
  const { data } = await api.get(`/quotes/${quoteId}/versions`);
  return data.versions;
}

export async function downloadQuotePdf(quoteId: number) {
  const response = await api.get(`/quotes/${quoteId}/pdf`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const disposition = response.headers['content-disposition'];
  const filename = disposition?.match(/filename="(.+)"/)?.[1] || `quote-${quoteId}.pdf`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
