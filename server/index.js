import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import accountsRoutes from './routes/accounts.js';
import transactionsRoutes from './routes/transactions.js';
import investmentsRoutes from './routes/investments.js';
import identityRoutes from './routes/identity.js';
import categoriesRoutes from './routes/categories.js';
import loansRoutes from './routes/loans.js';
import billsRoutes from './routes/bills.js';
import connectorsRoutes from './routes/connectors.js';
import itemsRoutes from './routes/items.js';
import webhooksRoutes from './routes/webhooks.js';
import chatbotRoutes from './routes/chatbot.js';
import { clearCache } from './middleware/cache.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Register API Routes
app.use('/api/accounts', accountsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/connectors', connectorsRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Cache flush endpoint
app.post('/api/cache/clear', (req, res) => {
  clearCache();
  res.json({ success: true, message: 'Cache limpo com sucesso' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    pluggyConfigured: Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET)
  });
});

app.listen(PORT, () => {
  console.log(`[FinanceHub Backend] Servidor rodando na porta ${PORT}`);
});
