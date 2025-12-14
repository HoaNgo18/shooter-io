import { circleCollision } from '../../../shared/src/utils.js';
// 🟢 GOM TẤT CẢ IMPORT VÀO 1 DÒNG DUY NHẤT
import { PLAYER_RADIUS, MAP_SIZE, FOOD_RADIUS, XP_PER_FOOD } from '../../../shared/src/constants.js';
import { Quadtree } from '../utils/Quadtree.js';

export class Physics {
  constructor(game) {
    this.game = game;
  }

  checkCollisions() {
    // 1. Khởi tạo Quadtree cho frame hiện tại
    // Boundary bao trùm cả bản đồ
    const boundary = { x: 0, y: 0, width: MAP_SIZE, height: MAP_SIZE };
    const qt = new Quadtree(boundary, 4); // Capacity = 4

    // 2. Nạp tất cả Players vào Quadtree
    this.game.players.forEach(player => {
      qt.insert({
        x: player.x,
        y: player.y,
        userData: player // Lưu tham chiếu player
      });
    });

    // 3. Kiểm tra va chạm: Đạn vs Players (Dùng Quadtree)
    this.game.projectiles.forEach(proj => {
      if (proj.hit) return;

      // Tạo vùng tìm kiếm quanh viên đạn (hình chữ nhật nhỏ)
      const range = {
        x: proj.x,
        y: proj.y,
        width: PLAYER_RADIUS * 2,
        height: PLAYER_RADIUS * 2
      };

      // Hỏi Quadtree: "Có ai ở gần viên đạn này không?"
      const candidates = qt.query(range);

      // Chỉ check va chạm kỹ với những người ở gần
      for (let point of candidates) {
        const player = point.userData;

        // Bỏ qua chủ nhân viên đạn
        if (player.id === proj.ownerId) continue;

        // Check va chạm hình tròn chính xác
        if (circleCollision(player.x, player.y, PLAYER_RADIUS, proj.x, proj.y, 5)) {
          player.takeDamage(proj.damage, proj.ownerId);
          proj.hit = true;

          if (player.isDead()) {
            this.handlePlayerDeath(player, proj.ownerId);
          }
          break; // Một viên đạn chỉ trúng 1 người rồi mất
        }
      }
    });

    // 4. Player vs Player (Giữ nguyên logic đẩy nhau hoặc cũng dùng Quadtree tương tự)
    // Tạm thời giữ nguyên logic cũ cho Player vs Player vì số lượng player ít hơn đạn
    const players = Array.from(this.game.players.values());
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        this.resolvePlayerCollision(players[i], players[j]);
      }
    }
    // 🟢 THÊM: Player vs Food collision (Ăn)
    // Duyệt qua tất cả player còn sống
    this.game.players.forEach(player => {
      if (player.dead) return;

      // Logic đơn giản: Check khoảng cách với TẤT CẢ food
      // (Sau này tối ưu bằng Quadtree sau nếu lag)
      for (let i = this.game.foods.length - 1; i >= 0; i--) {
        const food = this.game.foods[i];

        // Tính khoảng cách
        const dx = player.x - food.x;
        const dy = player.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Nếu chạm vào (Lưu ý: player.radius sẽ tăng khi lên cấp)
        if (dist < (player.radius || PLAYER_RADIUS) + FOOD_RADIUS) {
          // 1. Cộng điểm
          player.score += XP_PER_FOOD;
          player.checkLevelUp(); // Hàm này sẽ viết ở bước sau

          // 2. Xóa food khỏi mảng
          this.game.foods.splice(i, 1);
        }
      }
    });

    // 🟢 1. Check Player vs Obstacles (Chặn đường)
    this.game.players.forEach(player => {
        if (player.dead) return;
        this.game.obstacles.forEach(obs => {
            const dx = player.x - obs.x;
            const dy = player.y - obs.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const minDist = (player.radius || PLAYER_RADIUS) + obs.radius;

            if (dist < minDist) {
                // Đẩy người chơi ra khỏi tảng đá (Logic đơn giản)
                const angle = Math.atan2(dy, dx);
                const pushOut = minDist - dist;
                player.x += Math.cos(angle) * pushOut;
                player.y += Math.sin(angle) * pushOut;
            }
        });
    });

    // 🟢 2. Check Projectile vs Obstacles (Chắn đạn)
    // Duyệt ngược để xóa cho an toàn
    for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
        const proj = this.game.projectiles[i];
        for (const obs of this.game.obstacles) {
            const dx = proj.x - obs.x;
            const dy = proj.y - obs.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Đạn (radius 5) chạm đá
            if (dist < 5 + obs.radius) {
                this.game.projectiles.splice(i, 1); // Xóa đạn
                break; // Thoát vòng lặp obstacle
            }
        }
    }

  }
  resolvePlayerCollision(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const minDist = PLAYER_RADIUS * 2;

    if (dist < minDist) {
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const overlap = (minDist - dist) / 2;

      p1.x -= Math.cos(angle) * overlap;
      p1.y -= Math.sin(angle) * overlap;
      p2.x += Math.cos(angle) * overlap;
      p2.y += Math.sin(angle) * overlap;
    }
  }

  handlePlayerDeath(player, killerId) {
    const killer = this.game.players.get(killerId);
    if (killer) {
      killer.score += 100;
      killer.health = Math.min(killer.health + 20, killer.maxHealth); // Thưởng máu cho kẻ giết
    }

    // 🟢 THAY ĐỔI LOGIC: Đánh dấu chết chứ không hồi sinh ngay
    player.dead = true;
    player.health = 0;

    // Đẩy player ra chỗ khác hoặc ẩn đi (tùy chọn, ở đây ta giữ nguyên vị trí xác chết)

    this.game.server.broadcast({
      type: 'player_died', // Hoặc PacketType.PLAYER_DIED
      victimId: player.id,
      killerId: killerId
    });
  }
  clampToMap(entity) {
    const max = MAP_SIZE / 2 - PLAYER_RADIUS;
    entity.x = Math.max(-max, Math.min(max, entity.x));
    entity.y = Math.max(-max, Math.min(max, entity.y));
  }
}