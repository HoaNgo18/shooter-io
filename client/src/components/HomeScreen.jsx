import React, { useState, useEffect } from 'react';
import { PacketType } from '../../../shared/src/packetTypes'; // Đảm bảo đúng đường dẫn tới shared

const HomeScreen = ({ user, socket, onPlayClick, onLogout }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [skins, setSkins] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    // Sử dụng localUser để React có thể render lại khi socket gửi data mới
    const [localUser, setLocalUser] = useState(user); 
    const API_URL = 'http://localhost:8080/api';

    // 1. Khởi tạo dữ liệu và Lắng nghe Socket cập nhật liên tục
    useEffect(() => {
        setLocalUser(user);
        loadSkins();
        loadLeaderboard();

        if (!socket) return;

        const handleSocketMessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Lắng nghe gói tin cập nhật user từ Server (ví dụ sau khi chết hoặc mua đồ)
                if (data.type === 'USER_DATA_UPDATE' || data.type === 'init') {
                    setLocalUser(prev => ({
                        ...prev,
                        ...data
                    }));
                }
            } catch (err) {
                console.error("Socket message error:", err);
            }
        };

        socket.addEventListener('message', handleSocketMessage);
        return () => socket.removeEventListener('message', handleSocketMessage);
    }, [socket, user]);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            loadLeaderboard();
        }
    }, [activeTab]);

    const loadSkins = () => {
        // Lấy danh sách skin (Nên đồng bộ với WEAPON_STATS hoặc cấu hình trong shared)
        setSkins([
            { id: 'default', name: 'Default', price: 0, color: '#4CAF50' },
            { id: 'fire', name: 'Fire', price: 100, color: '#FF5722' },
            { id: 'ice', name: 'Ice', price: 100, color: '#03A9F4' },
            { id: 'gold', name: 'Gold', price: 250, color: '#FFD700' },
            { id: 'shadow', name: 'Shadow', price: 500, color: '#424242' },
        ]);
    };

    const loadLeaderboard = async () => {
        try {
            const res = await fetch(`${API_URL}/leaderboard`);
            if (!res.ok) throw new Error('Failed to fetch leaderboard');
            const data = await res.json();
            const formattedData = data.map((player, index) => ({
                rank: index + 1,
                username: player.username,
                score: player.highScore || 0
            }));
            setLeaderboard(formattedData);
        } catch (err) {
            console.error("Leaderboard error:", err);
            setLeaderboard([]);
        }
    };

    // 2. Logic Mua Skin gửi qua Socket
    const handleBuySkin = (skinId) => {
        const skin = skins.find(s => s.id === skinId);
        if (!skin || localUser.coins < skin.price) {
            alert("Không đủ tiền!");
            return;
        }

        socket.send(JSON.stringify({
            type: 'buy_skin', // Khớp với xử lý ở server.js
            skinId: skinId
        }));
    };

    // 3. Logic Trang bị Skin gửi qua Socket
    const handleEquipSkin = (skinId) => {
        socket.send(JSON.stringify({
            type: 'equip_skin',
            skinId: skinId
        }));
    };

    // --- STYLES (Giữ nguyên của bạn) ---
    const containerStyle = {
        position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'Arial, sans-serif', color: 'white', zIndex: 100
    };

    const boxStyle = {
        width: '900px', height: '600px', background: 'rgba(0,0,0,0.8)',
        borderRadius: '20px', display: 'flex', overflow: 'hidden',
        boxShadow: '0 0 50px rgba(0,0,0,0.7)', border: '1px solid #444'
    };

    const btnStyle = (active) => ({
        padding: '15px', background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: 'none', color: active ? '#FFD700' : 'white', cursor: 'pointer',
        textAlign: 'left', fontSize: '16px', fontWeight: 'bold'
    });

    return (
        <div style={containerStyle}>
            <div style={boxStyle}>
                {/* SIDEBAR - Hiển thị localUser để cập nhật liên tục */}
                <div style={{ width: '250px', background: 'rgba(0,0,0,0.3)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #555', paddingBottom: '20px' }}>
                        <div style={{ fontSize: '50px' }}>👾</div>
                        <h3>{localUser.username}</h3>
                        <div style={{ color: '#FFD700', fontSize: '20px' }}>💰 {localUser.coins}</div>
                        <div style={{ fontSize: '12px', color: '#aaa', marginTop: '10px' }}>
                            <div>🏆 High Score: {localUser.highScore || 0}</div>
                            <div>⚔️ Kills: {localUser.totalKills || 0}</div>
                            <div>💀 Deaths: {localUser.totalDeaths || 0}</div>
                        </div>
                    </div>

                    <button style={btnStyle(activeTab === 'home')} onClick={() => setActiveTab('home')}>🏠 Trang chủ</button>
                    <button style={btnStyle(activeTab === 'shop')} onClick={() => setActiveTab('shop')}>🛒 Cửa hàng</button>
                    <button style={btnStyle(activeTab === 'profile')} onClick={() => setActiveTab('profile')}>👤 Hồ sơ</button>
                    <button style={btnStyle(activeTab === 'leaderboard')} onClick={() => setActiveTab('leaderboard')}>🏆 Xếp hạng</button>

                    <button onClick={onLogout} style={{ ...btnStyle(false), marginTop: 'auto', color: '#ff4444' }}>🚪 Đăng xuất</button>
                </div>

                {/* CONTENT */}
                <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                    {activeTab === 'home' && (
                        <div style={{ textAlign: 'center', marginTop: '50px' }}>
                            <h1 style={{ fontSize: '60px', color: '#4CAF50', textShadow: '0 0 10px #000' }}>SHOOTER.IO</h1>
                            <p>Chào mừng trở lại, <b>{localUser.username}</b>!</p>
                            <button onClick={() => onPlayClick(localUser.equippedSkin)} style={{
                                marginTop: '40px', padding: '20px 60px', fontSize: '30px',
                                background: '#FFD700', border: 'none', borderRadius: '50px',
                                cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 5px 0 #b8860b'
                            }}>
                                CHIẾN NGAY
                            </button>
                        </div>
                    )}

                    {/* SHOP (Logic Mua/Trang bị thực tế) */}
                    {activeTab === 'shop' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {skins.map(s => {
                                const isOwned = localUser.skins?.includes(s.id) || s.price === 0;
                                const isEquipped = localUser.equippedSkin === s.id;
                                
                                return (
                                    <div key={s.id} style={{ 
                                        background: '#333', padding: '15px', borderRadius: '10px', 
                                        textAlign: 'center', border: isEquipped ? '2px solid #FFD700' : '1px solid transparent' 
                                    }}>
                                        <div style={{ width: '50px', height: '50px', background: s.color, borderRadius: '50%', margin: '0 auto' }}></div>
                                        <h4>{s.name}</h4>
                                        {isOwned ? (
                                            <button 
                                                onClick={() => handleEquipSkin(s.id)}
                                                style={{ 
                                                    background: isEquipped ? '#4CAF50' : '#666', 
                                                    color: 'white', border: 'none', padding: '8px 15px', 
                                                    cursor: 'pointer', borderRadius: '5px', width: '100%'
                                                }}
                                            >
                                                {isEquipped ? 'ĐANG DÙNG' : 'TRANG BỊ'}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleBuySkin(s.id)} 
                                                style={{ 
                                                    background: '#FFD700', border: 'none', padding: '8px 15px', 
                                                    cursor: 'pointer', borderRadius: '5px', width: '100%', fontWeight: 'bold'
                                                }}
                                            >
                                                MUA {s.price} 💰
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* LEADERBOARD & PROFILE giữ nguyên hiển thị từ localUser... */}
                    {activeTab === 'leaderboard' && (
                        <div>
                            <h3>Bảng xếp hạng</h3>
                            {leaderboard.map(p => (
                                <div key={p.rank} style={{ background: '#222', padding: '10px', margin: '5px 0', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>#{p.rank} {p.username}</span>
                                    <span style={{ color: '#FFD700' }}>{p.score}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {activeTab === 'profile' && (
                        <div>
                            <h3>Thông tin tài khoản</h3>
                            <div style={{ background: '#222', padding: '15px', borderRadius: '10px', marginBottom: '10px' }}>
                                <p><strong>Username:</strong> {localUser.username}</p>
                            </div>
                            <h4 style={{marginTop: '20px'}}>Thống kê</h4>
                            <div style={{ background: '#222', padding: '15px', borderRadius: '10px' }}>
                                <p><strong>Điểm cao nhất:</strong> <span style={{ color: '#FFD700' }}>{localUser.highScore || 0}</span></p>
                                <p><strong>Số mạng đã giết:</strong> <span style={{ color: '#4CAF50' }}>{localUser.totalKills || 0}</span></p>
                                <p><strong>Số lần chết:</strong> <span style={{ color: '#F44336' }}>{localUser.totalDeaths || 0}</span></p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomeScreen;