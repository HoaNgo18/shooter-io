import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import LoginScreen from './components/LoginScreen';
import HUD from './components/HUD';
import DeathScreen from './components/DeathScreen';
import { socket } from './network/socket';
import { PacketType } from '@shared/packetTypes';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  const handleQuitToMenu = () => {
    setIsDead(false);
    setKillerName('');
    setFinalScore(0);
    setIsPlaying(false);
  };

  useEffect(() => {
    // Lắng nghe sự kiện từ socket để hiện Death Screen
    const unsubscribe = socket.subscribe((data) => {
      // Khi mình chết - Server gửi PLAYER_DIED
      if (data.type === PacketType.PLAYER_DIED && data.victimId === socket.myId) {
        setIsDead(true);
        // Lấy tên kẻ giết mình (nếu có)
        const killer = data.killerName || 'Unknown';
        setKillerName(killer);
        // Lấy score trước khi chết
        const score = data.score || 0;
        setFinalScore(score);
      }

      // Khi hồi sinh (nhận UPDATE từ server với player alive)
      if (data.type === PacketType.UPDATE && isDead) {
        // Tìm mình trong danh sách players
        const me = data.players?.find(p => p.id === socket.myId);
        if (me && !me.dead) {
          setIsDead(false);
          setKillerName('');
        }
      }
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
      {isPlaying && isDead && <DeathScreen killerName={killerName} score={finalScore} onQuit={handleQuitToMenu} />}
    </div>
  );
}

export default App;