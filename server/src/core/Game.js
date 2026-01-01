import { TICK_RATE, CHEST_TYPES } from '../../../shared/src/constants.js';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Player } from '../entities/Player.js';
import { Physics } from './Physics.js';

// Import managers
import { WorldManager } from './managers/WorldManager.js';
import { BotManager } from './managers/BotManager.js';
import { StatsService } from './managers/StatsService.js';
import { Explosion } from '../entities/Explosion.js';

export class Game {
  constructor(server) {
    this.server = server;
    this.players = new Map();
    this.projectiles = [];
    this.explosions = [];

    // Spectate tracking
    this.spectators = new Map(); // clientId -> { targetId, targetName }

    // Initialize Managers
    this.world = new WorldManager();
    this.bots = new BotManager(this);

    this.physics = new Physics(this);

    this.tickInterval = null;
    this.lastTick = Date.now();
  }

  start() {
    const SIMULATION_RATE = 60; // Server ticks 60 FPS
    const BROADCAST_RATE = 20;   // Broadcast 20 FPS

    setInterval(() => this.tick(), 1000 / SIMULATION_RATE);
    setInterval(() => this.sendStateUpdate(), 1000 / BROADCAST_RATE);
  }

  tick() {
    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt > 0.05) dt = 0.05;

    // 1. Update Projectiles
    this.updateProjectiles(dt);

    // 2. Update Players (Input + Move)
    this.players.forEach(player => {
      if (!player.dead) player.update(dt);
    });

    // 3. Update Bots (AI logic + Spawning)
    this.bots.update(dt);

    // 4. Physics Collision
    this.physics.checkCollisions();

    // 4.5. Cleanup expired explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].shouldRemove()) {
        this.explosions.splice(i, 1);
      }
    }

    this.world.chests.forEach(chest => chest.update(dt));

    // 5. World Management (Spawn Food, Chests, Big Chest)
    this.world.spawnFood();
    this.world.spawnNormalChestIfNeeded();
    this.world.spawnStationIfNeeded();

    // 6. Broadcast State
    this.sendStateUpdate();
  }

  // --- PLAYER MANAGEMENT ---
  addPlayer(clientId, name, userId = null, skinId = 'default') {
    const player = new Player(clientId, name, userId, skinId);
    this.players.set(clientId, player);

    // Send INIT
    this.server.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      foods: this.world.foods,
      obstacles: this.world.obstacles,
      nebulas: this.world.nebulas,
      chests: this.world.chests,
      items: this.world.items.map(item => item.serialize ? item.serialize() : item)
    });

    this.server.broadcast({
      type: PacketType.PLAYER_JOIN,
      player: player.serialize()
    }, clientId);
  }

  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (player) {
      this.players.delete(clientId);
      this.server.broadcast({ type: PacketType.PLAYER_LEAVE, id: clientId });
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

  handleSelectSlot(clientId, slotIndex) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      if (slotIndex >= 0 && slotIndex <= 4) {
        player.selectedSlot = slotIndex;
      }
    }
  }

  handleUseItem(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      player.activateCurrentItem(this);
    }
  }

  // --- SPECTATE MODE ---
  handleSpectateStart(clientId, targetId) {
    // Check if spectator is dead
    const spectator = this.players.get(clientId);
    if (spectator && !spectator.dead) {
      // Spectator is alive, can't spectate
      return;
    }

    const target = this.players.get(targetId);
    if (!target || target.dead) {
      // Target not found or dead, can't spectate
      this.server.sendToClient(clientId, {
        type: PacketType.SPECTATE_UPDATE,
        isSpectating: false,
        targetId: null,
        targetName: null
      });
      return;
    }

    // Store spectator info
    this.spectators.set(clientId, {
      targetId: targetId,
      targetName: target.name
    });

    // Notify client
    this.server.sendToClient(clientId, {
      type: PacketType.SPECTATE_UPDATE,
      isSpectating: true,
      targetId: targetId,
      targetName: target.name
    });
  }

  handleSpectateStop(clientId) {
    this.spectators.delete(clientId);

    this.server.sendToClient(clientId, {
      type: PacketType.SPECTATE_UPDATE,
      isSpectating: false,
      targetId: null,
      targetName: null
    });
  }

  // Called when a spectated player dies
  notifySpectatorTargetDied(killedPlayerId, killerId, killerName) {
    // Find all spectators watching this player
    for (const [spectatorId, spectateInfo] of this.spectators.entries()) {
      if (spectateInfo.targetId === killedPlayerId) {
        // If killer exists and is alive, switch to watching killer
        const killer = this.players.get(killerId);
        if (killer && !killer.dead && killerId !== killedPlayerId) {
          // Update spectator's target
          this.spectators.set(spectatorId, {
            targetId: killerId,
            targetName: killer.name
          });

          // Notify client to switch target
          this.server.sendToClient(spectatorId, {
            type: PacketType.SPECTATE_TARGET_DIED,
            canSpectateKiller: true,
            newTargetId: killerId,
            newTargetName: killer.name
          });
        } else {
          // No valid killer to spectate, end spectate mode
          this.spectators.delete(spectatorId);
          this.server.sendToClient(spectatorId, {
            type: PacketType.SPECTATE_TARGET_DIED,
            canSpectateKiller: false,
            newTargetId: null,
            newTargetName: null
          });
        }
      }
    }
  }

  respawnPlayer(clientId, skinId) {
    const player = this.players.get(clientId);
    if (player) {
      // 1. Reset player state
      player.dead = false;
      player.respawn(skinId);

      // 2. Send INIT again
      this.server.sendToClient(clientId, {
        type: PacketType.INIT,
        id: clientId,
        player: player.serialize(),
        players: Array.from(this.players.values()).map(p => p.serialize()),
        foods: this.world.foods,
        obstacles: this.world.obstacles,
        nebulas: this.world.nebulas,
        chests: this.world.chests,
        items: this.world.items.map(item => item.serialize ? item.serialize() : item)
      });

      // 3. Notify other players
      this.server.broadcast({
        type: PacketType.RESPAWN,
        player: player.serialize()
      }, clientId);
    }
  }

  // --- STATS DELEGATION ---
  async savePlayerScore(player) {
    await StatsService.savePlayerScore(this.server, player);
  }

  async saveKillerStats(player) {
    await StatsService.saveKillerStats(this.server, player);
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
            proj.x,
            proj.y,
            100, // Radius
            proj.damage,
            proj.ownerId,
            proj.ownerName
          );
          this.explosions.push(explosion);
        }

        this.projectiles.splice(i, 1);
      }
    }
  }

  // --- NETWORK ---
  sendStateUpdate() {

    const state = {
      type: PacketType.UPDATE,
      t: Date.now(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      projectiles: this.projectiles.map(p => p.serialize()),
      explosions: this.explosions.map(e => e.serialize()),

      foodsAdded: this.world.delta.foodsAdded,
      foodsRemoved: this.world.delta.foodsRemoved,
      chestsAdded: this.world.delta.chestsAdded.map(c => ({
        ...c,
        rotation: c.rotation || 0
      })),

      chestsRemoved: this.world.delta.chestsRemoved,
      itemsAdded: this.world.delta.itemsAdded.map(item => item.serialize ? item.serialize() : item),
      itemsRemoved: this.world.delta.itemsRemoved,

    };

    this.server.broadcast(state);
    this.world.resetDelta();
  }
}