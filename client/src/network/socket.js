
import { PacketType } from '@shared/packetTypes';

class NetworkManager {
  constructor() {
    this.ws = null;
    this.gameScene = null;
    
    // Biến này để HUD biết ai là người chơi hiện tại
    this.myId = null; 
    
    this.isConnected = false;
    this.listeners = [];
  }

  connect(authOptions) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:3000');

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('Connected via WebSocket');
        
        // Gửi gói tin JOIN kèm thông tin xác thực
        const joinPacket = { 
          type: PacketType.JOIN, 
          ...authOptions 
        };
        
        // Nếu đã đăng nhập, thêm thông tin người chơi từ localStorage
        if (authOptions.token) {
          try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            joinPacket.gameDisplayName = user.gameDisplayName || authOptions.name;
          } catch (e) {
            joinPacket.gameDisplayName = authOptions.name;
          }
        }
        
        this.send(joinPacket);
        
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

  //ngat ket noi
  disconnect() {
    if (this.ws) {
      this.ws.close(); // Đóng kết nối
      this.ws = null;
      this.isConnected = false;
      this.myId = null;
      console.log('Manually disconnected');
    }
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
          // QUAN TRỌNG: Lưu ID của mình khi server cấp
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

    // 2. Xử lý packet từ React (DeathScreen, HUD)
    if (packet.type === PacketType.PLAYER_DIED) {
      this.notifyReact(packet);
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