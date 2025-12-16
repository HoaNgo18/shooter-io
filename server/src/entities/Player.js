import { Entity } from './Entity.js';
import {
  PLAYER_SPEED, PLAYER_MAX_HEALTH, MAP_SIZE, PLAYER_RADIUS,
  REGEN_DELAY, REGEN_RATE, DASH_DURATION, DASH_COOLDOWN, DASH_MULTIPLIER,
  WEAPON_STATS, ITEM_TYPES
} from '../../../shared/src/constants.js';
import { getRandomPosition } from '../../../shared/src/utils.js';
import { Projectile } from './Projectile.js';

export class Player extends Entity {
  constructor(id, name, userId = null) {
    const pos = getRandomPosition(MAP_SIZE);
    super(pos.x, pos.y);

    this.id = id;
    this.name = name;
    this.health = PLAYER_MAX_HEALTH;
    this.maxHealth = PLAYER_MAX_HEALTH;
    this.score = 0;
    this.weapon = 'PISTOL'; // Mặc định
    this.angle = 0;
    this.dead = false;
    this.lastDamageTime = 0;
    this.lastAttack = 0;
    this.radius = PLAYER_RADIUS;
    this.userId = userId; // Lưu trữ ID người dùng từ DB

    // Dash logic
    this.dashEndTime = 0;
    this.dashCooldownTime = 0;

    // Quản lý Buff
    this.shieldEndTime = 0;    // Thời gian hết khiên
    this.speedBuffEndTime = 0; // Thời gian hết tốc chạy

    // Tracking movement cho Sniper
    this.lastMoveTime = 0;
    this.isMoving = false;

    // Input (Đã bỏ num1, num2, num3)
    this.input = {
      up: false, down: false, left: false, right: false,
      mouseX: 0, mouseY: 0, space: false
    };
  }

  setInput(data) {
    // 1. Cập nhật các phím di chuyển 
    if (data.movement) {
      Object.assign(this.input, data.movement);
    }

    // 2. Cập nhật tọa độ chuột
    if (data.mouseX !== undefined) {
      this.input.mouseX = data.mouseX;
    }

    if (data.mouseY !== undefined) {
      this.input.mouseY = data.mouseY;
    }
  }

  update(dt) {
    if (this.dead) return;

    // 1. Xử lý Input Dash
    if (this.input.space && Date.now() > this.dashCooldownTime) {
      this.dashEndTime = Date.now() + DASH_DURATION;
      this.dashCooldownTime = Date.now() + DASH_COOLDOWN;
    }

    // 2. Tính toán tốc độ
    let currentSpeed = PLAYER_SPEED;

    // Giảm tốc do kích thước (Càng to càng chậm)
    const sizeFactor = this.radius / PLAYER_RADIUS;
    currentSpeed = currentSpeed / Math.sqrt(sizeFactor);

    // Buff Dash
    if (Date.now() < this.dashEndTime) {
      currentSpeed *= DASH_MULTIPLIER;
    }

    // Buff Speed (Item)
    if (Date.now() < this.speedBuffEndTime) {
      currentSpeed *= 2;
    }

    // 3. Di chuyển 
    let dx = 0;
    let dy = 0;
    if (this.input.up) dy -= 1;
    if (this.input.down) dy += 1;
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;

      this.x += dx * currentSpeed * dt;
      this.y += dy * currentSpeed * dt;

      // Đánh dấu đang di chuyển
      this.isMoving = true;
      this.lastMoveTime = Date.now();
    } else {
      // Đứng yên sau 100ms không nhấn phím
      if (Date.now() - this.lastMoveTime > 100) {
        this.isMoving = false;
      }
    }

    // 4. Góc quay
    this.angle = Math.atan2(this.input.mouseY - this.y, this.input.mouseX - this.x);

