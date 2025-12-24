// server/src/entities/Player.js - SPACE SHIP VERSION
import { Entity } from './Entity.js';
import {
  SHIP_MAX_LIVES, MAP_SIZE, SHIP_RADIUS,
  DASH_DURATION, DASH_COOLDOWN, DASH_BOOST,
  WEAPON_STATS, ITEM_TYPES,
  SHIP_MAX_SPEED, SHIP_ACCELERATION,
  SHIP_DECELERATION, SHIP_ROTATION_SPEED, SHIP_BRAKE_FORCE,
  ITEM_CONFIG, BOMB_STATS
} from '../../../shared/src/constants.js';
import { getRandomPosition } from '../../../shared/src/utils.js';
import { Projectile } from './Projectile.js';

export class Player extends Entity {
  constructor(id, name, userId = null, skinId = 'default') {
    const pos = getRandomPosition(MAP_SIZE);
    super(pos.x, pos.y);

    this.id = id;
    this.name = name;
    // SỬA: Dùng constant thay vì số 3
    this.lives = 3;
    this.maxLives = SHIP_MAX_LIVES;
    this.score = 0;
    this.weapon = 'BLUE';
    this.weaponLevel = 1;
    this.angle = 0;
    this.dead = true;
    this.lastDamageTime = 0;
    this.lastAttack = 0;
    this.radius = SHIP_RADIUS;
    this.userId = userId;
    this.coins = 0;
    this.sessionKills = 0;
    this.skinId = skinId;
    this.isHidden = false;
    this.speedMultiplier = 1;

    this.spritePointsDown = skinId.startsWith('bot_');

    // === SPACE SHIP PHYSICS ===
    this.vx = 0;
    this.vy = 0;
    this.maxSpeed = SHIP_MAX_SPEED;
    this.acceleration = SHIP_ACCELERATION;
    this.deceleration = SHIP_DECELERATION;
    this.rotationSpeed = SHIP_ROTATION_SPEED;
    this.brakeForce = SHIP_BRAKE_FORCE;

    this.dashEndTime = 0;
    this.dashCooldownTime = 0;
    this.dashBoost = DASH_BOOST;

    this.shieldEndTime = 0;
    this.speedBuffEndTime = 0;
    this.lastMoveTime = 0;
    this.isMoving = false;
    this.isBoosting = false;

    const stats = WEAPON_STATS[this.weapon];
    this.currentAmmo = stats ? stats.maxAmmo : 3;
    this.lastAmmoRegen = Date.now();

    this.inventory = [null, null, null, null, null]; // 4 ô trống
    this.selectedSlot = 0; // Ô đang chọn (0-3)
    this.invisibleEndTime = 0; // Thời gian hết tàng hình

    this.input = {
      up: false, down: false, left: false, right: false,
      mouseX: 0, mouseY: 0, space: false
    };
  }

  setInput(data) {
    if (data.movement) Object.assign(this.input, data.movement);
    if (data.mouseX !== undefined) this.input.mouseX = data.mouseX;
    if (data.mouseY !== undefined) this.input.mouseY = data.mouseY;
  }

  update(dt) {
    if (this.dead) return;

    // ROTATION
    let rotationInput = 0;
    if (this.input.left) rotationInput -= 1;
    if (this.input.right) rotationInput += 1;
    this.angle += rotationInput * this.rotationSpeed * dt;
    while (this.angle > Math.PI) this.angle -= 2 * Math.PI;
    while (this.angle < -Math.PI) this.angle += 2 * Math.PI;

    // THRUST
    this.isBoosting = this.input.up;
    if (this.input.up) {
      // Bot sprite hướng XUỐNG, player sprite hướng LÊN
      const thrustAngle = this.spritePointsDown ? this.angle : (this.angle - Math.PI / 2);
      this.vx += Math.cos(thrustAngle) * this.acceleration * dt;
      this.vy += Math.sin(thrustAngle) * this.acceleration * dt;
    }

    // BRAKE
    if (this.input.down) {
      const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      if (speed > 0) {
        const brakeRatio = Math.min(this.brakeForce * dt / speed, 1);
        this.vx *= (1 - brakeRatio);
        this.vy *= (1 - brakeRatio);
      }
    }

    // DECELERATION
    const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (speed > 0) {
      const frictionRatio = Math.min(this.deceleration * dt / speed, 1);
      this.vx *= (1 - frictionRatio);
      this.vy *= (1 - frictionRatio);
    }

    // SPEED LIMIT
    let maxSpeedActual = this.maxSpeed;
    // Sử dụng this.speedMultiplier được set từ Item Config
    if (Date.now() < this.speedBuffEndTime) {
      maxSpeedActual *= this.speedMultiplier;
    }

    const finalSpeed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (finalSpeed > maxSpeedActual) {
      const ratio = maxSpeedActual / finalSpeed;
      this.vx *= ratio;
      this.vy *= ratio;
    }

    // MOVE
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.isMoving = Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10;
    this.clampToMap();

    // Update Ammo Regen
    this.updateAmmo();
  }

