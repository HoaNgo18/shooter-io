// server/src/core/physics/CollisionDetector.js
import { circleCollision, circleRotatedRectCollision, distance, getPushVectorFromRotatedRect } from '../../../../shared/src/utils.js';
import { SHIP_RADIUS, FOOD_RADIUS, ITEM_RADIUS, BOMB_STATS, CHEST_TYPES } from '../../../../shared/src/constants.js';

export class CollisionDetector {
  constructor(game, resolver) {
    this.game = game;
    this.resolver = resolver;
  }

  // 1. PROJECTILES LOOP
  checkProjectiles(qt) {
    const projectiles = this.game.projectiles;
    const obstacles = this.game.world.obstacles;
    const chests = this.game.world.chests;

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const proj = projectiles[i];

      // Trap Logic
      if (proj.isTrap && !proj.hit) {
        this.checkTrapTrigger(proj, projectiles, qt);
        if (proj.hit) continue; 
      }

      // Skip cleanup or hit projectiles
      if (proj.shouldRemove() || proj.hit) continue;

      // Hit Player
      if (this.checkProjectileVsPlayers(proj, qt)) {
        projectiles.splice(i, 1);
        continue;
      }

      // Hit Obstacle
      if (this.checkProjectileVsObstacles(proj, obstacles)) {
        projectiles.splice(i, 1);
        continue;
      }

      // Hit Chests
      if (this.checkProjectileVsChests(proj, chests)) {
        projectiles.splice(i, 1);
        continue;
      }
    }
  }

  // 2. PLAYERS LOOP
  checkPlayers(qt) {
    const foods = this.game.world.foods;
    const obstacles = this.game.world.obstacles;
    const chests = this.game.world.chests;
    const items = this.game.world.items;
    const nebulas = this.game.world.nebulas;

    this.game.players.forEach(player => {
      if (player.dead) return;

      this.checkPlayerVsPlayers(player, qt);
      this.checkPlayerVsFoods(player, foods);
      this.checkPlayerVsObstacles(player, obstacles);
      this.checkPlayerVsChests(player, chests);
      this.checkPlayerVsItems(player, items);
      this.checkPlayerVsNebulas(player, nebulas);
    });
  }

  // 3. EXPLOSIONS LOOP
  checkExplosions() {
    for (const explosion of this.game.explosions) {
      if ((Date.now() - explosion.createdAt) > 50) continue;

      this.game.players.forEach(player => {
        if (player.dead || player.id === explosion.ownerId) return;
        if (distance(player.x, player.y, explosion.x, explosion.y) < explosion.radius + player.radius) {
          this.resolver.applyExplosionDamage(player, explosion);
        }
      });
    }
  }

  // --- SUB-LOGIC ---

  checkTrapTrigger(bomb, allProjectiles, qt) {
    // Bomb vs Bullets
    for (const bullet of allProjectiles) {
      if (bullet === bomb || bullet.isTrap) continue;
      if (circleCollision(bomb.x, bomb.y, bomb.radius, bullet.x, bullet.y, bullet.radius)) {
        bomb.hit = true;
        bullet.hit = true;
        bomb.ownerId = bullet.ownerId;
        bomb.ownerName = bullet.ownerName;
        return;
      }
    }
    // Bomb vs Players
    if (Date.now() > bomb.armingTime) {
      const range = { x: bomb.x, y: bomb.y, width: BOMB_STATS.TRIGGER_RADIUS * 2, height: BOMB_STATS.TRIGGER_RADIUS * 2 };
      const candidates = qt.query(range);
      for (const point of candidates) {
        const player = point.userData;
        if (circleCollision(bomb.x, bomb.y, BOMB_STATS.TRIGGER_RADIUS, player.x, player.y, player.radius)) {
          bomb.hit = true;
          return;
        }
      }
    }
  }

  checkProjectileVsPlayers(proj, qt) {
    const range = { x: proj.x, y: proj.y, width: SHIP_RADIUS * 2, height: SHIP_RADIUS * 2 };
    const candidates = qt.query(range);
    
    for (const point of candidates) {
      const player = point.userData;
      if (player.id === proj.ownerId) continue;
      if (circleCollision(player.x, player.y, player.radius || SHIP_RADIUS, proj.x, proj.y, proj.radius)) {
        this.resolver.hitPlayer(player, proj);
        proj.hit = true;
        return true;
      }
    }
    return false;
  }

  checkProjectileVsObstacles(proj, obstacles) {
    for (const obs of obstacles) {
      if (distance(proj.x, proj.y, obs.x, obs.y) < proj.radius + obs.radius) {
        return true;
      }
    }
    return false;
  }

  checkProjectileVsChests(proj, chests) {
    for (const chest of chests) {
      let isHit = false;
      if (chest.type === CHEST_TYPES.STATION) {
        isHit = circleRotatedRectCollision(proj.x, proj.y, proj.radius, chest.x, chest.y, chest.width, chest.height, chest.rotation);
      } else {
        isHit = circleCollision(proj.x, proj.y, proj.radius, chest.x, chest.y, chest.radius);
      }

      if (isHit) {
        this.resolver.hitChest(chest, proj);
        return true;
      }
    }
    return false;
  }

  checkPlayerVsPlayers(player, qt) {
    const range = { x: player.x, y: player.y, width: player.radius * 2 + 10, height: player.radius * 2 + 10 };
    const candidates = qt.query(range);
    for (const point of candidates) {
      const other = point.userData;
      if (other.id !== player.id) {
        this.resolver.resolvePlayerVsPlayerPush(player, other);
      }
    }
  }

  checkPlayerVsFoods(player, foods) {
    for (let i = foods.length - 1; i >= 0; i--) {
      const food = foods[i];
      if (distance(player.x, player.y, food.x, food.y) < (player.radius || SHIP_RADIUS) + FOOD_RADIUS) {
        this.resolver.collectFood(player, food);
      }
    }
  }

  checkPlayerVsObstacles(player, obstacles) {
    obstacles.forEach(obs => {
      this.resolver.resolveEntityPush(player, obs.x, obs.y, obs.radius);
    });
  }

  checkPlayerVsChests(player, chests) {
    chests.forEach(chest => {
      if (chest.type === CHEST_TYPES.STATION) {
        const pushVector = getPushVectorFromRotatedRect(player.x, player.y, player.radius, chest.x, chest.y, chest.width, chest.height, chest.rotation);
        if (pushVector) this.resolver.applyPushVector(player, pushVector);
      } else {
        this.resolver.resolveEntityPush(player, chest.x, chest.y, chest.radius);
      }
    });
  }

  checkPlayerVsItems(player, items) {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (circleCollision(player.x, player.y, player.radius, item.x, item.y, ITEM_RADIUS)) {
        this.resolver.collectItem(player, item);
      }
    }
  }

  checkPlayerVsNebulas(player, nebulas) {
    let insideNebula = false;
    for (const nebula of nebulas) {
      if (distance(player.x, player.y, nebula.x, nebula.y) < nebula.radius - 10) {
        insideNebula = true;
        break;
      }
    }
    const now = Date.now();
    const isItemInvisible = player.invisibleEndTime && player.invisibleEndTime > now;
    player.isHidden = insideNebula || isItemInvisible;
  }
}