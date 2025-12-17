import express from 'express';
import jwt from 'jsonwebtoken';
// Lưu ý: Đường dẫn này đã được sửa để đúng với cấu trúc models
import { User } from '../db/models/User.model.js';
import config from '../config.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, gameDisplayName, password } = req.body;

    // Validation
    if (!email || !gameDisplayName || !password) {
      return res.status(400).json({ error: '❌ Vui lòng điền đầy đủ thông tin' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '❌ Mật khẩu phải có tối thiểu 6 ký tự' });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ error: '❌ Email đã đăng ký' });
    }

    // Create user
    const user = new User({ email, gameDisplayName, password });
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id }, config.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        gameDisplayName: user.gameDisplayName,
        highScore: user.highScore
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    // Parse validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message).join(', ');
      return res.status(400).json({ error: `❌ ${messages}` });
    }
    res.status(500).json({ error: '❌ Lỗi server, vui lòng thử lại' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '❌ Vui lòng nhập email và mật khẩu' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: '❌ Email hoặc mật khẩu sai' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: '❌ Email hoặc mật khẩu sai' });
    }

    // Generate token
    const token = jwt.sign({ id: user._id }, config.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        gameDisplayName: user.gameDisplayName,
        highScore: user.highScore,
        coins: user.coins
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '❌ Lỗi server, vui lòng thử lại' });
  }
});

// Get profile (protected route)
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;