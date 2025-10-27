import {
  MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN, OBSTACLE_RADIUS_MAX,
  CHEST_COUNT, CHEST_RADIUS, CHEST_TYPES, ITEM_TYPES, ITEM_CONFIG,
  NEBULA_COUNT, NEBULA_RADIUS,
  STATION_COUNT, STATION_STATS
} from '../../../../shared/src/constants.js';
import { Chest } from '../../entities/Chest.js';
import { Item } from '../../entities/Item.js';
import { SpawnValidator } from '../../utils/SpawnValidator.js';

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

    // Spawn validator - khởi tạo sau khi các arrays đã được tạo
    this.spawnValidator = new SpawnValidator(this);

    // Init - thứ tự quan trọng: obstacles trước (được phép overlap)
    this.initObstacles();
    this.initStations();  // Stations trước vì to nhất
    this.initChests();    // Chests sau stations
    this.initNebulas();
    this.initFood();      // Food cuối vì nhiều và nhỏ
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
      const pos = this.spawnValidator.findStationPosition();
      const station = new Chest(pos.x, pos.y, id, CHEST_TYPES.STATION);
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
    const pos = this.spawnValidator.findFoodPosition();
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: pos.x,
      y: pos.y,
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
    const pos = this.spawnValidator.findChestPosition();
    return new Chest(pos.x, pos.y, id, type);
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
      const pos = this.spawnValidator.findStationPosition();
      const newStation = new Chest(pos.x, pos.y, id, CHEST_TYPES.STATION);
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
      // STATION: Rơi 1-2 đồ (coin rate thấp, items/weapons cao)
      const dropCount = Math.random() < 0.5 ? 1 : 2;
      for (let i = 0; i < dropCount; i++) {
        itemsToSpawn.push(this.rollStationDrop());
      }
      spawnRadius = 50;

    } else if (sourceType === 'ENEMY') {
      // ENEMY (kể cả bot): Rơi 2-3 đồ
      const dropCount = Math.random() < 0.5 ? 2 : 3;
      for (let i = 0; i < dropCount; i++) {
        itemsToSpawn.push(this.rollAnyItem());
      }
      spawnRadius = 40;

    } else {
      // CHEST THƯỜNG: Rơi 1 đồ, tỷ lệ coin CAO hơn
      itemsToSpawn.push(this.rollChestDrop());
      spawnRadius = 0;
    }

    // --- LOGIC SINH ITEM VÀ TÍNH TOÁN VỊ TRÍ ---

    const startAngle = Math.random() * Math.PI * 2;
    const angleStep = (Math.PI * 2) / (itemsToSpawn.length || 1);

    itemsToSpawn.forEach((itemType, index) => {
      let itemX = x;
      let itemY = y;

      // Nếu có nhiều hơn 1 món thì văng ra xung quanh
      if (itemsToSpawn.length > 1) {
        const angle = startAngle + (index * angleStep);
        const currentRadius = spawnRadius * (0.8 + Math.random() * 0.4);
        itemX = x + Math.cos(angle) * currentRadius;
        itemY = y + Math.sin(angle) * currentRadius;
      }

      const uniqueId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const item = new Item(itemX, itemY, itemType);
      item.id = uniqueId;

      this.items.push(item);
      this.delta.itemsAdded.push(item);
    });
  }

  // --- DROP TABLES ---

  // 1. Chỉ random ra tiền
  rollCoinOnly() {
    const pool = [
      ITEM_TYPES.COIN_BRONZE,
      ITEM_TYPES.COIN_SILVER,
      ITEM_TYPES.COIN_GOLD
    ];
    return this.weightedRandom(pool);
  }

  // 2. Random TẤT CẢ mọi thứ (cho Enemy drops)
  rollAnyItem() {
    const allItems = Object.values(ITEM_TYPES);
    return this.weightedRandom(allItems);
  }

  // 3. Station drop - CHỈ items và weapons, KHÔNG coin
  rollStationDrop() {
    const itemsAndWeapons = [
      ITEM_TYPES.HEALTH_PACK,
      ITEM_TYPES.SPEED_BOOST,
      ITEM_TYPES.WEAPON_BLUE,
      ITEM_TYPES.WEAPON_GREEN,
      ITEM_TYPES.WEAPON_RED,
      ITEM_TYPES.BOMB,
      ITEM_TYPES.SHIELD,
      ITEM_TYPES.INVISIBLE
    ];
    return itemsAndWeapons[Math.floor(Math.random() * itemsAndWeapons.length)];
  }

  // 4. Chest drop - tỷ lệ coin CAO hơn (60% coin, 40% items khác)
  rollChestDrop() {
    // 60% chance là coin
    if (Math.random() < 0.6) {
      return this.rollCoinOnly();
    }
    // 40% chance là item khác (không phải coin)
    const nonCoinItems = [
      ITEM_TYPES.HEALTH_PACK,
      ITEM_TYPES.SPEED_BOOST,
      ITEM_TYPES.WEAPON_BLUE,
      ITEM_TYPES.BOMB,
      ITEM_TYPES.SHIELD
    ];
    return nonCoinItems[Math.floor(Math.random() * nonCoinItems.length)];
  }

  // 5. Legacy common drop (deprecated, giữ lại cho compatibility)
  rollCommonDrop() {
    return this.rollChestDrop();
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