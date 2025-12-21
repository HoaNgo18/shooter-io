export const MAP_SIZE = 5000;

export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 300;
export const PLAYER_MAX_LIVES = 3;

export const TICK_RATE = 60;
export const INTERPOLATION_DELAY = 100;

export const FOOD_COUNT = 300;
export const FOOD_RADIUS = 5;
export const XP_PER_FOOD = 10;

export const REGEN_DELAY = 3000;
export const REGEN_RATE = 10;

export const DASH_DURATION = 200;
export const DASH_COOLDOWN = 3000;
export const DASH_MULTIPLIER = 3;

export const OBSTACLE_COUNT = 80;
export const OBSTACLE_RADIUS_MIN = 30;
export const OBSTACLE_RADIUS_MAX = 120;

export const CHEST_COUNT = 15;
export const CHEST_RADIUS = 25;
export const CHEST_HP = 50;
export const SHIP_MAX_SPEED = 400;
export const SHIP_ACCELERATION = 600;
export const SHIP_DECELERATION = 300;
export const SHIP_ROTATION_SPEED = 3.5;
export const SHIP_BRAKE_FORCE = 800;
export const DASH_BOOST = 1200;
export const CHEST_TYPES = {
  NORMAL: 'NORMAL',
  BIG: 'BIG' // Chest to (Event)
};

export const BIG_CHEST_STATS = {
  radius: 45,        // To gấp đôi chest thường
  hp: 300,           // Máu trâu hơn nhiều (để người chơi phải bắn lâu mới vỡ)
  interval: 30000,   // Xuất hiện mỗi 30 giây (30000ms)
  message: "A LEGENDARY CHEST HAS SPAWNED!" // Thông báo
};

export const SKINS = [
  { id: 'default', name: 'Default', price: 0, color: 0x9E9E9E },
  { id: 'red', name: 'Crimson', price: 100, color: 0xFF1744 },
  { id: 'blue', name: 'Cobalt', price: 250, color: 0x00E5FF },
  { id: 'gold', name: 'Gold', price: 1000, color: 0xFFD700 },
  { id: 'dark', name: 'Nightmare', price: 2000, color: 0x212121 }
];

export const NEBULA_COUNT = 15; // Thay vì BUSH_COUNT
export const NEBULA_RADIUS = 70; // Tinh vân thường to hơn bụi cây

export const ITEM_TYPES = {
  HEALTH_PACK: 'HEALTH_PACK',
  SHIELD: 'SHIELD',
  SPEED: 'SPEED',
  WEAPON_BLUE: 'WEAPON_BLUE',     // Thay đổi
  WEAPON_RED: 'WEAPON_RED',       // Thay đổi
  WEAPON_GREEN: 'WEAPON_GREEN',
  COIN_SMALL: 'COIN_SMALL',   // Rơi từ Chest
  COIN_MEDIUM: 'COIN_MEDIUM', // Rơi từ Chest hiếm
  COIN_LARGE: 'COIN_LARGE'    // Rơi từ Chest cực hiếm
};

export const ITEM_RADIUS = 15;

// CẬP NHẬT HỆ THỐNG VŨ KHÍ
export const WEAPON_STATS = {
  BLUE: {
    cooldown: 200,        // Bắn nhanh
    damage: 10,
    speed: 600,
    range: 500,
    laserSprite: 'laserBlue01',
    color: 0x00E5FF,
    requireStill: false
  },

  RED: {
    cooldown: 400,        // Bắn chậm hơn
    damage: 25,           // Damage cao
    speed: 400,
    range: 450,
    laserSprite: 'laserRed01',
    color: 0xFF0000,
    requireStill: false
  },

  GREEN: {
    cooldown: 150,        // Bắn cực nhanh
    damage: 8,            // Damage thấp
    speed: 700,          // Tốc độ đạn nhanh nhất
    range: 600,
    laserSprite: 'laserGreen01',
    color: 0x00FF00,
    requireStill: false
  }
};

export const ENTITY_TYPES = {
  PLAYER: 'player',
  PROJECTILE: 'projectile',
  EXPLOSION: 'explosion', // Thêm explosion type
  FOOD: 'food'
};