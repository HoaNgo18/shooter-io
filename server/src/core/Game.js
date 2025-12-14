import { TICK_RATE, MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN, OBSTACLE_RADIUS_MAX } from '../../../shared/src/constants.js'; // Gom import lại cho gọn
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Player } from '../entities/Player.js';
import { Physics } from './Physics.js';

export class Game {
  constructor(server) {
    this.server = server;
    this.players = new Map();
    this.projectiles = [];
    this.physics = new Physics(this);
    this.tickInterval = null;
    this.lastTick = Date.now();
    
    // Quản lý thức ăn
    this.foods = []; 
    this.initFood();

    this.obstacles = []; // 🟢 Mảng chứa chướng ngại vật
    this.initObstacles(); // Gọi hàm tạo
  }

  start() {
    const tickDelay = 1000 / TICK_RATE;
    this.tickInterval = setInterval(() => this.tick(), tickDelay);
    console.log(`Game loop started at ${TICK_RATE} ticks/sec`);
  }

  initFood() {
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.foods.push(this.generateRandomFood());
    }
  }

  // 🟢 HÀM MỚI: Tạo đá ngẫu nhiên
  initObstacles() {
    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const radius = Math.floor(Math.random() * (OBSTACLE_RADIUS_MAX - OBSTACLE_RADIUS_MIN + 1)) + OBSTACLE_RADIUS_MIN;
      const max = MAP_SIZE / 2 - radius;
      this.obstacles.push({
        id: `obs_${i}`,
        x: (Math.random() * MAP_SIZE) - max,
        y: (Math.random() * MAP_SIZE) - max,
        radius: radius
      });
    }
  }

  generateRandomFood() {
    // Random vị trí trong map
    const max = MAP_SIZE / 2;
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: (Math.random() * MAP_SIZE) - max,
      y: (Math.random() * MAP_SIZE) - max,
      type: Math.floor(Math.random() * 3) // 0: Đỏ, 1: Xanh, 2: Lam
    };
  }

  tick() {
    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    // 🟢 SỬA LỖI LAG: Giới hạn dt tối đa (chống nhảy cóc khi lag)
    if (dt > 0.05) {
        dt = 0.05;
    }

    // 🔴 BỎ ĐOẠN CODE UPDATE CŨ Ở ĐÂY ĐI (để tránh update 2 lần)

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);
      
      if (proj.shouldRemove()) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update players (Chỉ người sống)
    this.players.forEach(player => {
        if (!player.dead) { 
            player.update(dt);
        }
    });

    // Check collisions
    this.physics.checkCollisions();

    // 🟢 SỬA LOGIC FOOD: Chỉ thêm mới nếu thiếu (Logic cũ của bạn đúng rồi)
    if (this.foods.length < FOOD_COUNT) {
       this.foods.push(this.generateRandomFood());
    }

    // Send state updates to all clients
    this.sendStateUpdate();
  }

  addPlayer(clientId, name) {
    const player = new Player(clientId, name);
    this.players.set(clientId, player);

    // Send init packet to new player
    this.server.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      foods: this.foods, // 🟢 Gửi luôn food hiện có cho người mới vào
      obstacles: this.obstacles // 🟢 Gửi chướng ngại vật cho client
    });

    this.server.broadcast({
      type: PacketType.PLAYER_JOIN,
      player: player.serialize()
    }, clientId);

    console.log(`Player joined: ${name} (${clientId})`);
  }

  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (player) {
      this.players.delete(clientId);
      console.log(`Player removed: ${player.name}`);
    }
  }

  handleInput(clientId, inputData) {
    const player = this.players.get(clientId);
    // 🟢 THÊM CHECK: Chỉ xử lý input nếu còn sống
    if (player && !player.dead) {
      player.setInput(inputData);
    }
  }

  handleAttack(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
        const newProjectiles = player.attack(); // Nhận về mảng hoặc null
        
        if (newProjectiles) {
            // Đẩy tất cả đạn mới vào danh sách chung
            this.projectiles.push(...newProjectiles);
        }
    }
}
  respawnPlayer(clientId) {
    const player = this.players.get(clientId);
    if (player && player.dead) {
        player.dead = false;
        player.respawn(); 
        // Logic báo hồi sinh sẽ nằm trong gói tin UPDATE tiếp theo (dead = false)
    }
  }

  sendStateUpdate() {
    const state = {
      type: PacketType.UPDATE,
      t: Date.now(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      projectiles: this.projectiles.map(p => p.serialize()),
      foods: this.foods // 🟢 QUAN TRỌNG: Phải gửi mảng food về client mới vẽ được
    };

    this.server.broadcast(state);
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(p => ({ name: p.name, score: p.score }));
  }
}