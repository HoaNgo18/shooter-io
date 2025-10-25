// server/src/services/SkinService.js
import { User } from '../db/models/User.model.js';
import { SKINS } from '../../../shared/src/constants.js';

/**
 * Service xử lý skin: mua, trang bị, lấy thông tin user
 */
export class SkinService {
    /**
     * Mua skin cho user
     * @param {string} userId - User ID
     * @param {string} skinId - Skin ID cần mua
     * @returns {Promise<{success: boolean, coins?: number, skins?: string[], error?: string}>}
     */
    static async buySkin(userId, skinId) {
        if (!userId) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const user = await User.findById(userId);
            const skinInfo = SKINS.find(s => s.id === skinId);

            if (!user || !skinInfo) {
                return { success: false, error: 'User or skin not found' };
            }

            if (user.skins.includes(skinId)) {
                return { success: false, error: 'Already owned' };
            }

            if (user.coins < skinInfo.price) {
                return { success: false, error: 'Not enough coins' };
            }

            user.coins -= skinInfo.price;
            user.skins.push(skinId);
            await user.save();

            return {
                success: true,
                coins: user.coins,
                skins: user.skins
            };
        } catch (err) {
            console.error('Error buying skin:', err);
            return { success: false, error: 'Server error' };
        }
    }

    /**
     * Trang bị skin cho user
     * @param {string} userId - User ID
     * @param {string} skinId - Skin ID cần trang bị
     * @returns {Promise<{success: boolean, equippedSkin?: string, error?: string}>}
     */
    static async equipSkin(userId, skinId) {
        if (!userId) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const user = await User.findById(userId);

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            if (!user.skins.includes(skinId)) {
                return { success: false, error: 'Skin not owned' };
            }

            user.equippedSkin = skinId;
            await user.save();

            return {
                success: true,
                equippedSkin: user.equippedSkin
            };
        } catch (err) {
            console.error('Error equipping skin:', err);
            return { success: false, error: 'Server error' };
        }
    }

    /**
     * Lấy full user profile
     * @param {string} userId - User ID
     * @returns {Promise<object|null>}
     */
    static async getUserProfile(userId) {
        if (!userId) return null;

        try {
            const user = await User.findById(userId);
            if (!user) return null;

            return {
                username: user.username,
                displayName: user.displayName,
                coins: user.coins,
                highScore: user.highScore,
                totalKills: user.totalKills,
                totalDeaths: user.totalDeaths,
                skins: user.skins,
                equippedSkin: user.equippedSkin,
                arenaWins: user.arenaWins,
                arenaTop2: user.arenaTop2,
                arenaTop3: user.arenaTop3
            };
        } catch (err) {
            console.error('Error getting user profile:', err);
            return null;
        }
    }
}
