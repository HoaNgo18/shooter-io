import { PacketType } from '../../../../shared/src/packetTypes.js';
import { Bot } from '../../entities/Bot.js';

export class BotManager {
  constructor(game) {
    this.game = game; // Cần tham chiếu ngược lại game để truy cập players Map
    this.lastSpawnTime = 0;
    this.spawnInterval = 5000;
  }

  update(dt) {
    const now = Date.now();
    if (now - this.lastSpawnTime > this.spawnInterval) {
      this.manageBots();
      this.lastSpawnTime = now;
    }

    // Logic suy nghĩ cho bot
    this.game.players.forEach(player => {
      if (!player.dead && player instanceof Bot) {
        player.think(this.game);
      }
    });
  }

  manageBots() {
    let realPlayerCount = 0;
    let botCount = 0;

    this.game.players.forEach(p => {
      if (p.isBot) botCount++;
      else realPlayerCount++;
    });

    const targetBotCount = realPlayerCount < 3 ? 5 : 2;

    if (botCount < targetBotCount) {
      const botId = `bot_${Date.now()}_${Math.random()}`;

      // Bot class sẽ tự động chọn skin từ danh sách bot_black/blue/green/red
      const bot = new Bot(botId);

      // Thêm trực tiếp vào map players của Game
      this.game.players.set(botId, bot);

      this.game.server.broadcast({
        type: PacketType.PLAYER_JOIN,
        player: bot.serialize()
      });
    }
  }
}