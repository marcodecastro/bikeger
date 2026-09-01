import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDb } from './src/config/db.js';
import { router } from './src/routes/index.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { securityHeaders } from './src/middleware/securityHeaders.js';
import { ensureDefaultUsers } from './src/services/userService.js';
import { assertBootConfig, corsOrigin, redactMongoUri } from './src/utils/security.js';
import { transactionSupport } from './src/utils/transaction.js';

assertBootConfig();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(securityHeaders());
app.use(cors({ origin: corsOrigin() }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'bikeger',
    money: 'cents',
    mongoTransactions: transactionSupport().transactions,
  });
});

app.use('/api', router);
app.use(errorHandler);

connectDb()
  .then(async () => {
    await ensureDefaultUsers();
    app.listen(PORT, () => {
      console.log(`BikeGer API em http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  })
  .catch((err) => {
    console.error('Falha ao iniciar a API:', redactMongoUri(err.message));
    if (String(err.message).includes('ECONNREFUSED') || String(err.message).includes('connect')) {
      console.error('Suba o MongoDB local ou use: docker compose up -d');
    }
    process.exit(1);
  });
