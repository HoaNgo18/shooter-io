// server/src/utils/SpawnValidator.js
import { MAP_SIZE, FOOD_RADIUS, CHEST_RADIUS, ITEM_RADIUS, STATION_STATS } from '../../../shared/src/constants.js';
import { distance } from '../../../shared/src/utils.js';

/**
 * Utility class để validate vị trí spawn, tránh objects spawn trùng nhau
 * Obstacles được phép overlap nên không check
 */
export class SpawnValidator {
    constructor(worldManager) {
        this.world = worldManager;
    }

    /**
     * Lấy random position trong map
     * @param {number} margin - Khoảng cách tối thiểu với edge
     * @returns {{x: number, y: number}}
     */
    getRandomPosition(margin = 100) {
        const limit = MAP_SIZE / 2 - margin;
        return {
            x: (Math.random() * limit * 2) - limit,
            y: (Math.random() * limit * 2) - limit
        };
    }

    /**
     * Tìm vị trí spawn hợp lệ không trùng với các object khác
     * @param {number} objectRadius - Bán kính của object cần spawn
     * @param {number} minDistance - Khoảng cách tối thiểu với các object khác
     * @param {number} maxAttempts - Số lần thử tìm vị trí
     * @param {number} margin - Khoảng cách với edge của map
     * @returns {{x: number, y: number}}
     */
    findValidPosition(objectRadius, minDistance = 50, maxAttempts = 15, margin = 100) {
        for (let i = 0; i < maxAttempts; i++) {
            const pos = this.getRandomPosition(margin);
            if (this.isValidPosition(pos.x, pos.y, objectRadius, minDistance)) {
                return pos;
            }
        }
        // Fallback: trả về random position nếu không tìm được vị trí hợp lệ
        return this.getRandomPosition(margin);
    }

    /**
     * Kiểm tra vị trí có hợp lệ không (không trùng với các object khác)
     * @param {number} x 
     * @param {number} y 
     * @param {number} radius - Bán kính của object
     * @param {number} minDistance - Khoảng cách tối thiểu
     * @param {boolean} checkObstacles - Có check obstacles không (default: true cho stations/chests)
     * @returns {boolean}
     */
    isValidPosition(x, y, radius, minDistance = 50, checkObstacles = true) {
        const checkDistance = radius + minDistance;

        // Check vs Chests (includes stations)
        for (const chest of this.world.chests) {
            const chestRadius = chest.type === 'STATION'
                ? Math.max(STATION_STATS.width, STATION_STATS.height) / 2
                : CHEST_RADIUS;
            if (distance(x, y, chest.x, chest.y) < checkDistance + chestRadius) {
                return false;
            }
        }

        // Check vs Items
        for (const item of this.world.items) {
            if (distance(x, y, item.x, item.y) < checkDistance + ITEM_RADIUS) {
                return false;
            }
        }

        // Check vs Foods (chỉ check ở gần để tiết kiệm performance)
        const foodCheckThreshold = checkDistance + FOOD_RADIUS + 20;
        for (const food of this.world.foods) {
            if (distance(x, y, food.x, food.y) < foodCheckThreshold) {
                if (distance(x, y, food.x, food.y) < checkDistance + FOOD_RADIUS) {
                    return false;
                }
            }
        }

        // Check vs Obstacles - cho stations và chests để không spawn trên thiên thạch
        if (checkObstacles && this.world.obstacles) {
            for (const obs of this.world.obstacles) {
                if (distance(x, y, obs.x, obs.y) < checkDistance + obs.radius) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Tìm vị trí cho food (với minDistance nhỏ hơn vì food nhỏ)
     * @returns {{x: number, y: number}}
     */
    findFoodPosition() {
        return this.findValidPosition(FOOD_RADIUS, 15, 10, 50);
    }

    /**
     * Tìm vị trí cho chest
     * @returns {{x: number, y: number}}
     */
    findChestPosition() {
        return this.findValidPosition(CHEST_RADIUS, 40, 15, 100);
    }

    /**
     * Tìm vị trí cho station (to hơn chest)
     * @returns {{x: number, y: number}}
     */
    findStationPosition() {
        return this.findValidPosition(Math.max(STATION_STATS.width, STATION_STATS.height) / 2, 80, 20, 200);
    }

    /**
     * Tìm vị trí cho nebula
     * @param {number} nebulaRadius 
     * @returns {{x: number, y: number}}
     */
    findNebulaPosition(nebulaRadius) {
        return this.findValidPosition(nebulaRadius, 100, 10, nebulaRadius + 50);
    }
}
