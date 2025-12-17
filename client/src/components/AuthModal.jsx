import React, { useState } from 'react';

const AuthModal = ({ onClose, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Login form
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Register form
  const [registerData, setRegisterData] = useState({
    email: '',
    gameDisplayName: '',
    password: '',
    confirmPassword: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Lưu token và user info vào localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Báo cho parent
      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setError('Không thể kết nối server');
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!registerData.email || !registerData.gameDisplayName || !registerData.password) {
      setError('❌ Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (registerData.password.length < 6) {
      setError('❌ Mật khẩu phải có tối thiểu 6 ký tự');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      setError('❌ Mật khẩu không khớp');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerData.email,
          gameDisplayName: registerData.gameDisplayName,
          password: registerData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Lưu token và user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setError('Không thể kết nối server');
      setLoading(false);
    }
  };

  const tabStyle = (isActive) => ({
    flex: 1,
    padding: '12px',
    cursor: 'pointer',
    border: 'none',
    background: isActive ? '#4CAF50' : '#333',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'all 0.3s',
    borderRadius: isActive ? '5px 0 0 0' : '0'
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100
    }}>
      <div style={{
        background: '#1a1a1a',
        borderRadius: '15px',
        maxWidth: '420px',
        width: '90%',
        color: 'white',
        border: '2px solid #4CAF50',
        overflow: 'hidden'
      }}>
        {/* TAB BUTTONS */}
        <div style={{ display: 'flex', gap: '0' }}>
          <button
            onClick={() => setActiveTab('login')}
            style={tabStyle(activeTab === 'login')}
          >
            🔑 ĐĂNG NHẬP
          </button>
          <button
            onClick={() => setActiveTab('register')}
            style={tabStyle(activeTab === 'register')}
          >
            ✎ ĐĂNG KÝ
          </button>
        </div>

        {/* CONTENT */}
        <div style={{ padding: '40px' }}>
          {error && (
            <div style={{
              background: '#FF5252',
              color: 'white',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              ❌ {error}
            </div>
          )}

          {/* LOGIN TAB */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#4CAF50' }}>
                ĐĂNG NHẬP
              </h2>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#333',
                    border: '1px solid #555',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#333',
                    border: '1px solid #555',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? '⏳ Đang xử lý...' : '🔑 ĐĂNG NHẬP'}
              </button>
            </form>
          )}

          {/* REGISTER TAB */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#4CAF50' }}>
                ĐĂNG KÝ TÀI KHOẢN
              </h2>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Email của bạn"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#333',
                    border: '1px solid #555',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                  Tên người chơi trong game
                </label>
                <input
                  type="text"
                  placeholder="Tên nhân vật của bạn"
                  value={registerData.gameDisplayName}
                  onChange={(e) => setRegisterData({...registerData, gameDisplayName: e.target.value})}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#333',
                    border: '1px solid #555',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#333',
                    border: '1px solid #555',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                  Xác nhận Password
                </label>
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#333',
                    border: '1px solid #555',
                    color: 'white',
                    borderRadius: '5px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginBottom: '10px',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? '⏳ Đang xử lý...' : '✎ ĐĂNG KÝ'}
              </button>
            </form>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              background: '#333',
              color: '#aaa',
              border: '1px solid #555',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✕ ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
