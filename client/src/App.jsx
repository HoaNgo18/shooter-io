import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import LoginScreen from './components/LoginScreen';
import HUD from './components/HUD';
import DeathScreen from './components/DeathScreen'; // Import
import { socket } from './network/socket';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDead, setIsDead] = useState(false); // Trạng thái chết
  const [killerName, setKillerName] = useState('');

  useEffect(() => {
    // Lắng nghe sự kiện từ socket để hiện Death Screen
    const unsubscribe = socket.subscribe((data) => {
      // Khi mình chết
      if (data.type === 'GAME_UPDATE' && data.me && data.me.dead) {
         if (!isDead) setIsDead(true); // Chỉ set 1 lần
      }
      
      // Khi mình hồi sinh (Server gửi me.dead = false)
      if (data.type === 'GAME_UPDATE' && data.me && !data.me.dead && isDead) {
         setIsDead(false);
         setKillerName('');
      }

      // Lấy tên kẻ giết mình (Optional - Xử lý packet PLAYER_DIED riêng ở socket.js nếu muốn chuẩn hơn)
    });
    return () => unsubscribe();
  }, [isDead]);

  return (
    <div className="App" style={{ position: 'relative' }}>
      <GameCanvas />
      
      {!isPlaying && <LoginScreen onJoin={() => setIsPlaying(true)} />}
      
      {/* Khi đang chơi và chưa chết thì hiện HUD */}
      {isPlaying && !isDead && <HUD />}

      {/* Khi chết thì hiện Death Screen */}
      {isPlaying && isDead && <DeathScreen killerName={killerName} />}
    </div>
  );
}

export default App;