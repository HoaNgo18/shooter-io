import { Server } from './core/Server.js';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db/mongo.js';
import authRouter from './api/auth.js';
import config from './config.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// REST API routes
app.use('/api/auth', authRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start HTTP server
const PORT = config.HTTP_PORT || 8080;
app.listen(PORT, () => {
  console.log(`HTTP API server running on port ${PORT}`);
});

// Connect to MongoDB
connectDB().then(() => {
  console.log('MongoDB connected');
  
  // Start WebSocket game server
  const gameServer = new Server(config.WS_PORT || 3000);
  gameServer.start();
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});