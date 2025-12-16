// server/src/entities/Explosion.js

export class Explosion {
  constructor(x, y, radius, damage, ownerId, ownerName) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.ownerId = ownerId;
    this.ownerName = ownerName;
    this.createdAt = Date.now();
    this.lifetime = 200; // Tồn tại 200ms để client render
  }

  shouldRemove() {
    return Date.now() - this.createdAt > this.lifetime;
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      radius: this.radius
    };
  }
}