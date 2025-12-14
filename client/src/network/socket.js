// client/src/network/socket.js
import { PacketType } from '@shared/packetTypes';

class NetworkManager {
  constructor() {
    this.ws = null;
    this.gameScene = null;
    this.myId = null;
    this.isConnected = false;
    this.listeners = [];
  }

  connect(username) {
    return new Promise((resolve, reject) => {
      // 🟢 Đảm bảo URL này đúng với server của bạn
      this.ws = new WebSocket('ws://localhost:3000');

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('✅ Connected via WebSocket');
        this.send({ type: PacketType.JOIN, name: username });
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('❌ WebSocket error', err);
        reject(err);
      };

      this.ws.onmessage = (event) => this.handleMessage(event);
      
      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('🔌 Disconnected');
      };
    });
  }

  setGameScene(scene) {
    this.gameScene = scene;
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
    const packet = JSON.parse(event.data);

    // 1. Xử lý Logic Game (Phaser)
    if (this.gameScene) {
      switch (packet.type) {
        case PacketType.UPDATE:
          this.gameScene.handleServerUpdate(packet);
          
          // 🟢 FIX LỖI HUD: Gửi nguyên gói tin packet sang React
          // React HUD sẽ tự lọc 'packet.players' để vẽ Leaderboard
          this.notifyReact(packet);
          break;

        case PacketType.INIT:
          this.myId = packet.id;
          this.gameScene.initGame(packet);
          // Gửi cả gói INIT để HUD hiển thị ngay khi vào game
          this.notifyReact(packet);
          break;

        case PacketType.PLAYER_JOIN:
          this.gameScene.addPlayer(packet.player);
          break;

        case PacketType.PLAYER_LEAVE:
          this.gameScene.removePlayer(packet.id);
          break;
      }
    }

    // 2. Ping/Pong
    if (packet.type === PacketType.PING) {
      this.send({ type: PacketType.PONG });
    }
  }

  notifyReact(data) {
    this.listeners.forEach(callback => callback(data));
  }
}

export const socket = new NetworkManager();