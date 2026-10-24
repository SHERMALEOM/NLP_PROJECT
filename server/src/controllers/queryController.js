import mongoose from 'mongoose';
import { getPool, getQueryTimeoutMs, isMysqlUnavailable } from '../database/mysql.js';
import { getDatabaseSchema } from '../database/schema.js';
import { generateSql, validateSelect } from '../services/queryService.js';

async function saveHistory(kind, payload, result) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const History = mongoose.models.QueryHistory || mongoose.model('QueryHistory', new mongoose.Schema({
      kind: String, question: String, sql: String, rowCount: Number, error: String
    }, { timestamps: true }));
    await History.create({ kind, ...payload, ...result });
  } catch (error) { console.error('Could not save query history:', error.message); }
}

export async function generate(req, res) {
  try {
    const schema = await getDatabaseSchema();
    const sql = await generateSql(req.body?.question, schema);
    await saveHistory('generate', { question: req.body.question, sql }, { rowCount: 0 });
    res.json({ sql });
  } catch (error) {
    const databaseUnavailable = isMysqlUnavailable(error);
    const status = error.statusCode || (error.message.includes('GEMINI_API_KEY') || databaseUnavailable ? 503 : 400);
    const message = databaseUnavailable
      ? `MySQL connection failed (${error.code || 'MYSQL_CONNECTION_FAILED'}). Check the configured host, port, database, and account permissions.`
      : error.message;
    res.status(status).json({ error: message });
  }
}

export async function execute(req, res) {
  let sql;
  try {
    sql = validateSelect(req.body?.sql);
    const pool = getPool();
    const boundedSql = `SELECT * FROM (${sql}) AS querybridge_result LIMIT 101`;
    const [rows, fields] = await pool.query({ sql: boundedSql, timeout: getQueryTimeoutMs() });
    const truncated = rows.length > 100;
    const limited = rows.slice(0, 100);
    await saveHistory('execute', { sql }, { rowCount: limited.length });
    res.json({ columns: fields.map((field) => field.name), rows: limited, rowCount: limited.length, truncated });
  } catch (error) {
    if (sql) await saveHistory('execute', { sql }, { error: error.message });
    const status = isMysqlUnavailable(error) ? 503 : 400;
    const message = error.code === 'ER_NO_SUCH_TABLE'
      ? 'The employees table was not found in the configured MySQL database.'
      : isMysqlUnavailable(error)
        ? `MySQL connection failed (${error.code || 'MYSQL_CONNECTION_FAILED'}). Check the configured host, port, database, and account permissions.`
        : `Could not run query: ${error.message}`;
    res.status(status).json({ error: message });
  }
}

export async function listEmployees(_req, res) {
  try {
    const [employees] = await getPool().query({ sql: 'SELECT * FROM employees ORDER BY id LIMIT 100', timeout: getQueryTimeoutMs() });
    res.json({ employees });
  } catch (error) {
    const message = isMysqlUnavailable(error)
      ? `MySQL connection failed (${error.code || 'MYSQL_CONNECTION_FAILED'}). Check the configured host, port, database, and account permissions.`
      : error.code === 'ER_NO_SUCH_TABLE'
        ? 'The employees table was not found in the configured MySQL database.'
        : `Could not read employees: ${error.message}`;
    res.status(503).json({ error: message });
  }
}
