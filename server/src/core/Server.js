import { WebSocketServer } from 'ws';
import { PacketType } from '../../../shared/src/packetTypes.js';
import { Game } from './Game.js';

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

      ws.on('message', (data) => {
        try {
          const packet = JSON.parse(data.toString());
          this.handleMessage(clientId, packet);
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

  handleMessage(clientId, packet) {
    switch (packet.type) {
      case PacketType.JOIN:
        this.game.addPlayer(clientId, packet.name || 'Anonymous');
        break;
      case PacketType.INPUT:
        this.game.handleInput(clientId, packet.data);
        break;
      case PacketType.ATTACK:
        this.game.handleAttack(clientId);
        break;
      case PacketType.PONG:
        const client = this.clients.get(clientId);
        if (client?.player) {
          client.player.lastPong = Date.now();
        }
        break;
      case PacketType.RESPAWN: 
        this.game.respawnPlayer(clientId);
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

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  start() {
    this.game.start();
  }
}