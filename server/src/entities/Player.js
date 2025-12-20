// server/src/entities/Player.js - SPACE SHIP VERSION
import { Entity } from './Entity.js';
import {
  PLAYER_MAX_HEALTH, MAP_SIZE, PLAYER_RADIUS,
  REGEN_DELAY, REGEN_RATE, DASH_DURATION, DASH_COOLDOWN,
  WEAPON_STATS, ITEM_TYPES,
  SHIP_MAX_SPEED, SHIP_ACCELERATION, SHIP_DECELERATION, SHIP_ROTATION_SPEED, SHIP_BRAKE_FORCE, DASH_BOOST
} from '../../../shared/src/constants.js';
import { getRandomPosition } from '../../../shared/src/utils.js';
import { Projectile } from './Projectile.js';

export class Player extends Entity {
  constructor(id, name, userId = null, skinId = 'default') {
    const pos = getRandomPosition(MAP_SIZE);
    super(pos.x, pos.y);

    this.id = id;
    this.name = name;
    this.health = PLAYER_MAX_HEALTH;
    this.maxHealth = PLAYER_MAX_HEALTH;
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

    // DASH
    if (this.input.space && Date.now() > this.dashCooldownTime) {
      this.vx += Math.cos(this.angle) * this.dashBoost * dt;
      this.vy += Math.sin(this.angle) * this.dashBoost * dt;
      this.dashEndTime = Date.now() + DASH_DURATION;
      this.dashCooldownTime = Date.now() + DASH_COOLDOWN;
    }

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
      // Offset để angle=0 hướng lên thay vì phải
      const thrustAngle = this.angle - Math.PI / 2;
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
    this.regenerate(dt);
    this.clampToMap();
  }

  attack() {
    const now = Date.now();
    const stats = WEAPON_STATS[this.weapon] || WEAPON_STATS.BLUE;

    if (now - this.lastAttack < stats.cooldown) return null;
    if (stats.requireStill && this.isMoving) return null;

    this.lastAttack = now;

    // Tính góc bắn (hướng lên = angle - 90°)
    const finalAngle = (this.angle - Math.PI / 2);

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

  // Giữ nguyên các method còn lại...
  checkLevelUp() {
    const scaleFactor = 1 + (this.score / 1000);
    this.radius = PLAYER_RADIUS * scaleFactor;
    if (this.radius > PLAYER_RADIUS * 1.5) this.radius = PLAYER_RADIUS * 1.5;
  }

  applyItem(type) {
    switch (type) {
      case ITEM_TYPES.HEALTH_PACK:
        this.health = Math.min(this.health + this.maxHealth * 0.5, this.maxHealth);
        break;
      case ITEM_TYPES.SHIELD: this.shieldEndTime = Date.now() + 5000; break;
      case ITEM_TYPES.SPEED: this.speedBuffEndTime = Date.now() + 5000; break;
      case ITEM_TYPES.WEAPON_RED:
        this.weapon = 'RED';
        break;
      case ITEM_TYPES.WEAPON_GREEN:
        this.weapon = 'GREEN';
        break;
      case ITEM_TYPES.WEAPON_BLUE:
        this.weapon = 'BLUE';
        break;
      case 'COIN_SMALL': this.coins += 1; break;
      case 'COIN_MEDIUM': this.coins += 2; break;
      case 'COIN_LARGE': this.coins += 5; break;
    }
  }

  takeDamage(amount, attackerId) {
    if (Date.now() < this.shieldEndTime) return;
    this.health -= amount;
    this.lastDamageTime = Date.now();
    if (this.health < 0) this.health = 0;
  }

  isDead() { return this.health <= 0; }
  hasMovementInput() { return this.input.up || this.input.down || this.input.left || this.input.right; }

  respawn(skinId = null) {
    const pos = getRandomPosition(MAP_SIZE);
    this.x = pos.x;
    this.y = pos.y;
    this.vx = 0;
    this.vy = 0;
    this.health = PLAYER_MAX_HEALTH;
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

  regenerate(dt) {
    if (this.health >= this.maxHealth) return;
    if (Date.now() - this.lastDamageTime > REGEN_DELAY) {
      this.health += REGEN_RATE * dt;
      if (this.health > this.maxHealth) this.health = this.maxHealth;
    }
  }

  serialize() {
    return {
      id: this.id, name: this.name,
      x: Math.round(this.x), y: Math.round(this.y),
      vx: Math.round(this.vx), vy: Math.round(this.vy),
      angle: this.angle, health: this.health, maxHealth: this.maxHealth,
      score: this.score, dead: this.dead, weapon: this.weapon,
      radius: this.radius, coins: this.coins,
      hasShield: Date.now() < this.shieldEndTime,
      isSpeedUp: Date.now() < this.speedBuffEndTime,
      isMoving: this.isMoving, isBoosting: this.isBoosting,
      skinId: this.skinId, hi: this.isHidden
    };
  }
}