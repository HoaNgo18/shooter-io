import { Entity } from './Entity.js';
import {
  PLAYER_SPEED,
  PLAYER_MAX_HEALTH,
  WEAPON_TYPES,
  MAP_SIZE,
  PLAYER_RADIUS,
  REGEN_DELAY,
  REGEN_RATE,
  DASH_DURATION, DASH_COOLDOWN, DASH_MULTIPLIER
} from '../../../shared/src/constants.js';
import { getRandomPosition } from '../../../shared/src/utils.js';
import { Projectile } from './Projectile.js';

export class Player extends Entity {
  constructor(id, name) {
    const pos = getRandomPosition(MAP_SIZE);
    super(pos.x, pos.y);

    this.id = id;
    this.name = name;
    this.health = PLAYER_MAX_HEALTH;
    this.maxHealth = PLAYER_MAX_HEALTH;
    this.score = 0;
    this.weapon = 'PISTOL';
    this.angle = 0;
    this.dead = false;
    this.lastDamageTime = 0;
    this.lastAttack = 0;
    this.radius = PLAYER_RADIUS;
    this.dashEndTime = 0;
    this.dashCooldownTime = 0;

    this.input = {
      up: false, down: false, left: false, right: false,
      mouseX: 0, mouseY: 0,
      space: false,
      num1: false, num2: false, num3: false
    };
  }

  setInput(data) {
    // 1. Cập nhật các phím di chuyển 
    if (data.movement) {
      Object.assign(this.input, data.movement);
      if (data.movement.num1) this.weapon = 'PISTOL';
      if (data.movement.num2) this.weapon = 'SHOTGUN';
      if (data.movement.num3) this.weapon = 'MACHINEGUN';
    }

    // 2. Cập nhật tọa độ chuột
    if (data.mouseX !== undefined) {
      this.input.mouseX = data.mouseX;
    }

    if (data.mouseY !== undefined) {
      this.input.mouseY = data.mouseY;
    }
  }

  update(dt) {
    if (this.dead) return;

    // 1. Xử lý Input Dash
    // Nếu bấm Space VÀ Đã hồi chiêu xong
    if (this.input.space && Date.now() > this.dashCooldownTime) {
      // Bắt đầu Dash
      this.dashEndTime = Date.now() + DASH_DURATION;
      this.dashCooldownTime = Date.now() + DASH_COOLDOWN;
    }

    // 2. Tính toán tốc độ
    let currentSpeed = PLAYER_SPEED; // Tốc độ gốc

    // Tính giảm tốc do kích thước 
    const sizeFactor = this.radius / PLAYER_RADIUS;
    currentSpeed = currentSpeed / Math.sqrt(sizeFactor);

    // Kiểm tra xem có đang trong thời gian Dash không?
    if (Date.now() < this.dashEndTime) {
      currentSpeed *= DASH_MULTIPLIER; // Tăng tốc gấp 3
    }

    //  3. Di chuyển 
    let dx = 0;
    let dy = 0;
    if (this.input.up) dy -= 1;
    if (this.input.down) dy += 1;
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;

      this.x += dx * currentSpeed * dt;
      this.y += dy * currentSpeed * dt;
    }

    this.angle = Math.atan2(this.input.mouseY - this.y, this.input.mouseX - this.x);

    this.regenerate(dt); // Hồi máu
    this.clampToMap();   // Không chạy ra khỏi map
  }

  // Hàm check level up
  checkLevelUp() {
    // Cứ 100 điểm tăng 10% kích thước
    // Scale = 1 + (Score / 1000)
    const scaleFactor = 1 + (this.score / 500);

    // Cập nhật bán kính va chạm
    this.radius = PLAYER_RADIUS * scaleFactor;

    // Giới hạn max size 
    if (this.radius > PLAYER_RADIUS * 3) {
      this.radius = PLAYER_RADIUS * 3;
    }
  }

  attack() {
    const now = Date.now();
    const weaponData = WEAPON_TYPES[this.weapon];

    if (now - this.lastAttack < weaponData.cooldown) return null;

    this.lastAttack = now;

    // LOGIC MỚI: Tạo nhiều viên đạn (cho Shotgun)
    const projectiles = [];
    const count = weaponData.count || 1;
    const spread = weaponData.spread || 0;

    for (let i = 0; i < count; i++) {
      // Tính góc lệch
      // Nếu bắn 1 viên -> góc chính giữa
      // Nếu bắn nhiều -> rải đều từ -spread/2 đến +spread/2
      let angleOffset = 0;
      if (count > 1) {
        angleOffset = -spread / 2 + (spread * i / (count - 1));
      } else {
        // Machine gun random rung tay một chút
        angleOffset = (Math.random() - 0.5) * spread;
      }

      const finalAngle = this.angle + angleOffset;

      const p = new Projectile(
        this.x, this.y,
        finalAngle,
        weaponData.projectileSpeed,
        weaponData.damage,
        this.id
      );
      projectiles.push(p);
    }

    return projectiles; // Trả về MẢNG
  }

  takeDamage(amount, attackerId) {
    this.health -= amount;

    // THÊM: Ghi lại thời điểm bị đánh
    this.lastDamageTime = Date.now();

    if (this.health < 0) this.health = 0;
  }

  isDead() {
    return this.health <= 0;
  }

  respawn() {
    const pos = getRandomPosition(MAP_SIZE);
    this.x = pos.x;
    this.y = pos.y;
    this.health = this.maxHealth;
    this.score = Math.max(0, this.score - 50);
  }

  clampToMap() {
    const max = MAP_SIZE / 2 - 20;
    this.x = Math.max(-max, Math.min(max, this.x));
    this.y = Math.max(-max, Math.min(max, this.y));
  }
  // Logic tự hồi máu
  regenerate(dt) {
    // 1. Kiểm tra xem đã đầy máu chưa? Đầy rồi thì thôi
    if (this.health >= this.maxHealth) {
      this.health = this.maxHealth;
      return;
    }

    // 2. Kiểm tra thời gian chờ (Out of combat)
    // Nếu thời gian hiện tại - lần cuối bị đánh > 3 giây
    if (Date.now() - this.lastDamageTime > REGEN_DELAY) {

      // 3. Cộng máu
      // Công thức: Tốc độ * thời gian trôi qua (để mượt ở mọi FPS)
      this.health += REGEN_RATE * dt;

      // 4. Không được vượt quá Max Health
      if (this.health > this.maxHealth) {
        this.health = this.maxHealth;
      }
    }
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: this.angle,
      health: this.health,
      maxHealth: this.maxHealth,
      score: this.score,
      dead: this.dead,
      weapon: this.weapon,
      radius: this.radius,
      dashCooldown: this.dashCooldownTime // Gửi thời gian hồi xong
    };
  }
}