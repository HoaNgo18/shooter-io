export const MAP_SIZE = 5000;

export const PLAYER_RADIUS = 20;
export const PLAYER_SPEED = 300; 
export const PLAYER_MAX_HEALTH = 100;

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

export const OBSTACLE_COUNT = 50;  
export const OBSTACLE_RADIUS_MIN = 30; 
export const OBSTACLE_RADIUS_MAX = 80;

export const CHEST_COUNT = 15;
export const CHEST_RADIUS = 25;
export const CHEST_HP = 50;
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


export const ITEM_TYPES = {
  HEALTH_PACK: 'HEALTH_PACK',
  SHIELD: 'SHIELD',
  SPEED: 'SPEED',
  WEAPON_PISTOL: 'WEAPON_PISTOL',
  WEAPON_ROCKET: 'WEAPON_ROCKET',
  WEAPON_SHOTGUN: 'WEAPON_SHOTGUN',
  WEAPON_MACHINEGUN: 'WEAPON_MACHINEGUN',
  WEAPON_SNIPER: 'WEAPON_SNIPER', // Thêm Sniper
  COIN_SMALL: 'COIN_SMALL',   // Rơi từ Chest
  COIN_MEDIUM: 'COIN_MEDIUM', // Rơi từ Chest hiếm
  COIN_LARGE: 'COIN_LARGE'    // Rơi từ Chest cực hiếm
};

export const ITEM_RADIUS = 15;

// CẬP NHẬT HỆ THỐNG VŨ KHÍ
export const WEAPON_STATS = {
  PISTOL: {
    cooldown: 400,        // Bắn mỗi 0.4s
    damage: 15,
    speed: 600,           // Tốc độ đạn trung bình
    range: 400,           // Tầm bắn trung bình
    count: 1,
    spread: 0,
    radius: 6,            // Kích thước đạn trung bình
    color: 0xFFFF00,
    requireStill: false   // Không cần đứng yên
  },
  
  ROCKET: {
    cooldown: 1200,       // Bắn chậm (1.2s)
    damage: 30,           // Dame mỗi mảnh vụn
    speed: 350,           // Tốc độ chậm
    range: 500,           // Tầm xa
    count: 1,
    spread: 0,
    radius: 10,           // Đạn to
    color: 0xFF4400,
    requireStill: true,
    // Explosion properties
    explosionRadius: 120, // Phạm vi nổ
    shrapnelCount: 12,    // Số mảnh vụn
    shrapnelDamage: 30    // Dame mỗi mảnh
  },
  
  SHOTGUN: {
    cooldown: 800,        // Bắn chậm
    damage: 12,
    speed: 550,           // Tốc độ chậm
    range: 250,           // Tầm gần
    count: 6,             // Bắn 6 viên
    spread: 0.4,          // Tán rộng
    radius: 5,
    color: 0xFFA500,
    requireStill: false
  },
  
  MACHINEGUN: {
    cooldown: 100,        // Bắn cực nhanh
    damage: 8,
    speed: 700,           // Tốc độ nhanh
    range: 350,           // Tầm trung bình
    count: 1,
    spread: 0.15,         // Hơi rung
    radius: 4,            // Đạn nhỏ
    color: 0xFFFFAA,
    requireStill: false
  },
  
  SNIPER: {
    cooldown: 1500,       // Bắn rất chậm
    damage: 60,           // Dame cực cao
    speed: 1200,          // Cực nhanh
    range: 600,           // Tầm cực xa
    count: 1,
    spread: 0,            // Không rung
    radius: 4,            // Đạn nhỏ
    color: 0x00FFFF,
    requireStill: true    // PHẢI ĐỨNG YÊN
  }
};

export const ENTITY_TYPES = {
  PLAYER: 'player',
  PROJECTILE: 'projectile',
  EXPLOSION: 'explosion', // Thêm explosion type
  FOOD: 'food'
};