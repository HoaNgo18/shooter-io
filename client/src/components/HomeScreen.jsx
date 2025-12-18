import React, { useState, useEffect } from 'react';
import { socket } from '../network/socket'; // <--- 1. Import Socket trực tiếp
import { PacketType } from '../../../shared/src/packetTypes';

const HomeScreen = ({ user, onPlayClick, onLogout }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [skins, setSkins] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [localUser, setLocalUser] = useState(user);
    const API_URL = 'http://localhost:8080/api';

    useEffect(() => {
        setLocalUser(user);
        loadSkins();
        loadLeaderboard();

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

    // --- SỬA LỖI LOGIC GỬI PACKET ---
    const handleBuySkin = (skinId) => {
        const skin = skins.find(s => s.id === skinId);
        if (!skin || localUser.coins < skin.price) {
            alert("KHÔNG ĐỦ COINS");
            return;
        }
        // 3. Gửi Object trực tiếp, KHÔNG dùng JSON.stringify
        socket.send({
            type: PacketType.BUY_SKIN,
            skinId: skinId
        });
    };

    const handleEquipSkin = (skinId) => {
        // 3. Gửi Object trực tiếp, KHÔNG dùng JSON.stringify
        socket.send({
            type: PacketType.EQUIP_SKIN,
            skinId: skinId
        });
    };

    // --- STYLES (Giữ nguyên) ---
    const styles = {
        container: {
            width: '100vw', height: '100vh',
            background: 'radial-gradient(circle at center, #2b32b2, #1488cc)',
            backgroundColor: '#0f0f0f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            color: '#fff', overflow: 'hidden'
        },
        mainCard: {
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
        playBtn: {
            padding: '20px 80px', fontSize: '28px', fontWeight: '900',
            textTransform: 'uppercase', letterSpacing: '2px',
            background: '#FFD700', color: '#000',
            border: 'none', borderRadius: '4px', cursor: 'pointer',
            boxShadow: '0 0 30px rgba(255, 215, 0, 0.4)', marginTop: '40px',
            transform: 'skew(-10deg)'
        },
        leaderRow: {
            display: 'flex', justifyContent: 'space-between', padding: '15px',
            borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '14px'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.mainCard}>
                <div style={styles.sidebar}>
                    <div style={styles.userSection}>
                        <div style={styles.userName}>{localUser.username}</div>
                        <div style={styles.userCoin}>{localUser.coins} COINS</div>
                    </div>
                    <button style={styles.navBtn(activeTab === 'home')} onClick={() => setActiveTab('home')}>Trang chủ</button>
                    <button style={styles.navBtn(activeTab === 'shop')} onClick={() => setActiveTab('shop')}>Kho vũ khí</button>
                    <button style={styles.navBtn(activeTab === 'profile')} onClick={() => setActiveTab('profile')}>Hồ sơ</button>
                    <button style={styles.navBtn(activeTab === 'leaderboard')} onClick={() => setActiveTab('leaderboard')}>Xếp hạng</button>
                    <div style={{ flex: 1 }}></div>
                    <button onClick={onLogout} style={{ ...styles.navBtn(false), color: '#FF4444' }}>Đăng xuất</button>
                </div>

                <div style={styles.content}>
                    {activeTab === 'home' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <h1 style={{ fontSize: '72px', margin: 0, fontWeight: '900', letterSpacing: '-2px', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                                SHOOTER<span style={{ color: '#FFD700' }}>.IO</span>
                            </h1>
                            <p style={{ color: '#888', letterSpacing: '4px', textTransform: 'uppercase', marginTop: '10px' }}>
                                Are you ready to dominate?
                            </p>
                            <button
                                onClick={() => onPlayClick(localUser.equippedSkin)}
                                style={styles.playBtn}
                                onMouseOver={(e) => e.target.style.transform = 'skew(-10deg) scale(1.05)'}
                                onMouseOut={(e) => e.target.style.transform = 'skew(-10deg) scale(1)'}
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
                                                    disabled={isEquipped} // Disable nếu đã equip
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
                            <h2 style={{ fontSize: '24px', marginBottom: '30px', textTransform: 'uppercase' }}>Thông số chiến đấu</h2>
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
                                {leaderboard.length === 0 && <div style={{ padding: '20px', color: '#666', textAlign: 'center' }}>Chưa có dữ liệu</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomeScreen;