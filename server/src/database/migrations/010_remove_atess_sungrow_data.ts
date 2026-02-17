import Database from 'better-sqlite3';

export function up(db: Database.Database): void {
  const ATESS_SUNGROW_CLASSES = ['ATT5', 'ATT10', 'SG5', 'SG8', 'SG10', 'SG10RT'];
  const classPlaceholders = ATESS_SUNGROW_CLASSES.map(() => '?').join(',');

  // Find quote IDs that use Atess/Sungrow system classes OR brand
  const quoteIds = db.prepare(
    `SELECT id FROM quotes WHERE system_class IN (${classPlaceholders}) OR brand IN ('Atess', 'Sungrow')`
  ).all(...ATESS_SUNGROW_CLASSES).map((r: any) => r.id);

  if (quoteIds.length > 0) {
    const qPlaceholders = quoteIds.map(() => '?').join(',');

    // 1. Delete quote_bom_items
    db.prepare(`DELETE FROM quote_bom_items WHERE quote_id IN (${qPlaceholders})`).run(...quoteIds);

    // 2. Delete quote_designs
    db.prepare(`DELETE FROM quote_designs WHERE quote_id IN (${qPlaceholders})`).run(...quoteIds);

    // 3. Delete quote_flags
    db.prepare(`DELETE FROM quote_flags WHERE quote_id IN (${qPlaceholders})`).run(...quoteIds);

    // 4. Delete quote_versions
    db.prepare(`DELETE FROM quote_versions WHERE quote_id IN (${qPlaceholders})`).run(...quoteIds);

    // 5. Delete quotes
    db.prepare(`DELETE FROM quotes WHERE id IN (${qPlaceholders})`).run(...quoteIds);
  }

  // 6. Delete rule_entries for Atess/Sungrow system classes
  db.prepare(
    `DELETE FROM rule_entries WHERE system_class IN (${classPlaceholders})`
  ).run(...ATESS_SUNGROW_CLASSES);

  // 7. Delete inverters for Atess/Sungrow system classes
  db.prepare(
    `DELETE FROM inverters WHERE system_class IN (${classPlaceholders})`
  ).run(...ATESS_SUNGROW_CLASSES);

  // 8. Delete batteries with brand Atess or Sungrow
  db.prepare("DELETE FROM batteries WHERE brand IN ('Atess', 'Sungrow')").run();

  // 9. Delete products with brand Atess or Sungrow
  db.prepare("DELETE FROM products WHERE brand IN ('Atess', 'Sungrow')").run();

  console.log('  Removed all Atess & Sungrow data (products, inverters, batteries, rules, quotes).');
}
