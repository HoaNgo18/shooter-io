import { WebSocketServer } from 'ws';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Game } from './Game.js';
import jwt from 'jsonwebtoken';
import config from '../config.js'; // Import config để lấy JWT_SECRET
import { User } from '../db/models/User.model.js'; // Import Model User
import { SKINS } from '../../../shared/src/constants.js';

export class Server {
  constructor(port = 3000) {
    this.wss = new WebSocketServer({ port });
    this.game = new Game(this);
    this.clients = new Map();

    console.log(`WebSocket server running on port ${port}`);
    this.setupWSS();
  }

  setupWSS() {
    this.wss.on('connection', (ws) => {
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

      ws.on('error', (err) => console.error('WebSocket error:', err));
    });
  }

  async handleMessage(clientId, packet) {
    // Khai báo client ngay từ đầu để dùng cho tất cả các case
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
            // Gán userId vào đối tượng client để quản lý session
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
        // Cập nhật skin khi respawn nếu người chơi đã chọn skin mới
        const skinIdToUse = packet.skinId || (client.player?.skinId);
        this.game.respawnPlayer(clientId, skinIdToUse);
        break;

      case PacketType.BUY_SKIN: {
        if (!client.userId) return;

        try {
          const { skinId } = packet;
          const user = await User.findById(client.userId);

          // Tìm thông tin skin để lấy giá
          const skinInfo = SKINS.find(s => s.id === skinId);

          if (!user || !skinInfo) return;

          // Kiểm tra logic:
          // 1. Chưa sở hữu skin này
          // 2. Đủ tiền
          if (!user.skins.includes(skinId) && user.coins >= skinInfo.price) {

            // Trừ tiền & Thêm skin
            user.coins -= skinInfo.price;
            user.skins.push(skinId);

            await user.save();
            console.log(`User ${user.username} bought skin ${skinId}`);

            // Gửi cập nhật về Client ngay lập tức
            this.sendToClient(clientId, {
              type: 'USER_DATA_UPDATE',
              coins: user.coins,
              skins: user.skins
            });
          }
        } catch (err) {
          console.error("Lỗi mua skin:", err);
        }
        break;
      }

      case PacketType.EQUIP_SKIN: {
        if (!client.userId) {
          return;
        }
        try {
          const { skinId } = packet;
          console.log(`User ${client.userId} requesting equip: ${skinId}`); // Log debug

          const user = await User.findById(client.userId);
          if (!user) {
            return;
          }

          // Kiểm tra xem user có sở hữu skin đó không
          if (user && user.skins.includes(skinId)) {
            user.equippedSkin = skinId;
            await user.save(); // Bây giờ sẽ lưu được vì đã sửa Model

            console.log(`Equipped success: ${skinId}`);

            // Gửi cập nhật về Client
            this.sendToClient(clientId, {
              type: 'USER_DATA_UPDATE',
              equippedSkin: user.equippedSkin
            });

            // Cập nhật ngay vào player trong game (nếu đang chơi)
            if (client.player) {
              client.player.skinId = skinId;
            }
          } else {
            console.log("Equip failed: Skin not owned or User not found");
          }
        } catch (err) {
          console.error("Lỗi trang bị skin:", err);
        }
        break;
      }
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

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  start() {
    this.game.start();
  }
}