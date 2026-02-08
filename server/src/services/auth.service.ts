import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../database/connection';
import { UserWithPassword, JwtPayload } from '../types';

export function hashPassword(password: string): string {
  return bcryptjs.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcryptjs.compareSync(password, hash);
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: 86400 }); // 24 hours in seconds
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export function findUserByUsername(username: string): UserWithPassword | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as UserWithPassword | undefined;
}

export function findUserById(id: number): UserWithPassword | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(id) as UserWithPassword | undefined;
}

export function getAllUsers() {
  const db = getDb();
  return db.prepare('SELECT id, username, display_name, role, is_active, created_at, updated_at FROM users').all();
}

export function createUser(username: string, displayName: string, password: string, role: string) {
  const db = getDb();
  const hash = hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username, displayName, hash, role);
  return result.lastInsertRowid;
}

export function updateUser(id: number, updates: { display_name?: string; role?: string; is_active?: number }) {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.display_name !== undefined) { fields.push('display_name = ?'); values.push(updates.display_name); }
  if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function changePassword(id: number, newPassword: string) {
  const db = getDb();
  const hash = hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, id);
}
