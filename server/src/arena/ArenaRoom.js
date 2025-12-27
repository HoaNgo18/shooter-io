// server/src/arena/ArenaRoom.js
import { TICK_RATE, MAP_SIZE } from '../../../shared/src/constants.js';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Player } from '../entities/Player.js';
import { Bot } from '../entities/Bot.js';
import { Physics } from '../core/Physics.js';
import { WorldManager } from '../core/managers/WorldManager.js';
import { Explosion } from '../entities/Explosion.js';
import { StatsService } from '../core/managers/StatsService.js';

export class ArenaRoom {
  constructor(id, manager) {
    this.id = id;
    this.manager = manager;
    this.server = manager.server;

    // Room settings
    this.maxPlayers = 10;
    this.waitTime = 60000; // 60 giây chờ
    this.countdownTime = 5000; // 5 giây đếm ngược

    // State
    this.status = 'waiting'; // waiting, countdown, playing, ended
    this.createdAt = Date.now();
    this.startedAt = null;

    // Players in this room (clientId -> Player)
    this.players = new Map();
    this.clientIds = new Set(); // Track connected clients

    // Game state (similar to Game.js)
    this.projectiles = [];
    this.explosions = [];
    this.world = new WorldManager();
    this.physics = new Physics(this);

    this.tickInterval = null;
    this.broadcastInterval = null;
    this.lastTick = Date.now();

    // Timers
    this.waitTimer = null;
    this.countdownTimer = null;

    console.log(`[Arena] Room ${id} created`);
  }

  // Get player count (excluding bots)
  getRealPlayerCount() {
    let count = 0;
    this.players.forEach(p => {
      if (!p.isBot) count++;
    });
    return count;
  }

  getBotCount() {
    let count = 0;
    this.players.forEach(p => {
      if (p.isBot) count++;
    });
    return count;
  }

  getAlivePlayerCount() {
    let count = 0;
    this.players.forEach(p => {
      if (!p.dead && !p.isBot) count++;
    });
    return count;
  }

  getAliveBotCount() {
    let count = 0;
    this.players.forEach(p => {
      if (!p.dead && p.isBot) count++;
    });
    return count;
  }

  getTotalAliveCount() {
    let count = 0;
    this.players.forEach(p => {
      if (!p.dead) count++;
    });
    return count;
  }

