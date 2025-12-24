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
    this.weaponType = weaponType; // Lưu loại vũ khí
    this.range = range;            // Tầm bắn
    this.radius = radius;
    this.mine = false;        // Bán kính đạn

    this.startX = x;               // Vị trí bắt đầu
    this.startY = y;
    this.distanceTraveled = 0;     // Quãng đường đã bay

    this.createdAt = Date.now();
    this.hit = false;
    this.maxLifetime = 5000; // 5 giây tự hủy (backup)

    this.id = Math.random().toString(36).substr(2, 9);
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
    // Xóa khi: trúng đích, vượt range, hết thời gian, hoặc bay ra khỏi map
    return (
      this.hit ||
      (!this.isMine && this.distanceTraveled >= this.range) || // Kiểm tra range
      (Date.now() - this.createdAt > this.maxLifetime) ||
      this.x < -MAP_SIZE / 2 || this.x > MAP_SIZE / 2 ||
      this.y < -MAP_SIZE / 2 || this.y > MAP_SIZE / 2
    );
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: this.angle,
      radius: this.radius,          // Gửi radius về client để vẽ
      weaponType: this.weaponType,
      isMine: this.isMine  // Gửi type để client biết màu/style
    };
  }
}