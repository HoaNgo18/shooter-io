import { PacketType } from '@shared/packetTypes';

class NetworkManager {
  constructor() {
    this.ws = null;
    this.gameScene = null; // Tham chiếu đến Phaser Scene
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
        
        // Gửi gói tin JOIN ngay khi kết nối
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
    // Trả về hàm cleanup
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  handleMessage(event) {
    const packet = JSON.parse(event.data);

    // 1. Xử lý các gói tin Logic Game (chuyển cho Phaser)
    if (this.gameScene) {
      switch (packet.type) {
        case PacketType.UPDATE:
          this.gameScene.handleServerUpdate(packet);
          // Tìm thông tin của mình để cập nhật máu/điểm
          const myData = packet.players.find(p => p.id === this.myId);
          this.notifyReact({ 
            type: 'GAME_UPDATE', 
            me: myData, 
            leaderboard: this.gameScene.getLeaderboard ? this.gameScene.getLeaderboard() : [] 
          });
          break;
        case PacketType.INIT:
          this.myId = packet.id;
          this.gameScene.initGame(packet);
          break;
        case PacketType.PLAYER_JOIN:
          this.gameScene.addPlayer(packet.player);
          break;
        case PacketType.PLAYER_LEAVE:
          this.gameScene.removePlayer(packet.id);
          break;
      }
    }

    // 2. Xử lý Ping/Pong (tự động)
    if (packet.type === PacketType.PING) {
      this.send({ type: PacketType.PONG });
    }
  }
  notifyReact(data) {
    this.listeners.forEach(callback => callback(data));
  }
}

// Xuất ra một instance duy nhất (Singleton) để dùng chung
export const socket = new NetworkManager();