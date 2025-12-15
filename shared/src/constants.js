export const MAP_SIZE = 5000;

export const PLAYER_RADIUS = 20;
// Tốc độ di chuyển cơ bản (pixels/giây)
export const PLAYER_SPEED = 300; 
export const PLAYER_MAX_HEALTH = 100;

// Tốc độ server gửi update xuống client
export const TICK_RATE = 60; 
export const INTERPOLATION_DELAY = 100; 

// Thức ăn
export const FOOD_COUNT = 300; 
export const FOOD_RADIUS = 5; 
export const XP_PER_FOOD = 10; 

// Hồi máu
export const REGEN_DELAY = 3000; 
export const REGEN_RATE = 10; 

//THÊM CÁC HẰNG SỐ CHO DASH
export const DASH_DURATION = 200; 
export const DASH_COOLDOWN = 3000; 
export const DASH_MULTIPLIER = 3; 

// Chướng ngại vật
export const OBSTACLE_COUNT = 50;  
export const OBSTACLE_RADIUS_MIN = 30; 
export const OBSTACLE_RADIUS_MAX = 80;

// Thêm cấu hình Chest (Hòm đồ)
export const CHEST_COUNT = 15;        // Số lượng hòm trên map
export const CHEST_RADIUS = 25;
export const CHEST_HP = 50;           // Máu của hòm

// Định nghĩa các loại Item rơi ra
export const ITEM_TYPES = {
  HEALTH_PACK: 'HEALTH_PACK', // Hồi máu
  SHIELD: 'SHIELD',           // Bất tử
  SPEED: 'SPEED',             // Tốc chạy
  // Các loại súng
  WEAPON_ROCKET: 'WEAPON_ROCKET',
  WEAPON_SHOTGUN: 'WEAPON_SHOTGUN',
  WEAPON_MACHINEGUN: 'WEAPON_MACHINEGUN',
  WEAPON_LASER: 'WEAPON_LASER'
};

export const ITEM_RADIUS = 15;

// Cấu hình vũ khí (Damage, Speed, Cooldown, v.v.)
export const WEAPON_STATS = {
  PISTOL:     { cooldown: 400, damage: 10, speed: 600, count: 1, spread: 0, color: 0xFFFF00 },
  ROCKET:     { cooldown: 800, damage: 60, speed: 400, count: 1, spread: 0, color: 0xFF4400 }, // Chậm, đau
  SHOTGUN:    { cooldown: 1000, damage: 15, speed: 500, count: 5, spread: 0.5, color: 0xFFAA00 }, // 5 viên
  MACHINEGUN: { cooldown: 100, damage: 8,  speed: 700, count: 1, spread: 0.1, color: 0xFFFFAA }, // Bắn siêu nhanh
  LASER:      { cooldown: 600, damage: 30, speed: 1200, count: 1, spread: 0, color: 0x00FFFF } // Siêu nhanh
};

export const ENTITY_TYPES = {
  PLAYER: 'player',
  PROJECTILE: 'projectile',
  FOOD: 'food'
};