// server/src/entities/Bot.js - SPACE SHIP AI WITH ZONE AVOIDANCE
import { Player } from './Player.js';
import { distance } from '../../../shared/src/utils.js';

const BOT_NAMES = [
  "Stardust", "Nebula", "Comet", "Photon",
  "Quantum", "Pulsar", "Nova", "Meteor", "Vortex", "Eclipse",
  "Wukong", "Azuki", "Bronze", "HoaThanhQue", "Shiba",
  "DKM", "OKVIP", "FB88", "XYZ"
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

    // ========================================
    // ZONE AVOIDANCE SETTINGS
    // ========================================
    this.zoneAwareness = 0.8 + Math.random() * 0.2;
    this.panicThreshold = 0.75; // 75%: Bắt đầu chú ý sớm hơn (cũ 0.8)
    this.dangerThreshold = 0.9; // 90%: Báo động đỏ (cũ 0.95)
  }

  think(game) {
    if (this.dead) return;

    // ========================================
    // PRIORITY 1: ZONE AVOIDANCE (CAO NHẤT)
    // ========================================
    const zoneStatus = this.checkZoneStatus(game);

    if (zoneStatus.inDanger) {
      this.handleZoneDanger(zoneStatus);
      return; // Ưu tiên cao nhất - bỏ qua combat
    }

    // ========================================
    // PRIORITY 2: VALIDATE TARGET
    // ========================================
    if (this.target) {
      let targetPlayer = null;

      if (game.players instanceof Map) {
        targetPlayer = game.players.get(this.target.id);
      } else if (Array.isArray(game.players)) {
        targetPlayer = game.players.find(p => p.id === this.target.id);
      }

      if (!targetPlayer || targetPlayer.dead || targetPlayer.isHidden) {
        this.target = null;
      } else {
        this.target.x = targetPlayer.x;
        this.target.y = targetPlayer.y;
        this.target.distance = distance(this.x, this.y, targetPlayer.x, targetPlayer.y);
      }
    }

    // ========================================
    // PRIORITY 3: COMBAT OR WANDER
    // ========================================
    if (!this.target) {
      this.findTarget(game);
    }

    if (this.target) {
      // Nếu có mục tiêu NHƯNG gần bo, ưu tiên tránh bo hơn
      if (zoneStatus.needsAttention) {
        this.engageTargetWithZoneAwareness(game, zoneStatus);
      } else {
        this.engageTarget(game);
      }
    } else {
      // Nếu đang lang thang, vẫn cần tránh bo
      if (zoneStatus.needsAttention) {
        this.moveTowardsSafeZone(zoneStatus);
      } else {
        this.wander();
      }
    }
  }

  // ========================================
  // ZONE AVOIDANCE LOGIC
  // ========================================

  checkZoneStatus(game) {
    // Kiểm tra xem có phải Arena không
    const zone = game.zone;

    if (!zone || zone.radius <= 0) {
      return {
        inDanger: false,
        needsAttention: false,
        distanceFromCenter: 0,
        distanceToEdge: Infinity
      };
    }

    // Tính khoảng cách từ bot đến tâm bo
    const distanceFromCenter = Math.hypot(
      this.x - zone.x,
      this.y - zone.y
    );

    // Khoảng cách đến viền bo
    const distanceToEdge = zone.radius - distanceFromCenter;

    // Tỷ lệ so với bán kính
    const edgeRatio = distanceFromCenter / zone.radius;

    return {
      zone: zone,
      distanceFromCenter: distanceFromCenter,
      distanceToEdge: distanceToEdge,
      edgeRatio: edgeRatio,
      inDanger: edgeRatio >= this.dangerThreshold, // 95%: NGUY HIỂM NGAY LẬP TỨC
      needsAttention: edgeRatio >= this.panicThreshold, // 80%: CẦN CHÚ Ý
      isOutside: distanceFromCenter > zone.radius // Đã ở ngoài bo
    };
  }

  handleZoneDanger(zoneStatus) {
    // PANIC MODE: Chạy thẳng về tâm bo
    const zone = zoneStatus.zone;

    // Tính góc về tâm bo
    const angleToCenter = Math.atan2(
      zone.y - this.y,
      zone.x - this.x
    );

    this.desiredAngle = angleToCenter;

    // Điều khiển: Xoay về hướng tâm
    let angleDiff = this.desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const angleThreshold = 0.2;

    if (Math.abs(angleDiff) > angleThreshold) {
      this.input.left = angleDiff < 0;
      this.input.right = angleDiff > 0;
    } else {
      this.input.left = false;
      this.input.right = false;
    }

    // === [FIX QUAN TRỌNG: CƠ CHẾ PHANH] ===
    // Nếu góc lệch > 1 radian (~57 độ), tức là tàu đang quay ngang hoặc quay lưng
    // -> NHẢ GA (up = false) để giảm quán tính trượt
    // -> Chỉ tăng tốc khi đầu tàu đã hướng về vùng an toàn
    if (Math.abs(angleDiff) > 1.0) {
      this.input.up = false;
    } else {
      this.input.up = true; // Chỉ tăng tốc khi hướng đã chuẩn
    }
    this.input.down = false;

    // Không bắn khi panic
    // console.log(`[Bot] ${this.name} PANIC...`);
  }

  moveTowardsSafeZone(zoneStatus) {
    // ... (Giữ nguyên phần tính toán angleToCenter và urgency ở trên) ...
    const zone = zoneStatus.zone;
    const angleToCenter = Math.atan2(zone.y - this.y, zone.x - this.x);
    const urgency = zoneStatus.edgeRatio;

    if (urgency > 0.85) {
      this.desiredAngle = angleToCenter;
    } else {
      const randomOffset = (Math.random() - 0.5) * (Math.PI / 4);
      this.desiredAngle = angleToCenter + randomOffset * (1 - urgency);
    }

    // Xoay về hướng mong muốn
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

    // === [FIX QUAN TRỌNG] ===
    // Cũng áp dụng logic nhả ga nếu góc xoay quá lớn
    if (Math.abs(angleDiff) > 1.2) {
      this.input.up = false;
    } else {
      this.input.up = true;
    }
    this.input.down = false;
  }

  engageTargetWithZoneAwareness(game, zoneStatus) {
    // Combat nhưng ưu tiên tránh bo

    const zone = zoneStatus.zone;
    const angleToCenter = Math.atan2(zone.y - this.y, zone.x - this.x);
    const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);

    // Tính góc giữa hướng đến tâm và hướng đến mục tiêu
    let angleDifference = Math.abs(angleToTarget - angleToCenter);
    if (angleDifference > Math.PI) angleDifference = Math.PI * 2 - angleDifference;

    // Nếu mục tiêu và tâm bo cùng hướng -> Tấn công bình thường
    // Nếu ngược hướng -> Ưu tiên tránh bo
    if (angleDifference < Math.PI / 3) {
      // Mục tiêu nằm về phía tâm bo - An toàn để tấn công
      this.engageTarget(game);
    } else {
      // Mục tiêu nằm xa tâm bo - Ưu tiên tránh bo
      console.log(`[Bot] ${this.name} prioritizing zone safety over combat`);
      this.moveTowardsSafeZone(zoneStatus);
    }
  }

  // ========================================
  // ORIGINAL COMBAT LOGIC (KHÔNG THAY ĐỔI)
  // ========================================

  findTarget(game) {
    let closestDist = Infinity;
    let newTarget = null;

    game.players.forEach(other => {
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

    this.desiredAngle = Math.atan2(dy, dx);

    let angleDiff = this.desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const angleThreshold = 0.1;
    if (Math.abs(angleDiff) > angleThreshold) {
      this.input.left = angleDiff < 0;
      this.input.right = angleDiff > 0;
    } else {
      this.input.left = false;
      this.input.right = false;
    }

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