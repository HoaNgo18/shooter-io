import { CHEST_RADIUS, CHEST_HP } from '../../../shared/src/constants.js'; // Import hằng số cũ làm mặc định
import { CHEST_TYPES, BIG_CHEST_STATS } from '../../../shared/src/constants.js';
export class Chest {
  constructor(x, y, id, type = CHEST_TYPES.NORMAL) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.type =   type;
    this.dead = false;
    if (type === CHEST_TYPES.BIG) {
      this.radius = BIG_CHEST_STATS.radius;
      this.health = BIG_CHEST_STATS.hp;
      this.maxHealth = BIG_CHEST_STATS.hp;
    } else {
      this.radius = CHEST_RADIUS;
      this.health = CHEST_HP;
      this.maxHealth = CHEST_HP;
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }
}