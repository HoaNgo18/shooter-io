import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';
import { PacketType } from '@shared/packetTypes'; // Đảm bảo đường dẫn đúng

const HUD = () => {
  const [stats, setStats] = useState({ health: 100, maxHealth: 100, score: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = socket.subscribe((packet) => {
      
      // Nếu nhận được gói tin, tức là đã kết nối
      setIsConnected(true);

      // Chỉ xử lý khi có danh sách players (Gói UPDATE hoặc INIT)
      if (packet.players) {
        
        // 1. TÌM BẢN THÂN TRONG DANH SÁCH
        // Dùng socket.myId (đã lưu ở bước trước) để tìm chính xác player của mình
        const myId = socket.myId;
        const me = packet.players.find(p => p.id === myId);

        if (me) {
          setStats({
            health: me.health,
            maxHealth: me.maxHealth,
            score: me.score
          });
        }

        // 2. CẬP NHẬT LEADERBOARD
        const sorted = [...packet.players].sort((a, b) => b.score - a.score);
        setLeaderboard(sorted.slice(0, 10));
      }
    });

    return () => unsubscribe();
  }, []);

  // Tính phần trăm máu an toàn (tránh chia cho 0)
  const healthPercent = stats.maxHealth > 0 
    ? Math.max(0, (stats.health / stats.maxHealth) * 100) 
    : 0;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none',
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
        <div style={{ 
          width: '200px', height: '20px', 
          background: '#333', borderRadius: '10px', 
          overflow: 'hidden', border: '2px solid #555',
          position: 'relative'
        }}>
          <div style={{
            width: `${healthPercent}%`,
            height: '100%',
            background: healthPercent > 50 ? '#4CAF50' : healthPercent > 20 ? '#FFC107' : '#F44336',
            transition: 'width 0.2s ease-out'
          }} />
          
          {/* Text hiển thị số máu đè lên thanh */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 'bold', textShadow: '1px 1px 2px black'
          }}>
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
        <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '8px', color: '#FFD700', textAlign: 'center', fontSize: '16px' }}>
           🏆 Top Players
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {leaderboard.length > 0 ? (
            leaderboard.map((player, index) => {
              // So sánh ID để highlight tên mình
              const isMe = player.id === socket.myId;
              
              return (
                <div key={player.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: isMe ? '#4CAF50' : '#fff',
                  fontWeight: isMe ? 'bold' : 'normal',
                  background: isMe ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                  padding: '2px 5px',
                  borderRadius: '4px'
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
            <div style={{ fontSize: '14px', color: '#aaa', textAlign: 'center' }}>
                {isConnected ? "Waiting for players..." : "Connecting..."}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default HUD;