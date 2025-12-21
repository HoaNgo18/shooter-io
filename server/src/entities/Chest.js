import { CHEST_RADIUS, CHEST_HP, CHEST_TYPES, STATION_STATS } from '../../../shared/src/constants.js';
export class Chest {
  constructor(x, y, id, type = CHEST_TYPES.NORMAL) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.type = type;
    this.dead = false;

    // Logic set stats
    if (type === CHEST_TYPES.STATION) {
      // Station dùng hình chữ nhật
      this.width = STATION_STATS.width;
      this.height = STATION_STATS.height;

      this.radius = Math.sqrt(this.width**2 + this.height**2) / 2; // Đường chéo / 2

      this.health = STATION_STATS.hp;
      this.maxHealth = STATION_STATS.hp;

      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 15);
    } else {
      // Chest thường dùng hình tròn
      this.radius = CHEST_RADIUS;
      this.width = CHEST_RADIUS * 2;
      this.height = CHEST_RADIUS * 2;

      this.health = CHEST_HP;
      this.maxHealth = CHEST_HP;
    }
  }

  update(dt) {
    if (this.type === CHEST_TYPES.STATION) {
      this.rotation += this.rotationSpeed * dt;
      while (this.rotation > Math.PI) this.rotation -= 2 * Math.PI;
      while (this.rotation < -Math.PI) this.rotation += 2 * Math.PI;
    }
  }

  takeDamage(amount) {
    this.health -= 1;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }
}