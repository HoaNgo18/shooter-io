// client/src/game/ui/HUD.jsx

import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';

const HUD = () => {
  const [stats, setStats] = useState({ health: 100, maxHealth: 100, score: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    // Đăng ký nhận dữ liệu từ socket
    const unsubscribe = socket.subscribe((data) => {
      
      // Kiểm tra xem có dữ liệu players không (Gói tin UPDATE từ server gửi về)
      if (data.players) {
        
        // 1. CẬP NHẬT STATS (Máu, Score của bản thân)
        // Cần lấy ID của socket hiện tại để biết ai là "mình"
        const myId = socket.socket?.id; 
        const me = data.players.find(p => p.id === myId);

        if (me) {
          setStats({
            health: me.health,
            maxHealth: me.maxHealth,
            score: me.score
          });
        }

        // 2. CẬP NHẬT LEADERBOARD
        // Copy mảng để không ảnh hưởng dữ liệu gốc, sau đó sort
        const sorted = [...data.players].sort((a, b) => b.score - a.score);
        
        // Lấy top 10
        setLeaderboard(sorted.slice(0, 10));
      }
    });

    return () => unsubscribe();
  }, []);

  // Tính phần trăm máu
  const healthPercent = Math.max(0, (stats.health / stats.maxHealth) * 100);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', // Để click xuyên qua được xuống game
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif'
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
        
        {/* Thanh máu */}
        <div style={{ width: '200px', height: '20px', background: '#333', borderRadius: '10px', overflow: 'hidden', border: '2px solid #555' }}>
          <div style={{
            width: `${healthPercent}%`,
            height: '100%',
            background: healthPercent > 50 ? '#4CAF50' : healthPercent > 20 ? '#FFC107' : '#F44336',
            transition: 'width 0.2s ease-out' // Thêm ease-out cho mượt
          }} />
        </div>
        <div style={{ fontSize: '12px', marginTop: '5px', textAlign: 'center', color: '#ddd' }}>
          HP: {Math.round(stats.health)} / {stats.maxHealth}
        </div>
      </div>

      {/* 2. LEADERBOARD (Góc phải trên) */}
      <div style={{
        position: 'absolute', top: '20px', right: '20px',
        background: 'rgba(0,0,0,0.7)', padding: '15px', borderRadius: '10px',
        color: 'white', minWidth: '200px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '8px', color: '#FFD700', textAlign: 'center', fontSize: '16px' }}>
           🏆 Top Players
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {leaderboard.length > 0 ? (
            leaderboard.map((player, index) => {
              const isMe = player.id === socket.socket?.id;
              return (
                <div key={player.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: isMe ? '#4CAF50' : '#fff', // Màu xanh nếu là mình
                  fontWeight: isMe ? 'bold' : 'normal'
                }}>
                  <span>
                    <span style={{ color: '#888', marginRight: '8px', width: '20px', display: 'inline-block' }}>#{index + 1}</span>
                    {player.name || 'Unknown'}
                  </span>
                  <span>{player.score}</span>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '14px', color: '#aaa', textAlign: 'center' }}>Connecting...</div>
          )}
        </div>
      </div>

    </div>
  );
};

export default HUD;