// server/src/arena/ArenaRoom.js
import { TICK_RATE, MAP_SIZE, ARENA_CONFIG } from '../../../shared/src/constants.js';
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
    this.waitTime = ARENA_CONFIG.WAITING_TIME;
    this.countdownTime = ARENA_CONFIG.COUNTDOWN_TIME;
    this.gameDuration = ARENA_CONFIG.GAME_DURATION;

    // State
    this.status = 'waiting'; // waiting, countdown, playing, ended
    this.createdAt = Date.now();
    this.startedAt = null;

    // Players
    this.players = new Map();
    this.clientIds = new Set();

    // Game state
    this.projectiles = [];
    this.explosions = [];
    this.world = new WorldManager();
    this.physics = new Physics(this);

    // Intervals
    this.tickInterval = null;
    this.broadcastInterval = null;
    this.waitUpdateInterval = null;
    this.lastTick = Date.now();

    // Timers
    this.waitTimer = null;
    this.countdownTimer = null;

    // Zone initialization
    this.initZone();

    console.log(`[Arena] Room ${id} created`);
    this.startWaitTimer();
  }

  // ========================================
  // ZONE MANAGEMENT
  // ========================================

  initZone() {
    const startRadius = MAP_SIZE / 2;
    this.zone = {
      x: 0,
      y: 0,
      radius: startRadius,
      targetX: 0,
      targetY: 0,
      targetRadius: startRadius,
      phase: 0,
      state: 'WAITING',
      nextActionTime: 0
    };
  }

  updateZone(dt) {
    if (this.zone.state === 'FINISHED') return;

    const now = Date.now();

    if (this.zone.state === 'WAITING') {
      if (now >= this.zone.nextActionTime) {
        this.startZoneShrink();
      }
    } else if (this.zone.state === 'SHRINKING') {
      this.updateZoneShrink(dt, now);
    }
  }

  startZoneShrink() {
    if (this.zone.phase >= ARENA_CONFIG.ZONE.RADII_PERCENT.length) {
      this.zone.state = 'FINISHED';
      this.zone.targetRadius = 0;
      return;
    }

    this.zone.state = 'SHRINKING';
    this.zone.nextActionTime = Date.now() + (ARENA_CONFIG.ZONE.SHRINK_TIME * 1000);

    console.log(`[Arena] Zone phase ${this.zone.phase} shrinking - From R=${Math.round(this.zone.radius)} to R=${Math.round(this.zone.targetRadius)} over ${ARENA_CONFIG.ZONE.SHRINK_TIME}s`);
  }

  updateZoneShrink(dt, now) {
    const timeLeft = (this.zone.nextActionTime - now) / 1000;

    if (timeLeft <= 0) {
      this.finishZoneShrink();
    } else {
      this.interpolateZone(dt, timeLeft);
    }
  }

  finishZoneShrink() {
    // Snap to target
    this.zone.radius = this.zone.targetRadius;
    this.zone.x = this.zone.targetX;
    this.zone.y = this.zone.targetY;

    console.log(`[Arena] Zone phase ${this.zone.phase} completed - At (${Math.round(this.zone.x)}, ${Math.round(this.zone.y)}), R=${Math.round(this.zone.radius)}`);

    // Tăng phase cho lần co tiếp theo
    this.zone.phase++;

    // Kiểm tra xem còn phase nào không
    if (this.zone.phase >= ARENA_CONFIG.ZONE.RADII_PERCENT.length) {
      this.zone.state = 'FINISHED';
      console.log(`[Arena] Zone finished - All phases completed`);
      return;
    }

    // Tính toán target cho phase tiếp theo
    const BASE_RADIUS = MAP_SIZE / 2;
    const nextPercent = ARENA_CONFIG.ZONE.RADII_PERCENT[this.zone.phase];
    this.zone.targetRadius = BASE_RADIUS * nextPercent;
    this.calculateNextZoneTarget();

    // Chuyển sang trạng thái WAITING
    this.zone.state = 'WAITING';
    this.zone.nextActionTime = Date.now() + (ARENA_CONFIG.ZONE.WAIT_TIME * 1000);

    console.log(`[Arena] Next phase ${this.zone.phase} will shrink to R=${Math.round(this.zone.targetRadius)} in ${ARENA_CONFIG.ZONE.WAIT_TIME}s`);
  }

  interpolateZone(dt, timeLeft) {
    const factor = dt / (timeLeft + dt);
    this.zone.radius += (this.zone.targetRadius - this.zone.radius) * factor;
    this.zone.x += (this.zone.targetX - this.zone.x) * factor;
    this.zone.y += (this.zone.targetY - this.zone.y) * factor;
  }

  calculateNextZoneTarget() {
    const currentR = this.zone.radius;
    const nextR = this.zone.targetRadius;

    if (nextR <= 0) {
      this.zone.targetX = this.zone.x;
      this.zone.targetY = this.zone.y;
      return;
    }

    const maxDistance = currentR - nextR;

    if (maxDistance <= 0) {
      this.zone.targetX = this.zone.x;
      this.zone.targetY = this.zone.y;
      return;
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * maxDistance;

    this.zone.targetX = this.zone.x + Math.cos(angle) * distance;
    this.zone.targetY = this.zone.y + Math.sin(angle) * distance;

    console.log(`[Arena] Zone phase ${this.zone.phase} target: Center (${Math.round(this.zone.x)}, ${Math.round(this.zone.y)}) → (${Math.round(this.zone.targetX)}, ${Math.round(this.zone.targetY)}), Radius ${Math.round(currentR)} → ${Math.round(nextR)}`);
  }

  checkZoneDamage(dt) {
    this.players.forEach(player => {
      if (player.dead) return;

      const dist = Math.hypot(player.x - this.zone.x, player.y - this.zone.y);

      if (dist > this.zone.radius) {
        this.applyZoneDamage(player, dt);
      } else {
        player.zoneDamageAccumulated = 0;
      }
    });
  }

  applyZoneDamage(player, dt) {
    if (!player.zoneDamageAccumulated) {
      player.zoneDamageAccumulated = 0;
    }

    player.zoneDamageAccumulated += dt;

    const DAMAGE_INTERVAL = 3;
    if (player.zoneDamageAccumulated >= DAMAGE_INTERVAL) {
      player.zoneDamageAccumulated -= DAMAGE_INTERVAL;
      player.lives = Math.max(0, player.lives - 1);
      player.lastDamageTime = Date.now();

      this.broadcast({
        type: PacketType.PLAYER_DAMAGED,
        victimId: player.id,
        damage: 1,
        source: 'ZONE',
        newLives: player.lives
      });

      console.log(`[Arena] ${player.name} took zone damage (${player.lives} lives left)`);

      if (player.lives <= 0 && !player.dead) {
        this.handlePlayerDeath(player);
      }
    }
  }

  handlePlayerDeath(player) {
    player.dead = true;
    player.deathTime = Date.now();

    this.broadcast({
      type: PacketType.PLAYER_DIED,
      victimId: player.id,
      killerId: 'ZONE',
      killerName: 'The Zone'
    });

    console.log(`[Arena] ${player.name} eliminated by zone`);
    this.checkGameEnd();
  }

  // ========================================
  // PLAYER MANAGEMENT
  // ========================================

  getRealPlayerCount() {
    return Array.from(this.players.values()).filter(p => !p.isBot).length;
  }

  getBotCount() {
    return Array.from(this.players.values()).filter(p => p.isBot).length;
  }

  getAlivePlayerCount() {
    return Array.from(this.players.values()).filter(p => !p.dead && !p.isBot).length;
  }

  getAliveBotCount() {
    return Array.from(this.players.values()).filter(p => !p.dead && p.isBot).length;
  }

  getTotalAliveCount() {
    return Array.from(this.players.values()).filter(p => !p.dead).length;
  }

  addPlayer(clientId, name, userId = null, skinId = 'default') {
    if (!['waiting', 'countdown'].includes(this.status)) return false;
    if (this.players.size >= this.maxPlayers) return false;

    const player = new Player(clientId, name, userId, skinId);
    player.dead = false;

    this.players.set(clientId, player);
    this.clientIds.add(clientId);

    const client = this.server.clients.get(clientId);
    if (client) {
      client.arenaRoomId = this.id;
      client.player = player;
    }

    this.sendInitPacket(clientId, player);
    this.broadcast({
      type: PacketType.PLAYER_JOIN,
      player: player.serialize()
    }, clientId);

    this.broadcastRoomStatus();

    console.log(`[Arena] ${name} joined room ${this.id} (${this.getRealPlayerCount()}/${this.maxPlayers})`);

    if (this.getRealPlayerCount() >= this.maxPlayers) {
      this.startCountdown();
    }

    return true;
  }

  sendInitPacket(clientId, player) {
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
  }

  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (!player) return;

    this.players.delete(clientId);
    this.clientIds.delete(clientId);

    const client = this.server.clients.get(clientId);
    if (client) {
      client.arenaRoomId = null;
      client.player = null;
    }

    this.broadcast({
      type: PacketType.PLAYER_LEAVE,
      id: clientId
    });

    console.log(`[Arena] ${player.name} left room ${this.id}`);

    this.broadcastRoomStatus();
    this.checkGameEnd();
  }

  fillWithBots() {
    const needed = this.maxPlayers - this.players.size;

    for (let i = 0; i < needed; i++) {
      const botId = `arena_bot_${this.id}_${Date.now()}_${i}`;
      const bot = new Bot(botId);

      const r = MAP_SIZE / 2;
      bot.x = (Math.random() * r * 2) - r;
      bot.y = (Math.random() * r * 2) - r;
      bot.dead = false;

      this.players.set(botId, bot);

      this.broadcast({
        type: PacketType.PLAYER_JOIN,
        player: bot.serialize()
      });

      console.log(`[Arena] Bot ${bot.name} added to room ${this.id}`);
    }
  }

  // ========================================
  // GAME FLOW
  // ========================================

  startWaitTimer() {
    let lastPlayerCount = this.getRealPlayerCount();
    let lastWaitTime = Math.ceil((this.waitTime - (Date.now() - this.createdAt)) / 1000);

    this.waitUpdateInterval = setInterval(() => {
      if (this.status === 'waiting') {
        const currentCount = this.getRealPlayerCount();
        const currentWait = Math.ceil((this.waitTime - (Date.now() - this.createdAt)) / 1000);

        if (currentCount !== lastPlayerCount || currentWait !== lastWaitTime) {
          this.broadcastRoomStatus();
          lastPlayerCount = currentCount;
          lastWaitTime = currentWait;
        }
      }
    }, 1000);

    this.waitTimer = setTimeout(() => {
      if (this.status === 'waiting') {
        if (this.getRealPlayerCount() > 0) {
          this.startCountdown();
        } else {
          this.destroy();
        }
      }
    }, this.waitTime);
  }

  startCountdown() {
    if (this.status !== 'waiting') return;

    this.clearWaitTimers();
    this.status = 'countdown';
    this.fillWithBots();

    this.runCountdown(5);
  }

  clearWaitTimers() {
    clearTimeout(this.waitTimer);
    clearInterval(this.waitUpdateInterval);
  }

  runCountdown(seconds) {
    if (seconds > 0) {
      this.broadcast({
        type: PacketType.ARENA_COUNTDOWN,
        seconds: seconds
      });
      this.countdownTimer = setTimeout(() => this.runCountdown(seconds - 1), 1000);
    } else {
      this.startGame();
    }
  }

  startGame() {
    this.status = 'playing';
    this.startedAt = Date.now();

    this.resetZoneForGame();

    this.broadcast({
      type: PacketType.ARENA_START,
      roomId: this.id,
      playerCount: this.players.size,
      gameDuration: this.gameDuration
    });

    const SIMULATION_RATE = 60;
    const BROADCAST_RATE = 20;

    this.tickInterval = setInterval(() => this.tick(), 1000 / SIMULATION_RATE);
    this.broadcastInterval = setInterval(() => this.sendStateUpdate(), 1000 / BROADCAST_RATE);

    console.log(`[Arena] Room ${this.id} game started with ${this.players.size} players`);
  }

  resetZoneForGame() {
    const startRadius = MAP_SIZE / 2;

    this.zone.phase = 0;
    this.zone.state = 'WAITING';
    this.zone.radius = startRadius;
    this.zone.x = 0;
    this.zone.y = 0;
    this.zone.targetRadius = startRadius * ARENA_CONFIG.ZONE.RADII_PERCENT[0];

    this.calculateNextZoneTarget();

    this.zone.nextActionTime = Date.now() + (ARENA_CONFIG.ZONE.WAIT_TIME * 1000);

    console.log(`[Arena] Zone initialized - Radius: ${Math.round(startRadius)}, First shrink to ${Math.round(this.zone.targetRadius)} in ${ARENA_CONFIG.ZONE.WAIT_TIME}s`);
  }

  tick() {
    if (this.status !== 'playing') return;

    const dt = this.calculateDeltaTime();

    // Kiểm tra time limit
    const gameTime = Date.now() - this.startedAt;
    if (gameTime >= this.gameDuration) {
      this.endGameByTime();
      return;
    }

    this.updateZone(dt);
    this.checkZoneDamage(dt);
    this.updateProjectiles(dt);
    this.updatePlayers(dt);
    this.updateBots();
    this.physics.checkCollisions();
    this.updateWorld(dt);
    this.checkGameEnd();
  }

  calculateDeltaTime() {
    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    return dt > 0.05 ? 0.05 : dt;
  }

  updatePlayers(dt) {
    this.players.forEach(player => {
      if (!player.dead) player.update(dt);
    });
  }

  updateBots() {
    this.players.forEach(player => {
      if (!player.dead && player instanceof Bot) {
        player.think(this);
      }
    });
  }

  updateWorld(dt) {
    this.world.chests.forEach(chest => chest.update(dt));
    this.world.spawnFood();
    this.world.spawnNormalChestIfNeeded();
    this.world.spawnStationIfNeeded();
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);

      if (this.shouldRemoveProjectile(proj)) {
        if (proj.weaponType === 'BOMB') {
          this.createExplosion(proj);
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  shouldRemoveProjectile(proj) {
    return (proj.distanceTraveled >= proj.range && !proj.isMine) ||
      proj.shouldRemove() ||
      proj.hit;
  }

  createExplosion(proj) {
    const explosion = new Explosion(
      proj.x, proj.y, 100, proj.damage, proj.ownerId, proj.ownerName
    );
    this.explosions.push(explosion);
  }

  endGameByTime() {
    this.status = 'ended';
    this.clearGameIntervals();

    let winner = null;
    let maxScore = -1;

    this.players.forEach(player => {
      if (!player.isBot && !player.dead && player.score > maxScore) {
        maxScore = player.score;
        winner = player;
      }
    });

    if (winner) {
      this.announceWinner(winner);
      if (winner.userId) {
        this.saveWinnerStats(winner);
      }
    } else {
      this.broadcast({
        type: PacketType.ARENA_END,
        reason: 'time_up'
      });
      console.log(`[Arena] Room ${this.id} ended - Time limit reached`);
    }

    setTimeout(() => this.destroy(), 5000);
  }

  checkGameEnd() {
    if (this.status !== 'playing') return;
    if (Date.now() - this.startedAt < 2000) return;

    const aliveRealPlayers = [];
    let aliveBots = 0;

    this.players.forEach(p => {
      if (!p.dead) {
        p.isBot ? aliveBots++ : aliveRealPlayers.push(p);
      }
    });

    if (aliveRealPlayers.length === 0 && aliveBots > 0) {
      this.endGame(null);
      return;
    }

    const totalAlive = aliveRealPlayers.length + aliveBots;
    if (totalAlive <= 1) {
      this.endGame(aliveRealPlayers[0] || null);
    }
  }

  endGame(winner) {
    this.status = 'ended';
    this.clearGameIntervals();

    if (winner) {
      this.announceWinner(winner);
      if (winner.userId) {
        this.saveWinnerStats(winner);
      }
    } else {
      this.broadcast({
        type: PacketType.ARENA_END,
        reason: 'no_players'
      });
      console.log(`[Arena] Room ${this.id} ended - No real players remaining`);
    }

    setTimeout(() => this.destroy(), 5000);
  }

  clearGameIntervals() {
    clearInterval(this.tickInterval);
    clearInterval(this.broadcastInterval);
  }

  announceWinner(winner) {
    this.broadcast({
      type: PacketType.ARENA_VICTORY,
      winnerId: winner.id,
      winnerName: winner.name,
      score: winner.score
    });

    console.log(`[Arena] Room ${this.id} - Winner: ${winner.name}`);
  }

  async saveWinnerStats(winner) {
    try {
      const { User } = await import('../db/models/User.model.js');
      const user = await User.findById(winner.userId);

      if (user) {
        user.coins += winner.score + 100;
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

    if (this.status !== 'ended') {
      this.broadcast({
        type: PacketType.ARENA_END,
        reason: 'room_closed'
      });
    }

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

  // ========================================
  // INPUT HANDLERS
  // ========================================

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

  // ========================================
  // STATS (Delegation)
  // ========================================

  async savePlayerScore(player) {
    await StatsService.savePlayerScore(this.server, player);
  }

  async saveKillerStats(player) {
    await StatsService.saveKillerStats(this.server, player);
  }

  // ========================================
  // NETWORK
  // ========================================

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

    const state = {
      type: PacketType.ARENA_UPDATE,
      t: Date.now(),
      players: alivePlayers,
      projectiles: this.projectiles.map(p => p.serialize()),
      explosions: this.explosions.map(e => e.serialize()),
      aliveCount: this.getTotalAliveCount(),
      zone: this.serializeZone()
    };

    this.addWorldDelta(state);

    this.broadcast(state);
    this.world.resetDelta();
  }

  serializeZone() {
    return {
      x: Math.round(this.zone.x),
      y: Math.round(this.zone.y),
      r: Math.round(this.zone.radius),
      p: this.zone.phase,
      state: this.zone.state,
      targetX: Math.round(this.zone.targetX),
      targetY: Math.round(this.zone.targetY),
      targetR: Math.round(this.zone.targetRadius)
    };
  }

  addWorldDelta(state) {
    const delta = this.world.delta;

    if (delta.foodsAdded.length > 0) state.foodsAdded = delta.foodsAdded;
    if (delta.foodsRemoved.length > 0) state.foodsRemoved = delta.foodsRemoved;
    if (delta.chestsAdded.length > 0) {
      state.chestsAdded = delta.chestsAdded.map(c => ({
        ...c,
        rotation: c.rotation || 0
      }));
    }
    if (delta.chestsRemoved.length > 0) state.chestsRemoved = delta.chestsRemoved;
    if (delta.itemsAdded.length > 0) state.itemsAdded = delta.itemsAdded;
    if (delta.itemsRemoved.length > 0) state.itemsRemoved = delta.itemsRemoved;
  }
}