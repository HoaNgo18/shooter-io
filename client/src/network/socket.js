import { PacketType } from '@shared/packetTypes';

class NetworkManager {
  constructor() {
    this.ws = null;
    this.gameScene = null;

    // Biến này để HUD biết ai là người chơi hiện tại
    this.myId = null;

    this.isConnected = false;
    this.listeners = [];
    this.initData = null;

    // Arena state
    this.isInArena = false;
    this.arenaRoomId = null;

    // Spectate state
    this.isSpectating = false;
    this.spectateTargetId = null;
    this.spectateTargetName = null;
  }

  connect(authOptions) {
    return new Promise((resolve, reject) => {
      // Close any existing connection first
      if (this.ws) {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
        this.ws = null;
        this.isConnected = false;
      }

      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        // Connected via WebSocket

        // Gửi gói tin JOIN kèm thông tin xác thực
        this.send({
          type: PacketType.JOIN,
          ...authOptions
        });

        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error', err);
        this.isConnected = false;
        reject(err);
      };

      this.ws.onmessage = (event) => this.handleMessage(event);

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isInArena = false;
        this.arenaRoomId = null;
      };
    });
  }

  // Connect to arena
  connectArena(authOptions) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.ws = new WebSocket('ws://localhost:3000');

        this.ws.onopen = () => {
          this.isConnected = true;
          // Connected via WebSocket (Arena)

          // Send arena join request
          this.send({
            type: PacketType.ARENA_JOIN,
            ...authOptions
          });

          this.isInArena = true;
          resolve();
        };

        this.ws.onerror = (err) => {
          console.error('WebSocket error', err);
          reject(err);
        };

        this.ws.onmessage = (event) => this.handleMessage(event);

        this.ws.onclose = () => {
          this.isConnected = false;
          this.isInArena = false;
          this.arenaRoomId = null;
        };
      } else {
        // Already connected, just send arena join
        this.send({
          type: PacketType.ARENA_JOIN,
          ...authOptions
        });
        this.isInArena = true;
        resolve();
      }
    });
  }

  leaveArena() {
    this.send({ type: PacketType.ARENA_LEAVE });
    this.isInArena = false;
    this.arenaRoomId = null;
    this.gameScene = null;
    this.initData = null;
    this.myId = null;
    this.stopSpectate();
  }

  // Spectate methods
  startSpectate(targetId) {
    this.send({ type: PacketType.SPECTATE_START, targetId });
  }

  stopSpectate() {
    this.isSpectating = false;
    this.spectateTargetId = null;
    this.spectateTargetName = null;
    this.send({ type: PacketType.SPECTATE_STOP });
    if (this.gameScene && this.gameScene.stopSpectate) {
      this.gameScene.stopSpectate();
    }
  }

  // Ngắt kết nối
  disconnect() {
    if (this.ws) {
      this.ws.close(); // Đóng kết nối
      this.ws = null;
      this.isConnected = false;
      this.myId = null;
      this.isInArena = false;
      this.arenaRoomId = null;
      // DON'T clear listeners here - they're still needed for reconnection
    }
  }

  // Full reset (used for logout) - DON'T clear listeners as they're set up once in App.jsx
  fullReset() {
    this.disconnect();
    // DON'T clear listeners - App.jsx sets them up once on mount
    // this.listeners = [];  // REMOVED - caused skin equip to fail after logout+login
    this.initData = null;
    this.gameScene = null;
    this.isSpectating = false;
    this.spectateTargetId = null;
    this.spectateTargetName = null;
  }

  setGameScene(scene) {
    if (!scene) return;
    this.gameScene = scene;
    if (this.initData) {
      this.gameScene.initGame(this.initData);
      // Don't clear initData - keep it for potential reconnect
    }
  }

  resetGameScene() {
    this.gameScene = null;
    // Don't clear initData here - it might be needed when scene is recreated
  }

  send(data) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  handleMessage(event) {
    try {
      const packet = JSON.parse(event.data);

      // 1. Xử lý Logic Global (Luôn chạy dù có GameScene hay không)

      // Init ID (for both normal and arena)
      if (packet.type === PacketType.INIT) {
        this.myId = packet.id;
        this.initData = packet;
        if (packet.isArena) {
          this.isInArena = true;
          this.arenaRoomId = packet.roomId;
        }
      }

      // Arena status updates
      if (packet.type === PacketType.ARENA_STATUS) {
        if (packet.roomId) {
          this.arenaRoomId = packet.roomId;
        }
      }

      // Spectate updates
      if (packet.type === PacketType.SPECTATE_UPDATE) {
        this.isSpectating = packet.isSpectating;
        this.spectateTargetId = packet.targetId;
        this.spectateTargetName = packet.targetName;

        if (this.gameScene && packet.isSpectating && packet.targetId) {
          this.gameScene.startSpectate(packet.targetId);
        } else if (this.gameScene && !packet.isSpectating) {
          this.gameScene.stopSpectate();
        }
      }

      // Spectate target died
      if (packet.type === PacketType.SPECTATE_TARGET_DIED) {
        if (packet.canSpectateKiller && packet.newTargetId) {
          this.spectateTargetId = packet.newTargetId;
          this.spectateTargetName = packet.newTargetName;
          if (this.gameScene && this.gameScene.switchSpectateTarget) {
            this.gameScene.switchSpectateTarget(packet.newTargetId);
          }
        } else {
          this.isSpectating = false;
          this.spectateTargetId = null;
          this.spectateTargetName = null;
          if (this.gameScene && this.gameScene.stopSpectate) {
            this.gameScene.stopSpectate();
          }
        }
      }

      // Ping/Pong
      if (packet.type === PacketType.PING) {
        this.send({ type: PacketType.PONG });
        return; // Ping pong không cần báo cho React
      }

      // [QUAN TRỌNG] Bắn tin cho React (App.jsx, HUD)
      // KHÔNG gửi UPDATE/ARENA_UPDATE packets để tránh lag (quá nhiều - 20fps)
      // HUD sẽ lấy data trực tiếp từ gameScene
      if (packet.type !== PacketType.UPDATE && packet.type !== PacketType.ARENA_UPDATE) {
        this.notifyReact(packet);
      }

      // 2. Xử lý Logic Game (Phaser) - Chỉ chạy khi đang chơi và có gameScene
      if (this.gameScene) {
        switch (packet.type) {
          case PacketType.UPDATE:
            // Only handle UPDATE if not in arena mode
            if (!this.isInArena) {
              this.gameScene.handleServerUpdate(packet);
            }
            break;

          case PacketType.ARENA_UPDATE:
            // Only handle ARENA_UPDATE if in arena mode
            if (this.isInArena) {
              this.gameScene.handleServerUpdate(packet);
            }
            break;

          case PacketType.INIT:
            // Cập nhật lại ID nếu cần
            this.myId = packet.id;
            this.gameScene.initGame(packet);
            break;

          case PacketType.PLAYER_JOIN:
            this.gameScene.addPlayer(packet.player);
            break;

          case PacketType.PLAYER_LEAVE:
            this.gameScene.removePlayer(packet.id);
            break;

          case PacketType.EMOJI_BROADCAST:
            // Handle emoji broadcast
            if (this.gameScene && this.gameScene.handleEmoji) {
              this.gameScene.handleEmoji(packet.playerId, packet.emoji);
            }
            break;
        }
      }

    } catch (e) {
      console.error('Socket handling error:', e);
    }
  }

  // Send emoji
  sendEmoji(emoji) {
    this.send({ type: PacketType.EMOJI, emoji });
  }

  notifyReact(data) {
    // Gửi data cho tất cả các listener đã đăng ký (App.jsx, GameScene...)
    this.listeners.forEach(callback => callback(data));
  }
}

export const socket = new NetworkManager();