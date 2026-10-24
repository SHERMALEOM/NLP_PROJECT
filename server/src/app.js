
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPool, getQueryTimeoutMs } from './database/mysql.js';
import queryRoutes from './routes/queryRoutes.js';

const serverDirectory = path.dirname(
  path.dirname(fileURLToPath(import.meta.url))
);

const envPath = path.join(serverDirectory, '.env');

const envResult = dotenv.config({
  path: envPath,
  override: true
});

if (envResult.error) {
  console.warn(
    `Could not load backend environment file: ${envResult.error.message}`
  );
}

const app = express();

// Allow both Vite development ports.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5177'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as curl.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    }
  })
);

app.use(express.json({ limit: '10kb' }));

// Backend health check
app.get('/api/health', async (_req, res) => {
  try {
    await getPool().query({
      sql: 'SELECT 1 AS connected',
      timeout: getQueryTimeoutMs()
    });

    res.json({
      status: 'ok',
      mysql: true,
      mongodb: mongoose.connection.readyState === 1
    });
  } catch (error) {
    const code = error.code || 'MYSQL_CONNECTION_FAILED';

    console.error(`MySQL health check failed (${code}).`);

    res.status(503).json({
      status: 'error',
      mysql: false,
      mongodb: mongoose.connection.readyState === 1,
      error: code
    });
  }
});

// Query generation and execution routes
app.use('/api', queryRoutes);

// Error handler
app.use((error, _req, res, _next) => {
  console.error('Request error:', error.message);

  res.status(400).json({
    error: error.message || 'Invalid request.'
  });
});

// MongoDB connection (optional query history)
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('MongoDB connected (query history enabled).');
    })
    .catch((error) => {
      console.error(
        `MongoDB unavailable; query history disabled: ${error.message}`
      );
    });
} else {
  console.warn(
    'MONGODB_URI is not set; query history is disabled.'
  );
}

// Start server
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`QueryBridge API running at http://localhost:${port}`);
});
