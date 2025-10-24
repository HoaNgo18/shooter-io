// server/src/arena/ArenaPlayerManager.js
import { Player } from '../entities/Player.js';
import { Bot } from '../entities/Bot.js';
import { MAP_SIZE } from '../../../shared/src/constants.js';
import { PacketType } from '../../../shared/src/packetTypes.js';

/**
 * Manages players and bots in Arena room
 */
export class ArenaPlayerManager {
    constructor(room) {
        this.room = room;
        this.players = new Map();
        this.clientIds = new Set();
    }

    /**
     * Add a player to the room
     * @param {string} clientId
     * @param {string} name
     * @param {string|null} userId
     * @param {string} skinId
     * @returns {boolean}
     */
    addPlayer(clientId, name, userId = null, skinId = 'default') {
        if (!['waiting', 'countdown'].includes(this.room.status)) return false;
        if (this.players.size >= this.room.maxPlayers) return false;

        const player = new Player(clientId, name, userId, skinId);
        player.dead = false;

        this.players.set(clientId, player);
        this.clientIds.add(clientId);

        const client = this.room.server.clients.get(clientId);
        if (client) {
            client.arenaRoomId = this.room.id;
            client.player = player;
        }

        return player;
    }

    /**
     * Remove a player from the room
     * @param {string} clientId
     */
    removePlayer(clientId) {
        const player = this.players.get(clientId);
        if (!player) return null;

        this.players.delete(clientId);
        this.clientIds.delete(clientId);

        const client = this.room.server.clients.get(clientId);
        if (client) {
            client.arenaRoomId = null;
            client.player = null;
        }

        return player;
    }

    /**
     * Fill remaining slots with bots
     */
    fillWithBots() {
        const needed = this.room.maxPlayers - this.players.size;

        for (let i = 0; i < needed; i++) {
            const botId = `arena_bot_${this.room.id}_${Date.now()}_${i}`;
            const bot = new Bot(botId);

            const r = MAP_SIZE / 2;
            bot.x = (Math.random() * r * 2) - r;
            bot.y = (Math.random() * r * 2) - r;
            bot.dead = false;

            this.players.set(botId, bot);

            this.room.broadcast({
                type: PacketType.PLAYER_JOIN,
                player: bot.serialize()
            });
        }
    }

    /**
     * Get player by clientId
     * @param {string} clientId
     * @returns {Player|Bot|undefined}
     */
    getPlayer(clientId) {
        return this.players.get(clientId);
    }

    /**
     * Count of real (non-bot) players
     * @returns {number}
     */
    getRealPlayerCount() {
        return Array.from(this.players.values()).filter(p => !p.isBot).length;
    }

    /**
     * Count of bots
     * @returns {number}
     */
    getBotCount() {
        return Array.from(this.players.values()).filter(p => p.isBot).length;
    }

    /**
     * Count of alive real players
     * @returns {number}
     */
    getAlivePlayerCount() {
        return Array.from(this.players.values()).filter(p => !p.dead && !p.isBot).length;
    }

    /**
     * Count of alive bots
     * @returns {number}
     */
    getAliveBotCount() {
        return Array.from(this.players.values()).filter(p => !p.dead && p.isBot).length;
    }

    /**
     * Total alive count (players + bots)
     * @returns {number}
     */
    getTotalAliveCount() {
        return Array.from(this.players.values()).filter(p => !p.dead).length;
    }

    /**
     * Update all players
     * @param {number} dt - Delta time
     */
    updatePlayers(dt) {
        this.players.forEach(player => {
            if (!player.dead) player.update(dt);
        });
    }

    /**
     * Update bot AI
     */
    updateBots() {
        this.players.forEach(player => {
            if (!player.dead && player instanceof Bot) {
                player.think(this.room);
            }
        });
    }

    /**
     * Get all players for serialization
     * @returns {Array}
     */
    serializeAll() {
        return Array.from(this.players.values()).map(p => p.serialize());
    }

    /**
     * Get alive players for state update
     * @returns {Array}
     */
    serializeAlive() {
        const alivePlayers = [];
        this.players.forEach(p => {
            if (!p.dead || (Date.now() - (p.deathTime || 0)) < 2000) {
                alivePlayers.push(p.serialize());
            }
        });
        return alivePlayers;
    }

    /**
     * Clear all players
     */
    clear() {
        this.players.clear();
        this.clientIds.clear();
    }

    /**
     * Iterate over all players
     * @param {Function} callback
     */
    forEach(callback) {
        this.players.forEach(callback);
    }

    /**
     * Get players map size
     * @returns {number}
     */
    get size() {
        return this.players.size;
    }
}
