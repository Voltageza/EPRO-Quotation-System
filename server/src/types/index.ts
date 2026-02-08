export type UserRole = 'admin' | 'sales' | 'viewer';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  subcategory: string | null;
  unit: string;
  retail_price: number;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingConfig {
  id: number;
  pricing_factor: number;
  vat_rate: number;
  min_margin: number;
  travel_rate: number;
  labour_rate: number;
  updated_by: number | null;
  updated_at: string;
}
