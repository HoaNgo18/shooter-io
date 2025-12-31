import React, { useState, useEffect } from 'react';
import { socket } from '../network/socket';
import './LoginScreen.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API_URL = `${BASE_URL}/api/auth`;

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
      setTab('login');
    }
  }, []);

  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  const handleGuestPlay = async () => {
    if (!username) {
      setError('Please enter a name!');
      return;
    }
    setConnecting(true);
    try {
      await socket.connect({ name: username });
      const savedGuest = localStorage.getItem('guest_data');
      let guestData;
      if (savedGuest) {
        const parsed = JSON.parse(savedGuest);
        guestData = {
          ...parsed,
          username: username,
          isGuest: true,
          totalKills: parsed.totalKills || 0,
          totalDeaths: parsed.totalDeaths || 0,
          coins: parsed.coins || 0,
          highScore: parsed.highScore || 0
        };
      } else {
        guestData = {
          username: username,
          coins: 0,
          highScore: 0,
          isGuest: true
        };
      }
      onLoginSuccess({ username: username, coins: 0, highScore: 0, isGuest: true });
    } catch (err) {
      setError('Cannot connect to Game Server!');
      setConnecting(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) return setError('Missing login info');
    setError('');
    setConnecting(true);

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('game_token', data.token);
      localStorage.setItem('game_username', data.user.username);

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
    if (!username || !password || !email) return setError('Please fill all fields!');
    setError('');
    setConnecting(true);

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('game_token', data.token);

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

  return (
    <div className="login-screen-overlay">
      <div className="login-card">
        <h1 className="login-title">MY IO GAME</h1>

        {/* TABS */}
        <div className="login-tabs">
          <div onClick={() => setTab('guest')} className={`login-tab-btn ${tab === 'guest' ? 'active' : ''}`}>GUEST</div>
          <div onClick={() => setTab('login')} className={`login-tab-btn ${tab === 'login' ? 'active' : ''}`}>LOGIN</div>
          <div onClick={() => setTab('register')} className={`login-tab-btn ${tab === 'register' ? 'active' : ''}`}>SIGN UP</div>
        </div>

        {/* ERROR MSG */}
        {error && <div className="login-error">{error}</div>}

        {/* GUEST FORM */}
        {tab === 'guest' && (
          <div>
            <input type="text" placeholder="Enter name..." className="form-input" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={stopPropagation} />
            <button onClick={handleGuestPlay} disabled={connecting} className="submit-btn guest-btn">
              {connecting ? 'JOINING...' : 'PLAY AS GUEST'}
            </button>
          </div>
        )}

        {/* LOGIN FORM */}
        {tab === 'login' && (
          <div>
            <input type="text" placeholder="Username" className="form-input" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={stopPropagation} />
            <input type="password" placeholder="Password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={stopPropagation} />
            <div className="optional-field">
              <label className="optional-label">Display Name (Optional):</label>
              <input
                type="text"
                placeholder={username || "Display Name..."}
                className="form-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={stopPropagation}
              />
            </div>
            <button onClick={handleLogin} disabled={connecting} className="submit-btn login-btn">
              {connecting ? 'CONNECTING...' : 'LOGIN & PLAY'}
            </button>
          </div>
        )}

        {/* REGISTER FORM */}
        {tab === 'register' && (
          <div>
            <input type="text" placeholder="Username" className="form-input" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={stopPropagation} />
            <input type="email" placeholder="Email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Password" className="form-input" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={stopPropagation} />
            <div className="optional-field">
              <label className="optional-label">Display Name (Optional):</label>
              <input
                type="text"
                placeholder={username || "Display Name..."}
                className="form-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={stopPropagation}
              />
            </div>
            <button onClick={handleRegister} disabled={connecting} className="submit-btn register-btn">
              {connecting ? 'REGISTERING...' : 'REGISTER & PLAY'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;