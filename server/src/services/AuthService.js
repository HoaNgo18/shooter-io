// server/src/services/AuthService.js
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { User } from '../db/models/User.model.js';

/**
 * Service xử lý xác thực và user data
 */
export class AuthService {
    /**
     * Xác thực token và trả về user info
     * @param {string} token - JWT token
     * @returns {Promise<{userId: string, user: object}|null>}
     */
    static async verifyToken(token) {
        if (!token) return null;

        try {
            const decoded = jwt.verify(token, config.JWT_SECRET);
            const user = await User.findById(decoded.id);

            if (!user) return null;

            return {
                userId: decoded.id,
                user
            };
        } catch (err) {
            return null;
        }
    }

    /**
     * Lấy thông tin player từ token hoặc packet
     * @param {string} token - JWT token (optional)
     * @param {object} packet - Packet data với name, skinId
     * @returns {Promise<{name: string, userId: string|null, skinId: string, user: object|null}>}
     */
    static async getPlayerInfo(token, packet) {
        let playerName = packet.name || 'Anonymous';
        let userId = null;
        let userSkin = packet.skinId || 'default';
        let user = null;

        if (token) {
            const authResult = await this.verifyToken(token);
            if (authResult) {
                userId = authResult.userId;
                user = authResult.user;
                playerName = user.displayName || user.username;
                userSkin = user.equippedSkin || 'default';
            }
        }

        return { name: playerName, userId, skinId: userSkin, user };
    }

    /**
     * Tạo USER_DATA_UPDATE packet
     * @param {object} user - User document
     * @param {boolean} full - Include all fields
     * @returns {object}
     */
    static createUserDataPacket(user, full = false) {
        const packet = {
            type: 'USER_DATA_UPDATE',
            coins: user.coins,
            skins: user.skins,
            equippedSkin: user.equippedSkin
        };

        if (full) {
            packet.username = user.username;
            packet.displayName = user.displayName;
            packet.highScore = user.highScore;
            packet.totalKills = user.totalKills;
            packet.totalDeaths = user.totalDeaths;
            packet.arenaWins = user.arenaWins;
            packet.arenaTop2 = user.arenaTop2;
            packet.arenaTop3 = user.arenaTop3;
        } else {
            packet.highScore = user.highScore;
            packet.totalKills = user.totalKills;
            packet.totalDeaths = user.totalDeaths;
        }

        return packet;
    }
}
