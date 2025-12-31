// server/src/arena/ArenaZoneManager.js
import { MAP_SIZE, ARENA_CONFIG } from '../../../shared/src/constants.js';

/**
 * Manages zone shrinking logic for Arena mode
 */
export class ArenaZoneManager {
    constructor(room) {
        this.room = room;
        this.zone = null;
        this.init();
    }

    /**
     * Initialize zone state
     */
    init() {
        const startRadius = MAP_SIZE / 2;
        this.zone = {
            x: 0,
            y: 0,
            radius: startRadius,
            targetX: 0,
            targetY: 0,
            targetRadius: startRadius,
            phase: 0,
            state: 'WAITING',
            nextActionTime: 0
        };
    }

    /**
     * Reset zone for new game
     */
    resetForGame() {
        const startRadius = MAP_SIZE / 2;

        this.zone.phase = 0;
        this.zone.state = 'WAITING';
        this.zone.radius = startRadius;
        this.zone.x = 0;
        this.zone.y = 0;
        this.zone.targetRadius = startRadius * ARENA_CONFIG.ZONE.RADII_PERCENT[0];

        this.calculateNextZoneTarget();

        this.zone.nextActionTime = Date.now() + (ARENA_CONFIG.ZONE.WAIT_TIME * 1000);
    }

    /**
     * Update zone each tick
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (this.zone.state === 'FINISHED') return;

        const now = Date.now();

        if (this.zone.state === 'WAITING') {
            if (now >= this.zone.nextActionTime) {
                this.startShrink();
            }
        } else if (this.zone.state === 'SHRINKING') {
            this.updateShrink(dt, now);
        }
    }

    /**
     * Start zone shrinking phase
     */
    startShrink() {
        if (this.zone.phase >= ARENA_CONFIG.ZONE.RADII_PERCENT.length) {
            this.zone.state = 'FINISHED';
            this.zone.targetRadius = 0;
            return;
        }

        this.zone.state = 'SHRINKING';
        this.zone.nextActionTime = Date.now() + (ARENA_CONFIG.ZONE.SHRINK_TIME * 1000);
    }

    /**
     * Update during shrinking state
     * @param {number} dt - Delta time
     * @param {number} now - Current timestamp
     */
    updateShrink(dt, now) {
        const timeLeft = (this.zone.nextActionTime - now) / 1000;

        if (timeLeft <= 0) {
            this.finishShrink();
        } else {
            this.interpolate(dt, timeLeft);
        }
    }

    /**
     * Finish current shrink phase
     */
    finishShrink() {
        // Snap to target
        this.zone.radius = this.zone.targetRadius;
        this.zone.x = this.zone.targetX;
        this.zone.y = this.zone.targetY;

        // Increase phase for next shrink
        this.zone.phase++;

        // Check if any phases left
        if (this.zone.phase >= ARENA_CONFIG.ZONE.RADII_PERCENT.length) {
            this.zone.state = 'FINISHED';
            return;
        }

        // Calculate target for next phase
        const BASE_RADIUS = MAP_SIZE / 2;
        const nextPercent = ARENA_CONFIG.ZONE.RADII_PERCENT[this.zone.phase];
        this.zone.targetRadius = BASE_RADIUS * nextPercent;
        this.calculateNextZoneTarget();

        // Switch to WAITING state
        this.zone.state = 'WAITING';
        this.zone.nextActionTime = Date.now() + (ARENA_CONFIG.ZONE.WAIT_TIME * 1000);
    }

    /**
     * Smoothly interpolate zone position and radius
     * @param {number} dt - Delta time
     * @param {number} timeLeft - Time left for shrink
     */
    interpolate(dt, timeLeft) {
        const factor = dt / (timeLeft + dt);
        this.zone.radius += (this.zone.targetRadius - this.zone.radius) * factor;
        this.zone.x += (this.zone.targetX - this.zone.x) * factor;
        this.zone.y += (this.zone.targetY - this.zone.y) * factor;
    }

    /**
     * Calculate random target position for next zone
     */
    calculateNextZoneTarget() {
        const currentR = this.zone.radius;
        const nextR = this.zone.targetRadius;

        if (nextR <= 0) {
            this.zone.targetX = this.zone.x;
            this.zone.targetY = this.zone.y;
            return;
        }

        const maxDistance = currentR - nextR;

        if (maxDistance <= 0) {
            this.zone.targetX = this.zone.x;
            this.zone.targetY = this.zone.y;
            return;
        }

        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * maxDistance;

        this.zone.targetX = this.zone.x + Math.cos(angle) * distance;
        this.zone.targetY = this.zone.y + Math.sin(angle) * distance;
    }

    /**
     * Check if a position is outside the zone
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {boolean}
     */
    isOutsideZone(x, y) {
        const dist = Math.hypot(x - this.zone.x, y - this.zone.y);
        return dist > this.zone.radius;
    }

    /**
     * Serialize zone data for network
     * @returns {Object}
     */
    serialize() {
        return {
            x: Math.round(this.zone.x),
            y: Math.round(this.zone.y),
            r: Math.round(this.zone.radius),
            p: this.zone.phase,
            state: this.zone.state,
            targetX: Math.round(this.zone.targetX),
            targetY: Math.round(this.zone.targetY),
            targetR: Math.round(this.zone.targetRadius)
        };
    }

    /**
     * Get current zone object
     * @returns {Object}
     */
    getZone() {
        return this.zone;
    }
}
