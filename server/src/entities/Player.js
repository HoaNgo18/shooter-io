import { Entity } from './Entity.js';
import {
  PLAYER_SPEED,
  PLAYER_MAX_HEALTH,
  MAP_SIZE,
  PLAYER_RADIUS,
  REGEN_DELAY, REGEN_RATE,
  DASH_DURATION, DASH_COOLDOWN, DASH_MULTIPLIER,
  WEAPON_STATS, ITEM_TYPES
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
    this.weapon = 'PISTOL'; // Mặc định
    this.angle = 0;
    this.dead = false;
    this.lastDamageTime = 0;
    this.lastAttack = 0;
    this.radius = PLAYER_RADIUS;
    
    // Dash logic
    this.dashEndTime = 0;
    this.dashCooldownTime = 0;

    // 🟢 Quản lý Buff
    this.shieldEndTime = 0;    // Thời gian hết khiên
    this.speedBuffEndTime = 0; // Thời gian hết tốc chạy

    // Input (Đã bỏ num1, num2, num3)
    this.input = {
      up: false, down: false, left: false, right: false,
      mouseX: 0, mouseY: 0,
      space: false
    };
  }

  setInput(data) {
    // 1. Cập nhật các phím di chuyển 
    if (data.movement) {
      Object.assign(this.input, data.movement);
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
    if (this.input.space && Date.now() > this.dashCooldownTime) {
      this.dashEndTime = Date.now() + DASH_DURATION;
      this.dashCooldownTime = Date.now() + DASH_COOLDOWN;
    }

    // 2. Tính toán tốc độ
    let currentSpeed = PLAYER_SPEED;

    // Giảm tốc do kích thước (Càng to càng chậm)
    const sizeFactor = this.radius / PLAYER_RADIUS;
    currentSpeed = currentSpeed / Math.sqrt(sizeFactor);

    // Buff Dash
    if (Date.now() < this.dashEndTime) {
      currentSpeed *= DASH_MULTIPLIER; 
    }

    // 🟢 Buff Speed (Item)
    if (Date.now() < this.speedBuffEndTime) {
      currentSpeed *= 2;
    }

    // 3. Di chuyển 
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

    // 4. Góc quay
    this.angle = Math.atan2(this.input.mouseY - this.y, this.input.mouseX - this.x);

    // 5. Hồi phục & Giới hạn map
    this.regenerate(dt); 
    this.clampToMap();   
  }

  checkLevelUp() {
    // Scale = 1 + (Score / 500)
    const scaleFactor = 1 + (this.score / 500);
    this.radius = PLAYER_RADIUS * scaleFactor;

    // Giới hạn max size 
    if (this.radius > PLAYER_RADIUS * 3) {
      this.radius = PLAYER_RADIUS * 3;
    }
  }

  // 🟢 HÀM QUAN TRỌNG: Xử lý ăn vật phẩm
  applyItem(type) {
    switch (type) {
      case ITEM_TYPES.HEALTH_PACK:
        // Hồi 50% máu tối đa
        this.health = Math.min(this.health + (this.maxHealth * 0.5), this.maxHealth);
        break;
        
      case ITEM_TYPES.SHIELD:
        // Bất tử 5s
        this.shieldEndTime = Date.now() + 5000;
        break;
        
      case ITEM_TYPES.SPEED:
        // Tăng tốc 5s
        this.speedBuffEndTime = Date.now() + 5000;
        break;
      
      // Đổi vũ khí (Pickup & Use)
      // Lưu ý: Key của WEAPON_STATS phải khớp với chuỗi gán ở đây (ROCKET, SHOTGUN...)
      case ITEM_TYPES.WEAPON_ROCKET:
        this.weapon = 'ROCKET';
        break;
      case ITEM_TYPES.WEAPON_SHOTGUN:
        this.weapon = 'SHOTGUN';
        break;
      case ITEM_TYPES.WEAPON_MACHINEGUN:
        this.weapon = 'MACHINEGUN';
        break;
      case ITEM_TYPES.WEAPON_LASER:
        this.weapon = 'LASER';
        break;
    }
  }
  
 attack() {
    const now = Date.now();
    // Lấy thông số súng dựa trên vũ khí hiện tại
    const stats = WEAPON_STATS[this.weapon] || WEAPON_STATS.PISTOL;

    if (now - this.lastAttack < stats.cooldown) return null;
    this.lastAttack = now;

    const projectiles = [];
    const count = stats.count;
    const spread = stats.spread;

    for (let i = 0; i < count; i++) {
      let angleOffset = 0;
      if (count > 1) {
        // Chia đều góc nếu bắn nhiều viên (Shotgun)
        angleOffset = -spread / 2 + (spread * i / (count - 1));
      } else {
        // Rung tay ngẫu nhiên nếu bắn 1 viên (Machinegun)
        angleOffset = (Math.random() - 0.5) * spread;
      }

      const finalAngle = this.angle + angleOffset;

      const p = new Projectile(
        this.x, this.y,
        finalAngle,
        stats.speed,  // Dùng stats của HEAD (vì biến weaponData không tồn tại ở đây)
        stats.damage, // Dùng stats của HEAD
        this.id,
        this.name     // 🟢 QUAN TRỌNG: Lấy từ nhánh FIX để hiện tên người bắn
      );
      
      // Gán màu để Client vẽ đúng màu súng
      p.color = stats.color;
      projectiles.push(p);
    }
    return projectiles;
  }

  takeDamage(amount, attackerId) {
    // Kiểm tra khiên
    if (Date.now() < this.shieldEndTime) {
      return; // Bất tử
    }

    this.health -= amount;
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

    // --- MERGE LOGIC ---

    // 1. Logic điểm số (Lấy của HEAD: trừ 50 điểm thay vì về 0)
    this.score = Math.max(0, this.score - 50); 
    
    // 2. Reset vũ khí & Buffs (Lấy của HEAD)
    this.weapon = 'PISTOL'; 
    this.shieldEndTime = 0;
    this.speedBuffEndTime = 0;

    // 3. Reset Input & Physics (Lấy của FIX - Rất quan trọng để tránh lỗi)
    this.angle = 0;
    this.input = {
      up: false, down: false, left: false, right: false,
      mouseX: 0, mouseY: 0,
      space: false,
      // Đã bỏ num1, num2, num3 vì bạn không dùng nữa
    };
    this.dashEndTime = 0;
    this.dashCooldownTime = 0;
    this.lastAttack = 0;
    this.lastDamageTime = 0;
    
    // Reset kích thước về ban đầu (FIX) - Nếu không có dòng này, hồi sinh vẫn to đùng
    this.radius = PLAYER_RADIUS;
  }

  clampToMap() {
    const max = MAP_SIZE / 2 - 20;
    this.x = Math.max(-max, Math.min(max, this.x));
    this.y = Math.max(-max, Math.min(max, this.y));
  }

  regenerate(dt) {
    if (this.health >= this.maxHealth) {
      this.health = this.maxHealth;
      return;
    }

    // Nếu không bị đánh trong 3s thì hồi máu
    if (Date.now() - this.lastDamageTime > REGEN_DELAY) {
      this.health += REGEN_RATE * dt;
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
      // Gửi trạng thái Buff về Client để vẽ hiệu ứng
      hasShield: Date.now() < this.shieldEndTime, 
      isSpeedUp: Date.now() < this.speedBuffEndTime
    };
  }
}