import { circleCollision, rectangleCollision, circleRectangleCollision, distance } from '../../../shared/src/utils.js';
// Đã import SHIP_RADIUS đúng, nhưng bên dưới phải dùng nó
import { SHIP_RADIUS, MAP_SIZE, FOOD_RADIUS, XP_PER_FOOD, CHEST_RADIUS, ITEM_RADIUS, WEAPON_STATS, CHEST_TYPES, NEBULA_RADIUS } from '../../../shared/src/constants.js';
import { Quadtree } from '../utils/Quadtree.js';
import { Projectile } from '../entities/Projectile.js';
import { PacketType } from '../../../shared/src/packetTypes.js';

export class Physics {
  constructor(game) {
    this.game = game;
  }

  circleRotatedRectCollision(cx, cy, cr, rectX, rectY, width, height, rotation) {
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = cx - rectX;
    const dy = cy - rectY;

    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const closestX = Math.max(-width / 2, Math.min(localX, width / 2));
    const closestY = Math.max(-height / 2, Math.min(localY, height / 2));

    const distX = localX - closestX;
    const distY = localY - closestY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    return distance < cr;
  }

  pushOutOfRotatedRect(player, rectX, rectY, width, height, rotation) {
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = player.x - rectX;
    const dy = player.y - rectY;

    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const closestX = Math.max(-width / 2, Math.min(localX, width / 2));
    const closestY = Math.max(-height / 2, Math.min(localY, height / 2));

    const distX = localX - closestX;
    const distY = localY - closestY;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist < player.radius && dist > 0) {
      const pushOut = player.radius - dist;
      const pushLocalX = (distX / dist) * pushOut;
      const pushLocalY = (distY / dist) * pushOut;

      const cosWorld = Math.cos(rotation);
      const sinWorld = Math.sin(rotation);
      player.x += pushLocalX * cosWorld - pushLocalY * sinWorld;
      player.y += pushLocalX * sinWorld + pushLocalY * cosWorld;
    }
  }

  checkCollisions() {
    const boundary = { x: 0, y: 0, width: MAP_SIZE, height: MAP_SIZE };
    const qt = new Quadtree(boundary, 4);

    this.game.players.forEach(player => {
      qt.insert({ x: player.x, y: player.y, userData: player });
    });

    // Projectile vs Players
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      if (proj.hit) continue;
      
      // SỬA: Thay PLAYER_RADIUS bằng SHIP_RADIUS
      const range = {
        x: proj.x, y: proj.y,
        width: SHIP_RADIUS * 2, height: SHIP_RADIUS * 2
      };

      const candidates = qt.query(range);
      let hitSomeone = false;

      for (let point of candidates) {
        const player = point.userData;
        if (player.id === proj.ownerId) continue;

        // SỬA: Thay PLAYER_RADIUS bằng SHIP_RADIUS (hoặc player.radius)
        if (circleCollision(player.x, player.y, player.radius || SHIP_RADIUS, proj.x, proj.y, proj.radius)) {
          console.log(`HIT! ${proj.weaponType} hit ${player.name}. Damage: ${proj.damage}`);

          player.takeDamage(proj.damage, proj.ownerId);

          proj.hit = true;
          hitSomeone = true;

          if (player.isDead()) {
            this.handlePlayerDeath(player, proj.ownerId, proj.ownerName);
          }
          break;
        }
      }

      if (hitSomeone) {
        this.game.projectiles.splice(i, 1);
      }
    }

    // Player vs Player
    this.game.players.forEach(player => {
      if (player.dead) return;
      const range = {
        x: player.x, y: player.y,
        width: player.radius * 2 + 10, height: player.radius * 2 + 10
      };
      const candidates = qt.query(range);
      for (let point of candidates) {
        const other = point.userData;
        if (other.id !== player.id) {
          this.resolvePlayerCollision(player, other);
        }
      }
    });

    // Player vs Food
    const foods = this.game.world.foods;
    this.game.players.forEach(player => {
      if (player.dead) return;
      for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        const dx = player.x - food.x;
        const dy = player.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // SỬA: Thay PLAYER_RADIUS bằng SHIP_RADIUS
        if (dist < (player.radius || SHIP_RADIUS) + FOOD_RADIUS) {
          player.score += XP_PER_FOOD;
          player.checkLevelUp();
          this.game.world.removeFood(food.id);
        }
      }
    });

    // Player vs Obstacles
    const obstacles = this.game.world.obstacles;
    this.game.players.forEach(player => {
      if (player.dead) return;
      obstacles.forEach(obs => {
        const dx = player.x - obs.x;
        const dy = player.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // SỬA: Thay PLAYER_RADIUS bằng SHIP_RADIUS
        const minDist = (player.radius || SHIP_RADIUS) + obs.radius;

        if (dist < minDist) {
          const pushOut = minDist - dist;
          if (dist > 0) {
            player.x += (dx / dist) * pushOut;
            player.y += (dy / dist) * pushOut;
          } else {
            player.x += pushOut;
          }
        }
      });
    });

    // Projectile vs Obstacles
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      if (proj.shouldRemove()) continue;

      for (const obs of obstacles) {
        const dx = proj.x - obs.x;
        const dy = proj.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < proj.radius + obs.radius) {
          this.game.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // Projectile vs Chests
    const chests = this.game.world.chests;
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      if (proj.shouldRemove()) continue;

      for (let j = chests.length - 1; j >= 0; j--) {
        const chest = chests[j];
        let isHit = false;

        if (chest.type === CHEST_TYPES.STATION) {
          if (chest.type === CHEST_TYPES.STATION) {
            isHit = this.circleRotatedRectCollision(
              proj.x, proj.y, proj.radius,
              chest.x, chest.y,
              chest.width, chest.height,
              chest.rotation
            );
          }
        } else {
          if (circleCollision(proj.x, proj.y, proj.radius, chest.x, chest.y, chest.radius)) {
            isHit = true;
          }
        }

        if (isHit) {
          chest.takeDamage(proj.damage);
          this.game.projectiles.splice(i, 1);

          if (chest.dead) {
            this.game.world.spawnItem(chest.x, chest.y, chest.type);
            this.game.world.delta.chestsRemoved.push(chest.id);
            chests.splice(j, 1);
          }
          break;
        }
      }
    }

    // Player vs Items
    const items = this.game.world.items;
    this.game.players.forEach(player => {
      if (player.dead) return;

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];

        if (circleCollision(player.x, player.y, player.radius, item.x, item.y, ITEM_RADIUS)) {
          player.applyItem(item.type);

          if (!player.isBot) {
            this.game.server.sendToClient(player.id, {
              type: 'ITEM_PICKED_UP',
              playerId: player.id,
              itemType: item.type
            });
          }

          this.game.world.delta.itemsRemoved.push(item.id);
          items.splice(i, 1);
        }
      }
    });

    // Player vs Chests
    this.game.players.forEach(player => {
      if (player.dead) return;

      this.game.world.chests.forEach(chest => {
        if (chest.type === CHEST_TYPES.STATION) {
          if (this.circleRotatedRectCollision(
            player.x, player.y, player.radius,
            chest.x, chest.y,
            chest.width, chest.height,
            chest.rotation
          )) {
            this.pushOutOfRotatedRect(
              player,
              chest.x, chest.y,
              chest.width, chest.height,
              chest.rotation
            );
          }
        } else {
          const dx = player.x - chest.x;
          const dy = player.y - chest.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = player.radius + chest.radius;
          if (dist < minDist && dist > 0) {
            const pushOut = minDist - dist;
            player.x += (dx / dist) * pushOut;
            player.y += (dy / dist) * pushOut;
          }
        }
      });
    });

    // Player vs Nebulas
    const nebulas = this.game.world.nebulas;
    this.game.players.forEach(player => {
      if (player.dead) return;
      let insideNebula = false;
      for (const nebula of nebulas) {
        const dx = player.x - nebula.x;
        const dy = player.y - nebula.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nebula.radius - 10) {
          insideNebula = true;
          break;
        }
      }
      player.isHidden = insideNebula;
    });
  }

  resolvePlayerCollision(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    // SỬA: Thay PLAYER_RADIUS bằng SHIP_RADIUS
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

  handlePlayerDeath(player, killerId, killerName) {
    const killer = this.game.players.get(killerId);
    if (killer) {
      killer.score += 100;
      killer.lives = Math.min(killer.lives + 1, killer.maxLives);
      killer.sessionKills = (killer.sessionKills || 0) + 1;
      if (!killer.isBot) {
        const sortedPlayers = Array.from(this.game.players.values()).sort((a, b) => b.score - a.score);
        const kingId = sortedPlayers.length > 0 ? sortedPlayers[0].id : null;
        const isKing = (player.id === kingId);
        const coinReward = isKing ? 5 : 1;
        killer.coins += coinReward;
        this.game.saveKillerStats(killer);
      }
      player.dead = true;
      player.lives = 0;
    }

    this.game.server.broadcast({
      type: PacketType.PLAYER_DIED,
      victimId: player.id,
      killerId: killerId,
      killerName: killerName || 'Unknown',
      score: player.score,
      coins: player.coins,
      kills: player.sessionKills
    });

    if (player.isBot) {
      setTimeout(() => {
        if (this.game.players.has(player.id)) {
          this.game.removePlayer(player.id);
          this.game.bots.manageBots();
        }
      }, 2000);
    } else {
      this.game.savePlayerScore(player);
    }
  }
}