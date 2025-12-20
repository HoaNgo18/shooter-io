// server/src/entities/Bot.js - SPACE SHIP AI
import { Player } from './Player.js';
import { distance } from '../../../shared/src/utils.js';

const BOT_NAMES = [
  "Stardust", "Nebula", "Comet", "Photon", 
  "Quantum", "Pulsar", "Nova", "Meteor", "Vortex", "Eclipse"
];

export class Bot extends Player {
  constructor(id) {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + 
                 Math.floor(Math.random() * 999);
    super(id, name, null);

    this.dead = false;
    this.health = this.maxHealth;
    this.isBot = true;
    this.target = null;
    
    // AI params
    this.accuracy = 0.3 + Math.random() * 0.4;
    this.aggression = Math.random();
    this.lastShot = 0;
    
    // Space ship AI specific
    this.desiredAngle = 0;
    this.stateChangeTime = 0;
    this.currentState = 'WANDER'; // WANDER, CHASE, ATTACK, EVADE
  }

  think(game) {
    if (this.dead) return;

    this.findTarget(game);
    
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
      if (other.id === this.id || other.isBot || other.dead) return;

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
    const angleThreshold = 0.1; // 5 degrees tolerance
    if (Math.abs(angleDiff) > angleThreshold) {
      this.input.left = angleDiff < 0;
      this.input.right = angleDiff > 0;
    } else {
      this.input.left = false;
      this.input.right = false;
    }

    // === MOVEMENT CONTROL ===
    const optimalDist = 300; // Khoảng cách lý tưởng

    if (dist > optimalDist + 50) {
      // Too far -> thrust forward
      this.input.up = true;
      this.input.down = false;
    } else if (dist < optimalDist - 50) {
      // Too close -> brake or rotate away
      this.input.up = false;
      this.input.down = true;
    } else {
      // Good distance -> maintain
      this.input.up = false;
      this.input.down = false;
    }

    // === SHOOTING ===
    const now = Date.now();
    const isAimingWell = Math.abs(angleDiff) < 0.3; // ~17 degrees
    
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
    
    // Change direction every 2-4 seconds
    if (now > this.stateChangeTime) {
      this.desiredAngle = Math.random() * Math.PI * 2 - Math.PI;
      this.stateChangeTime = now + 2000 + Math.random() * 2000;
    }

    // Rotate towards desired angle
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

    // Thrust 50% of the time
    this.input.up = Math.random() < 0.5;
    this.input.down = false;
  }
}