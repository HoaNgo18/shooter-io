import dotenv from 'dotenv';
dotenv.config();

export default {
  WS_PORT: process.env.WS_PORT || 3000,
  HTTP_PORT: process.env.HTTP_PORT || 8080,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/io-game',
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-key',
  NODE_ENV: process.env.NODE_ENV || 'development'
};