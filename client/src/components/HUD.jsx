import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';

const HUD = () => {
  const [stats, setStats] = useState({ health: 100, maxHealth: 100, score: 0 });
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    // Đăng ký nhận dữ liệu từ socket
    const unsubscribe = socket.subscribe((data) => {
      if (data.type === 'GAME_UPDATE' && data.me) {
        setStats({
          health: data.me.health,
          maxHealth: data.me.maxHealth,
          score: data.me.score
        });
        
        // Lưu ý: Logic Leaderboard nên được tính ở server gửi về sẽ chuẩn hơn
        // Nhưng tạm thời ta có thể lấy danh sách player từ packet update
      }
    });

    return () => unsubscribe();
  }, []);

  // Tính phần trăm máu
  const healthPercent = (stats.health / stats.maxHealth) * 100;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', // Để click xuyên qua được xuống game
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      
      {/* 1. THANH MÁU & ĐIỂM (Góc trái dưới) */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '20px',
        background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '10px',
        color: 'white', fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ marginBottom: '5px', fontSize: '18px', fontWeight: 'bold' }}>
          Score: <span style={{ color: '#FFD700' }}>{stats.score}</span>
        </div>
        
        {/* Thanh máu */}
        <div style={{ width: '200px', height: '20px', background: '#333', borderRadius: '10px', overflow: 'hidden', border: '2px solid white' }}>
          <div style={{
            width: `${healthPercent}%`,
            height: '100%',
            background: healthPercent > 50 ? '#4CAF50' : healthPercent > 20 ? '#FFC107' : '#F44336',
            transition: 'width 0.2s'
          }} />
        </div>
        <div style={{ fontSize: '12px', marginTop: '5px', textAlign: 'center' }}>
          HP: {Math.round(stats.health)} / {stats.maxHealth}
        </div>
      </div>

      {/* 2. LEADERBOARD (Góc phải trên) */}
      <div style={{
        position: 'absolute', top: '20px', right: '20px',
        background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '10px',
        color: 'white', minWidth: '150px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px', color: '#FFD700' }}>
          Top Players
        </h3>
        {/* Tạm thời hiển thị placeholder */}
        <div style={{ fontSize: '14px', color: '#aaa' }}>Processing...</div>
      </div>

    </div>
  );
};

export default HUD;