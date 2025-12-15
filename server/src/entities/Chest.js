export class Chest {
  constructor(x, y, id) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.radius = 25; // Hardcode hoặc lấy từ constant
    this.health = 50;
    this.dead = false;
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }
}