import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true, // Mongoose tự động tạo index unique
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true, // Mongoose tự động tạo index unique
    lowercase: true
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  highScore: {
    type: Number,
    default: 0
  },
  totalKills: {
    type: Number,
    default: 0
  },
  totalDeaths: {
    type: Number,
    default: 0
  },
  coins: {
    type: Number,
    default: 0
  },
  skins: {
    type: [String],
    default: ['default']
  },
  equippedSkin: {
    type: String,
    default: 'default'
  },
  arenaWins: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Chỉ khai báo index cho highScore vì nó không có unique
// Index -1 để tối ưu cho việc sort điểm cao nhất (Leaderboard)
userSchema.index({ highScore: -1 });

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Tạo Model
export const User = mongoose.model('User', userSchema);
