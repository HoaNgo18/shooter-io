// client/src/network/socket.js
import { PacketType } from '@shared/packetTypes';

class NetworkManager {
  constructor() {
    this.ws = null;
    this.gameScene = null;
    
    // 🟢 QUAN TRỌNG: Biến này để HUD biết ai là người chơi hiện tại
    this.myId = null; 
    
    this.isConnected = false;
    this.listeners = [];
  }

  connect(username) {
    return new Promise((resolve, reject) => {
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
          // Gửi data sang React HUD
          this.notifyReact(packet);
          break;

        case PacketType.INIT:
          // 🟢 QUAN TRỌNG: Lưu ID của mình khi server cấp
          this.myId = packet.id;
          
          this.gameScene.initGame(packet);
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

    if (packet.type === PacketType.PING) {
      this.send({ type: PacketType.PONG });
    }
  }

  notifyReact(data) {
    this.listeners.forEach(callback => callback(data));
  }
}

export const socket = new NetworkManager();