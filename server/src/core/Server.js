import { WebSocketServer } from 'ws';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Game } from './Game.js';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { User } from '../db/models/User.model.js';
import { SKINS } from '../../../shared/src/constants.js';
// Đảm bảo bạn đã tạo file này tại đường dẫn bên dưới
import { rateLimit } from '../utils/rateLimit.js'; 

export class Server {
  constructor(port = 3000) {
    this.wss = new WebSocketServer({ port });
    this.game = new Game(this);
    this.clients = new Map();

    console.log(`WebSocket server running on port ${port}`);
    this.setupWSS();
  }

  setupWSS() {
    // Sử dụng hàm rateLimit đã import
    const limiter = rateLimit('10s', 100, (ws) => {
      ws.close(1008, 'Rate limit exceeded');
    });

    this.wss.on('connection', (ws) => {
      limiter(ws);
      const clientId = this.generateId();
      console.log(`Client connected: ${clientId}`);

      this.clients.set(clientId, { ws, id: clientId, player: null });

      ws.on('message', async (data) => {
        try {
          const packet = JSON.parse(data.toString());
          await this.handleMessage(clientId, packet);
        } catch (err) {
          console.error('Invalid packet:', err);
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.game.removePlayer(clientId);
        this.clients.delete(clientId);
        this.broadcast({ type: PacketType.PLAYER_LEAVE, id: clientId });
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        this.game.removePlayer(clientId);
        this.clients.delete(clientId);
      });
    });
  }

  async handleMessage(clientId, packet) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (packet.type) {
      case PacketType.JOIN:
        let playerName = packet.name || 'Anonymous';
        let userId = null;
        let userSkin = packet.skinId || 'default';

        if (packet.token) {
          try {
            const decoded = jwt.verify(packet.token, config.JWT_SECRET);
            userId = decoded.id;
            client.userId = userId;

            const user = await User.findById(userId);
            if (user) {
              playerName = user.username;
              userSkin = user.equippedSkin || 'default';

              this.sendToClient(clientId, {
                type: 'USER_DATA_UPDATE',
                coins: user.coins,
                skins: user.skins,
                equippedSkin: user.equippedSkin,
                highScore: user.highScore,
                totalKills: user.totalKills,
                totalDeaths: user.totalDeaths
              });
            }
            console.log(`User ${userId} logged in via token`);
          } catch (err) {
            console.log('Invalid token, playing as guest');
          }
        }
        this.game.addPlayer(clientId, playerName, userId, userSkin);
        break;

      case PacketType.INPUT:
        this.game.handleInput(clientId, packet.data);
        break;

      case PacketType.ATTACK:
        this.game.handleAttack(clientId);
        break;

      case PacketType.PONG:
        if (client?.player) {
          client.player.lastPong = Date.now();
        }
        break;

      case PacketType.RESPAWN:
        const skinIdToUse = packet.skinId || (client.player?.skinId);
        this.game.respawnPlayer(clientId, skinIdToUse);
        break;

      case PacketType.BUY_SKIN:
        // Gọi hàm xử lý riêng, tránh duplicate code
        await this.handleBuySkin(clientId, packet.skinId);
        break;

      case PacketType.EQUIP_SKIN:
        // Gọi hàm xử lý riêng, tránh duplicate code
        await this.handleEquipSkin(clientId, packet.skinId);
        break;

      case PacketType.DASH:
        const player = this.game.players.get(clientId);
        if (player && typeof player.performDash === 'function') {
          player.performDash();
        }
        break;
    }
  }

  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);
    if (client?.ws.readyState === 1) {
      client.ws.send(JSON.stringify(data));
    }
  }

  broadcast(data, excludeId = null) {
    const message = JSON.stringify(data);
    this.clients.forEach((client, id) => {
      if (id !== excludeId && client.ws.readyState === 1) {
        client.ws.send(message);
      }
    });
  }

  async handleBuySkin(clientId, skinId) {
    const client = this.clients.get(clientId);
    if (!client || !client.userId) return;

    try {
      const user = await User.findById(client.userId);
      const skinInfo = SKINS.find(s => s.id === skinId);

      if (!user || !skinInfo) return;

      // Kiểm tra: Chưa sở hữu và Đủ tiền
      if (!user.skins.includes(skinId) && user.coins >= skinInfo.price) {
        user.coins -= skinInfo.price;
        user.skins.push(skinId);
        await user.save();

        console.log(`User ${user.username} bought skin ${skinId}`);

        this.sendToClient(clientId, {
          type: 'USER_DATA_UPDATE',
          coins: user.coins,
          skins: user.skins
        });
      }
    } catch (err) {
      console.error("Error handling buy skin:", err);
    }
  }

  async handleEquipSkin(clientId, skinId) {
    const client = this.clients.get(clientId);
    if (!client || !client.userId) return;

    try {
      const user = await User.findById(client.userId);
      // Kiểm tra sở hữu skin
      if (!user || !user.skins.includes(skinId)) {
        console.log("Equip failed: Skin not owned or User not found");
        return;
      }

      user.equippedSkin = skinId;
      await user.save();
      console.log(`User ${user.username} equipped skin ${skinId}`);

      // 1. Gửi cập nhật UI về Client
      this.sendToClient(clientId, {
        type: 'USER_DATA_UPDATE',
        equippedSkin: user.equippedSkin
      });

      // 2. Cập nhật ngay vào nhân vật trong game (nếu đang chơi)
      if (client.player) {
        client.player.skinId = skinId;
      }

    } catch (err) {
      console.error("Error handling equip skin:", err);
    }
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  start() {
    this.game.start();
  }
}