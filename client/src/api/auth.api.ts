import api from './client';

export async function login(username: string, password: string) {
  const { data } = await api.post('/auth/login', { username, password });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
  return data;
}

export async function getUsers() {
  const { data } = await api.get('/auth/users');
  return data.users;
}

export async function createUser(username: string, display_name: string, password: string, role: string) {
  const { data } = await api.post('/auth/users', { username, display_name, password, role });
  return data;
}

export async function updateUser(id: number, updates: { display_name?: string; role?: string; is_active?: number }) {
  const { data } = await api.patch(`/auth/users/${id}`, updates);
  return data;
}