    // 5. Hồi phục & Giới hạn map
    this.regenerate(dt);
    this.clampToMap();
  }

  checkLevelUp() {
    const scaleFactor = 1 + (this.score / 500);
    this.radius = PLAYER_RADIUS * scaleFactor;
    if (this.radius > PLAYER_RADIUS * 3) {
      this.radius = PLAYER_RADIUS * 3;
    }
  }

  // HÀM QUAN TRỌNG: Xử lý ăn vật phẩm
  applyItem(type) {
    switch (type) {
      case ITEM_TYPES.HEALTH_PACK:
        this.health = Math.min(this.health + (this.maxHealth * 0.5), this.maxHealth);
        break;
      case ITEM_TYPES.SHIELD:
        this.shieldEndTime = Date.now() + 5000;
        break;
      case ITEM_TYPES.SPEED:
        this.speedBuffEndTime = Date.now() + 5000;
        break;
      case ITEM_TYPES.WEAPON_ROCKET:
        this.weapon = 'ROCKET';
        break;
      case ITEM_TYPES.WEAPON_SHOTGUN:
        this.weapon = 'SHOTGUN';
        break;
      case ITEM_TYPES.WEAPON_MACHINEGUN:
        this.weapon = 'MACHINEGUN';
        break;
      case ITEM_TYPES.WEAPON_SNIPER: // 
        this.weapon = 'SNIPER';
        break;
      case ITEM_TYPES.WEAPON_PISTOL: // 
        this.weapon = 'PISTOL';
        break;
    }
  }

  attack() {
    const now = Date.now();
    const stats = WEAPON_STATS[this.weapon] || WEAPON_STATS.PISTOL;

    if (now - this.lastAttack < stats.cooldown) return null;

    const isBusyMoving = this.isMoving || this.hasMovementInput();

    // KIỂM TRA SNIPER: PHẢI ĐỨNG YÊN
    if (stats.requireStill && isBusyMoving) {
      return null; // Không bắn được nếu đang di chuyển
    }

    this.lastAttack = now;

    const projectiles = [];
    const count = stats.count;
    const spread = stats.spread;

    for (let i = 0; i < count; i++) {
      let angleOffset = 0;
      if (count > 1) {
        angleOffset = -spread / 2 + (spread * i / (count - 1));
      } else {
        angleOffset = (Math.random() - 0.5) * spread;
      }

      const finalAngle = this.angle + angleOffset;

      // Tạo projectile với đầy đủ thông tin
      const p = new Projectile(
        this.x, this.y,
        finalAngle,
        stats.speed,
        stats.damage,
        this.id,
        this.name,
        this.weapon,      // Weapon type
        stats.range,      // Range
        stats.radius      // Radius
      );

      p.color = stats.color;
      projectiles.push(p);
    }
    return projectiles;
  }

  takeDamage(amount, attackerId) {
    if (Date.now() < this.shieldEndTime) return;
    this.health -= amount;
    this.lastDamageTime = Date.now();
    if (this.health < 0) this.health = 0;
  }

  isDead() {
    return this.health <= 0;
  }

  hasMovementInput() {
    return this.input.up || this.input.down || this.input.left || this.input.right;
  }

  respawn() {
    const pos = getRandomPosition(MAP_SIZE);
    this.x = pos.x;
    this.y = pos.y;
    this.health = this.maxHealth;
    this.score = Math.floor(this.score * 0.1);
    this.weapon = 'PISTOL';
    this.shieldEndTime = 0;
    this.speedBuffEndTime = 0;
    this.angle = 0;
    this.input = { up: false, down: false, left: false, right: false, mouseX: 0, mouseY: 0, space: false };
    this.dashEndTime = 0;
    this.dashCooldownTime = 0;
    this.lastAttack = 0;
    this.lastDamageTime = 0;
    this.radius = PLAYER_RADIUS;
    this.isMoving = false;
    this.lastMoveTime = 0;
  }

  clampToMap() {
    const max = MAP_SIZE / 2 - 20;
    this.x = Math.max(-max, Math.min(max, this.x));
    this.y = Math.max(-max, Math.min(max, this.y));
  }

  regenerate(dt) {
    if (this.health >= this.maxHealth) {
      this.health = this.maxHealth;
      return;
    }
    if (Date.now() - this.lastDamageTime > REGEN_DELAY) {
      this.health += REGEN_RATE * dt;
      if (this.health > this.maxHealth) {
        this.health = this.maxHealth;
      }
    }
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: this.angle,
      health: this.health,
      maxHealth: this.maxHealth,
      score: this.score,
      dead: this.dead,
      weapon: this.weapon,
      radius: this.radius,
      hasShield: Date.now() < this.shieldEndTime,
      isSpeedUp: Date.now() < this.speedBuffEndTime,
      isMoving: this.isMoving // Gửi về client để hiển thị trạng thái
    };
  }
}