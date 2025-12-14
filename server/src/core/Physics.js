// server/src/core/Physics.js

import { circleCollision } from '../../../shared/src/utils.js';
import { PLAYER_RADIUS, MAP_SIZE, FOOD_RADIUS, XP_PER_FOOD } from '../../../shared/src/constants.js';
import { Quadtree } from '../utils/Quadtree.js';

export class Physics {
  constructor(game) {
    this.game = game;
  }

  checkCollisions() {
    // 1. Setup Quadtree
    const boundary = { x: 0, y: 0, width: MAP_SIZE, height: MAP_SIZE };
    const qt = new Quadtree(boundary, 4);

    this.game.players.forEach(player => {
      qt.insert({ x: player.x, y: player.y, userData: player });
    });

    // 2. Projectile vs Players
    this.game.projectiles.forEach(proj => {
      if (proj.hit) return;

      const range = {
        x: proj.x, y: proj.y,
        width: PLAYER_RADIUS * 2, height: PLAYER_RADIUS * 2
      };

      const candidates = qt.query(range);

      for (let point of candidates) {
        const player = point.userData;
        if (player.id === proj.ownerId) continue;

        if (circleCollision(player.x, player.y, PLAYER_RADIUS, proj.x, proj.y, 5)) {
          player.takeDamage(proj.damage, proj.ownerId);
          proj.hit = true;

          if (player.isDead()) {
            this.handlePlayerDeath(player, proj.ownerId);
          }
          break;
        }
      }
    });

    // 3. Player vs Player (Quadtree Optimized)
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

    // 4. Player vs Food (Delta Tracking)
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

          // 🟢 Lưu ID để gửi về Client xóa
          this.game.removedFoodIds.push(food.id);
          this.game.foods.splice(i, 1);
        }
      }
    });

    // 5. Player vs Obstacles
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

    // 6. Projectile vs Obstacles
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      for (const obs of this.game.obstacles) {
        const dx = proj.x - obs.x;
        const dy = proj.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5 + obs.radius) {
          this.game.projectiles.splice(i, 1);
          break;
        }
      }
    }
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

  handlePlayerDeath(player, killerId) {
    const killer = this.game.players.get(killerId);
    if (killer) {
      killer.score += 100;
      killer.health = Math.min(killer.health + 20, killer.maxHealth);
    }
    player.dead = true;
    player.health = 0;
    
    this.game.server.broadcast({
      type: 'player_died',
      victimId: player.id,
      killerId: killerId
    });
  }
}