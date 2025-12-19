import { 
  MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN, OBSTACLE_RADIUS_MAX,
  CHEST_COUNT, CHEST_RADIUS, CHEST_TYPES, BIG_CHEST_STATS, ITEM_TYPES 
} from '../../../shared/src/constants.js';
import { Chest } from '../entities/Chest.js';
import { Item } from '../entities/Item.js';

export class WorldManager {
  constructor() {
    this.foods = [];
    this.obstacles = [];
    this.chests = [];
    this.items = [];

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
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const radius = Math.floor(Math.random() * (OBSTACLE_RADIUS_MAX - OBSTACLE_RADIUS_MIN + 1)) + OBSTACLE_RADIUS_MIN;
      const max = MAP_SIZE / 2 - radius;
      this.obstacles.push({
        id: `obs_${i}`,
        x: (Math.random() * MAP_SIZE) - max,
        y: (Math.random() * MAP_SIZE) - max,
        radius: radius
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
      if (rand < 0.4) itemType = ITEM_TYPES.WEAPON_SNIPER;
      else if (rand < 0.8) itemType = ITEM_TYPES.WEAPON_ROCKET;
      else itemType = ITEM_TYPES.COIN_LARGE;
    } else {
      const rand = Math.random();
      if (rand < 0.3) {
        itemType = Math.random() < 0.7 ? ITEM_TYPES.COIN_SMALL : ITEM_TYPES.COIN_MEDIUM;
      } else {
        const normalItems = [
          ITEM_TYPES.HEALTH_PACK, ITEM_TYPES.SHIELD, ITEM_TYPES.SPEED,
          ITEM_TYPES.WEAPON_PISTOL, ITEM_TYPES.WEAPON_SHOTGUN, ITEM_TYPES.WEAPON_MACHINEGUN
        ];
        itemType = normalItems[Math.floor(Math.random() * normalItems.length)];
      }
    }

    const item = new Item(x, y, itemType);
    this.items.push(item);
    this.delta.itemsAdded.push(item);
  }
}