// server/src/entities/Projectile.js
import { Entity } from './Entity.js';
import { ENTITY_TYPES, MAP_SIZE } from '../../../shared/src/constants.js';

export class Projectile extends Entity {
  constructor(x, y, angle, speed, damage, ownerId, ownerName, weaponType, range, radius) {
    super(x, y, radius);
    this.type = ENTITY_TYPES.PROJECTILE;

    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = damage;
    this.ownerId = ownerId;
    this.ownerName = ownerName;
    this.weaponType = weaponType;
    this.range = range;
    this.radius = radius;
    this.isMine = false;

    this.startX = x;
    this.startY = y;
    this.distanceTraveled = 0;

    this.createdAt = Date.now();
    this.hit = false;
    this.maxLifetime = 5000;

    // Bomb trigger state
    this.isTriggered = false;      // Đã bị kích hoạt?
    this.triggeredAt = null;       // Thời điểm trigger
    this.triggerDelay = 500;       // 0.5s delay trước khi nổ

    this.id = Math.random().toString(36).substr(2, 9);
  }

  /**
   * Trigger bomb - bắt đầu countdown 0.5s trước khi nổ
   */
  trigger() {
    if (!this.isTriggered) {
      this.isTriggered = true;
      this.triggeredAt = Date.now();
    }
  }

  /**
   * Kiểm tra bomb đã sẵn sàng nổ chưa (sau 0.5s từ khi trigger)
   */
  isReadyToExplode() {
    if (!this.isTriggered) return false;
    return Date.now() - this.triggeredAt >= this.triggerDelay;
  }

  update(dt) {
    if (!this.isMine) {
      const moveDist = this.speed * dt;
      this.x += Math.cos(this.angle) * moveDist;
      this.y += Math.sin(this.angle) * moveDist;
      this.distanceTraveled += moveDist;
    }
  }

  shouldRemove() {
    return (
      this.hit ||
      (!this.isMine && this.distanceTraveled >= this.range) ||
      (Date.now() - this.createdAt > this.maxLifetime) ||
      this.x < -MAP_SIZE / 2 || this.x > MAP_SIZE / 2 ||
      this.y < -MAP_SIZE / 2 || this.y > MAP_SIZE / 2
    );
  }

  serialize() {
    const base = {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: this.angle,
      radius: this.radius,
      weaponType: this.weaponType,
      isMine: this.isMine
    };

    // Thêm thông tin cho bomb/mine
    if (this.isMine) {
      const now = Date.now();
      base.isArmed = now > this.armingTime;
      base.isTriggered = this.isTriggered;

      // Progress calculations
      const armingDuration = this.armingTime - this.createdAt;
      base.armingProgress = Math.min(1, (now - this.createdAt) / armingDuration);

      // Trigger countdown progress (0 -> 1 trong 0.5s)
      if (this.isTriggered) {
        base.triggerProgress = Math.min(1, (now - this.triggeredAt) / this.triggerDelay);
      }
    }

    return base;
  }
}