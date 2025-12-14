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

export const WEAPON_TYPES = {
  // Súng mặc định (Súng lục)
  PISTOL: { damage: 15, range: 600, cooldown: 400, projectileSpeed: 600, count: 1, spread: 0 },
  
  // Shotgun: Bắn 5 viên, tản ra, tầm gần, delay lâu
  SHOTGUN: { damage: 10, range: 400, cooldown: 1000, projectileSpeed: 500, count: 5, spread: 0.5 },
  
  // Machine Gun: Bắn nhanh, dam bé, hơi tản mát nhẹ
  MACHINEGUN: { damage: 8, range: 700, cooldown: 100, projectileSpeed: 700, count: 1, spread: 0.1 }
};

export const ENTITY_TYPES = {
  PLAYER: 'player',
  PROJECTILE: 'projectile',
  FOOD: 'food'
};