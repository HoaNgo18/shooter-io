import { User } from '../db/models/User.model.js';

export const StatsService = {
  async savePlayerScore(server, player) {
    if (!player.userId) return;

    try {
      const user = await User.findById(player.userId);
      if (user) {
        user.coins += player.coins;
        if (player.score > user.highScore) user.highScore = player.score;
        user.totalDeaths += 1;

        await user.save();
        console.log(`Saved: Score=${player.score}, Earned Coins=${player.coins}`);

        server.sendToClient(player.id, {
          type: 'USER_DATA_UPDATE',
          coins: user.coins,
          highScore: user.highScore,
          totalKills: user.totalKills,
          totalDeaths: user.totalDeaths,
          skins: user.skins,
          equippedSkin: user.equippedSkin
        });
      }
    } catch (err) {
      console.error('Error saving score:', err);
    }
  },

  async saveKillerStats(server, player) {
    if (!player.userId) return;

    try {
      const user = await User.findById(player.userId);
      if (user) {
        user.totalKills = (user.totalKills || 0) + 1;
        await user.save();
        
        server.sendToClient(player.id, {
          type: 'USER_DATA_UPDATE',
          totalKills: user.totalKills
        });
      }
    } catch (err) {
      console.error('Error saving killer stats:', err);
    }
  }
};