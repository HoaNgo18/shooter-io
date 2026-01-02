export const PacketType = {
  // Client -> Server
  JOIN: 'join',
  INPUT: 'input',
  DASH: 'dash',
  ATTACK: 'attack',
  CHAT: 'chat',
  RESPAWN: 'respawn',
  SELECT_SLOT: 'SELECT_SLOT', // Khi bấm 1, 2, 3, 4
  USE_ITEM: 'USE_ITEM',

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
  USER_DATA_UPDATE: 'user_data_update',
  REQUEST_USER_DATA: 'request_user_data',

  // Arena Mode
  ARENA_JOIN: 'arena_join',           // Client -> Server: Xin vào đấu trường
  ARENA_LEAVE: 'arena_leave',         // Client -> Server: Rời hàng chờ/phòng
  ARENA_STATUS: 'arena_status',       // Server -> Client: Trạng thái phòng (waiting/playing)
  ARENA_START: 'arena_start',         // Server -> Client: Trận đấu bắt đầu
  ARENA_UPDATE: 'arena_update',       // Server -> Client: Update state đấu trường
  ARENA_VICTORY: 'arena_victory',     // Server -> Client: Thông báo người thắng
  ARENA_END: 'arena_end',             // Server -> Client: Trận đấu kết thúc
  ARENA_COUNTDOWN: 'arena_countdown', // Server -> Client: Đếm ngược trước khi bắt đầu
  ARENA_PLAYER_COUNT: 'arena_player_count', // Server -> Client: Số người trong phòng

  // Spectate Mode
  SPECTATE_START: 'spectate_start',   // Client -> Server: Bắt đầu quan sát
  SPECTATE_STOP: 'spectate_stop',     // Client -> Server: Dừng quan sát
  SPECTATE_UPDATE: 'spectate_update', // Server -> Client: Cập nhật target spectate
  SPECTATE_TARGET_DIED: 'spectate_target_died', // Server -> Client: Target đã chết

  // Emoji
  EMOJI: 'emoji',                     // Client -> Server -> All: Gửi emoji
  EMOJI_BROADCAST: 'emoji_broadcast'  // Server -> Client: Broadcast emoji to all
};