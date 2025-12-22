import {
  MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN, OBSTACLE_RADIUS_MAX,
  CHEST_COUNT, CHEST_RADIUS, CHEST_TYPES, ITEM_TYPES, ITEM_CONFIG,
  NEBULA_COUNT, NEBULA_RADIUS,
  STATION_COUNT, STATION_STATS
} from '../../../shared/src/constants.js';
import { Chest } from '../entities/Chest.js';
import { Item } from '../entities/Item.js';

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

  // --- INITIALIZATION ---
  initFood() {
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.foods.push(this._createFoodObject());
    }
  }

  initObstacles() {
    // Tăng kích thước ĐÁNG KỂ cho tất cả thiên thạch
    const meteorSizes = {
      tiny: { width: 50, height: 50, radius: 25 },    // Tăng 2.5x
      small: { width: 80, height: 90, radius: 40 },   // Tăng ~2.7x
      med: { width: 90, height: 120, radius: 60 },   // Tăng ~2.6x
      big: { width: 120, height: 150, radius: 90 }    // Tăng 3x
    };

    // Danh sách sprite theo kích thước
    const meteorSprites = {
      small: ['meteorBrown_small1', 'meteorBrown_small2', 'meteorGrey_small1', 'meteorGrey_small2'],
      med: ['meteorBrown_med1', 'meteorBrown_med3', 'meteorGrey_med1', 'meteorGrey_med2'],
      big: ['meteorBrown_big1', 'meteorBrown_big2', 'meteorBrown_big3', 'meteorBrown_big4',
        'meteorGrey_big1', 'meteorGrey_big2', 'meteorGrey_big3', 'meteorGrey_big4',
        'spaceMeteors_001', 'spaceMeteors_002', 'spaceMeteors_003', 'spaceMeteors_004']
    };

    const spawnedObstacles = [];
    let i = 0;

    while (i < OBSTACLE_COUNT) {
      // Random size category với tỷ lệ: 20% big, 30% med, 30% small, 20% tiny
      const rand = Math.random();
      let randomSize;
      if (rand < 0.3) randomSize = 'big';
      else if (rand < 0.7) randomSize = 'med';
      else randomSize = 'small';

      const sizeData = meteorSizes[randomSize];

      // === LOGIC MỚI: Nếu là thiên thạch NHỎ (tiny/small), spawn thành CỤM ===
      if (randomSize === 'small') {
        const clusterSize = Math.floor(Math.random() * 3) + 2; // 2-4 thiên thạch/cụm
        const clusterX = (Math.random() * MAP_SIZE * 0.8) - MAP_SIZE * 0.4; // Tránh spawn sát biên
        const clusterY = (Math.random() * MAP_SIZE * 0.8) - MAP_SIZE * 0.4;

        // Spawn cluster
        for (let j = 0; j < clusterSize && i < OBSTACLE_COUNT; j++, i++) {
          // Offset ngẫu nhiên trong bán kính 100-150 pixel
          const offsetDist = 100 + Math.random() * 50;
          const offsetAngle = Math.random() * Math.PI * 2;

          const x = clusterX + Math.cos(offsetAngle) * offsetDist;
          const y = clusterY + Math.sin(offsetAngle) * offsetDist;

          // Chọn sprite ngẫu nhiên từ danh sách phù hợp với size
          const spriteKey = meteorSprites[randomSize][Math.floor(Math.random() * meteorSprites[randomSize].length)];

          this.obstacles.push({
            id: `obs_${i}`,
            x: x,
            y: y,
            radius: sizeData.radius,
            width: sizeData.width,
            height: sizeData.height,
            size: randomSize,
            sprite: spriteKey  // THÊM SPRITE KEY
          });
        }
      } else {
        // Thiên thạch TO (med/big) spawn đơn lẻ như cũ
        const max = MAP_SIZE / 2 - Math.max(sizeData.width, sizeData.height) / 2;

        // Chọn sprite ngẫu nhiên từ danh sách phù hợp với size
        const spriteKey = meteorSprites[randomSize][Math.floor(Math.random() * meteorSprites[randomSize].length)];

        this.obstacles.push({
          id: `obs_${i}`,
          x: (Math.random() * MAP_SIZE) - max,
          y: (Math.random() * MAP_SIZE) - max,
          radius: sizeData.radius,
          width: sizeData.width,
          height: sizeData.height,
          size: randomSize,
          sprite: spriteKey  // THÊM SPRITE KEY
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
      // Station cũng là Chest, nhưng type khác
      const id = `station_${i}`;

      // Spawn random vị trí (hoặc bạn có thể fix vị trí nếu muốn map đẹp hơn)
      // Lưu ý: Station to nên tránh spawn quá sát mép map
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
    // Chỉ xử lý Chest thường ở đây (vì Station spawn cố định lúc đầu)
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
    // Đếm số lượng station hiện tại
    const currentStations = this.chests.filter(c => c.type === CHEST_TYPES.STATION).length;

    // Nếu thiếu thì spawn thêm
    if (currentStations < STATION_COUNT) {
      // Tạo ID random
      const id = `station_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // Spawn vị trí random (tránh mép map)
      const limit = MAP_SIZE / 2 - 200;
      const x = (Math.random() * limit * 2) - limit;
      const y = (Math.random() * limit * 2) - limit;

      const newStation = new Chest(x, y, id, CHEST_TYPES.STATION);

      this.chests.push(newStation);

      // QUAN TRỌNG: Báo cho Client biết có Station mới
      this.delta.chestsAdded.push(newStation);

      console.log("Respawned Station:", id);
    }
  }

  spawnItem(x, y, fromChestType = CHEST_TYPES.NORMAL) {
    if (fromChestType === CHEST_TYPES.STATION) {
      // Station drops: 3 items với 3 màu khác nhau (xanh, vàng, đỏ)
      const greenItem = this.rollGreenItem();   // Xanh
      const yellowItem = this.rollYellowItem(); // Vàng
      const redItem = this.rollRedItem();       // Đỏ

      // Spawn 3 items xung quanh vị trí Station (hình tam giác)
      const angleOffset = (Math.PI * 2) / 3; // 120 degrees
      const spawnRadius = 50; // Khoảng cách từ tâm Station

      const items = [greenItem, yellowItem, redItem];

      items.forEach((itemType, index) => {
        const angle = angleOffset * index + Math.random() * 0.3; // Random nhẹ
        const itemX = x + Math.cos(angle) * spawnRadius;
        const itemY = y + Math.sin(angle) * spawnRadius;

        const item = new Item(itemX, itemY, itemType);
        this.items.push(item);
        this.delta.itemsAdded.push(item);
      });

      console.log(`Station destroyed! Dropped: ${greenItem}, ${yellowItem}, ${redItem}`);
    } else {
      // Normal Chest drops: 1 item thường
      const itemType = this.rollCommonDrop();
      const item = new Item(x, y, itemType);
      this.items.push(item);
      this.delta.itemsAdded.push(item);
    }
  }


  rollCommonDrop() {
    const pool = [
      ITEM_TYPES.COIN_BRONZE,      // Vàng - 40%
      ITEM_TYPES.COIN_SILVER,      // Vàng - 25%
      ITEM_TYPES.HEALTH_PACK,      // Xanh - 25%
      ITEM_TYPES.SPEED_BOOST,      // Vàng - 30%
      ITEM_TYPES.WEAPON_BLUE       // Đỏ - 25%
    ];

    return this.weightedRandom(pool);
  }

  rollGreenItem() {
    return ITEM_TYPES.HEALTH_PACK;
  }

  rollYellowItem() {
    const pool = [
      ITEM_TYPES.SHIELD,           // 15%
      ITEM_TYPES.SPEED_BOOST,      // 30%
      ITEM_TYPES.COIN_BRONZE,      // 40%
      ITEM_TYPES.COIN_SILVER,      // 25%
      ITEM_TYPES.COIN_GOLD         // 10%
    ];

    return this.weightedRandom(pool);
  }

  rollRedItem() {
    const pool = [
      ITEM_TYPES.WEAPON_BLUE,      // 25%
      ITEM_TYPES.WEAPON_RED,       // 15%
      ITEM_TYPES.WEAPON_GREEN      // 20%
    ];

    return this.weightedRandom(pool);
  }


  weightedRandom(itemTypes) {
    // Calculate total weight
    const weights = itemTypes.map(type => ITEM_CONFIG[type].dropChance);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Random selection
    let random = Math.random() * totalWeight;

    for (let i = 0; i < itemTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return itemTypes[i];
      }
    }

    return itemTypes[0]; // Fallback
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