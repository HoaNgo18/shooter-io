// server/src/arena/ArenaInputHandler.js

/**
 * Handles player input for Arena mode
 */
export class ArenaInputHandler {
    /**
     * Handle movement input
     * @param {ArenaRoom} room
     * @param {string} clientId
     * @param {Object} inputData
     */
    static handleInput(room, clientId, inputData) {
        const player = room.playerManager.getPlayer(clientId);
        if (player && !player.dead) {
            player.setInput(inputData);
        }
    }

    /**
     * Handle attack action
     * @param {ArenaRoom} room
     * @param {string} clientId
     */
    static handleAttack(room, clientId) {
        const player = room.playerManager.getPlayer(clientId);
        if (player && !player.dead) {
            const newProjectiles = player.attack();
            if (newProjectiles) {
                room.projectiles.push(...newProjectiles);
            }
        }
    }

    /**
     * Handle dash action
     * @param {ArenaRoom} room
     * @param {string} clientId
     */
    static handleDash(room, clientId) {
        const player = room.playerManager.getPlayer(clientId);
        if (player && typeof player.performDash === 'function') {
            player.performDash();
        }
    }

    /**
     * Handle inventory slot selection
     * @param {ArenaRoom} room
     * @param {string} clientId
     * @param {number} slotIndex
     */
    static handleSelectSlot(room, clientId, slotIndex) {
        const player = room.playerManager.getPlayer(clientId);
        if (player && !player.dead && slotIndex >= 0 && slotIndex <= 4) {
            player.selectedSlot = slotIndex;
        }
    }

    /**
     * Handle use item action
     * @param {ArenaRoom} room
     * @param {string} clientId
     */
    static handleUseItem(room, clientId) {
        const player = room.playerManager.getPlayer(clientId);
        if (player && !player.dead) {
            player.activateCurrentItem(room);
        }
    }
}
