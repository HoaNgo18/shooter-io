import { TICK_RATE, CHEST_TYPES } from '../../../shared/src/constants.js';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Player } from '../entities/Player.js';
import { Physics } from './Physics.js';

// Import các Module mới
import { WorldManager } from './WorldManager.js';
import { BotManager } from './BotManager.js';
import { StatsService } from './StatsService.js';

export class Game {
  constructor(server) {
    this.server = server;
    this.players = new Map();
    this.projectiles = [];
    this.explosions = [];
    
    // Khởi tạo Managers
    this.world = new WorldManager();
    this.bots = new BotManager(this);
    
    // Physics nhận vào 'this' (game instance), nên trong Physics.js
    // bạn cần đổi 'this.game.foods' thành 'this.game.world.foods'
    this.physics = new Physics(this);

    this.tickInterval = null;
    this.lastTick = Date.now();
  }

  start() {
    const tickDelay = 1000 / TICK_RATE;
    this.tickInterval = setInterval(() => this.tick(), tickDelay);
    console.log(`Game loop started at ${TICK_RATE} ticks/sec`);
  }

  tick() {
    // 1. Reset Delta Tracking từ World
    this.world.resetDelta();

    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt > 0.05) dt = 0.05;

    // 2. Update Projectiles
    this.updateProjectiles(dt);

    // 3. Update Explosions
    this.updateExplosion();

    // 4. Update Players (Input + Move)
    this.players.forEach(player => {
      if (!player.dead) player.update(dt);
    });
    
    // 5. Update Bots (AI logic + Spawning)
    this.bots.update(dt);

    // 6. Physics Collision
    this.physics.checkCollisions();

    // 7. World Management (Spawn Food, Chests, Big Chest)
    this.world.spawnFood();
    this.world.spawnNormalChestIfNeeded();
    
    const chestStatus = this.world.checkBigChestSpawn(now);
    if (chestStatus.scheduled) {
        console.log(`Next Big Chest in ${chestStatus.time / 1000}s`);
    } else if (chestStatus.spawned) {
        console.log("SPAWNED BIG CHEST AT", chestStatus.spawned.x, chestStatus.spawned.y);
    }

    // 8. Broadcast State
    this.sendStateUpdate();
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);

      if (proj.distanceTraveled >= proj.range) {
        if (proj.weaponType === 'ROCKET') {
          this.physics.createExplosion(proj);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.shouldRemove()) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateExplosion() {
     for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].shouldRemove()) {
        this.explosions.splice(i, 1);
      }
    }
  }

  // --- PLAYER MANAGEMENT ---
  addPlayer(clientId, name, userId = null, skinId = 'default') {
    const player = new Player(clientId, name, userId, skinId);
    this.players.set(clientId, player);

    // Gửi INIT
    this.server.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      // Lấy dữ liệu từ World Manager
      foods: this.world.foods,
      obstacles: this.world.obstacles,
      nebulas: this.world.nebulas,
      chests: this.world.chests,
      items: this.world.items
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
      this.server.broadcast({ type: PacketType.PLAYER_LEAVE, id: clientId });
      console.log(`Player/Bots removed: ${player.name}`);
    }
  }

  respawnPlayer(clientId, skinId) {
    const player = this.players.get(clientId);
    if (player) {
      player.respawn(skinId);
      // Send INIT to reload world data
      this.server.sendToClient(clientId, {
        type: PacketType.INIT,
        id: clientId,
        player: player.serialize(),
        players: Array.from(this.players.values()).map(p => p.serialize()),
        foods: this.world.foods,
        obstacles: this.world.obstacles,
        nebulas: this.world.nebulas,
        chests: this.world.chests,
        items: this.world.items
      });
    }
  }

  // --- EVENTS ---
  handleInput(clientId, inputData) {
    const player = this.players.get(clientId);
    if (player && !player.dead) player.setInput(inputData);
  }

  handleAttack(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      const newProjectiles = player.attack();
      if (newProjectiles) this.projectiles.push(...newProjectiles);
    }
  }

  respawnPlayer(clientId, skinId) {
    const player = this.players.get(clientId);
    if (player && player.dead) {
      if (skinId) player.skinId = skinId;
      player.dead = false;
      player.respawn();
      this.server.broadcast({
        type: PacketType.RESPAWN, // Lưu ý: Check lại PacketType trong file shared
        player: player.serialize()
      });
    }
  }

  // --- STATS DELEGATION ---
  async savePlayerScore(player) {
    await StatsService.savePlayerScore(this.server, player);
  }

  async saveKillerStats(player) {
    await StatsService.saveKillerStats(this.server, player);
  }

  // --- NETWORK ---
  sendStateUpdate() {
    const bigChest = this.world.chests.find(c => c.type === CHEST_TYPES.BIG);

    const state = {
      type: PacketType.UPDATE,
      t: Date.now(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      projectiles: this.projectiles.map(p => p.serialize()),
      explosions: this.explosions.map(e => e.serialize()),
      
      // Lấy Delta từ World Manager
      foodsAdded: this.world.delta.foodsAdded,
      foodsRemoved: this.world.delta.foodsRemoved,
      chestsAdded: this.world.delta.chestsAdded,
      chestsRemoved: this.world.delta.chestsRemoved,
      itemsAdded: this.world.delta.itemsAdded,
      itemsRemoved: this.world.delta.itemsRemoved,
      
      bigChest: bigChest ? { x: bigChest.x, y: bigChest.y } : null
    };

    this.server.broadcast(state);
  }
}