  attack() {
    const now = Date.now();
    const stats = WEAPON_STATS[this.weapon] || WEAPON_STATS.BLUE;

    if (now - this.lastAttack < stats.cooldown) return null;
    if (stats.requireStill && this.isMoving) return null;
    if (this.currentAmmo <= 0) return null;

    this.lastAttack = now;

    // Logic tính đạn hồi
    const currentMax = this.getMaxAmmo();
    if (this.currentAmmo === currentMax) {
      this.lastAmmoRegen = now;
    }

    this.currentAmmo--;

    // --- CHUẨN BỊ THÔNG SỐ CHUNG ---
    const baseAngle = this.spritePointsDown ? this.angle : (this.angle - Math.PI / 2);
    const spawnDistance = 30;
    const projectileSpeed = stats.speed + Math.sqrt(this.vx ** 2 + this.vy ** 2);
    const projectiles = [];

    // --- XỬ LÝ RIÊNG TỪNG LOẠI SÚNG ---

    if (this.weapon === 'BLUE') {
      // === BLUE: BẮN SONG SONG (PARALLEL) ===
      // Level 1: [0]
      // Level 2: [-10, 10]
      // Level 3: [-15, 0, 15]
      let offsets = [0];
      if (this.weaponLevel === 2) offsets = [-10, 10];
      if (this.weaponLevel === 3) offsets = [-15, 0, 15];

      offsets.forEach(offset => {
        // Tọa độ xuất phát cơ bản (tại nòng súng)
        let spawnX = this.x + Math.cos(baseAngle) * spawnDistance;
        let spawnY = this.y + Math.sin(baseAngle) * spawnDistance;

        // 1. Dịch chuyển NGANG (Side Offset - Để tạo song song)
        if (offset !== 0) {
          spawnX += Math.cos(baseAngle + Math.PI / 2) * offset;
          spawnY += Math.sin(baseAngle + Math.PI / 2) * offset;
        }

        // 2. Dịch chuyển DỌC (Forward Offset - Để viên giữa cao hơn)
        // Chỉ áp dụng khi Level 3 và là viên ở giữa (offset === 0)
        if (this.weaponLevel === 3 && offset === 0) {
          const forwardBoost = 15; // Đẩy lên trước 15 pixel
          spawnX += Math.cos(baseAngle) * forwardBoost;
          spawnY += Math.sin(baseAngle) * forwardBoost;
        }

        projectiles.push(new Projectile(
          spawnX, spawnY, baseAngle,
          projectileSpeed, stats.damage, this.id, this.name,
          this.weapon, stats.range, 8
        ));
      });

    } else if (this.weapon === 'GREEN') {
      // === GREEN: BẮN HÌNH NÓN (CONE SPREAD) ===
      // Level 1: [0]
      // Level 2: [-5 độ, +5 độ]
      // Level 3: [-8 độ, 0, +8 độ]
      // Lưu ý: Đơn vị là Radian (0.08 rad ~ 4.5 độ) -> Spread nhỏ
      let angleOffsets = [0];
      if (this.weaponLevel === 2) angleOffsets = [-0.08, 0.08];
      if (this.weaponLevel === 3) angleOffsets = [-0.12, 0, 0.12];

      angleOffsets.forEach(angleOffset => {
        // Vị trí xuất phát giống nhau (từ nòng súng)
        const spawnX = this.x + Math.cos(baseAngle) * spawnDistance;
        const spawnY = this.y + Math.sin(baseAngle) * spawnDistance;

        // Góc bắn thay đổi (Hình nón)
        const spreadAngle = baseAngle + angleOffset;

        projectiles.push(new Projectile(
          spawnX, spawnY, spreadAngle, // Góc thay đổi
          projectileSpeed, stats.damage, this.id, this.name,
          this.weapon, stats.range, 8
        ));
      });

    } else {
      // === RED (VÀ MẶC ĐỊNH): BẮN 1 VIÊN THẲNG ===
      // Red tăng cấp chỉ tăng số lượng đạn dự trữ (Max Ammo), 
      // không thay đổi cách bắn.
      const spawnX = this.x + Math.cos(baseAngle) * spawnDistance;
      const spawnY = this.y + Math.sin(baseAngle) * spawnDistance;

      projectiles.push(new Projectile(
        spawnX, spawnY, baseAngle,
        projectileSpeed, stats.damage, this.id, this.name,
        this.weapon, stats.range, 8
      ));
    }

    return projectiles;
  }

