
import {
  TICK_RATE, MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN,
  OBSTACLE_RADIUS_MAX, CHEST_COUNT, CHEST_RADIUS, ITEM_TYPES, CHEST_TYPES, BIG_CHEST_STATS
}
  from '../../../shared/src/constants.js';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Player } from '../entities/Player.js';
import { Physics } from './Physics.js';
import { Chest } from '../entities/Chest.js';
import { Item } from '../entities/Item.js';
import { User } from '../db/models/User.model.js';
import { Bot } from '../entities/Bot.js';

export class Game {
  constructor(server) {
    this.server = server;
    this.players = new Map();
    this.projectiles = [];
    this.explosions = [];
    this.physics = new Physics(this);
    this.tickInterval = null;
    this.lastTick = Date.now();
    this.minPlayers = 10; // Luôn giữ tối thiểu 5 người chơi (người + bot)
    this.lastBotSpawn = 0;

    this.nextBigChestTime = null;
    this.hasBigChest = false;

    // Quản lý thức ăn & Delta
    this.foods = [];
    this.removedFoodIds = [];
    this.newFoods = [];

    this.initFood();

    // Quản lý chướng ngại vật
    this.obstacles = [];
    this.initObstacles();

    // Quản lý Chest
    this.chests = [];
    this.removedChestIds = []; // Delta
    this.newChests = [];       // Delta
    this.initChests();

    // Quản lý Items (Rơi trên đất)
    this.items = [];
    this.removedItemIds = [];  // Delta
    this.newItems = [];        // Delta
  }

  start() {
    const tickDelay = 1000 / TICK_RATE;
    this.tickInterval = setInterval(() => this.tick(), tickDelay);
    console.log(`Game loop started at ${TICK_RATE} ticks/sec`);
  }

