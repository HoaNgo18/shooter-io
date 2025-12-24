// server/src/entities/Bot.js - SPACE SHIP AI
import { Player } from './Player.js';
import { distance } from '../../../shared/src/utils.js';

const BOT_NAMES = [
  "Stardust", "Nebula", "Comet", "Photon", 
  "Quantum", "Pulsar", "Nova", "Meteor", "Vortex", "Eclipse",
  "SunWukong", "Azuki", "Bronze", "HoaThanhQue", "Shiba"
];

const BOT_SKINS = ['bot_black', 'bot_blue', 'bot_green', 'bot_red'];

export class Bot extends Player {
  constructor(id) {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + 
                 Math.floor(Math.random() * 999);
    
    const randomSkin = BOT_SKINS[Math.floor(Math.random() * BOT_SKINS.length)];
    
    super(id, name, null, randomSkin);

    this.dead = false;
    this.isBot = true;
    this.target = null;
    
    this.accuracy = 0.3 + Math.random() * 0.4;
    this.aggression = Math.random();
    this.lastShot = 0;
    
    this.desiredAngle = 0;
    this.stateChangeTime = 0;
    this.currentState = 'WANDER'; 
    this.spritePointsDown = true;
  }

  think(game) {
    if (this.dead) return;

    // --- SỬA ĐỔI: VALIDATE TARGET (Kiểm tra lại mục tiêu hiện tại) ---
    if (this.target) {
        // Tìm đối tượng player thực tế trong danh sách players của game
        // (Giả sử game.players là Map như cấu trúc thường dùng, nếu là Array thì dùng .find)
        let targetPlayer = null;
        if (game.players instanceof Map) {
            targetPlayer = game.players.get(this.target.id);
        } else if (Array.isArray(game.players)) {
            targetPlayer = game.players.find(p => p.id === this.target.id);
        }

        // Nếu mục tiêu không còn tồn tại, đã chết, HOẶC ĐANG TÀNG HÌNH
        if (!targetPlayer || targetPlayer.dead || targetPlayer.isHidden) {
            this.target = null; // Quên mục tiêu ngay lập tức
        } else {
            // Nếu vẫn thấy, cập nhật vị trí mới nhất để bắn cho chuẩn
            this.target.x = targetPlayer.x;
            this.target.y = targetPlayer.y;
            this.target.distance = distance(this.x, this.y, targetPlayer.x, targetPlayer.y);
        }
    }
    // -------------------------------------------------------------

    // Chỉ tìm mục tiêu mới nếu hiện tại không có mục tiêu
    if (!this.target) {
      this.findTarget(game);
    }
    
    if (this.target) {
      this.engageTarget(game);
    } else {
      this.wander();
    }
  }

  findTarget(game) {
    let closestDist = Infinity;
    let newTarget = null;

    game.players.forEach(other => {
      // --- SỬA ĐỔI: Xóa dòng thừa, chỉ giữ 1 dòng check đầy đủ ---
      // Bỏ qua: Chính mình, Bot khác, Người chết, Người tàng hình
      if (other.id === this.id || other.isBot || other.dead || other.isHidden) return;

      const d = distance(this.x, this.y, other.x, other.y);
      const visionRange = 400 + (this.aggression * 200);
      
      if (d < visionRange && d < closestDist) {
        closestDist = d;
        newTarget = {
          x: other.x,
          y: other.y,
          id: other.id,
          distance: d
        };
      }
    });

    this.target = newTarget;
  }

  engageTarget(game) {
    if (!this.target) return;

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = this.target.distance;
    
    // Calculate desired angle to face target
    this.desiredAngle = Math.atan2(dy, dx);

    // Current angle difference
    let angleDiff = this.desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // === ROTATION CONTROL ===
    const angleThreshold = 0.1;
    if (Math.abs(angleDiff) > angleThreshold) {
      this.input.left = angleDiff < 0;
      this.input.right = angleDiff > 0;
    } else {
      this.input.left = false;
      this.input.right = false;
    }

    // === MOVEMENT CONTROL ===
    const optimalDist = 300; 

    if (dist > optimalDist + 50) {
      this.input.up = true;
      this.input.down = false;
    } else if (dist < optimalDist - 50) {
      this.input.up = false;
      this.input.down = true;
    } else {
      this.input.up = false;
      this.input.down = false;
    }

    // === SHOOTING ===
    const now = Date.now();
    const isAimingWell = Math.abs(angleDiff) < 0.3; 
    
    if (isAimingWell && 
        dist < 400 && 
        now - this.lastShot > 1000 && 
        Math.random() < this.accuracy) {
      
      const projectiles = this.attack();
      if (projectiles) {
        game.projectiles.push(...projectiles);
        this.lastShot = now;
      }
    }
  }

  wander() {
    const now = Date.now();
    
    if (now > this.stateChangeTime) {
      this.desiredAngle = Math.random() * Math.PI * 2 - Math.PI;
      this.stateChangeTime = now + 2000 + Math.random() * 2000;
    }

    let angleDiff = this.desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    if (Math.abs(angleDiff) > 0.1) {
      this.input.left = angleDiff < 0;
      this.input.right = angleDiff > 0;
    } else {
      this.input.left = false;
      this.input.right = false;
    }

    this.input.up = Math.random() < 0.5;
    this.input.down = false;
  }
}