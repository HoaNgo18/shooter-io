// client/src/components/LoginScreen.jsx
import React, { useState, useEffect } from 'react';
import { socket } from '../network/socket';
import AuthModal from './AuthModal';

const API_URL = 'http://localhost:8080/api/auth'; // URL Backend của bạn

const LoginScreen = ({ onJoin }) => {
  const [tab, setTab] = useState('guest'); // 'guest', 'login', 'register'
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const [displayName, setDisplayName] = useState('');

  // Tự động điền token nếu đã lưu trước đó
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (savedToken && user) {
      try {
        const userData = JSON.parse(user);
        setPlayerName(userData.gameDisplayName || userData.username || '');
        setIsLoggedIn(true);
      } catch (e) {
        console.log('Error parsing user from localStorage');
      }
    }
  }, []);

  // Ngăn chặn sự kiện bắn lan khi nhấn Enter trong form
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  const handleGuestPlay = async () => {
    if (!username) {
      setError('Vui lòng nhập tên!');
      return;
    }
    setConnecting(true);
    try {
      await socket.connect({ name: username, isGuest: true });
      onJoin();
    } catch (err) {
      setError('Không thể kết nối Server Game!');
      setConnecting(false);
    }
  };

  const handleLoginSuccess = async () => {
    setConnecting(true);
    try {
      await socket.connect({
        token: localStorage.getItem('token'),
        name: playerName,
        isLoggedIn: true
      });
      onJoin();
    } catch (err) {
      setError('Không thể kết nối Server Game!');
      setConnecting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setPlayerName('');
    setIsLoggedIn(false);
    setError('');
  };

  const handleRegister = async () => {
    if (!username || !password || !email) return setError('Điền đầy đủ thông tin!');
    setError('');
    setConnecting(true);

    try {
      // 1. Gọi API Register
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');

      // 2. Lưu token & Login luôn
      localStorage.setItem('game_token', data.token);

      // 3. Kết nối Socket
      await socket.connect({
        token: data.token,
        name: displayName || username
      });
      onJoin();

    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
  };

  // Styles đơn giản
  const inputStyle = { padding: '10px', fontSize: '16px', marginBottom: '10px', width: '100%', boxSizing: 'border-box' };
  const btnStyle = { padding: '10px', width: '100%', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '5px', marginTop: '10px' };
  const tabStyle = (isActive) => ({
    padding: '10px 20px', cursor: 'pointer', borderBottom: isActive ? '3px solid #4CAF50' : '3px solid transparent', color: isActive ? '#4CAF50' : '#888', fontWeight: 'bold'
  });

  return (
    <>
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={(userData) => {
            setUser(userData);
            setPlayerName(userData.gameDisplayName || userData.username);
            setIsLoggedIn(true);
            setShowAuthModal(false);
          }}
        />
      )}

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 10 }}>
        {/* TÊN NGƯỜI CHƠI - GÓC TRÁI TRÊN */}
        {playerName && (
          <div style={{
            position: 'absolute', top: '20px', left: '20px',
            color: '#4CAF50', fontSize: '18px', fontWeight: 'bold',
            textShadow: '0 0 8px rgba(76,175,80,0.5)',
            padding: '8px 15px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '5px',
            border: '1px solid #4CAF50'
          }}>
            👤 {playerName}
          </div>
        )}

        {/* NÚT LOGIN - GÓC PHẢI TRÊN */}
        <button
          onClick={() => isLoggedIn ? handleLogout() : setShowAuthModal(true)}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '12px 30px',
            background: isLoggedIn ? '#f44336' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 4px 10px rgba(76, 175, 80, 0.3)',
            transition: 'all 0.3s',
            zIndex: 11
          }}
          onMouseOver={(e) => {
            e.target.style.background = isLoggedIn ? '#da190b' : '#45a049';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = isLoggedIn ? '#f44336' : '#4CAF50';
            e.target.style.transform = 'scale(1)';
          }}
        >
          {isLoggedIn ? '🚪 ĐĂNG XUẤT' : '🔑 ĐĂNG NHẬP'}
        </button>

        <div style={{ background: '#fff', padding: '30px', borderRadius: '10px', width: '350px', textAlign: 'center' }}>
          <h1 style={{ color: '#333', marginTop: 0 }}>MY IO GAME</h1>

          {/* ERROR MSG */}
          {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}

          {/* GUEST FORM ONLY */}
          <div>
            {!isLoggedIn && (
              <input type="text" placeholder="Tên nhân vật..." style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} onKeyDown={stopPropagation} />
            )}
            {isLoggedIn && (
              <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(76,175,80,0.1)', borderRadius: '5px', border: '1px solid #4CAF50' }}>
                <p style={{ margin: 0, color: '#4CAF50', fontWeight: 'bold', fontSize: '14px' }}>Chào mừng, {playerName}!</p>
              </div>
            )}
            <button onClick={() => {
              if (isLoggedIn) {
                handleLoginSuccess();
              } else {
                handleGuestPlay();
              }
            }} disabled={connecting || (!isLoggedIn && !username)} style={{ ...btnStyle, background: '#FF9800', color: 'white' }}>
              {connecting ? 'ĐANG VÀO...' : 'CHƠI NGAY'}
            </button>
          </div>
      </div>
      </div>
    </>
  );
};

const tabStyle = (isActive) => ({
  padding: '10px 20px', cursor: 'pointer', borderBottom: isActive ? '3px solid #4CAF50' : '3px solid transparent', color: isActive ? '#4CAF50' : '#888', fontWeight: 'bold'
});

export default LoginScreen;