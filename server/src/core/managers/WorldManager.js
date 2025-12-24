import {
  MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN, OBSTACLE_RADIUS_MAX,
  CHEST_COUNT, CHEST_RADIUS, CHEST_TYPES, ITEM_TYPES, ITEM_CONFIG,
  NEBULA_COUNT, NEBULA_RADIUS,
  STATION_COUNT, STATION_STATS
} from '../../../../shared/src/constants.js';
import { Chest } from '../../entities/Chest.js';
import { Item } from '../../entities/Item.js';

export class WorldManager {
  constructor() {
    this.foods = [];
    this.obstacles = [];
    this.chests = [];
    this.items = [];
    this.nebulas = [];

    // Delta tracking (Change Logs)
    this.delta = {
      foodsAdded: [],
      foodsRemoved: [],
      chestsAdded: [],
      chestsRemoved: [],
      itemsAdded: [],
      itemsRemoved: []
    };

    // Init
    this.initObstacles();
    this.initFood();
    this.initStations();
    this.initChests();
    this.initNebulas();
  }

  resetDelta() {
    this.delta.foodsAdded = [];
    this.delta.foodsRemoved = [];
    this.delta.chestsAdded = [];
    this.delta.chestsRemoved = [];
    this.delta.itemsAdded = [];
    this.delta.itemsRemoved = [];
  }

