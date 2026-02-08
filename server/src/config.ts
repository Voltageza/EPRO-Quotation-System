import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  dbPath: path.resolve(__dirname, '..', process.env.DB_PATH || './data/epro.db'),
  jwtSecret: process.env.JWT_SECRET || 'epro-default-secret',
  jwtExpiresIn: '24h',
  uploadDir: path.resolve(__dirname, '../uploads'),
};
