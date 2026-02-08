import api from './client';

export async function getProducts(category?: string) {
  const params = category ? { category } : {};
  const { data } = await api.get('/products', { params });
  return data.products;
}

export async function getProduct(id: number) {
  const { data } = await api.get(`/products/${id}`);
  return data.product;
}

export async function createProduct(product: {
  sku: string; name: string; category: string; subcategory?: string;
  unit?: string; retail_price: number; notes?: string;
}) {
  const { data } = await api.post('/products', product);
  return data;
}

export async function updateProduct(id: number, updates: Record<string, unknown>) {
  const { data } = await api.patch(`/products/${id}`, updates);
  return data;
}

export async function deleteProduct(id: number) {
  const { data } = await api.delete(`/products/${id}`);
  return data;
}

export async function importHTM(filePath: string) {
  const { data } = await api.post('/products/import-htm', { filePath });
  return data;
}

export async function getPriceHistory(id: number) {
  const { data } = await api.get(`/products/${id}/price-history`);
  return data.history;
}
