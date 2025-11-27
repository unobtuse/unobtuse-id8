require('dotenv').config();
const express = require('express');
const {
    createServer
} = require('http');
const cors = require('cors');
const {
    initSocket
} = require('./config/socket');
const authRoutes = require('./routes/auth');
const ideasRoutes = require('./routes/ideas');
const repliesRoutes = require('./routes/replies');
const attachmentsRoutes = require('./routes/attachments');
const collaboratorsRoutes = require('./routes/collaborators');
const settingsRoutes = require('./routes/settings');
const pushRoutes = require('./routes/push');
const logsRoutes = require('./routes/logs');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Socket.IO
initSocket(server);

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
app.use('/api/push', pushRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/og', require('./routes/og'));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

server.listen(PORT, () => {
    console.log(`id8 API server running on port ${PORT}`);
});