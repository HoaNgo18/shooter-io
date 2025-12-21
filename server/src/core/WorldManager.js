import {
  MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN, OBSTACLE_RADIUS_MAX,
  CHEST_COUNT, CHEST_RADIUS, CHEST_TYPES, BIG_CHEST_STATS, ITEM_TYPES, NEBULA_COUNT, NEBULA_RADIUS
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

    // Big Chest Logic
    this.hasBigChest = false;
    this.nextBigChestTime = null;

    // Init
    this.initObstacles();
    this.initFood();
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
      tiny: ['meteorBrown_tiny1', 'meteorBrown_tiny2', 'meteorGrey_tiny1', 'meteorGrey_tiny2'],
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
      else if (rand < 0.9) randomSize = 'small';
      else randomSize = 'tiny';

      const sizeData = meteorSizes[randomSize];

      // === LOGIC MỚI: Nếu là thiên thạch NHỎ (tiny/small), spawn thành CỤM ===
      if (randomSize === 'tiny' || randomSize === 'small') {
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
    const radius = type === CHEST_TYPES.BIG ? BIG_CHEST_STATS.radius : CHEST_RADIUS;
    const max = MAP_SIZE / 2 - radius;
    const limit = type === CHEST_TYPES.BIG ? MAP_SIZE / 4 : max;

    return new Chest(
      (Math.random() * limit * 2) - limit,
      (Math.random() * limit * 2) - limit,
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

  spawnBigChest() {
    if (this.hasBigChest) return null;

    const id = `BIG_${Date.now()}`;
    const chest = this._spawnRandomChest(id, CHEST_TYPES.BIG);
    this.chests.push(chest);
    this.delta.chestsAdded.push(chest);
    this.hasBigChest = true;
    this.nextBigChestTime = null;
    return chest; // Return để Game log ra console
  }

  checkBigChestSpawn(now) {
    // Nếu chưa có big chest và chưa lên lịch -> lên lịch
    if (!this.hasBigChest && !this.nextBigChestTime) {
      this.nextBigChestTime = now + BIG_CHEST_STATS.interval;
      return { scheduled: true, time: BIG_CHEST_STATS.interval };
    }
    // Nếu đến giờ -> spawn
    if (!this.hasBigChest && this.nextBigChestTime && now > this.nextBigChestTime) {
      return { spawned: this.spawnBigChest() };
    }
    return {};
  }

  spawnItem(x, y, fromChestType = CHEST_TYPES.NORMAL) {
    let itemType;
    if (fromChestType === CHEST_TYPES.BIG) {
      const rand = Math.random();
      if (rand < 0.5) itemType = ITEM_TYPES.WEAPON_RED;        // Thay đổi
      else if (rand < 0.8) itemType = ITEM_TYPES.WEAPON_GREEN;    // 20% ra xanh
      else itemType = ITEM_TYPES.COIN_LARGE;
    } else {
      const rand = Math.random();
      if (rand < 0.3) {
        itemType = Math.random() < 0.7 ? ITEM_TYPES.COIN_SMALL : ITEM_TYPES.COIN_MEDIUM;
      } else {
        const normalItems = [
          ITEM_TYPES.HEALTH_PACK, ITEM_TYPES.SHIELD, ITEM_TYPES.SPEED,
          ITEM_TYPES.WEAPON_BLUE,   // Thay đổi
          ITEM_TYPES.WEAPON_GREEN
        ];
        itemType = normalItems[Math.floor(Math.random() * normalItems.length)];
      }
    }

    const item = new Item(x, y, itemType);
    this.items.push(item);
    this.delta.itemsAdded.push(item);
  }
}