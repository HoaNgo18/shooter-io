import React from 'react';
import { socket } from '../network/socket';
import { PacketType } from '@shared/packetTypes';

const DeathScreen = ({ killerName, score, onQuit }) => {
  
  // Kiểm tra xem có phải tự sát không?
  // Lưu ý: Server cần gửi killerName trùng với tên mình nếu tự sát, 
  // hoặc chúng ta so sánh ID nếu App.jsx truyền xuống (ở đây làm đơn giản theo tên)
  const isSuicide = killerName === socket.gameScene?.players?.[socket.myId]?.name;

  const handleRespawn = () => {
    socket.send({ type: PacketType.RESPAWN });
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0, 0, 0, 0.85)', // Tối hơn chút cho rõ
      backdropFilter: 'blur(4px)',       // Làm mờ nền đằng sau
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      color: 'white', zIndex: 100,
      fontFamily: 'Arial, sans-serif'
    }}>
      
      {/* Tiêu đề */}
      <h1 style={{ 
        color: '#FF4444', 
        fontSize: '60px', 
        margin: '0 0 10px 0',
        textTransform: 'uppercase',
        letterSpacing: '5px',
        textShadow: '0 0 20px rgba(255, 0, 0, 0.5)'
      }}>
        YOU DIED
      </h1>

      {/* Thông tin kẻ giết */}
      <div style={{ fontSize: '24px', marginBottom: '20px', color: '#ddd' }}>
        {isSuicide ? (
          <span>💔 Bạn đã tự sát!</span>
        ) : (
          <span>
            Bị hạ gục bởi: <strong style={{ color: '#FFD700', fontSize: '28px' }}>{killerName || 'Unknown'}</strong>
          </span>
        )}
      </div>

      {/* Điểm số */}
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        padding: '15px 40px', 
        borderRadius: '10px',
        marginBottom: '40px',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <span style={{ fontSize: '20px', marginRight: '10px' }}>Final Score:</span>
        <strong style={{ fontSize: '32px', color: '#4CAF50' }}>{score}</strong>
      </div>
      
      {/* Nút bấm */}
      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          onClick={handleRespawn}
          style={{
            padding: '15px 40px', fontSize: '18px', fontWeight: 'bold',
            background: 'linear-gradient(to bottom, #4CAF50, #388E3C)',
            color: 'white', border: 'none',
            borderRadius: '8px', cursor: 'pointer',
            boxShadow: '0 4px 0 #2E7D32',
            transition: 'transform 0.1s'
          }}
          onMouseDown={e => e.target.style.transform = 'translateY(4px)'}
          onMouseUp={e => e.target.style.transform = 'translateY(0)'}
        >
          CHƠI LẠI
        </button>

        <button 
          onClick={onQuit}
          style={{
            padding: '15px 40px', fontSize: '18px', fontWeight: 'bold',
            background: 'linear-gradient(to bottom, #FF5252, #D32F2F)',
            color: 'white', border: 'none',
            borderRadius: '8px', cursor: 'pointer',
            boxShadow: '0 4px 0 #C62828',
            transition: 'transform 0.1s'
          }}
          onMouseDown={e => e.target.style.transform = 'translateY(4px)'}
          onMouseUp={e => e.target.style.transform = 'translateY(0)'}
        >
          THOÁT
        </button>
      </div>
    </div>
  );
};

export default DeathScreen;