  performDash() {
    // 1. Kiểm tra Cooldown
    if (Date.now() < this.dashCooldownTime) return;

    // 2. Tính góc Dash (Bot hướng xuống, Player hướng lên)
    const dashAngle = this.spritePointsDown ? this.angle : (this.angle - Math.PI / 2);

    // 3. --- LOGIC DỊCH CHUYỂN TỨC THỜI (BLINK) ---
    const BLINK_DISTANCE = DASH_BOOST; // Khoảng cách dịch chuyển (pixel)

    // Tính tọa độ đích đến
    let targetX = this.x + Math.cos(dashAngle) * BLINK_DISTANCE;
    let targetY = this.y + Math.sin(dashAngle) * BLINK_DISTANCE;

    // 4. Giới hạn trong bản đồ
    const maxBound = (MAP_SIZE / 2) - 50;

    this.x = Math.max(-maxBound, Math.min(maxBound, targetX));
    this.y = Math.max(-maxBound, Math.min(maxBound, targetY));

    // 5. (Tùy chọn) Hãm phanh sau khi dịch chuyển
    this.vx *= 0.5;
    this.vy *= 0.5;

    // 6. Set thời gian hồi chiêu
    this.dashEndTime = Date.now() + DASH_DURATION;
    this.dashCooldownTime = Date.now() + DASH_COOLDOWN;

    console.log(`Player ${this.name} blinked to ${Math.round(this.x)}, ${Math.round(this.y)}`);
  }

  checkLevelUp() {
    const scaleFactor = 1 + (this.score / 1000);
    // SỬA: Thay PLAYER_RADIUS bằng SHIP_RADIUS
    this.radius = SHIP_RADIUS * scaleFactor;
    if (this.radius > SHIP_RADIUS * 1.5) this.radius = SHIP_RADIUS * 1.5;
  }

  // Cập nhật phương thức applyItem() 
  applyItem(type) {
    const config = ITEM_CONFIG[type];
    if (!config) return;

    const effect = config.effect;

    // NHÓM 1: Dùng ngay lập tức (Máu, Xu, Súng, Đạn)
    // Lưu ý: Đảm bảo kiểm tra đúng string type trong ITEM_CONFIG
    if (['heal', 'coin', 'weapon', 'ammo_refill'].includes(effect.type)) {

      switch (effect.type) {
        case 'heal':
          this.lives = Math.min(this.lives + effect.value, this.maxLives);
          console.log(`${this.name} healed +${effect.value}`);
          break;

        case 'coin':
          this.coins += effect.value;
          console.log(`${this.name} got ${effect.value} coins`);
          break; // <-- Coin xử lý xong ở đây

        case 'weapon':
          // Logic đổi súng (giữ nguyên code cũ của bạn)
          if (this.weapon === effect.weaponType) {
            this.weaponLevel = Math.min(this.weaponLevel + 1, 3);
          } else {
            this.weapon = effect.weaponType;
            this.weaponLevel = 1;
          }
          this.currentAmmo = this.getMaxAmmo();
          this.lastAmmoRegen = Date.now();
          break;
      }

      // QUAN TRỌNG: Phải return ngay để không chạy xuống dòng addToInventory bên dưới
      return;
    }

    // NHÓM 2: Nhặt vào túi đồ (Shield, Speed, Invisible, Bomb...)
    this.addToInventory(type);
  }

  takeDamage(amount, attackerId) {
    if (Date.now() < this.shieldEndTime) return;

    // Mỗi lần dính đạn mất 1 mạng
    this.lives -= amount;
    this.lastDamageTime = Date.now();

    if (this.lives < 0) this.lives = 0;
  }

  getMaxAmmo() {
    const stats = WEAPON_STATS[this.weapon];
    if (!stats) return 0;

    // Nếu là Đạn Đỏ: Level 1 = Gốc, Level 2 = +1 viên, Level 3 = +2 viên
    if (this.weapon === 'RED') {
      return stats.maxAmmo + (this.weaponLevel - 1);
    }

    // Các súng khác giữ nguyên maxAmmo mặc định
    return stats.maxAmmo;
  }

  updateAmmo() {
    const stats = WEAPON_STATS[this.weapon];
    if (!stats) return;

    // SỬA: Dùng this.getMaxAmmo() thay vì stats.maxAmmo cố định
    const currentMax = this.getMaxAmmo();

    // TRƯỜNG HỢP 1: Đạn đã đầy
    if (this.currentAmmo >= currentMax) {
      this.currentAmmo = currentMax;
      this.lastAmmoRegen = Date.now();
      return;
    }

    // TRƯỜNG HỢP 2: Đang thiếu đạn -> Tính toán hồi
    const now = Date.now();
    if (now - this.lastAmmoRegen >= stats.regenTime) {
      this.currentAmmo++;
      this.lastAmmoRegen += stats.regenTime;

      if (this.lastAmmoRegen < now - stats.regenTime) {
        this.lastAmmoRegen = now;
      }
      // console.log(`${this.name} recovered 1 ammo.`);
    }
  }

