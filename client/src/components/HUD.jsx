import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';
import { MAP_SIZE } from '@shared/constants'; // Import MAP_SIZE từ shared

const MINIMAP_SIZE = 150; // Kích thước Minimap

const HUD = () => {
  // State chỉ số
  const [stats, setStats] = useState({ health: 100, maxHealth: 100, score: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // State vị trí cho Minimap
  const [myPos, setMyPos] = useState({ x: 0, y: 0 });
  const [kingPos, setKingPos] = useState(null);

  useEffect(() => {
    const unsubscribe = socket.subscribe((packet) => {
      setIsConnected(true);

      if (packet.players) {
        // 1. Tìm bản thân
        const myId = socket.myId;
        const me = packet.players.find(p => p.id === myId);

        if (me) {
          setStats({
            health: me.health,
            maxHealth: me.maxHealth,
            score: me.score
          });
          // Cập nhật vị trí mình
          setMyPos({ x: me.x, y: me.y });
        }

        // 2. Cập nhật Leaderboard & tìm King
        const sorted = packet.players
          .filter(p => !p.dead) // Chỉ lấy người CHƯA CHẾT
          .sort((a, b) => b.score - a.score);
        setLeaderboard(sorted.slice(0, 10));

        if (sorted.length > 0) {
          setKingPos({ x: sorted[0].x, y: sorted[0].y });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // HÀM QUAN TRỌNG: Chuyển đổi tọa độ World -> Minimap
  // (Đây là cái bạn bị thiếu gây ra lỗi myMinimapPos is not defined)
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

  // Tính toán hiển thị
  const healthPercent = stats.maxHealth > 0 ? Math.max(0, (stats.health / stats.maxHealth) * 100) : 0;

  const myMinimapPos = worldToMinimap(myPos.x, myPos.y);
  const kingMinimapPos = kingPos ? worldToMinimap(kingPos.x, kingPos.y) : null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', padding: '20px', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif'
    }}>

      {/* 1. THANH MÁU & ĐIỂM (Góc trái dưới) */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '20px',
        background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '10px',
        color: 'white', border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ marginBottom: '5px', fontSize: '18px', fontWeight: 'bold' }}>
          Score: <span style={{ color: '#FFD700' }}>{stats.score}</span>
        </div>
        <div style={{ width: '200px', height: '20px', background: '#333', borderRadius: '10px', overflow: 'hidden', border: '2px solid #555', position: 'relative' }}>
          <div style={{ width: `${healthPercent}%`, height: '100%', background: healthPercent > 50 ? '#4CAF50' : healthPercent > 20 ? '#FFC107' : '#F44336', transition: 'width 0.2s ease-out' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
            {Math.round(stats.health)} / {stats.maxHealth}
          </div>
        </div>
      </div>

      {/* 2. LEADERBOARD (Góc phải trên) */}
      <div style={{
        position: 'absolute', top: '20px', right: '20px',
        background: 'rgba(0,0,0,0.7)', padding: '15px', borderRadius: '10px',
        color: 'white', minWidth: '200px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '8px', color: '#FFD700', textAlign: 'center', fontSize: '16px' }}>🏆 Top Players</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {leaderboard.length > 0 ? leaderboard.map((player, index) => (
            <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: player.id === socket.myId ? '#4CAF50' : '#fff', fontWeight: player.id === socket.myId ? 'bold' : 'normal', background: player.id === socket.myId ? 'rgba(76, 175, 80, 0.2)' : 'transparent', padding: '2px 5px', borderRadius: '4px' }}>
              <span><span style={{ color: '#888', marginRight: '8px', width: '20px', display: 'inline-block' }}>#{index + 1}</span>{player.name || 'Unknown'}</span>
              <span>{player.score}</span>
            </div>
          )) : <div style={{ textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Waiting...</div>}
        </div>
      </div>

      {/* 🟢 3. MINIMAP (Góc phải dưới) */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px',
        width: `${MINIMAP_SIZE}px`, height: `${MINIMAP_SIZE}px`,
        background: 'rgba(0, 0, 0, 0.8)',
        border: '2px solid #555', borderRadius: '5px',
        overflow: 'hidden'
      }}>
        {/* Grid lines */}
        <div style={{ position: 'absolute', top: '50%', width: '100%', height: '1px', background: '#333' }}></div>
        <div style={{ position: 'absolute', left: '50%', height: '100%', width: '1px', background: '#333' }}></div>

        {/* Chấm xanh của mình */}
        <div style={{ position: 'absolute', left: myMinimapPos.left, top: myMinimapPos.top, width: '6px', height: '6px', background: '#00FF00', borderRadius: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 0 4px #00FF00' }} />

        {/* Chấm vàng của Top 1 */}
        {kingMinimapPos && (
          <div style={{ position: 'absolute', left: kingMinimapPos.left, top: kingMinimapPos.top, width: '8px', height: '8px', background: '#FFD700', borderRadius: '50%', transform: 'translate(-50%, -50%)', border: '1px solid #000', zIndex: 1 }}>
            <div style={{ position: 'absolute', top: '-10px', left: '-3px', fontSize: '10px' }}>👑</div>
          </div>
        )}
      </div>

    </div>
  );
};

export default HUD;