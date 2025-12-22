// server/src/entities/Player.js - SPACE SHIP VERSION
import { Entity } from './Entity.js';
import {
  PLAYER_MAX_LIVES, MAP_SIZE, PLAYER_RADIUS,
  DASH_DURATION, DASH_COOLDOWN, DASH_BOOST,
  WEAPON_STATS, ITEM_TYPES,
  SHIP_MAX_SPEED, SHIP_ACCELERATION,
  SHIP_DECELERATION, SHIP_ROTATION_SPEED, SHIP_BRAKE_FORCE,
  ITEM_CONFIG
} from '../../../shared/src/constants.js';
import { getRandomPosition } from '../../../shared/src/utils.js';
import { Projectile } from './Projectile.js';

export class Player extends Entity {
  constructor(id, name, userId = null, skinId = 'default') {
    const pos = getRandomPosition(MAP_SIZE);
    super(pos.x, pos.y);

    this.id = id;
    this.name = name;
    this.lives = PLAYER_MAX_LIVES;
    this.maxLives = PLAYER_MAX_LIVES;
    this.score = 0;
    this.weapon = 'BLUE';
    this.angle = 0;
    this.dead = true;
    this.lastDamageTime = 0;
    this.lastAttack = 0;
    this.radius = PLAYER_RADIUS;
    this.userId = userId;
    this.coins = 0;
    this.sessionKills = 0;
    this.skinId = skinId;
    this.isHidden = false;

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
    if (Date.now() < this.speedBuffEndTime) maxSpeedActual *= 1.5;

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
  }

  attack() {
    const now = Date.now();
    const stats = WEAPON_STATS[this.weapon] || WEAPON_STATS.BLUE;

    if (now - this.lastAttack < stats.cooldown) return null;
    if (stats.requireStill && this.isMoving) return null;

    this.lastAttack = now;

    // Tính góc bắn dựa trên hướng sprite
    // - Player sprite (hướng LÊN): angle - 90°
    // - Bot sprite (hướng XUỐNG): angle (không cần offset)
    const finalAngle = this.spritePointsDown ? this.angle : (this.angle - Math.PI / 2);

    // Spawn đạn phía trước tàu (30 pixel về phía mũi tàu)
    const spawnDistance = 30;
    const spawnX = this.x + Math.cos(finalAngle) * spawnDistance;
    const spawnY = this.y + Math.sin(finalAngle) * spawnDistance;

    // Kế thừa vận tốc của tàu vào đạn
    const projectileSpeed = stats.speed + Math.sqrt(this.vx ** 2 + this.vy ** 2);

    const p = new Projectile(
      spawnX, spawnY, finalAngle,
      projectileSpeed, stats.damage, this.id, this.name,
      this.weapon, stats.range, 8
    );

    return [p];
  }

  // server/src/entities/Player.js

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

    // 4. Giới hạn trong bản đồ (Quan trọng: để không dịch chuyển ra ngoài map)
    // MAP_SIZE đã được import ở đầu file, mặc định là 5000
    // Trừ đi 50 đơn vị để không bị kẹt sát mép
    const maxBound = (5000 / 2) - 50;

    this.x = Math.max(-maxBound, Math.min(maxBound, targetX));
    this.y = Math.max(-maxBound, Math.min(maxBound, targetY));

    // 5. (Tùy chọn) Hãm phanh sau khi dịch chuyển
    // Giảm vận tốc hiện tại đi 50% để người chơi dễ kiểm soát sau khi blink
    this.vx *= 0.5;
    this.vy *= 0.5;

    // 6. Set thời gian hồi chiêu
    this.dashEndTime = Date.now() + DASH_DURATION;
    this.dashCooldownTime = Date.now() + DASH_COOLDOWN;

    console.log(`Player ${this.name} blinked to ${Math.round(this.x)}, ${Math.round(this.y)}`);
  }

  // Giữ nguyên các method còn lại...
  checkLevelUp() {
    const scaleFactor = 1 + (this.score / 1000);
    this.radius = PLAYER_RADIUS * scaleFactor;
    if (this.radius > PLAYER_RADIUS * 1.5) this.radius = PLAYER_RADIUS * 1.5;
  }

  // Cập nhật phương thức applyItem() 
  applyItem(type) {
    const config = ITEM_CONFIG[type];
    if (!config) return;

    const effect = config.effect;

    switch (effect.type) {
      case 'heal':
        this.lives = Math.min(this.lives + effect.value, this.maxLives);
        console.log(`${this.name} healed +${effect.value} life`);
        break;

      case 'full_heal':
        this.lives = this.maxLives;
        console.log(`${this.name} fully healed!`);
        break;

      case 'shield':
        this.shieldEndTime = Date.now() + effect.duration;
        console.log(`${this.name} activated shield for ${effect.duration}ms`);
        break;

      case 'speed':
        this.speedBuffEndTime = Date.now() + effect.duration;
        this.speedMultiplier = effect.multiplier;
        console.log(`${this.name} speed boost x${effect.multiplier}`);
        break;

      case 'dash_reset':
        this.dashCooldownTime = 0; // Reset cooldown instantly
        console.log(`${this.name} dash reset!`);
        break;

      case 'weapon':
        this.weapon = effect.weaponType;
        console.log(`${this.name} equipped ${effect.weaponType} weapon`);
        break;

      case 'coin':
        this.coins += effect.value;
        console.log(`${this.name} earned ${effect.value} coins`);
        break;

      case 'ammo_refill':
        this.lastAttack = 0; // Reset attack cooldown
        console.log(`${this.name} ammo refilled!`);
        break;
    }
  }

  takeDamage(amount, attackerId) {
    if (Date.now() < this.shieldEndTime) return;

    // Mỗi lần dính đạn mất 1 mạng
    this.lives -= 1;
    this.lastDamageTime = Date.now();

    if (this.lives < 0) this.lives = 0;
  }

  isDead() { return this.lives <= 0; }
  hasMovementInput() { return this.input.up || this.input.down || this.input.left || this.input.right; }

  respawn(skinId = null) {
    const pos = getRandomPosition(MAP_SIZE);
    this.x = pos.x;
    this.y = pos.y;
    this.vx = 0;
    this.vy = 0;
    this.lives = this.maxLives;
    this.dead = false;
    this.angle = 0;
    if (skinId) this.skinId = skinId;
    this.shieldEndTime = 0;
    this.speedBuffEndTime = 0;
    this.weapon = 'BLUE';
    this.score = 0;
    this.radius = PLAYER_RADIUS;
    this.isBoosting = false;
  }

  clampToMap() {
    const max = MAP_SIZE / 2 - 20;
    this.x = Math.max(-max, Math.min(max, this.x));
    this.y = Math.max(-max, Math.min(max, this.y));
  }

  serialize() {
    return {
      id: this.id, name: this.name,
      x: Math.round(this.x), y: Math.round(this.y),
      vx: Math.round(this.vx), vy: Math.round(this.vy),
      angle: this.angle, lives: this.lives,          // Thay health
      maxLives: this.maxLives,
      score: this.score, dead: this.dead, weapon: this.weapon,
      radius: this.radius, coins: this.coins,
      hasShield: Date.now() < this.shieldEndTime,
      isSpeedUp: Date.now() < this.speedBuffEndTime,
      isMoving: this.isMoving, isBoosting: this.isBoosting,
      skinId: this.skinId, hi: this.isHidden
    };
  }
}