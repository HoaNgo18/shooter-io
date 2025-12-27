import React, { useState, useEffect } from 'react';
import { socket } from '../network/socket';
import { PacketType } from '../../../shared/src/packetTypes';
import './HomeScreen.css';

const SKIN_IMAGES = {
    'default': '/Ships/playerShip1_red.png',
    'ship_1': '/Ships/playerShip2_red.png',
    'ship_2': '/Ships/playerShip3_red.png',
    'ship_3': '/Ships/ufoRed.png',
    'ship_4': '/Ships/spaceShips_001.png',
    'ship_5': '/Ships/spaceShips_002.png',
    'ship_6': '/Ships/spaceShips_004.png',
    'ship_7': '/Ships/spaceShips_007.png',
    'ship_8': '/Ships/spaceShips_008.png',
    'ship_9': '/Ships/spaceShips_009.png'
};

const HomeScreen = ({ user, onPlayClick, onArenaClick, onLogout, onLoginSuccess }) => {
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
    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
    const API_URL = `${BASE_URL}/api`;

    useEffect(() => {
        setLocalUser(user);
        setShowLogin(!user);
        if (user) {
            loadSkins();
            loadLeaderboard();
        }

        const handleSocketMessage = (data) => {
            if (data.type === 'USER_DATA_UPDATE' || data.type === 'init') {
                setLocalUser(prev => ({ ...prev, ...data }));
            }
        };

        const unsubscribe = socket.subscribe(handleSocketMessage);
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (activeTab === 'leaderboard') loadLeaderboard();
    }, [activeTab]);

    const loadSkins = () => {
        setSkins([
            { id: 'default', name: 'Starter Red', price: 0 },
            { id: 'ship_1', name: 'Interceptor', price: 100 },
            { id: 'ship_2', name: 'Bomber', price: 250 },
            { id: 'ship_3', name: 'UFO Red', price: 500 },
            { id: 'ship_4', name: 'Scout', price: 1000 },
            { id: 'ship_5', name: 'Frigate', price: 1500 },
            { id: 'ship_6', name: 'Destroyer', price: 2000 },
            { id: 'ship_7', name: 'Speeder', price: 3000 },
            { id: 'ship_8', name: 'Tanker', price: 4000 },
            { id: 'ship_9', name: 'Mothership', price: 5000 }
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
                body: JSON.stringify({ username, password, displayName })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('game_token', data.token);
            localStorage.setItem('game_username', data.user.username);

            await socket.connect({
                token: data.token,
                name: data.user.displayName || data.user.username
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
                body: JSON.stringify({ username, password, email, displayName })
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

    const handleEquipSkin = (skinId) => {
        socket.send({
            type: PacketType.EQUIP_SKIN,
            skinId: skinId
        });
    };

    const handleBuySkin = (skinId) => {
        socket.send({
            type: PacketType.BUY_SKIN,
            skinId: skinId
        });
    };

    const handleLogout = () => {
        onLogout();
        setShowLogin(true);
        setActiveTab('home');
    };

    return (
        <div className="home-container">
            {/* Header with login/logout */}
            <div className="home-header">
                {localUser ? (
                    <button className="auth-btn logout-btn" onClick={handleLogout}>Logout</button>
                ) : (
                    <button className="auth-btn login-btn" onClick={() => setShowLogin(true)}>Login</button>
                )}
            </div>

            {/* Main Content */}
            <div className="main-content">
                <h1 className="game-title">SHOOTER<span style={{ color: '#FFD700' }}>.IO</span></h1>
                <p className="game-subtitle">Battle Royale Multiplayer</p>
                {localUser && (
                    <div className="button-container">
                        <button
                            onClick={() => onPlayClick(localUser.equippedSkin)}
                            className="game-mode-btn play-btn"
                        >
                            ENDLESS
                        </button>

                        <button
                            onClick={() => onArenaClick(localUser.equippedSkin)}
                            className="game-mode-btn arena-btn"
                        >
                            ARENA
                        </button>
                    </div>
                )}
            </div>

            {/* Menu Card if logged in */}
            {localUser && (
                <div className="menu-card-container">
                    <div className="menu-card">
                        <div className="menu-sidebar">
                            <div className="user-section">
                                <div className="user-name">{localUser.username}</div>
                                <div className="user-coin">{localUser.coins} COINS</div>
                            </div>
                            <button className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>Home</button>
                            <button className={`nav-btn ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>Shop</button>
                            <button className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
                            <button className={`nav-btn ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
                        </div>

                        <div className="menu-content">
                            {activeTab === 'home' && (
                                <div className="button-container">
                                    <h2>Welcome back, {localUser.username}!</h2>
                                    <p>Ready to dominate the battlefield?</p>
                                    <button
                                        onClick={() => onPlayClick(localUser.equippedSkin)}
                                        className="game-mode-btn play-btn"
                                    >
                                        ENDLESS
                                    </button>

                                    <button
                                        onClick={() => onArenaClick(localUser.equippedSkin)}
                                        className="game-mode-btn arena-btn"
                                    >
                                        ARENA
                                    </button>
                                </div>
                            )}

                            {activeTab === 'shop' && (
                                <div>
                                    <h2 className="section-title">Skin Collection</h2>
                                    <div className="skin-grid">
                                        {skins.map(s => {
                                            const isOwned = localUser.skins?.includes(s.id) || s.price === 0;
                                            const isEquipped = localUser.equippedSkin === s.id;
                                            const imgPath = SKIN_IMAGES[s.id] || SKIN_IMAGES['default'];

                                            return (
                                                <div key={s.id} className={`skin-card ${isEquipped ? 'active' : ''}`}>
                                                    <div className="skin-image-container">
                                                        <img
                                                            src={imgPath}
                                                            alt={s.name}
                                                            className="skin-img"
                                                            onError={(e) => {
                                                                e.target.style.border = "2px solid red";
                                                                e.target.alt = "IMG ERROR";
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="skin-name">{s.name}</div>

                                                    {isOwned ? (
                                                        <button
                                                            onClick={() => handleEquipSkin(s.id)}
                                                            className={`action-btn ${isEquipped ? 'equipped' : 'equip'}`}
                                                            disabled={isEquipped}
                                                        >
                                                            {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleBuySkin(s.id)}
                                                            className="action-btn buy"
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
                                    <h2 className="section-title">Combat Stats</h2>
                                    <div className="stats-grid">
                                        {[
                                            { label: 'High Score', val: localUser.highScore || 0, color: '#FFD700' },
                                            { label: 'Total Kills', val: localUser.totalKills || 0, color: '#00E5FF' },
                                            { label: 'Deaths', val: localUser.totalDeaths || 0, color: '#FF4444' }
                                        ].map((stat, idx) => (
                                            <div key={idx} className="stat-card">
                                                <div className="stat-value" style={{ color: stat.color }}>{stat.val}</div>
                                                <div className="stat-label">{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'leaderboard' && (
                                <div>
                                    <h2 className="section-title">TOP PLAYERS</h2>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
                                        {leaderboard.map((p, idx) => (
                                            <div key={idx} className="leader-row">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                    <span className={idx < 3 ? 'leader-rank-gold' : 'leader-rank-normal'}>#{p.rank}</span>
                                                    <span style={{ fontWeight: '600' }}>{p.username}</span>
                                                </div>
                                                <div className="leader-score">{p.score}</div>
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
            {showLogin && (
                <>
                    <div className="modal-overlay" onClick={() => setShowLogin(false)}></div>
                    <div className="login-modal">
                        <div style={{ display: 'flex', marginBottom: '20px' }}>
                            <button className={`tab-btn ${loginTab === 'guest' ? 'active' : ''}`} onClick={() => setLoginTab('guest')}>Guest</button>
                            <button className={`tab-btn ${loginTab === 'login' ? 'active' : ''}`} onClick={() => setLoginTab('login')}>Login</button>
                            <button className={`tab-btn ${loginTab === 'register' ? 'active' : ''}`} onClick={() => setLoginTab('register')}>Register</button>
                        </div>

                        {loginTab === 'guest' && (
                            <div>
                                <input
                                    type="text"
                                    placeholder="Enter your name"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="modal-input"
                                />
                                <button onClick={handleGuestPlay} disabled={connecting} className="modal-btn">
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
                                    className="modal-input"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="modal-input"
                                />
                                <input
                                    type="text"
                                    placeholder="Display Name (optional)"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="modal-input"
                                />
                                <button onClick={handleLogin} disabled={connecting} className="modal-btn">
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
                                    className="modal-input"
                                />
                                <input
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="modal-input"
                                />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="modal-input"
                                />
                                <input
                                    type="text"
                                    placeholder="Display Name (optional)"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="modal-input"
                                />
                                <button onClick={handleRegister} disabled={connecting} className="modal-btn">
                                    {connecting ? 'Registering...' : 'Register'}
                                </button>
                            </div>
                        )}

                        {error && <div className="error-msg">{error}</div>}
                    </div>
                </>
            )}
        </div>
    );
};

export default HomeScreen;