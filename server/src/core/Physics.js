import { circleCollision, rectangleCollision, circleRectangleCollision, distance } from '../../../shared/src/utils.js';
import { SHIP_RADIUS, MAP_SIZE, FOOD_RADIUS, XP_PER_FOOD, CHEST_RADIUS, ITEM_RADIUS, WEAPON_STATS, CHEST_TYPES, NEBULA_RADIUS } from '../../../shared/src/constants.js';
import { Quadtree } from '../utils/Quadtree.js';
import { Projectile } from '../entities/Projectile.js';
import { PacketType } from '../../../shared/src/packetTypes.js';

export class Physics {
  constructor(game) {
    this.game = game;
  }

  // --- Helper va chạm hình tròn vs hình chữ nhật xoay ---
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

  // --- Helper đẩy nhân vật ra khỏi vật cản ---
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

    // 1. Projectile vs Players
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      if (proj.hit) continue;

      const range = {
        x: proj.x, y: proj.y,
        width: SHIP_RADIUS * 2, height: SHIP_RADIUS * 2
      };

      const candidates = qt.query(range);
      let hitSomeone = false;

      for (let point of candidates) {
        const player = point.userData;
        if (player.id === proj.ownerId) continue;

        if (circleCollision(player.x, player.y, player.radius || SHIP_RADIUS, proj.x, proj.y, proj.radius)) {
          // console.log(`HIT! ${proj.weaponType} hit ${player.name}. Damage: ${proj.damage}`);

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

    // 2. Player vs Player
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

    // 3. Player vs Food
    const foods = this.game.world.foods;
    this.game.players.forEach(player => {
      if (player.dead) return;
      for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        const dx = player.x - food.x;
        const dy = player.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (player.radius || SHIP_RADIUS) + FOOD_RADIUS) {
          player.score += XP_PER_FOOD;
          player.checkLevelUp();
          this.game.world.removeFood(food.id);
        }
      }
    });

    // 4. Player vs Obstacles (Thiên thạch)
    const obstacles = this.game.world.obstacles;
    this.game.players.forEach(player => {
      if (player.dead) return;
      obstacles.forEach(obs => {
        const dx = player.x - obs.x;
        const dy = player.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

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

    // 5. Projectile vs Obstacles
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

    // 6. Projectile vs Chests (BAO GỒM CẢ STATION)
    const chests = this.game.world.chests;
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
      const proj = this.game.projectiles[i];
      if (proj.shouldRemove()) continue;

      for (let j = chests.length - 1; j >= 0; j--) {
        const chest = chests[j];
        let isHit = false;

        // Kiểm tra va chạm tùy theo loại (Hình chữ nhật xoay vs Hình tròn)
        if (chest.type === CHEST_TYPES.STATION) {
          // Đã fix lỗi lặp code if lồng nhau ở đây
          isHit = this.circleRotatedRectCollision(
            proj.x, proj.y, proj.radius,
            chest.x, chest.y,
            chest.width, chest.height,
            chest.rotation
          );
        } else {
          // Chest thường là hình tròn
          if (circleCollision(proj.x, proj.y, proj.radius, chest.x, chest.y, chest.radius)) {
            isHit = true;
          }
        }

        if (isHit) {
          chest.takeDamage(proj.damage);
          this.game.projectiles.splice(i, 1);

          // === LOGIC QUAN TRỌNG: KHI RƯƠNG/TRẠM NỔ ===
          if (chest.dead) {
            // Gọi spawnItem với sourceType chính là type của chest (STATION hoặc NORMAL)
            // WorldManager sẽ tự xử lý việc Station rơi 2 đồ, Normal rơi 1 đồ
            this.game.world.spawnItem(chest.x, chest.y, chest.type);

            this.game.world.delta.chestsRemoved.push(chest.id);
            chests.splice(j, 1);

            // Nếu là Station thì cần logic respawn sau này (đã có trong spawnStationIfNeeded của WorldManager)
            if (chest.type === CHEST_TYPES.STATION) {
              console.log("Station Destroyed!");
              setTimeout(() => this.game.world.spawnStationIfNeeded(), 60000); // Ví dụ hồi sinh sau 60s
            }
          }
          break;
        }
      }
    }

    // 7. Player vs Items (Nhặt đồ)
    const items = this.game.world.items;
    this.game.players.forEach(player => {
      if (player.dead) return;

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];

        // Item nhỏ nên dùng circleCollision là đủ
        if (circleCollision(player.x, player.y, player.radius, item.x, item.y, ITEM_RADIUS)) {

          // Apply effect
          player.applyItem(item.type);

          // Gửi tin nhắn về Client để hiện effect/text
          if (!player.isBot) {
            this.game.server.sendToClient(player.id, {
              type: 'ITEM_PICKED_UP',
              playerId: player.id,
              itemType: item.type
            });
          }

          // Xóa item
          this.game.world.delta.itemsRemoved.push(item.id);
          items.splice(i, 1);
        }
      }
    });

    // 8. Player vs Chests (Va chạm vật lý)
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

    // 9. Player vs Nebulas (Tàng hình)
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
      const now = Date.now(); // Đảm bảo bạn đã khai báo now hoặc dùng Date.now() trực tiếp
      const isItemInvisible = player.invisibleEndTime && player.invisibleEndTime > now;

      player.isHidden = insideNebula || isItemInvisible;
    });

    for (const explosion of this.game.explosions) {
       // Chỉ gây damage 1 lần khi mới nổ (hoặc check ID đã hit)
       // Để đơn giản, ta check thời gian tồn tại của vụ nổ, chỉ gây dmg trong 50ms đầu
       const explosionAge = Date.now() - explosion.createdAt;
       if (explosionAge > 50) continue; 

       this.game.players.forEach(player => {
         if (player.dead || player.id === explosion.ownerId) return; // Không tự nổ chính mình (hoặc bỏ điều kiện này nếu muốn hardcore)

         const dist = distance(player.x, player.y, explosion.x, explosion.y);
         if (dist < explosion.radius + player.radius) {
           player.takeDamage(explosion.damage, explosion.ownerId);
           // Có thể thêm hiệu ứng đẩy lùi tại đây nếu muốn
         }
       });
    }
  }

  resolvePlayerCollision(p1, p2) {
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

  // === XỬ LÝ KHI NGƯỜI CHƠI CHẾT ===
  handlePlayerDeath(player, killerId, killerName) {
    // 1. Spawn Item tại vị trí chết (QUAN TRỌNG)
    // Loại nguồn là 'ENEMY' -> WorldManager sẽ sinh ra 1 món đồ Random
    this.game.world.spawnItem(player.x, player.y, 'ENEMY');

    // 2. Logic tính điểm
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
    player.inventory = [null, null, null, null, null];

    // 3. Thông báo cho Client
    this.game.server.broadcast({
      type: PacketType.PLAYER_DIED,
      victimId: player.id,
      killerId: killerId,
      killerName: killerName || 'Unknown',
      score: player.score,
      coins: player.coins,
      kills: player.sessionKills
    });

    // 4. Xóa Bot hoặc Lưu điểm người chơi
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