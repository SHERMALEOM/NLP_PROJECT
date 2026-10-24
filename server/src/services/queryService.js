import { getDatabaseSchema } from '../database/schema.js';
import { GoogleGenAI } from '@google/genai';

export function validateSelect(sql) {
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('Enter a SQL query first.');
  const normalized = sql.trim().replace(/;\s*$/, '');
  if (normalized.length > 2000) throw new Error('SQL query is too long.');
  if (/[;`]/.test(normalized) || /--|\/\*/.test(normalized)) throw new Error('Only one plain SELECT statement is allowed.');
  if (!/^SELECT\b/i.test(normalized)) throw new Error('Only read-only SELECT queries are allowed.');
  if (/\b(ATTACH|DETACH|PRAGMA|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|VACUUM|REINDEX|WITH|INTO|OUTFILE|DUMPFILE|FOR\s+UPDATE|LOCK\s+IN\s+SHARE\s+MODE|SLEEP|BENCHMARK|LOAD_FILE|GET_LOCK|RELEASE_LOCK)\b/i.test(normalized)) {
    throw new Error('That SQL contains a statement or keyword that is not allowed.');
  }
  if (!/\bFROM\s+employees\b/i.test(normalized)) throw new Error('Queries must read from the employees table.');
  return normalized;
}

export async function generateSql(question, schema) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is missing. Add your Gemini API key to server/.env and restart the backend.');
    error.statusCode = 503;
    throw error;
  }
  if (typeof question !== 'string' || question.trim().length < 3 || question.length > 500) throw new Error('Enter a question between 3 and 500 characters.');
  const databaseSchema = schema || await getDatabaseSchema();
  const ai = new GoogleGenAI({ apiKey });
  let response;
  try {
    response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: question.trim(),
      config: {
        systemInstruction: `Convert the user's question to exactly one MySQL-compatible SELECT query for the active MySQL database. Use only tables and columns listed in this live schema:\n${databaseSchema}\nReturn only SQL, no markdown or explanation. Never modify data or use any table not shown in the schema.`,
        temperature: 0,
        httpOptions: { timeout: 20000 }
      }
    });
  } catch (cause) {
    const status = Number(cause.status || cause.statusCode || cause.code);
    let message = 'Gemini request failed. Check the backend Gemini configuration and try again.';
    if (status === 401 || status === 403) message = 'Gemini authentication failed. Check GEMINI_API_KEY and API access for the selected model.';
    else if (status === 429) message = 'Gemini rate limit or quota reached (HTTP 429). Check your Google AI quota, then retry.';
    else if (/timeout|timed out/i.test(cause.message || '')) message = 'Gemini request timed out. Try again.';
    const error = new Error(message);
    error.statusCode = status === 429 || status === 401 || status === 403 ? 503 : 502;
    throw error;
  }
  let rawText;
  try {
    rawText = typeof response.text === 'function' ? response.text() : response.text;
  } catch {
    rawText = undefined;
  }
  if (typeof rawText !== 'string') rawText = undefined;
  const sql = rawText?.trim().replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/, '');
  if (!sql) {
    const error = new Error('Gemini returned no SQL text. Try rephrasing your question.');
    error.statusCode = 502;
    throw error;
  }
  try {
    return validateSelect(sql);
  } catch (cause) {
    const error = new Error(`Gemini returned SQL that failed safety validation: ${cause.message}`);
    error.statusCode = 502;
    throw error;
  }
}
