import { circleCollision, rectangleCollision, circleRectangleCollision, distance } from '../../../shared/src/utils.js';
import { PLAYER_RADIUS, MAP_SIZE, FOOD_RADIUS, XP_PER_FOOD, CHEST_RADIUS, ITEM_RADIUS, WEAPON_STATS, CHEST_TYPES, NEBULA_RADIUS } from '../../../shared/src/constants.js';
import { Quadtree } from '../utils/Quadtree.js';
import { Explosion } from '../entities/Explosion.js';
import { Projectile } from '../entities/Projectile.js';
import { PacketType } from '../../../shared/src/packetTypes.js';

export class Physics {
  constructor(game) {
    this.game = game;
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
      const range = {
        x: proj.x, y: proj.y,
        width: PLAYER_RADIUS * 2, height: PLAYER_RADIUS * 2
      };

      const candidates = qt.query(range);
      let hitSomeone = false;

      for (let point of candidates) {
        const player = point.userData;
        if (player.id === proj.ownerId) continue;

        if (circleCollision(player.x, player.y, PLAYER_RADIUS, proj.x, proj.y, proj.radius)) {
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

    // Player vs Food (Truy cập qua game.world)
    const foods = this.game.world.foods;
    this.game.players.forEach(player => {
      if (player.dead) return;
      for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        const dx = player.x - food.x;
        const dy = player.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (player.radius || PLAYER_RADIUS) + FOOD_RADIUS) {
          player.score += XP_PER_FOOD;
          player.checkLevelUp();

          // SỬA: Gọi removeFood từ WorldManager
          this.game.world.removeFood(food.id);
        }
      }
    });

    // Player vs Obstacles (Truy cập qua game.world)
    const obstacles = this.game.world.obstacles;
    this.game.players.forEach(player => {
      if (player.dead) return;
      obstacles.forEach(obs => {
        if (circleRectangleCollision(player.x, player.y, player.radius || PLAYER_RADIUS, 
                                     obs.x - obs.width/2, obs.y - obs.height/2, obs.width, obs.height)) {
          // Push out: find closest point and push along the vector
          const px = Math.max(obs.x - obs.width/2, Math.min(player.x, obs.x + obs.width/2));
          const py = Math.max(obs.y - obs.height/2, Math.min(player.y, obs.y + obs.height/2));
          const dx = player.x - px;
          const dy = player.y - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = player.radius || PLAYER_RADIUS;
          if (dist < minDist && dist > 0) {
            const pushOut = minDist - dist;
            player.x += (dx / dist) * pushOut;
            player.y += (dy / dist) * pushOut;
          }
        }
      });
    });

    // Projectile vs Obstacles
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      for (const obs of obstacles) { // Dùng biến obstacles đã lấy ở trên
        if (circleRectangleCollision(proj.x, proj.y, proj.radius, obs.x - obs.width/2, obs.y - obs.height/2, obs.width, obs.height)) {
          this.game.projectiles.splice(i, 1);
          break;
        }
      }
    }
    // Projectile vs Chests
    const chests = this.game.world.chests;
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      for (let j = chests.length - 1; j >= 0; j--) {
        const chest = chests[j];
        if (circleCollision(proj.x, proj.y, proj.radius, chest.x, chest.y, chest.radius)) {
          chest.takeDamage(proj.damage);

          this.game.projectiles.splice(i, 1);
          if (chest.dead) {
            const isBigChest = (chest.type === 'BIG');

            // SỬA: spawnItem từ WorldManager
            this.game.world.spawnItem(chest.x, chest.y, chest.type);

            // SỬA: Push vào delta của WorldManager
            this.game.world.delta.chestsRemoved.push(chest.id);
            chests.splice(j, 1);

            if (isBigChest) {
              // SỬA: Cập nhật trạng thái Big Chest trong WorldManager
              this.game.world.hasBigChest = false;
              this.game.world.nextBigChestTime = Date.now() + 120000;

              console.log(`Big Chest destroyed! Next spawn in 2 minutes`);
              this.game.server.broadcast({
                type: 'system_message',
                message: 'Big Chest destroyed! Next one in 2 minutes'
              });
            }
          }
          break;
        }
      }
    }

    // [MODIFIED] Player vs Items (Truy cập qua game.world)
    const items = this.game.world.items;
    this.game.players.forEach(player => {
      if (player.dead) return;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (circleCollision(player.x, player.y, player.radius, item.x, item.y, ITEM_RADIUS)) {
          player.applyItem(item.type);

          // SỬA: Push vào delta của WorldManager
          this.game.world.delta.itemsRemoved.push(item.id);
          items.splice(i, 1);
        }
      }
    });

    // Player vs Chests (Collision) 
    this.game.players.forEach(player => {
      if (player.dead) return;
      this.game.world.chests.forEach(chest => {
        const dx = player.x - chest.x;
        const dy = player.y - chest.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = player.radius + chest.radius;
        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          const pushOut = minDist - dist;
          player.x += Math.cos(angle) * pushOut;
          player.y += Math.sin(angle) * pushOut;
        }
      });
    });

    // Player vs Nebulas (Collision)
    const nebulas = this.game.world.nebulas;

    this.game.players.forEach(player => {
      if (player.dead) return;

      let insideNebula = false;

      // Duyệt qua tất cả tinh vân để xem player có đứng trong cái nào không
      for (const nebula of nebulas) {
        // Tính khoảng cách
        const dx = player.x - nebula.x;
        const dy = player.y - nebula.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Logic: Nếu khoảng cách < bán kính tinh vân (người chơi lọt thỏm vào trong)
        // Ta dùng nebula.radius - 10 để người chơi phải đi sâu vào mới tàng hình
        if (dist < nebula.radius - 10) {
          insideNebula = true;
          break; // Chỉ cần chạm 1 tinh vân là đủ
        }
      }
      player.isHidden = insideNebula;
    });
  }


  resolvePlayerCollision(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const minDist = (p1.radius || PLAYER_RADIUS) + (p2.radius || PLAYER_RADIUS);
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
      killer.health = Math.min(killer.health + 20, killer.maxHealth);
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
      player.health = 0;
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
      console.log(`Bot died: ${player.name}`);
      setTimeout(() => {
        if (this.game.players.has(player.id)) {
          this.game.removePlayer(player.id);

          this.game.bots.manageBots();
        }
      }, 2000);
    } else {
      // Gọi qua delegate trong Game.js
      this.game.savePlayerScore(player);
    }
  }
}