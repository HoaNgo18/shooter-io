// server/src/arena/ArenaRoom.js
import { TICK_RATE, MAP_SIZE, ARENA_CONFIG } from '../../../shared/src/constants.js';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Physics } from '../core/Physics.js';
import { WorldManager } from '../core/managers/WorldManager.js';
import { Explosion } from '../entities/Explosion.js';

// Import Arena Modules
import { ArenaZoneManager } from './ArenaZoneManager.js';
import { ArenaPlayerManager } from './ArenaPlayerManager.js';
import { ArenaStatsHandler } from './ArenaStatsHandler.js';
import { ArenaInputHandler } from './ArenaInputHandler.js';

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

    // Managers
    this.zoneManager = new ArenaZoneManager(this);
    this.playerManager = new ArenaPlayerManager(this);

    // Game state
    this.projectiles = [];
    this.explosions = [];
    this.world = new WorldManager();
    this.physics = new Physics(this);

    // Intervals & Timers
    this.tickInterval = null;
    this.broadcastInterval = null;
    this.waitUpdateInterval = null;
    this.lastTick = Date.now();
    this.waitTimer = null;
    this.countdownTimer = null;

    this.startWaitTimer();
  }

  // ========================================
  // PLAYER MANAGEMENT (Delegated)
  // ========================================

  get players() { return this.playerManager.players; }
  get clientIds() { return this.playerManager.clientIds; }
  get zone() { return this.zoneManager.zone; }

  addPlayer(clientId, name, userId = null, skinId = 'default') {
    const player = this.playerManager.addPlayer(clientId, name, userId, skinId);
    if (!player) return false;

    this.sendInitPacket(clientId, player);
    this.broadcast({
      type: PacketType.PLAYER_JOIN,
      player: player.serialize()
    }, clientId);

    this.broadcastRoomStatus();

    this.sendToClient(clientId, {
      type: PacketType.ARENA_STATUS,
      roomId: this.id,
      status: this.status,
      playerCount: this.playerManager.getRealPlayerCount(),
      maxPlayers: this.maxPlayers,
      waitTimeRemaining: Math.max(0, this.waitTime - (Date.now() - this.createdAt))
    });

    if (this.playerManager.getRealPlayerCount() >= this.maxPlayers) {
      this.startCountdown();
    }

    return true;
  }

  removePlayer(clientId) {
    const player = this.playerManager.removePlayer(clientId);
    if (!player) return;

    this.broadcast({
      type: PacketType.PLAYER_LEAVE,
      id: clientId
    });

    this.broadcastRoomStatus();
    this.checkGameEnd();
  }

  sendInitPacket(clientId, player) {
    this.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: this.playerManager.serializeAll(),
      foods: this.world.foods,
      obstacles: this.world.obstacles,
      nebulas: this.world.nebulas,
      chests: this.world.chests,
      items: this.world.items,
      isArena: true,
      roomId: this.id
    });
  }

  getRealPlayerCount() { return this.playerManager.getRealPlayerCount(); }
  getBotCount() { return this.playerManager.getBotCount(); }
  getAlivePlayerCount() { return this.playerManager.getAlivePlayerCount(); }
  getAliveBotCount() { return this.playerManager.getAliveBotCount(); }
  getTotalAliveCount() { return this.playerManager.getTotalAliveCount(); }

  // ========================================
  // ZONE MANAGEMENT (Delegated)
  // ========================================

  checkZoneDamage(dt) {
    this.playerManager.forEach(player => {
      if (player.dead) return;

      if (this.zoneManager.isOutsideZone(player.x, player.y)) {
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

      if (player.lives <= 0 && !player.dead) {
        this.handlePlayerDeath(player);
      }
    }
  }

  handlePlayerDeath(player) {
    player.dead = true;
    player.deathTime = Date.now();

    const finalRank = this.getTotalAliveCount() + 1;

    this.broadcast({
      type: PacketType.PLAYER_DIED,
      victimId: player.id,
      killerId: 'ZONE',
      killerName: 'The Zone',
      rank: finalRank
    });

    if (!player.isBot && player.userId) {
      ArenaStatsHandler.savePlayerRanking(player, finalRank, this);
    }

    this.checkGameEnd();
  }

  // ========================================
  // GAME FLOW
  // ========================================

  startWaitTimer() {
    this.waitUpdateInterval = setInterval(() => {
      if (this.status === 'waiting') {
        this.broadcastRoomStatus();
      }
    }, 1000);

    this.waitTimer = setTimeout(() => {
      if (this.status === 'waiting') {
        if (this.playerManager.getRealPlayerCount() > 0) {
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
    this.playerManager.fillWithBots();

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

    this.zoneManager.resetForGame();

    this.broadcast({
      type: PacketType.ARENA_START,
      roomId: this.id,
      playerCount: this.playerManager.size,
      gameDuration: this.gameDuration
    });

    const SIMULATION_RATE = 60;
    const BROADCAST_RATE = 20;

    this.tickInterval = setInterval(() => this.tick(), 1000 / SIMULATION_RATE);
    this.broadcastInterval = setInterval(() => this.sendStateUpdate(), 1000 / BROADCAST_RATE);
  }

  tick() {
    if (this.status !== 'playing') return;

    const dt = this.calculateDeltaTime();

    const gameTime = Date.now() - this.startedAt;
    if (gameTime >= this.gameDuration) {
      this.endGameByTime();
      return;
    }

    this.zoneManager.update(dt);
    this.checkZoneDamage(dt);
    this.updateProjectiles(dt);
    this.playerManager.updatePlayers(dt);
    this.playerManager.updateBots();
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

  // ========================================
  // GAME END
  // ========================================

  endGameByTime() {
    this.status = 'ended';
    this.clearGameIntervals();

    let winner = null;
    let maxScore = -1;

    this.playerManager.forEach(player => {
      if (!player.isBot && !player.dead && player.score > maxScore) {
        maxScore = player.score;
        winner = player;
      }
    });

    if (winner) {
      this.announceWinner(winner);
      if (winner.userId) {
        ArenaStatsHandler.saveWinnerStats(winner, this);
      }
    } else {
      this.broadcast({
        type: PacketType.ARENA_END,
        reason: 'time_up'
      });
    }

    setTimeout(() => this.destroy(), 5000);
  }

  checkGameEnd() {
    if (this.status !== 'playing') return;
    if (Date.now() - this.startedAt < 2000) return;

    const aliveRealPlayers = [];
    let aliveBots = 0;

    this.playerManager.forEach(p => {
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
        ArenaStatsHandler.saveWinnerStats(winner, this);
      }
    } else {
      this.broadcast({
        type: PacketType.ARENA_END,
        reason: 'no_players'
      });
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

    this.playerManager.clientIds.forEach(clientId => {
      const client = this.server.clients.get(clientId);
      if (client) {
        client.arenaRoomId = null;
        client.player = null;
      }
    });

    this.playerManager.clear();
    this.manager.removeRoom(this.id);
  }

  // ========================================
  // INPUT HANDLERS (Delegated)
  // ========================================

  handleInput(clientId, inputData) {
    ArenaInputHandler.handleInput(this, clientId, inputData);
  }

  handleAttack(clientId) {
    ArenaInputHandler.handleAttack(this, clientId);
  }

  handleSelectSlot(clientId, slotIndex) {
    ArenaInputHandler.handleSelectSlot(this, clientId, slotIndex);
  }

  handleUseItem(clientId) {
    ArenaInputHandler.handleUseItem(this, clientId);
  }

  handleDash(clientId) {
    ArenaInputHandler.handleDash(this, clientId);
  }

  // ========================================
  // STATS (Delegated)
  // ========================================

  async savePlayerScore(player) {
    await ArenaStatsHandler.savePlayerScore(player, this.server);
  }

  async saveKillerStats(player) {
    await ArenaStatsHandler.saveKillerStats(player, this.server);
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
    this.playerManager.clientIds.forEach(clientId => {
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
      playerCount: this.playerManager.getRealPlayerCount(),
      maxPlayers: this.maxPlayers,
      waitTimeRemaining: Math.max(0, this.waitTime - (Date.now() - this.createdAt))
    });
  }

  sendStateUpdate() {
    const state = {
      type: PacketType.ARENA_UPDATE,
      t: Date.now(),
      players: this.playerManager.serializeAlive(),
      projectiles: this.projectiles.map(p => p.serialize()),
      explosions: this.explosions.map(e => e.serialize()),
      aliveCount: this.getTotalAliveCount(),
      zone: this.zoneManager.serialize()
    };

    this.addWorldDelta(state);

    this.broadcast(state);
    this.world.resetDelta();
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