import { Entity } from './Entity.js';
import { ENTITY_TYPES, MAP_SIZE } from '../../../shared/src/constants.js';

export class Projectile extends Entity {
  constructor(x, y, angle, speed, damage, ownerId) {
    super(x, y, 5); // 🟢 THÊM: Radius = 5 để Physics check va chạm
    this.type = ENTITY_TYPES.PROJECTILE;

    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed; // 🟢 SỬA: Lưu speed gốc (600), KHÔNG nhân 60 nữa
    this.damage = damage;
    this.ownerId = ownerId;
    
    this.createdAt = Date.now();
    this.hit = false;
    this.maxLifetime = 3000; // 3 giây tự hủy
    
    // ID Random
    this.id = Math.random().toString(36).substr(2, 9);
  }

  // 🟢 QUAN TRỌNG: Phải có hàm này đạn mới bay được
  update(dt) {
    const moveDist = this.speed * dt; // Tốc độ * Thời gian trôi qua

    this.x += Math.cos(this.angle) * moveDist;
    this.y += Math.sin(this.angle) * moveDist;
  }

  shouldRemove() {
    // Xóa khi trúng đích, hết thời gian, hoặc bay ra khỏi map
    return (
        this.hit || 
        (Date.now() - this.createdAt > this.maxLifetime) ||
        this.x < -MAP_SIZE/2 || this.x > MAP_SIZE/2 ||
        this.y < -MAP_SIZE/2 || this.y > MAP_SIZE/2
    );
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: this.angle
    };
  }
}