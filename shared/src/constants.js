// Game Settings
export const MAP_SIZE = 5000;

// Game Timing
export const TICK_RATE = 60;
export const INTERPOLATION_DELAY = 100;

//Food
export const FOOD_COUNT = 300;
export const FOOD_RADIUS = 5;
export const XP_PER_FOOD = 10;

// CẬP NHẬT HỆ THỐNG DASH
export const DASH_DURATION = 150;
export const DASH_COOLDOWN = 3000;
export const DASH_BOOST = 150;

// CẬP NHẬT HỆ THỐNG THIÊN THẠCH
export const OBSTACLE_COUNT = 120;
export const OBSTACLE_RADIUS_MIN = 30;
export const OBSTACLE_RADIUS_MAX = 120;

// CẬP NHẬT CHỈ SỐ TÀU
export const SHIP_RADIUS = 20;      // Đổi từ PLAYER_RADIUS
export const SHIP_MAX_LIVES = 5;    // Đổi từ PLAYER_MAX_LIVES
export const SHIP_MAX_SPEED = 400;
export const SHIP_ACCELERATION = 600;
export const SHIP_DECELERATION = 300;
export const SHIP_ROTATION_SPEED = 3.5;
export const SHIP_BRAKE_FORCE = 800;

// --- CẬP NHẬT HỆ THỐNG RƯƠNG VÀ ITEM ---
export const CHEST_COUNT = 15;
export const CHEST_RADIUS = 25;
export const CHEST_HP = 3; // Normal Chest: 5 phát bắn là vỡ

// --- THÊM STATION STATS ---
export const STATION_COUNT = 10;
export const STATION_STATS = {
  // Thay radius bằng width/height
  width: 86,         // Chiều ngang (tương ứng với ảnh spaceStation_018)
  height: 24,         // Chiều dọc
  hp: 7,
  dropCount: 3
};

export const CHEST_TYPES = {
  NORMAL: 'NORMAL',
  STATION: 'STATION' // Chỉ còn 2 loại này
};

export const SKINS = [
  { id: 'default', name: 'Starter Red', price: 0 },
  { id: 'ship_1', name: 'Interceptor', price: 100 },
  { id: 'ship_2', name: 'Bomber', price: 250 },
  { id: 'ship_3', name: 'UFO Red', price: 500 },
  { id: 'ship_4', name: 'Scout', price: 1000 },
  { id: 'ship_5', name: 'Frigate', price: 1500 },
  { id: 'ship_6', name: 'Destroyer', price: 2000 },
  { id: 'ship_7', name: 'Speeder', price: 3000 },
  { id: 'ship_8', name: 'Tanker', price: 4000 },
  { id: 'ship_9', name: 'Mothership', price: 5000 }
];

export const NEBULA_COUNT = 15; // Thay vì BUSH_COUNT
export const NEBULA_RADIUS = 70; // Tinh vân thường to hơn bụi cây

export const ITEM_TYPES = {
  // Health & Defense
  HEALTH_PACK: 'HEALTH_PACK',

  //Special abilities
  SHIELD: 'SHIELD',
  SPEED_BOOST: 'SPEED_BOOST',
  BOMB: 'BOMB',
  INVISIBLE: 'INVISIBLE',

  // Weapons
  WEAPON_BLUE: 'WEAPON_BLUE',
  WEAPON_RED: 'WEAPON_RED',
  WEAPON_GREEN: 'WEAPON_GREEN',

  // Coins
  COIN_BRONZE: 'COIN_BRONZE',
  COIN_SILVER: 'COIN_SILVER',
  COIN_GOLD: 'COIN_GOLD',

};

export const ITEM_RADIUS = 15;

