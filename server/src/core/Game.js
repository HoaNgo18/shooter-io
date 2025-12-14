// server/src/core/Game.js

import { TICK_RATE, MAP_SIZE, FOOD_COUNT, OBSTACLE_COUNT, OBSTACLE_RADIUS_MIN, OBSTACLE_RADIUS_MAX } from '../../../shared/src/constants.js';
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
    
    // Quản lý thức ăn & Delta
    this.foods = []; 
    this.removedFoodIds = []; 
    this.newFoods = [];

    this.initFood();

    // Quản lý chướng ngại vật
    this.obstacles = []; 
    this.initObstacles();
  }

  start() {
    const tickDelay = 1000 / TICK_RATE;
    this.tickInterval = setInterval(() => this.tick(), tickDelay);
    console.log(`Game loop started at ${TICK_RATE} ticks/sec`);
  }

  initFood() {
    for (let i = 0; i < FOOD_COUNT; i++) {
      // Init ban đầu không cần tracking delta
      this.foods.push(this._createFoodObject());
    }
  }

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

  _createFoodObject() {
    const max = MAP_SIZE / 2;
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: (Math.random() * MAP_SIZE) - max,
      y: (Math.random() * MAP_SIZE) - max,
      type: Math.floor(Math.random() * 3)
    };
  }

  generateAndTrackFood() {
    const food = this._createFoodObject();
    this.newFoods.push(food);
    return food;
  }

  tick() {
    // 1. Reset Delta
    this.removedFoodIds = [];
    this.newFoods = [];

    const now = Date.now();
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    if (dt > 0.05) dt = 0.05;

    // 2. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);
      
      if (proj.shouldRemove()) {
        this.projectiles.splice(i, 1);
      }
    }

    // 3. Update Players
    this.players.forEach(player => {
        if (!player.dead) { 
            player.update(dt);
        }
    });

    // 4. Physics (Check va chạm)
    this.physics.checkCollisions();

    // 5. Respawn Food
    if (this.foods.length < FOOD_COUNT) {
       this.foods.push(this.generateAndTrackFood());
    }

    // 6. Send Update
    this.sendStateUpdate();
  }

  addPlayer(clientId, name) {
    const player = new Player(clientId, name);
    this.players.set(clientId, player);

    // Gửi INIT: Full foods + Obstacles
    this.server.sendToClient(clientId, {
      type: PacketType.INIT,
      id: clientId,
      player: player.serialize(),
      players: Array.from(this.players.values()).map(p => p.serialize()),
      foods: this.foods,      
      obstacles: this.obstacles 
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
    if (player && !player.dead) {
      player.setInput(inputData);
    }
  }

  handleAttack(clientId) {
    const player = this.players.get(clientId);
    if (player && !player.dead) {
        const newProjectiles = player.attack();
        if (newProjectiles) {
            this.projectiles.push(...newProjectiles);
        }
    }
  }

  respawnPlayer(clientId) {
    const player = this.players.get(clientId);
    if (player && player.dead) {
        player.dead = false;
        player.respawn(); 
    }
  }

  sendStateUpdate() {
    const state = {
      type: PacketType.UPDATE,
      t: Date.now(),
      // 🟢 QUAN TRỌNG: Gửi mảng players để HUD vẽ Leaderboard
      players: Array.from(this.players.values()).map(p => p.serialize()), 
      projectiles: this.projectiles.map(p => p.serialize()),
      foodsAdded: this.newFoods,
      foodsRemoved: this.removedFoodIds
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