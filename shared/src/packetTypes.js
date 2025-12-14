export const PacketType = {
  // Client -> Server
  JOIN: 'join',
  INPUT: 'input',
  ATTACK: 'attack',
  CHAT: 'chat',
  RESPAWN: 'respawn',
  
  // Server -> Client
  INIT: 'init',
  UPDATE: 'update',
  PLAYER_JOIN: 'player_join',
  PLAYER_LEAVE: 'player_leave',
  PLAYER_DIED: 'player_died',
  LEADERBOARD: 'leaderboard',
  PING: 'ping',
  PONG: 'pong'
};