  initFood() {
    for (let i = 0; i < FOOD_COUNT; i++) {
      // Init ban đầu không cần tracking delta
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

  _spawnRandomChest(id, type = CHEST_TYPES.NORMAL) {
    const radius = type === CHEST_TYPES.BIG ? BIG_CHEST_STATS.radius : CHEST_RADIUS;
    const max = MAP_SIZE / 2 - radius;

    // Nếu là Big Chest, cho nó xuất hiện gần trung tâm hơn
    const limit = type === CHEST_TYPES.BIG ? MAP_SIZE / 4 : max;

    return new Chest(
      (Math.random() * limit * 2) - limit,
      (Math.random() * limit * 2) - limit,
      id,
      type
    );
  }

  // Hàm riêng để sinh Chest To và thông báo
  spawnBigChest() {
    if (this.hasBigChest) {
      console.log("Big Chest already exists");
      return;
    }
    const id = `BIG_${Date.now()}`;
    const chest = this._spawnRandomChest(id, CHEST_TYPES.BIG);
    this.chests.push(chest);
    this.newChests.push(chest);

    this.hasBigChest = true; // Đánh dấu đã có Big Chest
    this.nextBigChestTime = null; // Hủy timer


    // Gửi thông báo cho toàn server (Nếu bạn đã làm hệ thống chat/notification)
    // this.server.broadcast({ 
    //     type: 'chat', 
    //     id: 'SYSTEM', 
    //     message: BIG_CHEST_STATS.message 
    // });

    console.log("SPAWNED BIG CHEST AT", chest.x, chest.y);
  }

  _createFoodObject() {
    const max = MAP_SIZE / 2;
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: (Math.random() * MAP_SIZE) - max,
      y: (Math.random() * MAP_SIZE) - max,
      type: Math.floor(Math.random() * 3)
    };
  }

  generateAndTrackFood() {
    const food = this._createFoodObject();
    this.newFoods.push(food);
    return food;
  }

  // Hàm tạo item rơi ra w
  spawnItem(x, y, fromChestType = CHEST_TYPES.NORMAL) {
    let itemType;

    if (fromChestType === CHEST_TYPES.BIG) {
      // LOOT TABLE CỦA BIG CHEST
      const rand = Math.random();
      if (rand < 0.4) {
        itemType = ITEM_TYPES.WEAPON_SNIPER;
      } else if (rand < 0.8) {
        itemType = ITEM_TYPES.WEAPON_ROCKET;
      } else {
        itemType = ITEM_TYPES.COIN_LARGE;
      }
    } else {
      // LOOT TABLE CỦA NORMAL CHEST
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
    this.newItems.push(item);
  }

  // Giữ số lượng Bot tối thiểu
  manageBots() {
    // Đếm số người chơi THẬT
    let realPlayerCount = 0;
    let botCount = 0;

    this.players.forEach(p => {
      if (p.isBot) botCount++;
      else realPlayerCount++;
    });

    const totalCount = realPlayerCount + botCount;

    // Logic:
    // - Nếu có ít người thật (< 3) → giữ 5-7 bot
    // - Nếu có nhiều người (>= 3) → giữ 2-3 bot
    const targetBotCount = realPlayerCount < 3 ? 5 : 2;

    // Chỉ spawn 1 bot mỗi lần
    if (botCount < targetBotCount) {
      const botId = `bot_${Date.now()}_${Math.random()}`;
      const bot = new Bot(botId);
      this.players.set(botId, bot);

      this.server.broadcast({
        type: PacketType.PLAYER_JOIN,
        player: bot.serialize()
      });

      console.log(`Spawned Bot: ${bot.name} (Real: ${realPlayerCount}, Bots: ${botCount + 1})`);
    }
  }
  tick() {
    // 1. Reset Delta
    this.removedFoodIds = [];
    this.newFoods = [];
    this.removedChestIds = [];
    this.newChests = [];
    this.removedItemIds = [];
    this.newItems = [];

    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    if (dt > 0.05) dt = 0.05;

    // 2. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);

      // Kiểm tra range TRƯỚC khi shouldRemove
      if (proj.distanceTraveled >= proj.range) {
        if (proj.weaponType === 'ROCKET') {
          console.log(`Rocket reached max range, exploding!`);
          this.physics.createExplosion(proj);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.shouldRemove()) {
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Update Explosions (Tự xóa sau lifetime)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].shouldRemove()) {
        this.explosions.splice(i, 1);
      }
    }

    //4. Update Bots
    this.players.forEach(player => {
      if (!player.dead) {
        // NẾU LÀ BOT THÌ CHO NÓ SUY NGHĨ
        if (player instanceof Bot) {
          player.think(this);
        }

        player.update(dt);
      }
    });

    // 5. Physics (Check va chạm)
    this.physics.checkCollisions();

    // 6. Respawn Food
    if (this.foods.length < FOOD_COUNT) {
      this.foods.push(this.generateAndTrackFood());
    }

    // 7. Respawn Chests (Normal chest)
    const currentNormalChests = this.chests.filter(c => c.type === CHEST_TYPES.NORMAL).length;

    // Chỉ sinh THÊM 1 cái nếu thiếu (Không dùng while để tránh lặp vô tận)
    if (currentNormalChests < CHEST_COUNT) {
      const newChest = this._spawnRandomChest(
        Math.random().toString(36).substr(2, 9),
        CHEST_TYPES.NORMAL
      );
      this.chests.push(newChest);
      this.newChests.push(newChest);
    }

    // 8. Quản lý Bot
    if (now - this.lastBotSpawn > 5000) { // 5 giây
      this.manageBots();
      this.lastBotSpawn = now;
    }

    //9. Big Chest
    if (!this.hasBigChest && this.nextBigChestTime && now > this.nextBigChestTime) {
      this.spawnBigChest();
    }
    // Nếu chưa có lịch spawn và không có Big Chest → Tạo lịch đầu tiên
    if (!this.hasBigChest && !this.nextBigChestTime) {
      this.nextBigChestTime = now + BIG_CHEST_STATS.interval;
      console.log(`Next Big Chest in ${BIG_CHEST_STATS.interval / 1000}s`);
    }

    // Send Update
    this.sendStateUpdate();
  }

  addPlayer(clientId, name, userId = null) {
    const player = new Player(clientId, name, userId);
    this.players.set(clientId, player);

    // Gửi INIT: Full foods + Obstacles
    this.server.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      foods: this.foods,
      obstacles: this.obstacles,
      chests: this.chests, // Gửi full
      items: this.items    // Gửi full
    });

