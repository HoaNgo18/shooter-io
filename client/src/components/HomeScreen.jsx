import React, { useState, useEffect } from 'react';

const HomeScreen = ({ user, onPlayClick, onLogout }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [skins, setSkins] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(false);
    const API_URL = 'http://localhost:8080/api';

    // Load dữ liệu
    useEffect(() => {
        loadSkins();
        loadLeaderboard();
    }, []);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            loadLeaderboard(); // Reload khi chuyển tab
        }
    }, [activeTab]);

    const loadSkins = async () => {
        // TODO: Sau này gọi API /api/shop
        setSkins([
            { id: 'default', name: 'Default', price: 0, owned: true, color: '#4CAF50' },
            { id: 'fire', name: 'Fire', price: 100, owned: false, color: '#FF5722' },
            { id: 'ice', name: 'Ice', price: 100, owned: false, color: '#03A9F4' },
            { id: 'gold', name: 'Gold', price: 250, owned: false, color: '#FFD700' },
            { id: 'shadow', name: 'Shadow', price: 500, owned: false, color: '#424242' },
        ]);
    };

    const loadLeaderboard = async () => {
        try {
            const res = await fetch(`${API_URL}/leaderboard`);
            if (!res.ok) throw new Error('Failed to fetch leaderboard');

            const data = await res.json();

            // Map dữ liệu từ Server về format hiển thị (nếu cần)
            // API trả về: [{ username, highScore, ... }]
            // Chúng ta cần thêm rank vào
            const formattedData = data.map((player, index) => ({
                rank: index + 1,
                username: player.username,
                score: player.highScore || 0 // Dùng highScore làm điểm xếp hạng
            }));

            setLeaderboard(formattedData);
        } catch (err) {
            console.error("Leaderboard error:", err);
            // Nếu lỗi thì để mảng rỗng hoặc thông báo
            setLeaderboard([]);
        }
    };

    const handleBuySkin = async (skinId) => {
        // Logic mua skin (Mock)
        const skin = skins.find(s => s.id === skinId);
        if (!skin || skin.owned || user.coins < skin.price) return;

        setLoading(true);
        setTimeout(() => {
            // Giả lập mua thành công
            setSkins(skins.map(s =>
                s.id === skinId ? { ...s, owned: true } : s
            ));
            alert(`Đã mua ${skin.name}! (Logic trừ tiền cần xử lý ở Server)`);
            setLoading(false);
        }, 500);
    };

    // --- STYLES (Giữ nguyên style của bạn, rất đẹp rồi) ---
    const containerStyle = {
        position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)', // Đổi màu nền chút cho ngầu
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

                {/* SIDEBAR */}
                <div style={{ width: '250px', background: 'rgba(0,0,0,0.3)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '1px solid #555', paddingBottom: '20px' }}>
                        <div style={{ fontSize: '50px' }}>👾</div>
                        <h3>{user.username}</h3>
                        <div style={{ color: '#FFD700', fontSize: '20px' }}>💰 {user.coins}</div>
                        <div style={{ fontSize: '12px', color: '#aaa', marginTop: '10px' }}>
                            <div>🏆 High Score: {user.highScore || 0}</div>
                            <div>⚔️ Kills: {user.totalKills || 0}</div>
                            <div>💀 Deaths: {user.totalDeaths || 0}</div>
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

                    {/* HOME */}
                    {activeTab === 'home' && (
                        <div style={{ textAlign: 'center', marginTop: '50px' }}>
                            <h1 style={{ fontSize: '60px', color: '#4CAF50', textShadow: '0 0 10px #000' }}>SHOOTER.IO</h1>
                            <p>Chào mừng trở lại, <b>{user.username}</b>!</p>

                            <button onClick={onPlayClick} style={{
                                marginTop: '40px', padding: '20px 60px', fontSize: '30px',
                                background: '#FFD700', border: 'none', borderRadius: '50px',
                                cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 5px 0 #b8860b'
                            }}>
                                CHIẾN NGAY
                            </button>
                        </div>
                    )}

                    {/* SHOP (Hiển thị Skins) */}
                    {activeTab === 'shop' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {skins.map(s => (
                                <div key={s.id} style={{ background: '#333', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                    <div style={{ width: '50px', height: '50px', background: s.color, borderRadius: '50%', margin: '0 auto' }}></div>
                                    <h4>{s.name}</h4>
                                    {s.owned ?
                                        <span style={{ color: '#4CAF50' }}>Đã sở hữu</span> :
                                        <button onClick={() => handleBuySkin(s.id)} style={{ background: '#FFD700', border: 'none', padding: '5px 15px', cursor: 'pointer', borderRadius: '5px' }}>{s.price} 💰</button>
                                    }
                                </div>
                            ))}
                        </div>
                    )}

                    {/* LEADERBOARD */}
                    {activeTab === 'leaderboard' && (
                        <div>
                            <h3>Bảng xếp hạng (Mock Data)</h3>
                            {leaderboard.map(p => (
                                <div key={p.rank} style={{ background: '#222', padding: '10px', margin: '5px 0', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>#{p.rank} {p.username}</span>
                                    <span style={{ color: '#FFD700' }}>{p.score}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* PROFILE */}
                    {activeTab === 'profile' && (
                        <div>
                            <h3>Thông tin tài khoản</h3>
                            <div style={{ background: '#222', padding: '15px', borderRadius: '10px', marginBottom: '10px' }}>
                                <p><strong>Username:</strong> {user.username}</p>
                                <p><strong>Email:</strong> {user.email}</p>
                            </div>
                            <h4 style={{marginTop: '20px'}}>Thống kê</h4>
                            <div style={{ background: '#222', padding: '15px', borderRadius: '10px' }}>
                                <p><strong>Điểm cao nhất:</strong> <span style={{ color: '#FFD700' }}>{user.highScore || 0}</span></p>
                                <p><strong>Số mạng đã giết:</strong> <span style={{ color: '#4CAF50' }}>{user.totalKills || 0}</span></p>
                                <p><strong>Số lần chết:</strong> <span style={{ color: '#F44336' }}>{user.totalDeaths || 0}</span></p>
                                <p><strong>KD Ratio:</strong> {user.totalDeaths > 0 ? (user.totalKills / user.totalDeaths).toFixed(2) : user.totalKills}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomeScreen;