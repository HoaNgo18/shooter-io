import { TICK_RATE, CHEST_TYPES } from '../../../shared/src/constants.js';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Player } from '../entities/Player.js';
import { Physics } from './Physics.js';

// Import các Module mới
import { WorldManager } from './WorldManager.js';
import { BotManager } from './BotManager.js';
import { StatsService } from './StatsService.js';
import { Explosion } from '../entities/Explosion.js';

export class Game {
  constructor(server) {
    this.server = server;
    this.players = new Map();
    this.projectiles = [];
    this.explosions = [];

    // Khởi tạo Managers
    this.world = new WorldManager();
    this.bots = new BotManager(this);

    // Physics nhận vào 'this' (game instance), nên trong Physics.js
    // bạn cần đổi 'this.game.foods' thành 'this.game.world.foods'
    this.physics = new Physics(this);

    this.tickInterval = null;
    this.lastTick = Date.now();
  }

  start() {
    const SIMULATION_RATE = 60; // Server vẫn tick 60 FPS
    const BROADCAST_RATE = 20;   // Nhưng chỉ gửi 20 FPS

    setInterval(() => this.tick(), 1000 / SIMULATION_RATE);
    setInterval(() => this.sendStateUpdate(), 1000 / BROADCAST_RATE);
  }

  tick() {
    // 1. Reset Delta Tracking từ World
    this.world.resetDelta();

    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt > 0.05) dt = 0.05;

    // 2. Update Projectiles
    this.updateProjectiles(dt);

    // 4. Update Players (Input + Move)
    this.players.forEach(player => {
      if (!player.dead) player.update(dt);
    });

    // 5. Update Bots (AI logic + Spawning)
    this.bots.update(dt);

    // 6. Physics Collision
    this.physics.checkCollisions();

    this.world.chests.forEach(chest => chest.update(dt));

    // 7. World Management (Spawn Food, Chests, Big Chest)
    this.world.spawnFood();
    this.world.spawnNormalChestIfNeeded();
    this.world.spawnStationIfNeeded();

    // 8. Broadcast State
    this.sendStateUpdate();
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);

      if (proj.distanceTraveled >= proj.range) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.shouldRemove()) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateExplosion() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].shouldRemove()) {
        this.explosions.splice(i, 1);
      }
    }
  }

  // --- PLAYER MANAGEMENT ---
  addPlayer(clientId, name, userId = null, skinId = 'default') {
    const player = new Player(clientId, name, userId, skinId);
    this.players.set(clientId, player);

    // Gửi INIT
    this.server.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      // Lấy dữ liệu từ World Manager
      foods: this.world.foods,
      obstacles: this.world.obstacles,
      nebulas: this.world.nebulas,
      chests: this.world.chests,
      items: this.world.items
    });

    this.server.broadcast({
      type: PacketType.PLAYER_JOIN,
      player: player.serialize()
    }, clientId);

    console.log(`Player joined: ${name} (DB_ID: ${userId})`);
  }

  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (player) {
      this.players.delete(clientId);
      this.server.broadcast({ type: PacketType.PLAYER_LEAVE, id: clientId });
      console.log(`Player/Bots removed: ${player.name}`);
    }
  }

  // --- EVENTS ---
  handleInput(clientId, inputData) {
    const player = this.players.get(clientId);
    if (player && !player.dead) player.setInput(inputData);
  }

  handleAttack(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      const newProjectiles = player.attack();
      if (newProjectiles) this.projectiles.push(...newProjectiles);
    }
  }

  handleSelectSlot(clientId, slotIndex) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      // Đảm bảo index nằm trong khoảng 0-3
      if (slotIndex >= 0 && slotIndex <= 4) {
        player.selectedSlot = slotIndex;
      }
    }
  }

  handleUseItem(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
      // Gọi hàm kích hoạt item mà ta vừa viết trong Player.js
      // Truyền 'this' (chính là Game instance) vào để có thể spawn bomb
      player.activateCurrentItem(this); 
    }
  }

  respawnPlayer(clientId, skinId) {
    const player = this.players.get(clientId);
    if (player) {
      // 1. Reset trạng thái player
      player.dead = false;
      player.respawn(skinId); // Hàm này đã có trong Player.js, xử lý reset máu, vị trí...

      // 2. QUAN TRỌNG: Gửi lại gói INIT cho chính người chơi đó để load lại Map
      // (Dữ liệu này cần thiết nếu họ vừa thoát ra menu và vào lại)
      this.server.sendToClient(clientId, {
        type: PacketType.INIT,
        id: clientId,
        player: player.serialize(),
        players: Array.from(this.players.values()).map(p => p.serialize()),
        foods: this.world.foods,       // Gửi danh sách thức ăn hiện tại
        obstacles: this.world.obstacles, // Gửi danh sách thiên thạch hiện tại
        nebulas: this.world.nebulas,
        chests: this.world.chests,
        items: this.world.items
      });

      // 3. Thông báo cho những người chơi khác biết (để cập nhật skin/vị trí mới ngay lập tức)
      this.server.broadcast({
        type: PacketType.RESPAWN,
        player: player.serialize()
      }, clientId); // Exclude clientId vì họ đã nhận thông tin qua INIT rồi

      console.log(`Player respawned: ${player.name}`);
    }
  }

  // --- STATS DELEGATION ---
  async savePlayerScore(player) {
    await StatsService.savePlayerScore(this.server, player);
  }

  async saveKillerStats(player) {
    await StatsService.saveKillerStats(this.server, player);
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);

      // Kiểm tra các điều kiện xóa đạn (Hết tầm, hết giờ, va chạm)
      const isExpired = proj.distanceTraveled >= proj.range && !proj.isMine; // Mine không tính range
      const shouldRemove = proj.shouldRemove(); // Bao gồm cả maxLifetime (1.5s)
      const isHit = proj.hit; // Set bởi Physics.js khi va chạm

      if (isExpired || shouldRemove || isHit) {
        
        // --- THÊM LOGIC: Nếu là BOM thì NỔ ---
        if (proj.weaponType === 'BOMB') {
          // Tạo vụ nổ tại vị trí quả bom
          // Explosion(x, y, radius, damage, ownerId, ownerName)
          const explosion = new Explosion(
            proj.x, 
            proj.y, 
            100, // Bán kính nổ (radius)
            proj.damage, 
            proj.ownerId, 
            proj.ownerName
          );
          this.explosions.push(explosion);
        }

        this.projectiles.splice(i, 1);
      }
    }
  }

  // --- NETWORK ---
  sendStateUpdate() {

    const state = {
      type: PacketType.UPDATE,
      t: Date.now(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      projectiles: this.projectiles.map(p => p.serialize()),
      explosions: this.explosions.map(e => e.serialize()),

      // Lấy Delta từ World Manager
      foodsAdded: this.world.delta.foodsAdded,
      foodsRemoved: this.world.delta.foodsRemoved,
      chestsAdded: this.world.delta.chestsAdded.map(c => ({
        ...c,
        rotation: c.rotation || 0
      })),

      chestsRemoved: this.world.delta.chestsRemoved,
      itemsAdded: this.world.delta.itemsAdded,
      itemsRemoved: this.world.delta.itemsRemoved,

    };

    this.server.broadcast(state);
  }
}