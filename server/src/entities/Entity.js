export class Entity {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  serialize() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y)
    };
  }
}