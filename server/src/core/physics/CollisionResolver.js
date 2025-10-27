// server/src/core/physics/CollisionResolver.js
import { PacketType } from '../../../../shared/src/packetTypes.js';
import { XP_PER_FOOD, CHEST_TYPES, ITEM_RADIUS, SHIP_RADIUS } from '../../../../shared/src/constants.js';

export class CollisionResolver {
  constructor(game) {
    this.game = game;
  }

  // --- PROJECTILES HITS ---

  hitPlayer(player, projectile) {
    player.takeDamage(projectile.damage, projectile.ownerId);
    if (player.isDead()) {
      this.handlePlayerDeath(player, projectile.ownerId, projectile.ownerName);
    }
  }

  hitChest(chest, projectile) {
    chest.takeDamage(projectile.damage);
    if (chest.dead) {
      this.game.world.spawnItem(chest.x, chest.y, chest.type);
      this.game.world.delta.chestsRemoved.push(chest.id);

      // Xóa khỏi mảng chests của world
      const idx = this.game.world.chests.indexOf(chest);
      if (idx !== -1) this.game.world.chests.splice(idx, 1);

      if (chest.type === CHEST_TYPES.STATION) {
        setTimeout(() => this.game.world.spawnStationIfNeeded(), 60000);
      }
    }
  }

  // --- PLAYER COLLECTIBLES ---

  collectFood(player, food) {
    player.score += XP_PER_FOOD;
    player.checkLevelUp();
    this.game.world.removeFood(food.id);
  }

  collectItem(player, item) {
    player.applyItem(item.type);

    if (!player.isBot) {
      this.game.server.sendToClient(player.id, {
        type: 'ITEM_PICKED_UP',
        playerId: player.id,
        itemType: item.type
      });
    }

    this.game.world.delta.itemsRemoved.push(item.id);
    const idx = this.game.world.items.indexOf(item);
    if (idx !== -1) this.game.world.items.splice(idx, 1);
  }

  // --- PHYSICS PUSH ---

  resolveEntityPush(dynamicEntity, staticEntityX, staticEntityY, staticRadius) {
    const dx = dynamicEntity.x - staticEntityX;
    const dy = dynamicEntity.y - staticEntityY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = (dynamicEntity.radius || SHIP_RADIUS) + staticRadius;

    if (dist < minDist) {
      if (dist > 0) {
        const pushOut = minDist - dist;
        dynamicEntity.x += (dx / dist) * pushOut;
        dynamicEntity.y += (dy / dist) * pushOut;
      } else {
        dynamicEntity.x += minDist; // Fallback trùng tâm
      }
    }
  }

  resolvePlayerVsPlayerPush(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const minDist = (p1.radius || SHIP_RADIUS) + (p2.radius || SHIP_RADIUS);

    if (dist < minDist && dist > 0) {
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const overlap = (minDist - dist) / 2;

      p1.x -= Math.cos(angle) * overlap;
      p1.y -= Math.sin(angle) * overlap;
      p2.x += Math.cos(angle) * overlap;
      p2.y += Math.sin(angle) * overlap;
    }
  }

  applyPushVector(player, vector) {
    if (vector) {
      player.x += vector.x;
      player.y += vector.y;
    }
  }

  // --- EXPLOSIONS ---

  applyExplosionDamage(player, explosion) {
    player.takeDamage(explosion.damage, explosion.ownerId);

    // Check death after damage
    if (player.isDead()) {
      this.handlePlayerDeath(player, explosion.ownerId, explosion.ownerName);
    }
  }

  // --- DEATH LOGIC ---

  handlePlayerDeath(player, killerId, killerName) {
    this.game.world.spawnItem(player.x, player.y, 'ENEMY');

    player.dead = true;
    player.lives = 0;
    player.deathTime = Date.now();
    player.inventory = [null, null, null, null, null];

    const killer = this.game.players.get(killerId);
    if (killer) {
      killer.score += 100;
      killer.lives = Math.min(killer.lives + 1, killer.maxLives);
      killer.sessionKills = (killer.sessionKills || 0) + 1;

      if (!killer.isBot) {
        // Chỉ cộng điểm và save stats, không tự cộng coin
        // Coin sẽ rơi ra từ enemy drops
        this.game.saveKillerStats(killer);
      }
    }

    // Broadcast death - works for both normal game and arena
    // Check if this is an arena room (has broadcast method directly) or normal game (has server.broadcast)
    const broadcastData = {
      type: PacketType.PLAYER_DIED,
      victimId: player.id,
      killerId: killerId,
      killerName: killerName || 'Unknown',
      score: player.score,
      coins: player.coins,
      kills: player.sessionKills,
      rank: (this.game.getTotalAliveCount && typeof this.game.getTotalAliveCount === 'function')
        ? this.game.getTotalAliveCount() + 1
        : undefined
    };

    if (this.game.broadcast) {
      // This is an ArenaRoom
      this.game.broadcast(broadcastData);

      // Save arena ranking for PvP deaths (if not a bot and has userId)
      if (!player.isBot && player.userId && broadcastData.rank) {
        this.game.savePlayerRanking(player, broadcastData.rank);
      }
    } else if (this.game.server) {
      // This is the main Game
      this.game.server.broadcast(broadcastData);
    }

    // Handle bot cleanup - only for normal game mode (arena handles its own cleanup)
    if (player.isBot) {
      setTimeout(() => {
        if (this.game.broadcast) {
          // Arena
          if (this.game.players.has(player.id)) {
            this.game.players.delete(player.id);
            this.game.broadcast({
              type: PacketType.PLAYER_LEAVE,
              id: player.id
            });
          }
        } else if (this.game.bots) {
          // Normal game
          if (this.game.players.has(player.id)) {
            this.game.removePlayer(player.id);
            this.game.bots.manageBots();
          }
        }
      }, 2000);
    } else if (!player.isBot) {
      this.game.savePlayerScore(player);
    }
  }
}