  // --- INITIALIZATION (GIỮ NGUYÊN) ---
  initFood() {
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.foods.push(this._createFoodObject());
    }
  }

  initObstacles() {
    // Logic thiên thạch giữ nguyên như file cũ của bạn
    const meteorSizes = {
      tiny: { width: 50, height: 50, radius: 25 },
      small: { width: 80, height: 90, radius: 40 },
      med: { width: 90, height: 120, radius: 60 },
      big: { width: 120, height: 150, radius: 90 }
    };
    const meteorSprites = {
      small: ['meteorBrown_small1', 'meteorBrown_small2', 'meteorGrey_small1', 'meteorGrey_small2'],
      med: ['meteorBrown_med1', 'meteorBrown_med3', 'meteorGrey_med1', 'meteorGrey_med2'],
      big: ['meteorBrown_big1', 'meteorBrown_big2', 'meteorBrown_big3', 'meteorBrown_big4',
        'meteorGrey_big1', 'meteorGrey_big2', 'meteorGrey_big3', 'meteorGrey_big4',
        'spaceMeteors_001', 'spaceMeteors_002', 'spaceMeteors_003', 'spaceMeteors_004']
    };

    let i = 0;
    while (i < OBSTACLE_COUNT) {
      const rand = Math.random();
      let randomSize;
      if (rand < 0.3) randomSize = 'big';
      else if (rand < 0.7) randomSize = 'med';
      else randomSize = 'small';

      const sizeData = meteorSizes[randomSize];

      if (randomSize === 'small') {
        const clusterSize = Math.floor(Math.random() * 3) + 2;
        const clusterX = (Math.random() * MAP_SIZE * 0.8) - MAP_SIZE * 0.4;
        const clusterY = (Math.random() * MAP_SIZE * 0.8) - MAP_SIZE * 0.4;

        for (let j = 0; j < clusterSize && i < OBSTACLE_COUNT; j++, i++) {
          const offsetDist = 100 + Math.random() * 50;
          const offsetAngle = Math.random() * Math.PI * 2;
          const x = clusterX + Math.cos(offsetAngle) * offsetDist;
          const y = clusterY + Math.sin(offsetAngle) * offsetDist;
          const spriteKey = meteorSprites[randomSize][Math.floor(Math.random() * meteorSprites[randomSize].length)];

          this.obstacles.push({
            id: `obs_${i}`,
            x: x, y: y, radius: sizeData.radius, width: sizeData.width, height: sizeData.height,
            size: randomSize, sprite: spriteKey
          });
        }
      } else {
        const max = MAP_SIZE / 2 - Math.max(sizeData.width, sizeData.height) / 2;
        const spriteKey = meteorSprites[randomSize][Math.floor(Math.random() * meteorSprites[randomSize].length)];
        this.obstacles.push({
          id: `obs_${i}`,
          x: (Math.random() * MAP_SIZE) - max,
          y: (Math.random() * MAP_SIZE) - max,
          radius: sizeData.radius, width: sizeData.width, height: sizeData.height,
          size: randomSize, sprite: spriteKey
        });
        i++;
      }
    }
  }

  initNebulas() {
    for (let i = 0; i < NEBULA_COUNT; i++) {
      const max = MAP_SIZE / 2 - NEBULA_RADIUS;
      this.nebulas.push({
        id: `nebula_${i}`,
        x: (Math.random() * MAP_SIZE) - max,
        y: (Math.random() * MAP_SIZE) - max,
        radius: NEBULA_RADIUS
      });
    }
  }

  initStations() {
    for (let i = 0; i < STATION_COUNT; i++) {
      const id = `station_${i}`;
      const limit = MAP_SIZE / 2 - 100;
      const x = (Math.random() * limit * 2) - limit;
      const y = (Math.random() * limit * 2) - limit;
      const station = new Chest(x, y, id, CHEST_TYPES.STATION);
      this.chests.push(station);
    }
  }

  initChests() {
    for (let i = 0; i < CHEST_COUNT; i++) {
      this.chests.push(this._spawnRandomChest(`chest_${i}`));
    }
  }

  // --- SPAWNING LOGIC ---
  _createFoodObject() {
    const max = MAP_SIZE / 2;
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: (Math.random() * MAP_SIZE) - max,
      y: (Math.random() * MAP_SIZE) - max,
      type: Math.floor(Math.random() * 3)
    };
  }

  spawnFood() {
    if (this.foods.length < FOOD_COUNT) {
      const food = this._createFoodObject();
      this.foods.push(food);
      this.delta.foodsAdded.push(food);
    }
  }

  removeFood(id) {
    const idx = this.foods.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.foods.splice(idx, 1);
      this.delta.foodsRemoved.push(id);
    }
  }

  _spawnRandomChest(id, type = CHEST_TYPES.NORMAL) {
    const radius = 25;
    const max = MAP_SIZE / 2 - radius;
    return new Chest(
      (Math.random() * max * 2) - max,
      (Math.random() * max * 2) - max,
      id,
      type
    );
  }

  spawnNormalChestIfNeeded() {
    const currentNormalChests = this.chests.filter(c => c.type === CHEST_TYPES.NORMAL).length;
    if (currentNormalChests < CHEST_COUNT) {
      const newChest = this._spawnRandomChest(Math.random().toString(36).substr(2, 9), CHEST_TYPES.NORMAL);
      this.chests.push(newChest);
      this.delta.chestsAdded.push(newChest);
    }
  }

  spawnStationIfNeeded() {
    const currentStations = this.chests.filter(c => c.type === CHEST_TYPES.STATION).length;
    if (currentStations < STATION_COUNT) {
      const id = `station_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const limit = MAP_SIZE / 2 - 200;
      const x = (Math.random() * limit * 2) - limit;
      const y = (Math.random() * limit * 2) - limit;
      const newStation = new Chest(x, y, id, CHEST_TYPES.STATION);
      this.chests.push(newStation);
      this.delta.chestsAdded.push(newStation);
    }
  }

  // ==========================================================
  // LOGIC RƠI ĐỒ ĐÃ SỬA ĐỔI
  // ==========================================================
  
  /**
   * Hàm spawn đồ dùng chung.
   * @param {number} x - Tọa độ X
   * @param {number} y - Tọa độ Y
   * @param {string} sourceType - Nguồn rơi: 'STATION' | 'ENEMY' | 'CHEST'
   */
  spawnItem(x, y, sourceType = 'CHEST') {
    let itemsToSpawn = [];
    let spawnRadius = 20;

    // --- LOGIC XÁC ĐỊNH SỐ LƯỢNG VÀ LOẠI ITEM ---
    
    if (sourceType === CHEST_TYPES.STATION || sourceType === 'STATION') {
      // LOGIC STATION: Rơi 2 món
      // Món 1: Chắc chắn là Coin (Bronze/Silver/Gold)
      // Món 2: Random bất kỳ món nào (Weapon, Powerup, Shield, Bomb...)
      itemsToSpawn.push(this.rollCoinOnly());
      itemsToSpawn.push(this.rollAnyItem());
      
      spawnRadius = 60; // Station to nên văng xa hơn
      console.log("Station destroyed! Dropping 1 Coin + 1 Random Item");

    } else if (sourceType === 'ENEMY') {
      // LOGIC ENEMY: Rơi 1 món random
      // Tỷ lệ: Tất cả mọi đồ đều có thể xuất hiện
      itemsToSpawn.push(this.rollAnyItem());
      
      spawnRadius = 30;
      // console.log("Enemy destroyed! Dropping 1 Random Item");

    } else {
      // LOGIC CHEST THƯỜNG (Mặc định)
      // Giữ nguyên logic cũ hoặc random tùy bạn, ở đây để common cho cân bằng game đầu
      itemsToSpawn.push(this.rollCommonDrop());
      spawnRadius = 0;
    }

    // --- LOGIC SINH ITEM VÀ TÍNH TOÁN VỊ TRÍ ---

    const startAngle = Math.random() * Math.PI * 2;
    const angleStep = (Math.PI * 2) / (itemsToSpawn.length || 1);

    itemsToSpawn.forEach((itemType, index) => {
      let itemX = x;
      let itemY = y;

      // Nếu có nhiều hơn 1 món hoặc là Station/Enemy thì nên văng ra một chút cho đẹp
      if (itemsToSpawn.length > 1 || sourceType === 'ENEMY') {
        const angle = startAngle + (index * angleStep);
        const currentRadius = spawnRadius * (0.8 + Math.random() * 0.4); // Random độ xa gần
        itemX = x + Math.cos(angle) * currentRadius;
        itemY = y + Math.sin(angle) * currentRadius;
      }

      // Tạo ID duy nhất tại Server
      const uniqueId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const item = new Item(itemX, itemY, itemType);
      item.id = uniqueId;

      this.items.push(item);
      this.delta.itemsAdded.push(item);
    });
  }

  // --- DROP TABLES ---

  // 1. Chỉ random ra tiền (cho slot 1 của Station)
  rollCoinOnly() {
    const pool = [
      ITEM_TYPES.COIN_BRONZE, // Tỷ lệ cao
      ITEM_TYPES.COIN_SILVER, // Tỷ lệ vừa
      ITEM_TYPES.COIN_GOLD    // Tỷ lệ thấp
    ];
    // Ghi đè tỷ lệ riêng cho việc roll Coin này nếu muốn, 
    // hoặc dùng weightedRandom mặc định (dựa theo config global)
    return this.weightedRandom(pool);
  }

  // 2. Random TẤT CẢ mọi thứ (cho slot 2 của Station & Enemy)
  rollAnyItem() {
    // Lấy tất cả các key trong ITEM_TYPES
    const allItems = Object.values(ITEM_TYPES);
    return this.weightedRandom(allItems);
  }

  // 3. Logic cũ cho rương thường (Giữ lại để game cân bằng lúc đi nhặt rương lẻ)
  rollCommonDrop() {
    const pool = [
      ITEM_TYPES.COIN_BRONZE,
      ITEM_TYPES.COIN_SILVER,
      ITEM_TYPES.HEALTH_PACK,
      ITEM_TYPES.SPEED_BOOST,
      ITEM_TYPES.WEAPON_BLUE,
      ITEM_TYPES.BOMB
    ];
    return this.weightedRandom(pool);
  }

  weightedRandom(itemTypes) {
    // Tính tổng trọng số
    // (Giả sử ITEM_CONFIG có chứa dropChance cho mọi item)
    const weights = itemTypes.map(type => {
      // Fallback nếu item chưa config dropChance thì cho mặc định là 10
      return ITEM_CONFIG[type]?.dropChance || 10; 
    });
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < itemTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return itemTypes[i];
      }
    }
    return itemTypes[0];
  }

  update(dt) {
    // Check for expired items
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].shouldDespawn()) {
        this.delta.itemsRemoved.push(this.items[i].id);
        this.items.splice(i, 1);
      }
    }
  }
}