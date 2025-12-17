// client/src/components/LoginScreen.jsx
import React, { useState, useEffect } from 'react';
import { socket } from '../network/socket';

const API_URL = 'http://localhost:8080/api/auth'; // URL Backend của bạn

const LoginScreen = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState('guest'); // 'guest', 'login', 'register'
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  const [displayName, setDisplayName] = useState('');

  // Tự động điền token nếu đã lưu trước đó
  useEffect(() => {
    const savedToken = localStorage.getItem('game_token');
    const savedName = localStorage.getItem('game_username');
    if (savedToken && savedName) {
      setTab('login'); // Chuyển sang tab login để người dùng biết mình đang có acc
      // Bạn có thể thêm logic tự động login ở đây nếu muốn
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
      await socket.connect({ name: username });
      const savedGuest = localStorage.getItem('guest_data');
      let guestData;
      if (savedGuest) {
        // Nếu có, lấy coin và highscore cũ, nhưng update tên mới (nếu người chơi đổi tên)
        const parsed = JSON.parse(savedGuest);
        guestData = {
          ...parsed,
          username: username,
          isGuest: true,
          // Đảm bảo load đủ các trường này (nếu thiếu thì gán = 0)
          totalKills: parsed.totalKills || 0,
          totalDeaths: parsed.totalDeaths || 0,
          coins: parsed.coins || 0,
          highScore: parsed.highScore || 0
        };
      } else {
        // Nếu chưa có, tạo mới
        guestData = {
          username: username,
          coins: 0,
          highScore: 0,
          isGuest: true
        };
      }
      onLoginSuccess({ username: username, coins: 0, highScore: 0, isGuest: true });
    } catch (err) {
      setError('Không thể kết nối Server Game!');
      setConnecting(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) return setError('Thiếu thông tin đăng nhập');
    setError('');
    setConnecting(true);

    try {
      // 1. Gọi API Login
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

      // 2. Lưu token
      localStorage.setItem('game_token', data.token);
      localStorage.setItem('game_username', data.user.username);

      // 3. Kết nối Socket
      await socket.connect({
        token: data.token,
        name: displayName || data.user.username
      });

      onLoginSuccess({
        username: data.user.username,
        email: data.user.email,
        coins: data.user.coins || 0,
        highScore: data.user.highScore || 0,
        totalKills: data.user.totalKills || 0,
        totalDeaths: data.user.totalDeaths || 0,
        isGuest: false
      });

    } catch (err) {
      setError(err.message);
      setConnecting(false);
    }
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
      onLoginSuccess(data.user);

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
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 10 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '10px', width: '350px', textAlign: 'center' }}>
        <h1 style={{ color: '#333', marginTop: 0 }}>MY IO GAME</h1>

        {/* TABS */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '20px', borderBottom: '1px solid #eee' }}>
          <div onClick={() => setTab('guest')} style={tabStyle(tab === 'guest')}>GUEST</div>
          <div onClick={() => setTab('login')} style={tabStyle(tab === 'login')}>LOGIN</div>
          <div onClick={() => setTab('register')} style={tabStyle(tab === 'register')}>SIGN UP</div>
        </div>

        {/* ERROR MSG */}
        {error && <div style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}

        {/* GUEST FORM */}
        {tab === 'guest' && (
          <div>
            <input type="text" placeholder="Tên nhân vật..." style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} onKeyDown={stopPropagation} />
            <button onClick={handleGuestPlay} disabled={connecting} style={{ ...btnStyle, background: '#FF9800', color: 'white' }}>
              {connecting ? 'ĐANG VÀO...' : 'CHƠI NGAY'}
            </button>
          </div>
        )}

        {/* LOGIN FORM */}
        {tab === 'login' && (
          <div>
            <input type="text" placeholder="Tên đăng nhập" style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} onKeyDown={stopPropagation} />
            <input type="password" placeholder="Mật khẩu" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={stopPropagation} />
            <div style={{ margin: '15px 0', borderTop: '1px dashed #ccc', paddingTop: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px', textAlign: 'left' }}>Tên hiển thị trong game (Tùy chọn):</label>
              <input
                type="text"
                placeholder={username || "Tên nhân vật..."} // Placeholder gợi ý theo username
                style={inputStyle}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={stopPropagation}
              />
            </div>
            <button onClick={handleLogin} disabled={connecting} style={{ ...btnStyle, background: '#4CAF50', color: 'white' }}>
              {connecting ? 'ĐANG KẾT NỐI...' : 'ĐĂNG NHẬP & CHƠI'}
            </button>
          </div>
        )}

        {/* REGISTER FORM */}
        {tab === 'register' && (
          <div>
            <input type="text" placeholder="Tên đăng nhập" style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} onKeyDown={stopPropagation} />
            <input type="email" placeholder="Email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Mật khẩu" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={stopPropagation} />
            <div style={{ margin: '15px 0', borderTop: '1px dashed #ccc', paddingTop: '10px' }}>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px', textAlign: 'left' }}>Tên trong game (Tùy chọn):</label>
              <input
                type="text"
                placeholder={username || "Tên nhân vật..."}
                style={inputStyle}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={stopPropagation}
              />
            </div>
            <button onClick={handleRegister} disabled={connecting} style={{ ...btnStyle, background: '#2196F3', color: 'white' }}>
              {connecting ? 'ĐANG ĐĂNG KÝ...' : 'ĐĂNG KÝ & CHƠI'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;