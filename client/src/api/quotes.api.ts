import api from './client';

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
