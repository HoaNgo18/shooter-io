// server/src/arena/ArenaStatsHandler.js
import { User } from '../db/models/User.model.js';
import { StatsService } from '../core/managers/StatsService.js';

/**
 * Handles stats saving for Arena mode
 */
export class ArenaStatsHandler {
    /**
     * Save winner stats to database
     * @param {Player} winner - Winner player
     * @param {ArenaRoom} room - Arena room reference
     */
    static async saveWinnerStats(winner, room) {
        if (!winner.userId) return;

        try {
            const user = await User.findById(winner.userId);

            if (user) {
                user.coins += winner.score + 100;
                user.arenaWins = (user.arenaWins || 0) + 1;
                if (winner.score > user.highScore) {
                    user.highScore = winner.score;
                }
                await user.save();

                room.sendToClient(winner.id, {
                    type: 'USER_DATA_UPDATE',
                    coins: user.coins,
                    highScore: user.highScore,
                    arenaWins: user.arenaWins
                });
            }
        } catch (err) {
            console.error('[Arena] Error saving winner stats:', err);
        }
    }

    /**
     * Save player ranking to database
     * @param {Player} player - Player object
     * @param {number} rank - Final rank (1, 2, 3, etc.)
     * @param {ArenaRoom} room - Arena room reference
     */
    static async savePlayerRanking(player, rank, room) {
        if (!player.userId) return;

        try {
            const user = await User.findById(player.userId);

            if (user) {
                // Update ranking stats based on final position
                if (rank === 2) {
                    user.arenaTop2 = (user.arenaTop2 || 0) + 1;
                } else if (rank === 3) {
                    user.arenaTop3 = (user.arenaTop3 || 0) + 1;
                }

                await user.save();

                // Send update to client
                room.sendToClient(player.id, {
                    type: 'USER_DATA_UPDATE',
                    arenaTop2: user.arenaTop2,
                    arenaTop3: user.arenaTop3
                });
            }
        } catch (err) {
            console.error('[Arena] Error saving player ranking:', err);
        }
    }

    /**
     * Save player score (delegates to StatsService)
     * @param {Player} player
     * @param {Server} server
     */
    static async savePlayerScore(player, server) {
        await StatsService.savePlayerScore(server, player);
    }

    /**
     * Save killer stats (delegates to StatsService)
     * @param {Player} player
     * @param {Server} server
     */
    static async saveKillerStats(player, server) {
        await StatsService.saveKillerStats(server, player);
    }
}
