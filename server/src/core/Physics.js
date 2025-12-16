
import { circleCollision, distance } from '../../../shared/src/utils.js';
import { PLAYER_RADIUS, MAP_SIZE, FOOD_RADIUS, XP_PER_FOOD, CHEST_RADIUS, ITEM_RADIUS, WEAPON_STATS } from '../../../shared/src/constants.js';
import { Quadtree } from '../utils/Quadtree.js';
import { Explosion } from '../entities/Explosion.js';
import { Projectile } from '../entities/Projectile.js';

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

          // Nếu là Rocket thì tạo explosion TRƯỚC khi xóa đạn
          if (proj.weaponType === 'ROCKET') {
            this.createExplosion(proj);
          } else {
            // Các vũ khí khác thì damage trực tiếp
            player.takeDamage(proj.damage, proj.ownerId);
          }

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
    this.game.players.forEach(player => {
      if (player.dead) return;
      for (let i = this.game.foods.length - 1; i >= 0; i--) {
        const food = this.game.foods[i];
        const dx = player.x - food.x;
        const dy = player.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (player.radius || PLAYER_RADIUS) + FOOD_RADIUS) {
          player.score += XP_PER_FOOD;
          player.checkLevelUp();
          this.game.removedFoodIds.push(food.id);
          this.game.foods.splice(i, 1);
        }
      }
    });

    // Player vs Obstacles
    this.game.players.forEach(player => {
      if (player.dead) return;
      this.game.obstacles.forEach(obs => {
        const dx = player.x - obs.x;
        const dy = player.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (player.radius || PLAYER_RADIUS) + obs.radius;
        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          const pushOut = minDist - dist;
          player.x += Math.cos(angle) * pushOut;
          player.y += Math.sin(angle) * pushOut;
        }
      });
    });

    // Projectile vs Obstacles
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      for (const obs of this.game.obstacles) {
        const dx = proj.x - obs.x;
        const dy = proj.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < proj.radius + obs.radius) {
          // Rocket nổ khi đâm vào obstacle
          if (proj.weaponType === 'ROCKET') {
            this.createExplosion(proj);
          }
          this.game.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // Projectile vs Chests
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      for (let j = this.game.chests.length - 1; j >= 0; j--) {
        const chest = this.game.chests[j];
        if (circleCollision(proj.x, proj.y, proj.radius, chest.x, chest.y, chest.radius)) {
          chest.takeDamage(proj.damage);

          // Rocket nổ khi đánh trúng chest
          if (proj.weaponType === 'ROCKET') {
            this.createExplosion(proj);
          }

          this.game.projectiles.splice(i, 1);
          if (chest.dead) {
            this.game.spawnItem(chest.x, chest.y);
            this.game.removedChestIds.push(chest.id);
            this.game.chests.splice(j, 1);
          }
          break;
        }
      }
    }

    // Player vs Items
    this.game.players.forEach(player => {
      if (player.dead) return;
      for (let i = this.game.items.length - 1; i >= 0; i--) {
        const item = this.game.items[i];
        if (circleCollision(player.x, player.y, player.radius, item.x, item.y, ITEM_RADIUS)) {
          player.applyItem(item.type);
          this.game.removedItemIds.push(item.id);
          this.game.items.splice(i, 1);
        }
      }
    });

    // Player vs Chests (Collision)
    this.game.players.forEach(player => {
      if (player.dead) return;
      this.game.chests.forEach(chest => {
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
  }

  // HÀM TẠO EXPLOSION
  createExplosion(projectile) {
    const stats = WEAPON_STATS[projectile.weaponType];
    if (!stats || !stats.shrapnelCount) return;

    console.log(`Rocket exploded! Creating ${stats.shrapnelCount} shrapnel`);

    // Tạo 8 mảnh vụn bắn ra 8 hướng
    const angleStep = (Math.PI * 2) / stats.shrapnelCount;

    for (let i = 0; i < stats.shrapnelCount; i++) {
      const angle = angleStep * i;

      const shrapnel = new Projectile(
        projectile.x, projectile.y, angle,
        400, // Tốc độ
        stats.shrapnelDamage,
        projectile.ownerId,
        projectile.ownerName,
        'SHRAPNEL',
        150, // Range
        3    // Radius
      );

      shrapnel.color = 0xFF6600;
      this.game.projectiles.push(shrapnel);
    }

    // Tạo visual effect
    const explosion = new Explosion(
      projectile.x, projectile.y,
      stats.explosionRadius, 0,
      projectile.ownerId, projectile.ownerName
    );
    this.game.explosions.push(explosion);
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
      if (!killer.isBot) {
        this.game.saveKillerStats(killer);
      }
      player.dead = true;
      player.health = 0;
    }
    
    this.game.server.broadcast({
      type: 'player_died',
      victimId: player.id,
      killerId: killerId,
      killerName: killerName || 'Unknown',
      score: player.score
    });

    if (player.isBot) {
      // --- XỬ LÝ BOT ---
      console.log(`Bot died: ${player.name}`);

      // Bot không cần lưu điểm vào DB
      
      // Xóa Bot khỏi game sau 2 giây
      // (Delay để Client kịp nhận gói tin player_died và vẽ hiệu ứng nổ)
      setTimeout(() => {
        // Kiểm tra lại lần nữa xem bot còn đó không (tránh crash)
        if (this.game.players.has(player.id)) {
          this.game.removePlayer(player.id);
          this.game.manageBots();
        }
      }, 2000); 

    } else {
      // --- XỬ LÝ NGƯỜI CHƠI THẬT ---
      // Lưu điểm vào DB
      this.game.savePlayerScore(player);
    }
  }
}