import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  // Migration 010 missed quotes that had system_class='V10' but brand='Atess'/'Sungrow'.
  // This cleans up those remaining quotes.
  const quoteIds = db.prepare(
    "SELECT id FROM quotes WHERE brand IN ('Atess', 'Sungrow')"
  ).all().map((r: any) => r.id);

  if (quoteIds.length > 0) {
    const placeholders = quoteIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM quote_bom_items WHERE quote_id IN (${placeholders})`).run(...quoteIds);
    db.prepare(`DELETE FROM quote_designs WHERE quote_id IN (${placeholders})`).run(...quoteIds);
    db.prepare(`DELETE FROM quote_flags WHERE quote_id IN (${placeholders})`).run(...quoteIds);
    db.prepare(`DELETE FROM quote_versions WHERE quote_id IN (${placeholders})`).run(...quoteIds);
    db.prepare(`DELETE FROM quotes WHERE id IN (${placeholders})`).run(...quoteIds);
    console.log(`  Cleaned up ${quoteIds.length} remaining Atess/Sungrow-branded quotes.`);
  }
}
