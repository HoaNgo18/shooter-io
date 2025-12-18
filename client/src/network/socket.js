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
  }

  connect(authOptions) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:3000');

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('✅ Connected via WebSocket');

        // Gửi gói tin JOIN kèm thông tin xác thực
        this.send({
          type: PacketType.JOIN,
          ...authOptions
        });

        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error', err);
        reject(err);
      };

      this.ws.onmessage = (event) => this.handleMessage(event);

      this.ws.onclose = () => {
        this.isConnected = false;
        console.log('🔌 Disconnected');
      };
    });
  }

  // Ngắt kết nối
  disconnect() {
    if (this.ws) {
      this.ws.close(); // Đóng kết nối
      this.ws = null;
      this.isConnected = false;
      this.myId = null;
      this.listeners = []; // Reset listeners khi logout
      console.log('Manually disconnected');
    }
  }

  setGameScene(scene) {
    if (!scene) return;
    this.gameScene = scene;
    if (this.initData) {
      console.log('Applying buffered INIT data...');
      this.gameScene.initGame(this.initData);
    }
  }

  resetGameScene() {
    this.gameScene = null;
    this.initData = null;
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
      
      // Init ID
      if (packet.type === PacketType.INIT) {
        console.log('Received INIT packet. My ID:', packet.id);
        this.myId = packet.id;
        this.initData = packet;
      }

      // Ping/Pong
      if (packet.type === PacketType.PING) {
        this.send({ type: PacketType.PONG });
        return; // Ping pong không cần báo cho React
      }

      // [QUAN TRỌNG] Bắn tin cho React (App.jsx, HUD) NGAY LẬP TỨC
      // Việc này đảm bảo USER_DATA_UPDATE luôn đến được App.jsx
      this.notifyReact(packet);

      // 2. Xử lý Logic Game (Phaser) - Chỉ chạy khi đang chơi
      if (this.gameScene) {
        switch (packet.type) {
          case PacketType.UPDATE:
            this.gameScene.handleServerUpdate(packet);
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
        }
      }

    } catch (e) {
      console.error('Socket handling error:', e);
    }
  }

  notifyReact(data) {
    // Gửi data cho tất cả các listener đã đăng ký (App.jsx, GameScene...)
    this.listeners.forEach(callback => callback(data));
  }
}

export const socket = new NetworkManager();