import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { config } from './config';
import { initDatabase } from './database/connection';
import { runMigrations } from './database/migrate';
import { authRoutes } from './routes/auth.routes';
import { productRoutes } from './routes/products.routes';
import { panelRoutes } from './routes/panels.routes';
import { componentRoutes } from './routes/components.routes';
import { adminRoutes } from './routes/admin.routes';
import { quoteRoutes } from './routes/quotes.routes';
import { errorHandler } from './middleware/errorHandler';
import { terminateOcrWorker } from './utils/ocr-worker';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();
runMigrations();

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/panels', panelRoutes);
app.use('/api/v1/components', componentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/quotes', quoteRoutes);

// Serve static React client in production (only if built)
const clientDist = path.join(__dirname, '../../client/dist');
const indexHtml = path.join(clientDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.json({ message: 'EPRO Quotation System API running. Build the client with: cd client && npm run build' });
  });
}

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, config.host, () => {
  console.log(`\n  EPRO Quotation System running on http://${config.host}:${config.port}`);

  // Print LAN IP addresses
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  LAN access: http://${iface.address}:${config.port}`);
      }
    }
  }
  console.log('');
});

// Graceful shutdown — terminate OCR worker to prevent hanging threads
const shutdown = async () => {
  console.log('\n  Shutting down…');
  await terminateOcrWorker();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
