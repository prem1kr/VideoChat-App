const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const matchRoutes = require('./routes/matchRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/match', matchRoutes);

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins (update this for production)
    methods: ['GET', 'POST'],
  },
});

// Track connected users
const users = {}; // Maps userId to socket.id
const activeUsers = new Set(); // Tracks active userIds

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Register user with their unique ID
  socket.on('register-user', ({ userId }) => {
    if (!users[userId]) {
      users[userId] = socket.id;
      activeUsers.add(userId); // Add user to active users
      console.log(`User ${userId} registered with socket ID ${socket.id}`);
    } else {
      console.log(`User ${userId} is already registered.`);
    }
  });

  // Handle joining a chat with another user
  socket.on('join-chat', ({ userId, senderId }) => {
    const targetSocketId = users[userId];
    if (targetSocketId) {
      console.log(`User ${senderId} is connecting to ${userId}`);
      io.to(targetSocketId).emit('incoming-connection', { senderId });
    } else {
      console.error(`User ${userId} not found.`);
      socket.emit('user-not-found', { userId });
    }
  });

  // Handle finding a random active user
  socket.on('find-random-user', ({ senderId }) => {
    const activeUserIds = Array.from(activeUsers).filter((id) => id !== senderId); // Exclude self
    if (activeUserIds.length > 0) {
      const randomUserId = activeUserIds[Math.floor(Math.random() * activeUserIds.length)];
      console.log(`Connecting ${senderId} to random user ${randomUserId}`);
      socket.emit('random-user-found', { userId: randomUserId });
    } else {
      console.log('No active users found.');
      socket.emit('no-active-users');
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const targetSocketId = users[data.targetUserId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('offer', { offer: data.offer, senderId: data.senderId });
    } else {
      console.error(`User ${data.targetUserId} not found.`);
      socket.emit('user-not-found', { userId: data.targetUserId });
    }
  });

  socket.on('answer', (data) => {
    const targetSocketId = users[data.targetUserId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer', { answer: data.answer, senderId: data.senderId });
    } else {
      console.error(`User ${data.targetUserId} not found.`);
      socket.emit('user-not-found', { userId: data.targetUserId });
    }
  });

  socket.on('ice-candidate', (data) => {
    const targetSocketId = users[data.targetUserId];
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', { candidate: data.candidate, senderId: data.senderId });
    } else {
      console.error(`User ${data.targetUserId} not found.`);
      socket.emit('user-not-found', { userId: data.targetUserId });
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    for (const [userId, socketId] of Object.entries(users)) {
      if (socketId === socket.id) {
        delete users[userId];
        activeUsers.delete(userId); // Remove user from active users
        console.log(`User ${userId} removed.`);
        break;
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});