export const ITEM_CONFIG = {
  [ITEM_TYPES.HEALTH_PACK]: {
    name: 'Health Pack',
    description: '+1 Life',
    sprite: 'item_health_pack',
    effect: { type: 'heal', value: 1 },
    glowColor: 0x00FF00,      // Xanh lá
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.15
  },

  [ITEM_TYPES.SHIELD]: {
    name: 'Energy Shield',
    description: 'Invulnerability 5s',
    sprite: 'item_shield',
    effect: { type: 'shield', duration: 5000 },
    glowColor: 0xFFD700,      // Vàng
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.20
  },

  [ITEM_TYPES.SPEED_BOOST]: {
    name: 'Speed Boost',
    description: 'x2 Speed for 10s', // Cập nhật mô tả đúng với thông số
    sprite: 'item_boost',            // Hoặc 'item_speed' tùy file load của bạn
    effect: { type: 'speed', multiplier: 2.0, duration: 10000 }, // Sửa theo yêu cầu mạnh hơn, lâu hơn
    glowColor: 0x00FFFF,      // Xanh Cyan (cho khác biệt với Shield/Coin)
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.20
  },

  [ITEM_TYPES.WEAPON_BLUE]: {
    name: 'Plasma Blaster',
    description: 'Balanced weapon',
    sprite: 'item_weapon_blue',
    effect: { type: 'weapon', weaponType: 'BLUE' },
    glowColor: 0x0000FF,      // Xanh dương (Sửa lại cho đúng màu súng)
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.20
  },

  [ITEM_TYPES.WEAPON_RED]: {
    name: 'Heavy Cannon',
    description: 'High damage, slow fire',
    sprite: 'item_weapon_red',
    effect: { type: 'weapon', weaponType: 'RED' },
    glowColor: 0xFF0000,      // Đỏ
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.15
  },

  [ITEM_TYPES.WEAPON_GREEN]: {
    name: 'Rapid Laser',
    description: 'Fast fire, low damage',
    sprite: 'item_weapon_green',
    effect: { type: 'weapon', weaponType: 'GREEN' },
    glowColor: 0x00FF00,      // Xanh lá
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.15
  },

  [ITEM_TYPES.COIN_BRONZE]: {
    name: 'Bronze Coin',
    description: '+1 Coin',
    sprite: 'item_bronze_coin',
    effect: { type: 'coin', value: 1 },
    glowColor: 0xCD7F32,      // Màu Đồng
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.20
  },

  [ITEM_TYPES.COIN_SILVER]: {
    name: 'Silver Coin',
    description: '+3 Coins',
    sprite: 'item_silver_coin',
    effect: { type: 'coin', value: 3 },
    glowColor: 0xC0C0C0,      // Màu Bạc
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.15
  },

  [ITEM_TYPES.COIN_GOLD]: {
    name: 'Gold Coin',
    description: '+5 Coins',
    sprite: 'item_gold_coin',
    effect: { type: 'coin', value: 5 },
    glowColor: 0xFFD700,      // Màu Vàng
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.10
  },

  // --- MỚI (Đã chuẩn hóa) ---
  [ITEM_TYPES.INVISIBLE]: {
    name: 'Cloaking Device',
    description: 'Invisible for 5s',
    sprite: 'item_invisible', // Đã đổi tên để đồng bộ (Client nhớ load key này)
    effect: { type: 'invisible', duration: 5000 },
    glowColor: 0xFFFFFF,      // Trắng
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.20
  },

  [ITEM_TYPES.BOMB]: {
    name: 'Space Mine',
    description: 'Place a bomb',
    sprite: 'item_bomb',      // Đã đổi tên để đồng bộ (Client nhớ load key này)
    effect: { type: 'plant_bomb', damage: 3, radius: 100 },
    glowColor: 0xFF0000,      // Đỏ
    borderColor: 0xFFFFFF,    // Viền trắng
    dropChance: 0.20
  }
};

// CẬP NHẬT HỆ THỐNG VŨ KHÍ
export const WEAPON_STATS = {
  BLUE: {
    // Cân bằng: 3 viên, bắn vừa, hồi trung bình
    maxAmmo: 3,           // <--- MỚI
    regenTime: 1500,      // <--- MỚI (1.5s hồi 1 viên)
    cooldown: 300,        // Tốc độ nhả đạn (giữa các viên trong băng)
    damage: 1,            // 1 viên = 1 live
    speed: 600,
    range: 500,
    laserSprite: 'laserBlue01',
    color: 0x00E5FF,
    requireStill: false
  },

  RED: {
    // Sniper: 1 viên duy nhất, bắn xong phải đợi, damage cực to
    maxAmmo: 1,           // <--- MỚI
    regenTime: 3000,      // <--- MỚI (3s mới có lại đạn)
    cooldown: 1000,
    damage: 3,            // 1 viên = 3 live (One shot one kill nếu còn ít máu)
    speed: 400,           // Tốc độ bay chậm
    range: 800,           // Tầm xa (đã tăng lên để đúng chất sniper)
    laserSprite: 'laserRed01',
    color: 0xFF0000,
    requireStill: true    // (Optional) Đứng yên mới bắn được để cân bằng
  },

  GREEN: {
    // SMG: 6 viên, xả nhanh, damage bé
    maxAmmo: 6,           // <--- MỚI
    regenTime: 600,       // <--- MỚI (Hồi đạn nhanh)
    cooldown: 100,        // Tốc độ nhả đạn cực nhanh
    damage: 0.5,          // 2 viên = 1 live
    speed: 800,           // Đạn bay rất nhanh
    range: 400,           // Tầm ngắn
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