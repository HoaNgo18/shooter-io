import mongoose from 'mongoose';
import config from '../config.js';

export async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export default mongoose;