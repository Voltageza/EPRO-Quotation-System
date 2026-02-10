import { getDb } from './connection';
import { up as schema } from './migrations/001_initial_schema';
import { up as seed } from './migrations/002_seed_data';
import { up as victronSystems } from './migrations/003_seed_victron_systems';
import { up as ruleSeeds } from './migrations/004_seed_rule_tables';
import { up as mountingType } from './migrations/005_mounting_type';

interface Migration {
  name: string;
  up: (db: any) => void;
}

const migrations: Migration[] = [
  { name: '001_initial_schema', up: schema },
  { name: '002_seed_data', up: seed },
  { name: '003_seed_victron_systems', up: victronSystems },
  { name: '004_seed_rule_tables', up: ruleSeeds },
  { name: '005_mounting_type', up: mountingType },
];

export function runMigrations(): void {
  const db = getDb();

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name);

  for (const migration of migrations) {
    if (!applied.includes(migration.name)) {
      console.log(`  Running migration: ${migration.name}`);
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
      })();
    }
  }
}

// Allow running directly
if (require.main === module) {
  const { initDatabase } = require('./connection');
  initDatabase();
  runMigrations();
  console.log('  Migrations complete.');
}
