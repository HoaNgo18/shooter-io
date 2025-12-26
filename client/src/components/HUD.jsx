import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';
import { MAP_SIZE, ITEM_CONFIG, WEAPON_STATS } from '@shared/constants'; // Import MAP_SIZE từ shared

const MINIMAP_SIZE = 150; // Kích thước Minimap

const HUD = ({ isArena = false }) => {
  const [stats, setStats] = useState({
    lives: 3,
    maxLives: 3,
    score: 0,
    currentAmmo: 3,     // <--- Thêm mới
    maxAmmo: 3,         // <--- Thêm mới
    weapon: 'BLUE',
    inventory: [null, null, null, null, null], // Mảng 4 ô
    selectedSlot: 0
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [myPos, setMyPos] = useState({ x: 0, y: 0 });
  const [kingPos, setKingPos] = useState(null);
  const [aliveCount, setAliveCount] = useState(10);

  const [pickupNotif, setPickupNotif] = useState(null);

  // Use interval to poll data from gameScene instead of packet subscription
  // This prevents re-renders on every packet (20fps -> causes lag)
  useEffect(() => {
    let lastUpdate = Date.now();
    const UPDATE_THROTTLE = 250;

    const updateInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdate < UPDATE_THROTTLE) return; // Skip nếu chưa đủ thời gian
      lastUpdate = now;

      if (!socket.gameScene || !socket.myId) return;

      const scene = socket.gameScene;
      const myPlayer = scene.players?.[socket.myId];

      if (myPlayer) {
        setStats(prev => {
          // Only update if values changed
          if (prev.lives !== myPlayer.lives ||
            prev.score !== myPlayer.score ||
            prev.currentAmmo !== myPlayer.currentAmmo ||
            prev.weapon !== myPlayer.weaponType) {
            return {
              lives: myPlayer.lives || 3,
              maxLives: myPlayer.maxLives || 3,
              score: myPlayer.score || 0,
              currentAmmo: myPlayer.currentAmmo !== undefined ? myPlayer.currentAmmo : 3,
              maxAmmo: myPlayer.maxAmmo || 3,
              weapon: myPlayer.weaponType || 'BLUE',
              inventory: myPlayer.inventory || [null, null, null, null, null],
              selectedSlot: myPlayer.selectedSlot || 0
            };
          }
          return prev;
        });
        setMyPos({ x: myPlayer.x, y: myPlayer.y });
      }

      // Update leaderboard from scene
      if (scene.players) {
        const sorted = Object.values(scene.players)
          .filter(p => !p.dead && p.name)
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 10);

        setLeaderboard(prev => {
          // Only update if changed
          const newIds = sorted.map(p => p.id + p.score).join(',');
          const oldIds = prev.map(p => p.id + p.score).join(',');
          if (newIds !== oldIds) {
            return sorted.map(p => ({
              id: p.id,
              name: p.name,
              score: p.score || 0,
              x: p.x,
              y: p.y
            }));
          }
          return prev;
        });

        if (sorted.length > 0) {
          setKingPos({ x: sorted[0].x, y: sorted[0].y });
        }

        // Update alive count for arena
        if (isArena) {
          // Lấy dữ liệu từ biến aliveCount mà ta đã giữ lại ở Scene
          const alive = scene.aliveCount !== undefined ? scene.aliveCount : 10;
          setAliveCount(alive);
        }
      }

      setIsConnected(socket.isConnected);
    }, 250); // Update HUD at ~7fps - balance between responsiveness and performance

    // Still listen for special events like item pickup
    const unsubscribe = socket.subscribe((packet) => {
      if (packet.type === 'ITEM_PICKED_UP' && packet.playerId === socket.myId) {
        const config = ITEM_CONFIG[packet.itemType];
        if (config) {
          setPickupNotif({
            name: config.name,
            description: config.description
          });
          setTimeout(() => setPickupNotif(null), 1500);
        }
      }
    });

    return () => {
      clearInterval(updateInterval);
      unsubscribe();
    };
  }, [isArena]);

  const worldToMinimap = (x, y) => {
    const shiftedX = x + (MAP_SIZE / 2);
    const shiftedY = y + (MAP_SIZE / 2);

    const ratioX = shiftedX / MAP_SIZE;
    const ratioY = shiftedY / MAP_SIZE;

    return {
      left: ratioX * MINIMAP_SIZE,
      top: ratioY * MINIMAP_SIZE
    };
  };

  // Hàm lấy màu đạn cho UI
  const getAmmoColor = () => {
    const weaponStats = WEAPON_STATS[stats.weapon];
    return weaponStats ? '#' + weaponStats.color.toString(16).padStart(6, '0') : '#00E5FF';
  };

  const getItemImage = (type) => {
    if (!type) return null;
    switch (type) {
      case 'SPEED_BOOST': return '/Power-ups/bolt_gold.png';
      case 'SHIELD': return '/Power-ups/shield_gold.png';
      case 'INVISIBLE': return '/Power-ups/hidden.png';
      case 'BOMB': return '/Power-ups/floating_mine.png';
      default: return null;
    }
  };

  const myMinimapPos = worldToMinimap(myPos.x, myPos.y);
  const kingMinimapPos = kingPos ? worldToMinimap(kingPos.x, kingPos.y) : null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', padding: '20px', boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif'
    }}>

      {/* ========== LIVES + SCORE + AMMO + ALIVE (GÓC TRÁI TRÊN) ========== */}
      <div style={{
        position: 'absolute',
        top: '25px',
        left: '25px',
        display: 'flex',
        flexDirection: 'column', // Xếp dọc từ trên xuống
        gap: '12px',             // Tăng khoảng cách giữa các dòng cho thoáng
        fontFamily: "'Segoe UI', 'Arial', sans-serif",
        pointerEvents: 'none'
      }}>

        {/* --- 1. LIVES ROW --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: '#DDD', letterSpacing: '1px', textShadow: '1px 1px 0 #000', width: '50px' }}>
            LIVES
          </span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: stats.maxLives }).map((_, index) => (
              <img
                key={index}
                src="/UI/playerLife3_red.png"
                alt="life"
                style={{
                  width: '28px',
                  height: 'auto',
                  filter: index < stats.lives ? 'drop-shadow(2px 2px 0 rgba(0,0,0,0.5))' : 'grayscale(100%) brightness(30%) opacity(0.5)',
                  transform: index < stats.lives ? 'scale(1)' : 'scale(0.9)',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>

        {/* --- 2. SCORE ROW --- */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: '#DDD', letterSpacing: '1px', textShadow: '1px 1px 0 #000', width: '50px' }}>
            SCORE
          </span>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#FFD700', textShadow: '2px 2px 0 #000', fontFamily: 'monospace' }}>
            {stats.score.toString().padStart(6, '0')}
          </span>
        </div>

        {/* --- 3. AMMO ROW --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: '#DDD', letterSpacing: '1px', textShadow: '1px 1px 0 #000', width: '50px' }}>
            AMMO
          </span>
          <div style={{
            display: 'flex', height: '14px', background: 'rgba(0, 0, 0, 0.4)', padding: '3px',
            borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', gap: '2px'
          }}>
            {Array.from({ length: stats.maxAmmo }).map((_, index) => (
              <div key={index} style={{
                width: '18px', height: '100%',
                backgroundColor: index < stats.currentAmmo ? getAmmoColor() : 'transparent',
                boxShadow: index < stats.currentAmmo ? `0 0 8px ${getAmmoColor()}` : 'none',
                borderRadius: '2px', opacity: index < stats.currentAmmo ? 1 : 0.1,
                transform: 'skewX(-15deg)', transition: 'all 0.1s ease'
              }} />
            ))}
          </div>
        </div>

        {/* --- 4. ALIVE ROW (Chỉ hiện khi đấu trường) --- */}
        {isArena && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#DDD', letterSpacing: '1px', textShadow: '1px 1px 0 #000', width: '50px' }}>
              ALIVE
            </span>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#FF4444', textShadow: '2px 2px 0 #000', fontFamily: 'monospace' }}>
              {aliveCount} <span style={{ fontSize: '14px', color: '#AAA' }}>/ 10</span>
            </span>
          </div>
        )}

      </div>

      {/* ========== LEADERBOARD (GÓC PHẢI TRÊN) ========== */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(0,0,0,0.7)',
        padding: '15px',
        borderRadius: '10px',
        color: 'white',
        minWidth: '200px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{
          margin: '0 0 10px 0',
          borderBottom: '1px solid #555',
          paddingBottom: '8px',
          color: '#FFD700',
          textAlign: 'center',
          fontSize: '16px'
        }}>
          🏆 Top Players
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {leaderboard.length > 0 ? leaderboard.map((player, index) => (
            <div key={player.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '14px',
              color: player.id === socket.myId ? '#4CAF50' : '#fff',
              fontWeight: player.id === socket.myId ? 'bold' : 'normal',
              background: player.id === socket.myId ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
              padding: '2px 5px',
              borderRadius: '4px'
            }}>
              <span>
                <span style={{
                  color: '#888',
                  marginRight: '8px',
                  width: '20px',
                  display: 'inline-block'
                }}>
                  #{index + 1}
                </span>
                {player.name || 'Unknown'}
              </span>
              <span>{player.score}</span>
            </div>
          )) : (
            <div style={{
              textAlign: 'center',
              color: '#aaa',
              fontSize: '12px'
            }}>
              Waiting...
            </div>
          )}
        </div>
      </div>

      {/* ========== MINIMAP (GÓC PHẢI DƯỚI) ========== */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        width: `${MINIMAP_SIZE}px`,
        height: `${MINIMAP_SIZE}px`,
        background: 'rgba(0, 0, 0, 0.8)',
        border: '2px solid #555',
        borderRadius: '5px',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          width: '100%',
          height: '1px',
          background: '#333'
        }}></div>
        <div style={{
          position: 'absolute',
          left: '50%',
          height: '100%',
          width: '1px',
          background: '#333'
        }}></div>

        <div style={{
          position: 'absolute',
          left: myMinimapPos.left,
          top: myMinimapPos.top,
          width: '6px',
          height: '6px',
          background: '#00FF00',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 4px #00FF00'
        }} />

        {kingMinimapPos && (
          <div style={{
            position: 'absolute',
            left: kingMinimapPos.left,
            top: kingMinimapPos.top,
            width: '8px',
            height: '8px',
            background: '#FFD700',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            border: '1px solid #000',
            zIndex: 1
          }}>
            <div style={{
              position: 'absolute',
              top: '-10px',
              left: '-3px',
              fontSize: '10px'
            }}>
              👑
            </div>
          </div>
        )}
      </div>

      {pickupNotif && (
        <div style={{
          position: 'absolute',
          top: '30%',                    // Lệch lên trên (30% từ top thay vì 50%)
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 1000,
          animation: 'fadeInOut 1.5s ease'
        }}>
          {/* Item Name */}
          <div style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#FFD700',           // Vàng gold - dễ nhìn
            textShadow: '0 0 10px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0,0,0,0.9)',
            marginBottom: '8px',
            letterSpacing: '1px'
          }}>
            + {pickupNotif.name}
          </div>

          {/* Description */}
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#FFD700',           // Cùng màu vàng
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            opacity: 0.9
          }}>
            {pickupNotif.description}
          </div>
        </div>
      )}

      {/* ========== INVENTORY BAR (GÓC TRÁI DƯỚI) ========== */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        display: 'flex',
        gap: '10px',
        pointerEvents: 'none' // Để click xuyên qua nếu cần
      }}>
        {stats.inventory.map((item, index) => (
          <div key={index} style={{
            position: 'relative',
            width: '50px',
            height: '50px',

            // --- SỬA Ở ĐÂY: Nền trắng xám nhẹ, độ trong suốt 0.4 ---
            backgroundColor: 'rgba(255, 255, 255, 0.4)',

            border: index === stats.selectedSlot
              ? '3px solid #FFD700' // Viền vàng nếu đang chọn
              : '2px solid #555',   // Viền xám nếu không chọn
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.1s ease',
            transform: index === stats.selectedSlot ? 'scale(1.1)' : 'scale(1)'
          }}>
            {/* Số thứ tự phím tắt */}
            <span style={{
              position: 'absolute',
              top: '2px',
              left: '5px',
              fontSize: '10px',

              // --- SỬA NHẸ: Đổi màu chữ sang đen để nổi trên nền trắng ---
              color: '#000',

              fontWeight: 'bold'
            }}>
              {index + 1}
            </span>

            {/* Hình ảnh vật phẩm */}
            {item && (
              <img
                src={getItemImage(item)}
                alt={item}
                style={{
                  width: '36px',
                  height: '36px',
                  objectFit: 'contain'
                }}
              />
            )}
          </div>
        ))}
      </div>

    </div>
  );
};

export default HUD;