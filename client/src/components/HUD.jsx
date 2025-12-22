import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';
import { MAP_SIZE, ITEM_CONFIG, WEAPON_STATS } from '@shared/constants'; // Import MAP_SIZE từ shared

const MINIMAP_SIZE = 150; // Kích thước Minimap

const HUD = () => {
  const [stats, setStats] = useState({
    lives: 3,
    maxLives: 3,
    score: 0,
    currentAmmo: 3,     // <--- Thêm mới
    maxAmmo: 3,         // <--- Thêm mới
    weapon: 'BLUE'
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [myPos, setMyPos] = useState({ x: 0, y: 0 });
  const [kingPos, setKingPos] = useState(null);

  const [pickupNotif, setPickupNotif] = useState(null);

  useEffect(() => {
    const unsubscribe = socket.subscribe((packet) => {
      setIsConnected(true);

      if (packet.players) {
        const myId = socket.myId;
        const me = packet.players.find(p => p.id === myId);

        if (me) {
          setStats({
            lives: me.lives,
            maxLives: me.maxLives,
            score: me.score,
            currentAmmo: me.currentAmmo !== undefined ? me.currentAmmo : 3,
            maxAmmo: me.maxAmmo || 3,
            weapon: me.weapon || 'BLUE'
          });
          setMyPos({ x: me.x, y: me.y });
        }

        const sorted = packet.players
          .filter(p => !p.dead)
          .sort((a, b) => b.score - a.score);
        setLeaderboard(sorted.slice(0, 10));

        if (sorted.length > 0) {
          setKingPos({ x: sorted[0].x, y: sorted[0].y });
        }
      }

      if (packet.type === 'ITEM_PICKED_UP' && packet.playerId === socket.myId) {
        const config = ITEM_CONFIG[packet.itemType];
        if (config) {
          setPickupNotif({
            name: config.name,
            description: config.description
          });

          // Auto-hide after 1.5 seconds
          setTimeout(() => setPickupNotif(null), 1500);
        }
      }
    });

    return () => unsubscribe();
  }, []);

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

  const myMinimapPos = worldToMinimap(myPos.x, myPos.y);
  const kingMinimapPos = kingPos ? worldToMinimap(kingPos.x, kingPos.y) : null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', padding: '20px', boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif'
    }}>
    
      {/* ========== LIVES + SCORE + AMMO (GÓC TRÁI TRÊN) ========== */}
      <div style={{
        position: 'absolute',
        top: '25px',
        left: '25px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px', // Khoảng cách đều giữa các dòng
        fontFamily: "'Segoe UI', 'Arial', sans-serif",
        pointerEvents: 'none'
      }}>

        {/* --- 1. LIVES ROW (ICONS) --- */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px' // Khoảng cách giữa chữ LIVES và Icon
        }}>
          {/* Label */}
          <span style={{
            fontSize: '14px',
            fontWeight: '800',
            color: '#DDD',
            letterSpacing: '1px',
            textShadow: '1px 1px 0 #000'
          }}>
            LIVES
          </span>

          {/* Icon Row */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: stats.maxLives }).map((_, index) => (
              <img
                key={index}
                src="/UI/playerLife3_red.png"
                alt="life"
                style={{
                  width: '32px', // Kích thước icon
                  height: 'auto',
                  // Logic hiển thị: Nếu còn mạng thì sáng, mất mạng thì tối + đen trắng
                  filter: index < stats.lives
                    ? 'drop-shadow(2px 2px 0 rgba(0,0,0,0.5))'
                    : 'grayscale(100%) brightness(30%) opacity(0.5)',
                  transform: index < stats.lives ? 'scale(1)' : 'scale(0.9)',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>

        {/* --- 2. SCORE ROW --- */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '10px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '800',
            color: '#DDD',
            letterSpacing: '1px',
            textShadow: '1px 1px 0 #000'
          }}>
            SCORE
          </span>
          <span style={{
            fontSize: '26px',
            fontWeight: '900',
            color: '#FFD700', // Vàng Gold
            textShadow: '2px 2px 0 #000',
            fontFamily: 'monospace' // Dùng font này để số không bị nhảy khi tăng điểm
          }}>
            {stats.score.toString().padStart(6, '0')}
          </span>
        </div>

        {/* --- 3. AMMO ROW (BAR STYLE) --- */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '800',
            color: '#DDD',
            letterSpacing: '1px',
            textShadow: '1px 1px 0 #000'
          }}>
            AMMO
          </span>

          {/* Thanh chứa đạn */}
          <div style={{
            display: 'flex',
            height: '16px',
            background: 'rgba(0, 0, 0, 0.4)', // Nền tối cho thanh đạn
            padding: '3px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            gap: '2px' // Khoảng cách nhỏ tạo cảm giác "chia nấc"
          }}>
            {Array.from({ length: stats.maxAmmo }).map((_, index) => (
              <div
                key={index}
                style={{
                  width: '20px', // Độ rộng mỗi nấc
                  height: '100%',
                  // Logic màu: Đầy đủ thì lấy màu súng, rỗng thì trong suốt
                  backgroundColor: index < stats.currentAmmo ? getAmmoColor() : 'transparent',
                  // Hiệu ứng phát sáng nếu có đạn
                  boxShadow: index < stats.currentAmmo ? `0 0 8px ${getAmmoColor()}` : 'none',

                  // Style nấc đạn
                  borderRadius: '2px',
                  opacity: index < stats.currentAmmo ? 1 : 0.1,
                  transform: 'skewX(-15deg)', // Nghiêng để tạo cảm giác tốc độ/sci-fi
                  transition: 'all 0.1s ease'
                }}
              />
            ))}
          </div>
        </div>

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

    </div>
  );
};

export default HUD;