  // Add a real player to room
  addPlayer(clientId, name, userId = null, skinId = 'default') {
    if (this.status !== 'waiting' && this.status !== 'countdown') {
      return false;
    }

    if (this.players.size >= this.maxPlayers) {
      return false;
    }

    const player = new Player(clientId, name, userId, skinId);
    player.dead = false;
    this.players.set(clientId, player);
    this.clientIds.add(clientId);

    // Mark client as in arena
    const client = this.server.clients.get(clientId);
    if (client) {
      client.arenaRoomId = this.id;
      client.player = player;
    }

    // Send init to joining player
    this.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      foods: this.world.foods,
      obstacles: this.world.obstacles,
      nebulas: this.world.nebulas,
      chests: this.world.chests,
      items: this.world.items,
      isArena: true,
      roomId: this.id
    });

    // Notify others
    this.broadcast({
      type: PacketType.PLAYER_JOIN,
      player: player.serialize()
    }, clientId);

    // ✅ CHỈ GỌI 1 LẦN DUY NHẤT Ở CUỐI
    this.broadcastRoomStatus();

    console.log(`[Arena] Player ${name} joined room ${this.id} (${this.getRealPlayerCount()}/${this.maxPlayers})`);

    // Start countdown if full
    if (this.getRealPlayerCount() >= this.maxPlayers) {
      this.startCountdown();
    }

    return true;
  }

  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (!player) return;

    this.players.delete(clientId);
    this.clientIds.delete(clientId);

    // Clear arena reference from client
    const client = this.server.clients.get(clientId);
    if (client) {
      client.arenaRoomId = null;
      client.player = null;
    }

    this.broadcast({
      type: PacketType.PLAYER_LEAVE,
      id: clientId
    });

    console.log(`[Arena] Player ${player.name} left room ${this.id}`);

    // ✅ CHỈ GỌI 1 LẦN
    this.broadcastRoomStatus();
    this.checkGameEnd();
  }

  // Fill remaining slots with bots
  fillWithBots() {
    const needed = this.maxPlayers - this.players.size;
    for (let i = 0; i < needed; i++) {
      const botId = `arena_bot_${this.id}_${Date.now()}_${i}`;
      const bot = new Bot(botId);
      bot.dead = false;
      this.players.set(botId, bot);

      this.broadcast({
        type: PacketType.PLAYER_JOIN,
        player: bot.serialize()
      });

      console.log(`[Arena] Bot ${bot.name} added to room ${this.id}`);
    }
  }

  // Start waiting timer
  startWaitTimer() {
    // Send periodic updates about wait time (every 1 second for accurate countdown)
    let lastPlayerCount = this.getRealPlayerCount();
    let lastWaitTime = Math.ceil((this.waitTime - (Date.now() - this.createdAt)) / 1000);

    this.waitUpdateInterval = setInterval(() => {
      if (this.status === 'waiting') {
        const currentCount = this.getRealPlayerCount();
        const currentWait = Math.ceil((this.waitTime - (Date.now() - this.createdAt)) / 1000);

        // Chỉ broadcast khi số người hoặc thời gian thay đổi
        if (currentCount !== lastPlayerCount || currentWait !== lastWaitTime) {
          this.broadcastRoomStatus();
          lastPlayerCount = currentCount;
          lastWaitTime = currentWait;
        }
      }
    }, 1000);

    this.waitTimer = setTimeout(() => {
      if (this.status === 'waiting') {
        // Time's up, fill with bots and start
        if (this.getRealPlayerCount() > 0) {
          this.startCountdown();
        } else {
          // No real players, destroy room
          this.destroy();
        }
      }
    }, this.waitTime);
  }

  // Start countdown before game
  startCountdown() {
    if (this.status !== 'waiting') return;

    clearTimeout(this.waitTimer);
    clearInterval(this.waitUpdateInterval);
    this.status = 'countdown';

    // Fill with bots if needed
    this.fillWithBots();

    let countdown = 5;

    const countdownTick = () => {
      if (countdown > 0) {
        this.broadcast({
          type: PacketType.ARENA_COUNTDOWN,
          seconds: countdown
        });
        countdown--;
        this.countdownTimer = setTimeout(countdownTick, 1000);
      } else {
        this.startGame();
      }
    };

    countdownTick();
  }

  // Start the actual game
  startGame() {
    this.status = 'playing';
    this.startedAt = Date.now();

    this.broadcast({
      type: PacketType.ARENA_START,
      roomId: this.id,
      playerCount: this.players.size
    });

    // ✅ SỬA: Giảm broadcast rate xuống
    const SIMULATION_RATE = 60;
    const BROADCAST_RATE = 60; // Giảm từ 15 xuống 10 FPS

    this.tickInterval = setInterval(() => this.tick(), 1000 / SIMULATION_RATE);
    this.broadcastInterval = setInterval(() => this.sendStateUpdate(), 1000 / BROADCAST_RATE);

    console.log(`[Arena] Room ${this.id} game started with ${this.players.size} players`);
  }

  tick() {
    if (this.status !== 'playing') return;

    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt > 0.05) dt = 0.05;

    // Update projectiles
    this.updateProjectiles(dt);

    // Update players
    this.players.forEach(player => {
      if (!player.dead) player.update(dt);
    });

    // Update bots AI
    this.players.forEach(player => {
      if (!player.dead && player instanceof Bot) {
        player.think(this);
      }
    });

    // Physics
    this.physics.checkCollisions();

    // Update chests
    this.world.chests.forEach(chest => chest.update(dt));

    // World spawns
    this.world.spawnFood();
    this.world.spawnNormalChestIfNeeded();
    this.world.spawnStationIfNeeded();

    // Check win condition
    this.checkGameEnd();
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);

      const isExpired = proj.distanceTraveled >= proj.range && !proj.isMine;
      const shouldRemove = proj.shouldRemove();
      const isHit = proj.hit;

      if (isExpired || shouldRemove || isHit) {
        if (proj.weaponType === 'BOMB') {
          const explosion = new Explosion(
            proj.x, proj.y, 100, proj.damage, proj.ownerId, proj.ownerName
          );
          this.explosions.push(explosion);
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  checkGameEnd() {
    if (this.status !== 'playing') return;

    const aliveRealPlayers = [];
    let aliveBots = 0;

    this.players.forEach(p => {
      if (!p.dead) {
        if (p.isBot) {
          aliveBots++;
        } else {
          aliveRealPlayers.push(p);
        }
      }
    });

    // Only bots alive -> end game
    if (aliveRealPlayers.length === 0 && aliveBots > 0) {
      this.endGame(null);
      return;
    }

    // Only 1 player alive (real or bot) -> winner
    const totalAlive = aliveRealPlayers.length + aliveBots;
    if (totalAlive <= 1) {
      const winner = aliveRealPlayers[0] || null;
      this.endGame(winner);
    }
  }

  endGame(winner) {
    this.status = 'ended';

    clearInterval(this.tickInterval);
    clearInterval(this.broadcastInterval);

    if (winner) {
      // Announce victory
      this.broadcast({
        type: PacketType.ARENA_VICTORY,
        winnerId: winner.id,
        winnerName: winner.name,
        score: winner.score
      });

      // Save winner stats
      if (winner.userId) {
        this.saveWinnerStats(winner);
      }

      console.log(`[Arena] Room ${this.id} - Winner: ${winner.name}`);
    } else {
      this.broadcast({
        type: PacketType.ARENA_END,
        reason: 'no_players'
      });
      console.log(`[Arena] Room ${this.id} ended - No real players remaining`);
    }

    // Destroy room after delay
    setTimeout(() => {
      this.destroy();
    }, 5000);
  }

  async saveWinnerStats(winner) {
    try {
      const { User } = await import('../db/models/User.model.js');
      const user = await User.findById(winner.userId);
      if (user) {
        user.coins += winner.score + 100; // Bonus for winning
        user.arenaWins = (user.arenaWins || 0) + 1;
        if (winner.score > user.highScore) {
          user.highScore = winner.score;
        }
        await user.save();

        this.sendToClient(winner.id, {
          type: 'USER_DATA_UPDATE',
          coins: user.coins,
          highScore: user.highScore,
          arenaWins: user.arenaWins
        });
      }
    } catch (err) {
      console.error('[Arena] Error saving winner stats:', err);
    }
  }

  destroy() {
    clearTimeout(this.waitTimer);
    clearTimeout(this.countdownTimer);
    clearInterval(this.tickInterval);
    clearInterval(this.broadcastInterval);
    clearInterval(this.waitUpdateInterval);

    // Notify all clients
    this.broadcast({
      type: PacketType.ARENA_END,
      reason: 'room_closed'
    });

    // Clear arena reference from all clients
    this.clientIds.forEach(clientId => {
      const client = this.server.clients.get(clientId);
      if (client) {
        client.arenaRoomId = null;
        client.player = null;
      }
    });

    this.players.clear();
    this.clientIds.clear();

    this.manager.removeRoom(this.id);
    console.log(`[Arena] Room ${this.id} destroyed`);
  }

  // Input handlers (same as Game.js)
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

  handleSelectSlot(clientId, slotIndex) {
    const player = this.players.get(clientId);
    if (player && !player.dead && slotIndex >= 0 && slotIndex <= 4) {
      player.selectedSlot = slotIndex;
    }
  }

  handleUseItem(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      player.activateCurrentItem(this);
    }
  }

  handleDash(clientId) {
    const player = this.players.get(clientId);
    if (player && typeof player.performDash === 'function') {
      player.performDash();
    }
  }

  // Stats saving for arena
  async savePlayerScore(player) {
    await StatsService.savePlayerScore(this.server, player);
  }

  async saveKillerStats(player) {
    await StatsService.saveKillerStats(this.server, player);
  }

  // Network
  sendToClient(clientId, data) {
    const client = this.server.clients.get(clientId);
    if (client?.ws.readyState === 1) {
      client.ws.send(JSON.stringify(data));
    }
  }

  broadcast(data, excludeId = null) {
    const message = JSON.stringify(data);
    this.clientIds.forEach(clientId => {
      if (clientId !== excludeId) {
        const client = this.server.clients.get(clientId);
        if (client?.ws.readyState === 1) {
          client.ws.send(message);
        }
      }
    });
  }

  broadcastRoomStatus() {
    this.broadcast({
      type: PacketType.ARENA_STATUS,
      roomId: this.id,
      status: this.status,
      playerCount: this.getRealPlayerCount(),
      maxPlayers: this.maxPlayers,
      waitTimeRemaining: Math.max(0, this.waitTime - (Date.now() - this.createdAt))
    });
  }

  sendStateUpdate() {
    const alivePlayers = [];
    this.players.forEach(p => {
      if (!p.dead || (Date.now() - (p.deathTime || 0)) < 2000) {
        alivePlayers.push(p.serialize());
      }
    });

    // Chuẩn bị state packet
    const state = {
      type: PacketType.ARENA_UPDATE,
      t: Date.now(),
      players: alivePlayers,
      projectiles: this.projectiles.map(p => p.serialize()),
      explosions: this.explosions.map(e => e.serialize()),
      aliveCount: this.getTotalAliveCount()
    };

    // ✅ CHỈ GỬI DELTA KHI CÓ THAY ĐỔI (giống Game.js)
    if (this.world.delta.foodsAdded.length > 0) {
      state.foodsAdded = this.world.delta.foodsAdded;
    }
    if (this.world.delta.foodsRemoved.length > 0) {
      state.foodsRemoved = this.world.delta.foodsRemoved;
    }
    if (this.world.delta.chestsAdded.length > 0) {
      state.chestsAdded = this.world.delta.chestsAdded.map(c => ({
        ...c,
        rotation: c.rotation || 0
      }));
    }
    if (this.world.delta.chestsRemoved.length > 0) {
      state.chestsRemoved = this.world.delta.chestsRemoved;
    }
    if (this.world.delta.itemsAdded.length > 0) {
      state.itemsAdded = this.world.delta.itemsAdded;
    }
    // ⭐ QUAN TRỌNG: Phải gửi itemsRemoved khi có item bị xóa
    if (this.world.delta.itemsRemoved.length > 0) {
      state.itemsRemoved = this.world.delta.itemsRemoved;
    }

    this.broadcast(state);
    
    // ✅ Reset Delta SAU khi broadcast
    this.world.resetDelta();
  }
}
