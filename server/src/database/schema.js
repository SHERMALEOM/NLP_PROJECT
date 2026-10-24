import { getPool, getQueryTimeoutMs } from './mysql.js';

export async function getDatabaseSchema() {
  const pool = getPool();
  const [rows] = await pool.query({
    sql: `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    timeout: getQueryTimeoutMs()
  });

  if (!rows.length) throw new Error('The configured MySQL database has no visible tables. Check MYSQL_DATABASE and the database user permissions.');

  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.TABLE_NAME)) tables.set(row.TABLE_NAME, []);
    tables.get(row.TABLE_NAME).push(
      `  ${row.COLUMN_NAME} ${row.COLUMN_TYPE}${row.COLUMN_KEY === 'PRI' ? ' PRIMARY KEY' : ''}${row.IS_NULLABLE === 'NO' ? ' NOT NULL' : ''}`
    );
  }

  return [...tables.entries()].map(([table, columns]) => `Table ${table} (\n${columns.join(',\n')}\n)`).join('\n\n');
}
