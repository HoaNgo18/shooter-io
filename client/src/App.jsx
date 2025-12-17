import React, { useState, useEffect } from 'react';
import Phaser from 'phaser';
import { GameScene } from './game/scenes/GameScene';
import LoginScreen from './components/LoginScreen';
import HUD from './components/HUD';
import DeathScreen from './components/DeathScreen';
import HomeScreen from './components/HomeScreen';
import { socket } from './network/socket';
import { PacketType } from '@shared/packetTypes';

function App() {
  const [gameState, setGameState] = useState('login');
  const [user, setUser] = useState(null);

  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setGameState('home');
  };

  const handleStartGame = async () => {
    setIsDead(false);
    setKillerName('');
    setFinalScore(0);

    if (!socket.isConnected) {
      try {
        await socket.connect({
          token: localStorage.getItem('game_token'),
          name: user.username
        });
      } catch (err) {
        alert('Không thể kết nối server!');
        return;
      }
    }

    // Đợi một chút để socket ổn định
    await new Promise(resolve => setTimeout(resolve, 100));

    // Gửi lệnh hồi sinh để bắt đầu game (vì mặc định đang dead)
    socket.send({ type: PacketType.RESPAWN });
    setGameState('playing');
  };

  const handleLogout = () => {
    socket.disconnect();
    localStorage.removeItem('game_token');
    localStorage.removeItem('game_user_info');
    setUser(null);
    setGameState('login');
  };

  const handleQuitToMenu = () => {
    setIsDead(false);
    setGameState('home');
  };

  const handleRespawn = () => {
    setIsDead(false);
    setKillerName('');
    socket.send({ type: PacketType.RESPAWN });
  };

  // --- Hợp nhất Logic Game & Socket ---
  useEffect(() => {
    let game = null;

    if (gameState === 'playing') {
      // 1. Khởi tạo Phaser
      const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'phaser-container',
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: [GameScene],
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
      };
      game = new Phaser.Game(config);
      // socket.setGameScene(game.scene.scenes[0]);

      // 2. Lắng nghe sự kiện chết từ Server
      const handleSocketMessage = (packet) => {
        if (packet.type === PacketType.PLAYER_DIED &&
          packet.victimId === socket.myId) {

          // Chỉ hiện màn hình chết, không destroy game ngay
          setIsDead(true);
          setKillerName(packet.killerName);
          setFinalScore(packet.score);
          setUser(prevUser => {
            if (prevUser && prevUser.isGuest) {
              // 1. Lấy dữ liệu cũ từ LocalStorage (để chắc chắn)
              const savedGuest = localStorage.getItem('guest_data');
              const oldData = savedGuest ? JSON.parse(savedGuest) : prevUser;

              // 2. Cộng dồn chỉ số mới
              const updatedGuest = {
                ...oldData, // Giữ lại username, skin...

                // Cộng coin
                coins: (oldData.coins || 0) + (packet.coins || 0),

                // Cập nhật điểm cao nhất
                highScore: Math.max(oldData.highScore || 0, packet.score),

                // Cộng kill (lấy từ packet.kills server vừa gửi)
                totalKills: (oldData.totalKills || 0) + (packet.kills || 0),

                // Cộng death (Chết 1 lần thì cộng 1)
                totalDeaths: (oldData.totalDeaths || 0) + 1
              };

              console.log("Saving Guest Data:", updatedGuest); // Log để kiểm tra

              // 3. Lưu lại
              localStorage.setItem('guest_data', JSON.stringify(updatedGuest));

              return updatedGuest;
            }
            return prevUser; // Nếu là user thật thì Server tự lưu, không làm gì cả
          });
          // ------------------------------------------
        }
      };

      const unsubscribe = socket.subscribe(handleSocketMessage);

      return () => {
        unsubscribe(); // Hủy lắng nghe socket
        if (game) {
          game.destroy(true); // Hủy game Phaser
        }
        socket.resetGameScene();
      };
    }
  }, [gameState]); // Chỉ chạy lại khi gameState thay đổi

  return (
    <div className="App">
      {gameState === 'login' && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}

      {gameState === 'home' && user && (
        <HomeScreen
          user={user}
          onPlayClick={handleStartGame}
          onLogout={handleLogout}
        />
      )}

      {gameState === 'playing' && (
        <>
          {/* Container cho Phaser */}
          <div id="phaser-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

          {/* HUD chỉ hiện khi đang chơi và chưa chết */}
          {!isDead && <HUD />}

          {/* Màn hình chết */}
          {isDead && (
            <DeathScreen
              killerName={killerName}
              score={finalScore}
              onQuit={handleQuitToMenu}
              onRespawn={handleRespawn}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;