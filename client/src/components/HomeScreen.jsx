import React, { useState, useEffect } from 'react';
import { socket } from '../network/socket'; // <--- 1. Import Socket trực tiếp
import { PacketType } from '../../../shared/src/packetTypes';

const HomeScreen = ({ user, onPlayClick, onLogout, onLoginSuccess }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [skins, setSkins] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [localUser, setLocalUser] = useState(user);
    const [showLogin, setShowLogin] = useState(!user);
    const [loginTab, setLoginTab] = useState('guest');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState('');
    const API_URL = 'http://localhost:8080/api';

    useEffect(() => {
        setLocalUser(user);
        setShowLogin(!user);
        if (user) {
            loadSkins();
            loadLeaderboard();
        }

        const handleSocketMessage = (data) => {
            // Socket.js mới đã parse JSON rồi, data ở đây là Object
            if (data.type === 'USER_DATA_UPDATE' || data.type === 'init') {
                console.log("Update received:", data);
                setLocalUser(prev => ({ ...prev, ...data }));
            }
        };

        // Đăng ký lắng nghe qua hàm subscribe của socket.js mới
        const unsubscribe = socket.subscribe(handleSocketMessage);
        return () => unsubscribe();
    }, [user]); // Bỏ dependency socket

    useEffect(() => {
        if (activeTab === 'leaderboard') loadLeaderboard();
    }, [activeTab]);

    const loadSkins = () => {
        setSkins([
            { id: 'default', name: 'DEFAULT', price: 0, color: '#9E9E9E' },
            { id: 'red', name: 'CRIMSON', price: 100, color: '#FF1744' },
            { id: 'blue', name: 'COBALT', price: 100, color: '#00E5FF' },
            { id: 'gold', name: 'GOLDEN AGE', price: 250, color: '#FFD700' },
            { id: 'dark', name: 'NIGHTMARE', price: 500, color: '#212121' },
        ]);
    };

    const loadLeaderboard = async () => {
        try {
            const res = await fetch(`${API_URL}/leaderboard`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setLeaderboard(data.map((p, i) => ({ rank: i + 1, username: p.username, score: p.highScore || 0 })));
        } catch (err) {
            setLeaderboard([]);
        }
    };

    // Login handlers
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
                    highScore: parsed.highScore || 0,
                    equippedSkin: parsed.equippedSkin || 'default'
                };
            } else {
                guestData = {
                    username: username,
                    coins: 0,
                    highScore: 0,
                    isGuest: true,
                    equippedSkin: 'default'
                };
            }
            setLocalUser(guestData);
            setShowLogin(false);
            onLoginSuccess(guestData);
        } catch (err) {
            setError('Cannot connect to game server!');
            setConnecting(false);
        }
    };

    const handleLogin = async () => {
        if (!username || !password) return setError('Missing login info');
        setError('');
        setConnecting(true);

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
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
                name: data.user.username
            });

            setLocalUser(data.user);
            setShowLogin(false);
            onLoginSuccess(data.user);
        } catch (err) {
            setError(err.message);
            setConnecting(false);
        }
    };

    const handleRegister = async () => {
        if (!username || !password || !email) return setError('Fill all fields');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return setError('Invalid email format');
        if (password.length < 6) return setError('Password must be at least 6 characters');
        setError('');
        setConnecting(true);

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Register failed');

            setError('Registration successful! Please login.');
            setLoginTab('login');
            setConnecting(false);
        } catch (err) {
            setError(err.message);
            setConnecting(false);
        }
    };

    // --- SỬA LỖI LOGIC GỬI PACKET ---
    const handleEquipSkin = (skinId) => {
        // 3. Gửi Object trực tiếp, KHÔNG dùng JSON.stringify
        socket.send({
            type: PacketType.EQUIP_SKIN,
            skinId: skinId
        });
    };

    const handleLogout = () => {
        onLogout();
        setShowLogin(true);
        setActiveTab('home');
    };

    // --- STYLES (Updated for ZombsRoyale style) ---
    const styles = {
        container: {
            width: '100vw', height: '100vh',
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
            // backgroundImage: 'url(https://example.com/game-bg.jpg)', // Add a game background image if available
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            color: '#fff', overflow: 'hidden',
            position: 'relative'
        },
        header: {
            position: 'absolute', top: '20px', right: '20px',
            display: 'flex', gap: '10px', zIndex: 10
        },
        loginBtn: {
            padding: '10px 20px', background: 'rgba(0,0,0,0.5)', border: '1px solid #FFD700',
            color: '#FFD700', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
        },
        logoutBtn: {
            padding: '10px 20px', background: 'rgba(255,0,0,0.5)', border: '1px solid #FF4444',
            color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
        },
        mainContent: {
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', textAlign: 'center'
        },
        title: {
            fontSize: '80px', fontWeight: '900', margin: 0,
            background: 'linear-gradient(45deg, #FFD700, #FF6B35)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(255,215,0,0.5)',
            letterSpacing: '-2px'
        },
        subtitle: {
            fontSize: '18px', color: '#ccc', marginTop: '10px', letterSpacing: '2px'
        },
        playBtn: {
            padding: '20px 60px', fontSize: '24px', fontWeight: 'bold',
            background: 'linear-gradient(45deg, #FFD700, #FFA500)',
            color: '#000', border: 'none', borderRadius: '8px',
            cursor: 'pointer', marginTop: '40px',
            boxShadow: '0 0 20px rgba(255,215,0,0.6)',
            transition: 'all 0.3s ease'
        },
        loginModal: {
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.9)', padding: '40px', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.2)', minWidth: '400px',
            zIndex: 20, display: showLogin ? 'block' : 'none'
        },
        modalOverlay: {
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.5)', zIndex: 15, display: showLogin ? 'block' : 'none'
        },
        input: {
            width: '100%', padding: '12px', margin: '10px 0',
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '4px', color: '#fff', fontSize: '16px'
        },
        btn: {
            width: '100%', padding: '12px', margin: '10px 0',
            background: '#FFD700', color: '#000', border: 'none',
            borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'
        },
        tabBtn: (active) => ({
            flex: 1, padding: '10px', background: active ? '#FFD700' : 'transparent',
            color: active ? '#000' : '#fff', border: 'none', cursor: 'pointer'
        }),
        error: { color: '#FF4444', marginTop: '10px' },
        menuCard: {
            width: '1000px', height: '650px',
            background: 'rgba(20, 20, 20, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            display: 'flex',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden'
        },
        sidebar: {
            width: '260px', background: 'rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', padding: '30px 0',
            borderRight: '1px solid rgba(255,255,255,0.05)'
        },
        content: {
            flex: 1, padding: '40px', overflowY: 'auto', position: 'relative'
        },
        userSection: { padding: '0 30px', marginBottom: '40px' },
        userName: { fontSize: '24px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '5px' },
        userCoin: { fontSize: '16px', color: '#FFD700', fontWeight: '600' },
        navBtn: (isActive) => ({
            padding: '15px 30px',
            background: isActive ? 'linear-gradient(90deg, rgba(255,215,0,0.15), transparent)' : 'transparent',
            border: 'none', borderLeft: isActive ? '4px solid #FFD700' : '4px solid transparent',
            color: isActive ? '#fff' : '#888',
            textAlign: 'left', cursor: 'pointer',
            fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase',
            transition: 'all 0.2s ease', outline: 'none'
        }),
        skinGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' },
        skinCard: (isActive, isOwned) => ({
            background: isActive ? 'rgba(255, 215, 0, 0.05)' : 'rgba(255,255,255,0.03)',
            border: isActive ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '20px', textAlign: 'center',
            cursor: 'default', position: 'relative'
        }),
        colorDot: (color) => ({
            width: '60px', height: '60px', borderRadius: '50%',
            background: color, margin: '0 auto 15px', boxShadow: `0 0 15px ${color}80`
        }),
        actionBtn: (type) => ({
            width: '100%', padding: '10px', marginTop: '15px',
            border: 'none', borderRadius: '4px',
            fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px',
            cursor: type === 'equipped' ? 'default' : 'pointer',
            background: type === 'buy' ? '#FFD700' : (type === 'equip' ? '#333' : '#4CAF50'),
            color: type === 'buy' ? '#000' : '#fff',
            opacity: type === 'equipped' ? 0.7 : 1
        }),
        leaderRow: {
            display: 'flex', justifyContent: 'space-between', padding: '15px',
            borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '14px'
        }
    };

    return (
        <div style={styles.container}>
            {/* Header with login/logout */}
            <div style={styles.header}>
                {localUser ? (
                    <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
                ) : (
                    <button style={styles.loginBtn} onClick={() => setShowLogin(true)}>Login</button>
                )}
            </div>

            {/* Main Content */}
            <div style={styles.mainContent}>
                <h1 style={styles.title}>SHOOTER<span style={{ color: '#FFD700' }}>.IO</span></h1>
                <p style={styles.subtitle}>Battle Royale Multiplayer</p>
                {localUser && (
                    <button
                        onClick={() => onPlayClick(localUser.equippedSkin)}
                        style={styles.playBtn}
                        onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                    >
                        PLAY NOW
                    </button>
                )}
            </div>

            {/* Menu Card if logged in */}
            {localUser && (
                <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
                    <div style={styles.menuCard}>
                        <div style={styles.sidebar}>
                            <div style={styles.userSection}>
                                <div style={styles.userName}>{localUser.username}</div>
                                <div style={styles.userCoin}>{localUser.coins} COINS</div>
                            </div>
                            <button style={styles.navBtn(activeTab === 'home')} onClick={() => setActiveTab('home')}>Home</button>
                            <button style={styles.navBtn(activeTab === 'shop')} onClick={() => setActiveTab('shop')}>Shop</button>
                            <button style={styles.navBtn(activeTab === 'profile')} onClick={() => setActiveTab('profile')}>Profile</button>
                            <button style={styles.navBtn(activeTab === 'leaderboard')} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
                        </div>

                        <div style={styles.content}>
                            {activeTab === 'home' && (
                                <div style={{ textAlign: 'center', paddingTop: '50px' }}>
                                    <h2>Welcome back, {localUser.username}!</h2>
                                    <p>Ready to dominate the battlefield?</p>
                                    <button
                                        onClick={() => onPlayClick(localUser.equippedSkin)}
                                        style={styles.playBtn}
                                        onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
                                        onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                                    >
                                        PLAY NOW
                                    </button>
                                </div>
                            )}

                            {activeTab === 'shop' && (
                                <div>
                                    <h2 style={{ fontSize: '24px', marginBottom: '30px', textTransform: 'uppercase', borderBottom: '2px solid #FFD700', display: 'inline-block' }}>Skin Collection</h2>
                                    <div style={styles.skinGrid}>
                                        {skins.map(s => {
                                            const isOwned = localUser.skins?.includes(s.id) || s.price === 0;
                                            const isEquipped = localUser.equippedSkin === s.id;

                                            return (
                                                <div key={s.id} style={styles.skinCard(isEquipped, isOwned)}>
                                                    <div style={styles.colorDot(s.color)}></div>
                                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.name}</div>

                                                    {isOwned ? (
                                                        <button
                                                            onClick={() => handleEquipSkin(s.id)}
                                                            style={styles.actionBtn(isEquipped ? 'equipped' : 'equip')}
                                                            disabled={isEquipped}
                                                        >
                                                            {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleBuySkin(s.id)}
                                                            style={styles.actionBtn('buy')}
                                                        >
                                                            BUY {s.price}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'profile' && (
                                <div>
                                    <h2 style={{ fontSize: '24px', marginBottom: '30px', textTransform: 'uppercase' }}>Combat Stats</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                                        {[
                                            { label: 'High Score', val: localUser.highScore || 0, color: '#FFD700' },
                                            { label: 'Total Kills', val: localUser.totalKills || 0, color: '#00E5FF' },
                                            { label: 'Deaths', val: localUser.totalDeaths || 0, color: '#FF4444' }
                                        ].map((stat, idx) => (
                                            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '30px', borderRadius: '8px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '48px', fontWeight: 'bold', color: stat.color, marginBottom: '10px' }}>{stat.val}</div>
                                                <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '2px' }}>{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'leaderboard' && (
                                <div>
                                    <h2 style={{ fontSize: '24px', marginBottom: '30px', textTransform: 'uppercase' }}>TOP PLAYERS</h2>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
                                        {leaderboard.map((p, idx) => (
                                            <div key={idx} style={styles.leaderRow}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                    <span style={{ color: idx < 3 ? '#FFD700' : '#666', fontWeight: 'bold', width: '20px' }}>#{p.rank}</span>
                                                    <span style={{ fontWeight: '600' }}>{p.username}</span>
                                                </div>
                                                <div style={{ color: '#FFD700', fontWeight: 'bold' }}>{p.score}</div>
                                            </div>
                                        ))}
                                        {leaderboard.length === 0 && <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>No data yet</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Login Modal */}
            <div style={styles.modalOverlay} onClick={() => setShowLogin(false)}></div>
            <div style={styles.loginModal}>
                <div style={{ display: 'flex', marginBottom: '20px' }}>
                    <button style={styles.tabBtn(loginTab === 'guest')} onClick={() => setLoginTab('guest')}>Guest</button>
                    <button style={styles.tabBtn(loginTab === 'login')} onClick={() => setLoginTab('login')}>Login</button>
                    <button style={styles.tabBtn(loginTab === 'register')} onClick={() => setLoginTab('register')}>Register</button>
                </div>

                {loginTab === 'guest' && (
                    <div>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={styles.input}
                        />
                        <button onClick={handleGuestPlay} disabled={connecting} style={styles.btn}>
                            {connecting ? 'Connecting...' : 'Play as Guest'}
                        </button>
                    </div>
                )}

                {loginTab === 'login' && (
                    <div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={styles.input}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                        />
                        <input
                            type="text"
                            placeholder="Display Name (optional)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            style={styles.input}
                        />
                        <button onClick={handleLogin} disabled={connecting} style={styles.btn}>
                            {connecting ? 'Logging in...' : 'Login'}
                        </button>
                    </div>
                )}

                {loginTab === 'register' && (
                    <div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={styles.input}
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                        />
                        <input
                            type="text"
                            placeholder="Display Name (optional)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            style={styles.input}
                        />
                        <button onClick={handleRegister} disabled={connecting} style={styles.btn}>
                            {connecting ? 'Registering...' : 'Register'}
                        </button>
                    </div>
                )}

                {error && <div style={styles.error}>{error}</div>}
            </div>
        </div>
    );
};

export default HomeScreen;