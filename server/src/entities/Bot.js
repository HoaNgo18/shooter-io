// server/src/entities/Bot.js
import { Player } from './Player.js';
import { distance } from '../../../shared/src/utils.js';
import { MAP_SIZE, PLAYER_RADIUS } from '../../../shared/src/constants.js';

const BOT_NAMES = [
  "ProGamer", "NoobMaster", "Guest_99", "Hunter", 
  "KillerVN", "Dragon", "Shadow", "Ninja", "Warrior", "Phantom"
];

export class Bot extends Player {
  constructor(id) {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + 
                 Math.floor(Math.random() * 999);
    super(id, name, null);
    
    this.isBot = true;
    this.target = null;
    this.changeDirTime = 0;
    this.lastShot = 0;
    
    // 🆕 Thêm skill level (0-1)
    this.accuracy = 0.3 + Math.random() * 0.4; // 30-70% cơ hội bắn
    this.aggression = Math.random(); // 0 = nhút, 1 = hung hăng
  }

  think(game) {
    if (this.dead) return;

    // 1. Tìm mục tiêu
    this.findTarget(game);

    // 2. Di chuyển & Bắn
    if (this.target) {
      this.moveToTarget();
      this.shootAtTarget(game);
    } else {
      this.wander();
    }
  }

  findTarget(game) {
    let closestDist = Infinity;
    let newTarget = null;

    // 🆕 A. CHỈ TÌM NGƯỜI CHƠI THẬT (không tìm Bot khác)
    game.players.forEach(other => {
      // ✅ Bỏ qua chính mình & Bot khác
      if (other.id === this.id || other.isBot || other.dead) return;

      const d = distance(this.x, this.y, other.x, other.y);
      
      // Tầm nhìn phụ thuộc aggression: Bot hung hăng nhìn xa hơn
      const visionRange = 400 + (this.aggression * 200);
      
      if (d < visionRange && d < closestDist) {
        closestDist = d;
        newTarget = {
          x: other.x,
          y: other.y,
          id: other.id,
          isPlayer: true,
          distance: d
        };
      }
    });

    // B. Nếu không thấy người → Tìm food
    if (!newTarget && Math.random() < 0.3) { // 30% cơ hội tìm food
      const nearbyFoods = game.foods.slice(0, 30); // Chỉ xét 30 food gần nhất
      
      for (const food of nearbyFoods) {
        const d = distance(this.x, this.y, food.x, food.y);
        if (d < 250 && d < closestDist) {
          closestDist = d;
          newTarget = {
            x: food.x,
            y: food.y,
            isPlayer: false,
            distance: d
          };
        }
      }
    }

    this.target = newTarget;
  }

  moveToTarget() {
    if (!this.target) return;

    // Tính góc đến target
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Nếu quá gần người chơi → Lùi lại (khoảng cách an toàn 200px)
    const isTooClose = this.target.isPlayer && dist < 200;
    
    // ✅ Tính hướng di chuyển đúng cho WASD
    if (isTooClose) {
      // Lùi lại
      this.input.up = (dy > 10);
      this.input.down = (dy < -10);
      this.input.left = (dx > 10);
      this.input.right = (dx < -10);
    } else {
      // Tiến lên
      this.input.up = (dy < -10);
      this.input.down = (dy > 10);
      this.input.left = (dx < -10);
      this.input.right = (dx > 10);
    }

    // Hướng chuột về target (để bắn)
    this.input.mouseX = this.target.x;
    this.input.mouseY = this.target.y;
  }

  shootAtTarget(game) {
    if (!this.target || !this.target.isPlayer) return;

    const now = Date.now();
    const dist = this.target.distance;

    // Chỉ bắn khi:
    // 1. Trong tầm (400px)
    // 2. Đã cooldown (1s)
    // 3. Random dựa trên accuracy
    if (dist < 400 && 
        now - this.lastShot > 1000 && 
        Math.random() < this.accuracy) {
      
      const projectiles = this.attack();
      if (projectiles) {
        game.projectiles.push(...projectiles);
        this.lastShot = now;
        console.log(`🤖 Bot ${this.name} shot at distance ${Math.round(dist)}`);
      }
    }
  }

  wander() {
    const now = Date.now();
    
    // Đổi hướng mỗi 2-4 giây
    if (now > this.changeDirTime) {
      // Random hướng mới
      const randomAngle = Math.random() * Math.PI * 2;
      const moveDistance = 300;
      
      this.input.mouseX = this.x + Math.cos(randomAngle) * moveDistance;
      this.input.mouseY = this.y + Math.sin(randomAngle) * moveDistance;
      
      // Tính WASD từ góc
      const dx = this.input.mouseX - this.x;
      const dy = this.input.mouseY - this.y;
      
      this.input.up = (dy < -10);
      this.input.down = (dy > 10);
      this.input.left = (dx < -10);
      this.input.right = (dx > 10);
      
      // Next change: 2-4 giây
      this.changeDirTime = now + 2000 + Math.random() * 2000;
    }
  }
}