const {
    Server
} = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                process.env.CORS_ORIGIN || '*',
                'https://id8.unobtuse.com',
                'http://localhost:3000',
                'http://localhost:8081'
            ],
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] User ${socket.userId} connected`);

        // Join user's personal room for direct notifications
        socket.join(`user:${socket.userId}`);

        // Join an idea room to receive updates for that idea
        socket.on('join:idea', (ideaId) => {
            socket.join(`idea:${ideaId}`);
            console.log(`[Socket] User ${socket.userId} joined idea:${ideaId}`);
        });

        // Leave an idea room
        socket.on('leave:idea', (ideaId) => {
            socket.leave(`idea:${ideaId}`);
            console.log(`[Socket] User ${socket.userId} left idea:${ideaId}`);
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] User ${socket.userId} disconnected`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Emit to all users in an idea room
const emitToIdea = (ideaId, event, data) => {
    if (io) {
        io.to(`idea:${ideaId}`).emit(event, data);
    }
};

// Emit to a specific user
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};

// Emit to all connected clients (for ideas list updates)
const emitToAll = (event, data) => {
    if (io) {
        io.emit(event, data);
    }
};

module.exports = {
    initSocket,
    getIO,
    emitToIdea,
    emitToUser,
    emitToAll
};