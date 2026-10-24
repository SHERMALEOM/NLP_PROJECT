import mysql from 'mysql2/promise';

let pool;

function getMysqlConfig() {
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
  const missing = required.filter((key) => process.env[key] === undefined || process.env[key] === '');
  if (missing.length) throw new Error(`Missing MySQL settings in server/.env: ${missing.join(', ')}.`);

  return {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    connectTimeout: Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 10000),
    decimalNumbers: true,
    dateStrings: true
  };
}

export function getPool() {
  if (!pool) pool = mysql.createPool(getMysqlConfig());
  return pool;
}

export function getQueryTimeoutMs() {
  return Number(process.env.MYSQL_QUERY_TIMEOUT_MS || 10000);
}

export function isMysqlUnavailable(error) {
  return error.message.includes('MySQL settings') || [
    'ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT',
    'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_CON_COUNT_ERROR'
  ].includes(error.code);
}

export async function closePool() {
  if (pool) {
    const activePool = pool;
    pool = undefined;
    await activePool.end();
  }
}