    this.server.broadcast({
      type: PacketType.PLAYER_JOIN,
      player: player.serialize()
    }, clientId);

    console.log(`Player joined: ${name} (DB_ID: ${userId})`);
  }

  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (player) {
      this.players.delete(clientId);
      // Broadcast để Client xóa Sprite
      this.server.broadcast({
        type: PacketType.PLAYER_LEAVE,
        id: clientId
      });
      console.log(`Player/Bots removed: ${player.name}`);
    }
  }

  handleInput(clientId, inputData) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      player.setInput(inputData);
    }
  }

  handleAttack(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      const newProjectiles = player.attack();
      if (newProjectiles) {
        this.projectiles.push(...newProjectiles);
      }
    }
  }

  respawnPlayer(clientId) {
    const player = this.players.get(clientId);
    if (player && player.dead) {
      player.dead = false;
      player.respawn();

      // THÊM: Broadcast để client biết player đã respawn
      this.server.broadcast({
        type: PacketType.PLAYER_RESPAWN, // Hoặc dùng PLAYER_JOIN
        player: player.serialize()
      });
    }
  }

  async savePlayerScore(player) {
      if (!player.userId) return; // Khách thì không lưu

      try {
        const user = await User.findById(player.userId);
        if (user) {
          // Cộng dồn coins (ví dụ: 1 điểm = 1 coin)
          user.coins += player.coins;

          // Cập nhật điểm cao nhất
          if (player.score > user.highScore) {
            user.highScore = player.score;
          }

          // Tăng số lần chết
          user.totalDeaths += 1;

          await user.save();
          console.log(`Saved: Score=${player.score}, Earned Coins=${player.coins}`);
        }
      } catch (err) {
        console.error('Error saving score:', err);
      }
    }

  async saveKillerStats(player) {
      if (!player.userId) return; // Nếu là khách (không đăng nhập) thì bỏ qua

      try {
        const user = await User.findById(player.userId);
        if (user) {
          user.totalKills = (user.totalKills || 0) + 1; // Cộng thêm 1 kill
          await user.save();
          console.log(`Updated totalKills for ${user.username}: ${user.totalKills}`);
        }
      } catch (err) {
        console.error('Error saving killer stats:', err);
      }
    }

    sendStateUpdate() {
      const bigChest = this.chests.find(c => c.type === CHEST_TYPES.BIG);

      const state = {
        type: PacketType.UPDATE,
        t: Date.now(),
        // QUAN TRỌNG: Gửi mảng players để HUD vẽ Leaderboard
        players: Array.from(this.players.values()).map(p => p.serialize()),
        projectiles: this.projectiles.map(p => p.serialize()),
        explosions: this.explosions.map(e => e.serialize()),
        foodsAdded: this.newFoods,
        foodsRemoved: this.removedFoodIds,
        // Thêm Delta Chests
        chestsAdded: this.newChests,
        chestsRemoved: this.removedChestIds,
        // Thêm Delta Items
        itemsAdded: this.newItems,
        itemsRemoved: this.removedItemIds,
        bigChest: bigChest ? { x: bigChest.x, y: bigChest.y } : null // 
      };

      this.server.broadcast(state);
    }

    getLeaderboard() {
      return Array.from(this.players.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(p => ({ name: p.name, score: p.score }));
    }
  }