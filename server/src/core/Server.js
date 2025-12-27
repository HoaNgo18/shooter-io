import { WebSocketServer } from 'ws';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Game } from './Game.js';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { User } from '../db/models/User.model.js';
import { SKINS } from '../../../shared/src/constants.js';
import { rateLimit } from '../utils/rateLimit.js';
import { ArenaManager } from '../arena/ArenaManager.js';

export class Server {
  constructor(port = 3000) {
    this.wss = new WebSocketServer({ port });
    this.game = new Game(this);
    this.clients = new Map();
    this.arena = new ArenaManager(this);

    console.log(`WebSocket server running on port ${port}`);
    this.setupWSS();
  }

  setupWSS() {
    const limiter = rateLimit('10s', 100, (ws) => {
      ws.close(1008, 'Rate limit exceeded');
    });

    this.wss.on('connection', (ws) => {
      limiter(ws);
      const clientId = this.generateId();

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
        // Check if client was in arena
        const client = this.clients.get(clientId);
        if (client?.arenaRoomId) {
          this.arena.leaveArena(clientId);
        } else {
          this.game.removePlayer(clientId);
        }
        this.clients.delete(clientId);
        this.broadcast({ type: PacketType.PLAYER_LEAVE, id: clientId });
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        const client = this.clients.get(clientId);
        if (client?.arenaRoomId) {
          this.arena.leaveArena(clientId);
        } else {
          this.game.removePlayer(clientId);
        }
        this.clients.delete(clientId);
      });
    });
  }

  async handleMessage(clientId, packet) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Check if client is in arena room
    if (client.arenaRoomId) {
      const room = this.arena.getRoom(client.arenaRoomId);
      if (room) {
        await this.handleArenaMessage(clientId, packet, room);
        return;
      }
    }

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
              playerName = user.displayName || user.username;
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
          } catch (err) {
            // Invalid token, playing as guest
          }
        }
        this.game.addPlayer(clientId, playerName, userId, userSkin);
        break;

      case PacketType.ARENA_JOIN:
        await this.handleArenaJoin(clientId, packet);
        break;

      case PacketType.ARENA_LEAVE:
        this.arena.leaveArena(clientId);
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
        await this.handleBuySkin(clientId, packet.skinId);
        break;

      case PacketType.EQUIP_SKIN:
        await this.handleEquipSkin(clientId, packet.skinId);
        break;

      case PacketType.DASH:
        const player = this.game.players.get(clientId);
        if (player && typeof player.performDash === 'function') {
          player.performDash();
        }
        break;
      case PacketType.SELECT_SLOT:
        if (typeof packet.slotIndex === 'number') {
          this.game.handleSelectSlot(clientId, packet.slotIndex);
        }
        break;

      case PacketType.USE_ITEM:
        this.game.handleUseItem(clientId);
        break;
    }
  }

  async handleArenaMessage(clientId, packet, room) {
    switch (packet.type) {
      case PacketType.INPUT:
        room.handleInput(clientId, packet.data);
        break;

      case PacketType.ATTACK:
        room.handleAttack(clientId);
        break;

      case PacketType.DASH:
        room.handleDash(clientId);
        break;

      case PacketType.SELECT_SLOT:
        if (typeof packet.slotIndex === 'number') {
          room.handleSelectSlot(clientId, packet.slotIndex);
        }
        break;

      case PacketType.USE_ITEM:
        room.handleUseItem(clientId);
        break;

      case PacketType.ARENA_LEAVE:
        this.arena.leaveArena(clientId);
        break;

      case PacketType.PONG:
        const client = this.clients.get(clientId);
        if (client?.player) {
          client.player.lastPong = Date.now();
        }
        break;
    }
  }

  async handleArenaJoin(clientId, packet) {
    const client = this.clients.get(clientId);
    if (!client) return;

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
          playerName = user.displayName || user.username;
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
      } catch (err) {
        // Invalid token
      }
    }

    const room = this.arena.joinArena(clientId, playerName, userId, userSkin);
    if (!room) {
      this.sendToClient(clientId, {
        type: PacketType.ARENA_STATUS,
        error: 'Failed to join arena'
      });
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

      if (!user.skins.includes(skinId) && user.coins >= skinInfo.price) {
        user.coins -= skinInfo.price;
        user.skins.push(skinId);
        await user.save();

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
      if (!user || !user.skins.includes(skinId)) {
        return;
      }

      user.equippedSkin = skinId;
      await user.save();

      this.sendToClient(clientId, {
        type: 'USER_DATA_UPDATE',
        equippedSkin: user.equippedSkin
      });

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