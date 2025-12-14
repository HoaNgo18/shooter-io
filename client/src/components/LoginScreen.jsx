import React, { useState } from 'react';
import { socket } from '../network/socket';

const LoginScreen = ({ onJoin }) => {
  const [username, setUsername] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handlePlay = async () => {
    if (!username) return;
    setConnecting(true);
    try {
      await socket.connect(username);
      onJoin(); // Báo cho App biết đã kết nối xong
    } catch (err) {
      alert('Không thể kết nối Server!');
      setConnecting(false);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: 'rgba(0,0,0,0.8)', zIndex: 10
    }}>
      <div style={{
        background: '#fff', padding: '40px', borderRadius: '10px', textAlign: 'center'
      }}>
        <h1 style={{color: '#333'}}>IO GAME REACT</h1>
        <input 
          type="text" 
          placeholder="Nhập tên..." 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ padding: '10px', fontSize: '16px', marginBottom: '10px' }}
        />
        <br />
        <button 
          onClick={handlePlay} 
          disabled={connecting}
          style={{ padding: '10px 30px', background: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {connecting ? 'Đang kết nối...' : 'CHƠI NGAY'}
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;