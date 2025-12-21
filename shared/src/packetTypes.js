export const PacketType = {
  // Client -> Server
  JOIN: 'join',
  INPUT: 'input',
  DASH: 'dash',
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
  PONG: 'pong',
  BUY_SKIN: 'buy_skin',
  EQUIP_SKIN: 'equip_skin',
  USER_DATA_UPDATE: 'user_data_update'
};