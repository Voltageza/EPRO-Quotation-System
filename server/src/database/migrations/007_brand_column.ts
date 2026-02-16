import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // Add brand column to quotes table (defaults to Victron for existing quotes)
  try {
    db.exec("ALTER TABLE quotes ADD COLUMN brand TEXT NOT NULL DEFAULT 'Victron'");
  } catch (e) {
    // column may already exist
  }
}
