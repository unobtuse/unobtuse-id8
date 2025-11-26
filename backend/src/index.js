require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const ideasRoutes = require('./routes/ideas');
const repliesRoutes = require('./routes/replies');
const attachmentsRoutes = require('./routes/attachments');
const collaboratorsRoutes = require('./routes/collaborators');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/replies', repliesRoutes);
app.use('/api/attachments', attachmentsRoutes);
app.use('/api/collaborators', collaboratorsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`id8 API server running on port ${PORT}`);
});
