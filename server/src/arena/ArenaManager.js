// server/src/arena/ArenaManager.js
import { ArenaRoom } from './ArenaRoom.js';
import { PacketType } from '../../../shared/src/packetTypes.js';

export class ArenaManager {
  constructor(server) {
    this.server = server;
    this.rooms = new Map(); // roomId -> ArenaRoom
    this.currentWaitingRoom = null; // The room that's currently accepting players
    this.roomCounter = 0;
    
    // Create new waiting room every minute
    this.roomCreateInterval = setInterval(() => {
      this.createNewWaitingRoom();
    }, 60000); // 60 seconds
    
    // Create first room immediately
    this.createNewWaitingRoom();
    
    console.log('[ArenaManager] Initialized');
  }
  
  createNewWaitingRoom() {
    // If current waiting room has players but isn't full, let it continue
    if (this.currentWaitingRoom && this.currentWaitingRoom.status === 'waiting') {
      const playerCount = this.currentWaitingRoom.getRealPlayerCount();
      if (playerCount > 0) {
        // Start the old room (it will fill with bots)
        console.log(`[ArenaManager] Starting old room ${this.currentWaitingRoom.id} with ${playerCount} players`);
        this.currentWaitingRoom.startCountdown();
      } else {
        // No players, destroy the empty room
        console.log(`[ArenaManager] Destroying empty room ${this.currentWaitingRoom.id}`);
        this.currentWaitingRoom.destroy();
      }
    }
    
    // Create new room
    this.roomCounter++;
    const roomId = `arena_${this.roomCounter}_${Date.now()}`;
    const room = new ArenaRoom(roomId, this);
    
    this.rooms.set(roomId, room);
    this.currentWaitingRoom = room;
    
    // Start room's wait timer
    room.startWaitTimer();
    
    console.log(`[ArenaManager] New waiting room created: ${roomId}`);
    
    return room;
  }
  
  // Find a room for player to join
  getWaitingRoom() {
    if (this.currentWaitingRoom && 
        this.currentWaitingRoom.status === 'waiting' &&
        this.currentWaitingRoom.players.size < this.currentWaitingRoom.maxPlayers) {
      return this.currentWaitingRoom;
    }
    
    // Create new room if needed
    return this.createNewWaitingRoom();
  }
  
  // Handle player joining arena queue
  joinArena(clientId, name, userId = null, skinId = 'default') {
    const room = this.getWaitingRoom();
    
    if (room.addPlayer(clientId, name, userId, skinId)) {
      return room;
    }
    
    return null;
  }
  
  // Handle player leaving arena
  leaveArena(clientId) {
    const client = this.server.clients.get(clientId);
    if (!client || !client.arenaRoomId) return;
    
    const room = this.rooms.get(client.arenaRoomId);
    if (room) {
      room.removePlayer(clientId);
    }
  }
  
  // Get room by ID
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }
  
  // Get room by client
  getRoomByClient(clientId) {
    const client = this.server.clients.get(clientId);
    if (!client || !client.arenaRoomId) return null;
    return this.rooms.get(client.arenaRoomId);
  }
  
  // Remove room
  removeRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room === this.currentWaitingRoom) {
      this.currentWaitingRoom = null;
    }
    this.rooms.delete(roomId);
    console.log(`[ArenaManager] Room ${roomId} removed. Active rooms: ${this.rooms.size}`);
  }
  
  // Get status of all rooms
  getStatus() {
    return {
      totalRooms: this.rooms.size,
      waitingRoom: this.currentWaitingRoom ? {
        id: this.currentWaitingRoom.id,
        playerCount: this.currentWaitingRoom.getRealPlayerCount(),
        maxPlayers: this.currentWaitingRoom.maxPlayers,
        status: this.currentWaitingRoom.status
      } : null,
      rooms: Array.from(this.rooms.values()).map(r => ({
        id: r.id,
        status: r.status,
        playerCount: r.getRealPlayerCount(),
        totalPlayers: r.players.size
      }))
    };
  }
  
  destroy() {
    clearInterval(this.roomCreateInterval);
    this.rooms.forEach(room => room.destroy());
    this.rooms.clear();
  }
}