  isDead() { return this.lives <= 0; }
  hasMovementInput() { return this.input.up || this.input.down || this.input.left || this.input.right; }

  respawn(skinId = null) {
    const pos = getRandomPosition(MAP_SIZE);
    this.x = pos.x;
    this.y = pos.y;
    this.vx = 0;
    this.vy = 0;
    this.lives = 3;
    this.dead = false;
    this.angle = 0;
    if (skinId) this.skinId = skinId;
    this.shieldEndTime = 0;
    this.speedBuffEndTime = 0;

    this.score = 0;
    this.radius = SHIP_RADIUS;
    this.isBoosting = false;

    this.weapon = 'BLUE';
    this.weaponLevel = 1;
    this.currentAmmo = WEAPON_STATS.BLUE.maxAmmo; // Đạn hiện tại
    this.lastAmmoRegen = Date.now();

    this.inventory = [null, null, null, null, null];
    this.selectedSlot = 0;
  }

  clampToMap() {
    const max = MAP_SIZE / 2 - 20;
    this.x = Math.max(-max, Math.min(max, this.x));
    this.y = Math.max(-max, Math.min(max, this.y));
  }

  // Thêm method mới này vào class Player
  activateCurrentItem(game) { // Cần tham số 'game' để spawn bomb nếu cần
    if (this.dead) return;

    const itemType = this.inventory[this.selectedSlot];
    if (!itemType) return; // Ô này rỗng

    const config = ITEM_CONFIG[itemType];
    const effect = config.effect;

    console.log(`${this.name} used ${itemType}`);

    // Xử lý hiệu ứng
    switch (effect.type) {
      case 'shield':
        this.shieldEndTime = Date.now() + effect.duration;
        break;

      case 'speed':
        this.speedBuffEndTime = Date.now() + effect.duration;
        this.speedMultiplier = effect.multiplier;
        break;

      case 'invisible':
        this.invisibleEndTime = Date.now() + effect.duration;
        // Logic: Khi tàng hình, bot sẽ không nhìn thấy (sẽ update ở Bot.js sau)
        break;

      case 'plant_bomb':
        const bomb = new Projectile(
          this.x, this.y, 0, 0, // speed = 0
          effect.damage,
          this.id, this.name,
          'BOMB',
          0,
          25
        );
        // SỬA: Thời gian tồn tại đúng 1.5 giây
        bomb.maxLifetime = BOMB_STATS.LIFETIME; // Tồn tại 60s
        bomb.isTrap = true; // Đánh dấu là Bẫy
        bomb.isMine = true; // Để client vẽ kiểu khác (nếu cần)
        bomb.armingTime = Date.now() + BOMB_STATS.ARMING_TIME;

        if (game && game.projectiles) {
          game.projectiles.push(bomb);
        }
        break;
    }

    // Dùng xong thì xóa khỏi túi
    this.inventory[this.selectedSlot] = null;
  }

  // Hàm phụ trợ: Tìm ô trống đầu tiên để nhét đồ vào
  addToInventory(itemType) {
    // 1. Tìm ô trống đầu tiên
    const emptyIndex = this.inventory.findIndex(slot => slot === null);

    if (emptyIndex !== -1) {
      this.inventory[emptyIndex] = itemType;
      console.log(`${this.name} picked up ${itemType} into slot ${emptyIndex}`);
    } else {
      console.log(`${this.name} inventory full!`);
      // (Tùy chọn: Có thể thay thế ô đang chọn hoặc không làm gì)
    }
  }

  serialize() {
    return {
      id: this.id, name: this.name,
      x: Math.round(this.x), y: Math.round(this.y),
      vx: Math.round(this.vx), vy: Math.round(this.vy),
      angle: this.angle, lives: this.lives,
      maxLives: this.maxLives,
      score: this.score, dead: this.dead,
      radius: this.radius, coins: this.coins,
      hasShield: Date.now() < this.shieldEndTime,
      isSpeedUp: Date.now() < this.speedBuffEndTime,
      isMoving: this.isMoving, isBoosting: this.isBoosting,
      skinId: this.skinId, hi: this.isHidden,
      weapon: this.weapon, currentAmmo: this.currentAmmo,   // <--- Gửi thêm cái này
      maxAmmo: this.getMaxAmmo(), // Gửi max để client vẽ thanh đạn
      isInvisible: Date.now() < this.invisibleEndTime, // Báo cho client biết đang tàng hình để vẽ mờ đi
      inventory: this.inventory,      // Gửi mảng túi đồ
      selectedSlot: this.selectedSlot // Gửi ô đang chọn
    };
  }
}