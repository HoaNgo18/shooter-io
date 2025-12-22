import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';
import { MAP_SIZE, ITEM_CONFIG } from '@shared/constants'; // Import MAP_SIZE từ shared

const MINIMAP_SIZE = 150; // Kích thước Minimap

const HUD = () => {
  const [stats, setStats] = useState({
    lives: 3,
    maxLives: 3,
    score: 0
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
            score: me.score
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

  const myMinimapPos = worldToMinimap(myPos.x, myPos.y);
  const kingMinimapPos = kingPos ? worldToMinimap(kingPos.x, kingPos.y) : null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', padding: '20px', boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif'
    }}>

      {/* ========== LIVES + SCORE (GÓC TRÁI TRÊN) - KHÔNG CÓ NỀN ========== */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {/* Lives Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {/* Icon tàu */}
          <div style={{
            width: '40px',
            height: '40px',
            background: '#FF6B35',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            border: '3px solid #FFA07A',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
          }}>
            🚀
          </div>

          {/* Dấu X */}
          <span style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#FFFFFF',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
          }}>
            ×
          </span>

          {/* Số mạng */}
          <span style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#FFFFFF',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
            minWidth: '35px'
          }}>
            {stats.lives}
          </span>
        </div>

        {/* Score Row */}
        <div style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#FFD700',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          letterSpacing: '2px',
          paddingLeft: '5px'
        }}>
          {stats.score.toString().padStart(6, '0')}
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