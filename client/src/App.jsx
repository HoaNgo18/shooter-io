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

  const handleStartGame = async (selectedSkinId) => {
    setIsDead(false);
    setKillerName('');
    setFinalScore(0);

    const skinToUse = selectedSkinId || user.equippedSkin || 'default';

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

    // Đợi socket ổn định
    await new Promise(resolve => setTimeout(resolve, 100));
    socket.send({ 
        type: PacketType.RESPAWN,
        skinId: skinToUse 
    });
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

  // --- 1. GLOBAL LISTENER: Luôn lắng nghe cập nhật Coin/Stats/Skin ---
  // (Chạy độc lập với việc đang chơi hay ở Home)
  useEffect(() => {
    const handleGlobalMessage = (packet) => {
      if (packet.type === 'USER_DATA_UPDATE') {   
        setUser(prevUser => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            coins: packet.coins !== undefined ? packet.coins : prevUser.coins,
            highScore: packet.highScore !== undefined ? packet.highScore : prevUser.highScore,
            totalKills: packet.totalKills !== undefined ? packet.totalKills : prevUser.totalKills,
            totalDeaths: packet.totalDeaths !== undefined ? packet.totalDeaths : prevUser.totalDeaths,
            skins: packet.skins !== undefined ? packet.skins : prevUser.skins,
            equippedSkin: packet.equippedSkin !== undefined ? packet.equippedSkin : prevUser.equippedSkin
          };
        });
      }
    };

    // Đăng ký lắng nghe
    const unsubscribe = socket.subscribe(handleGlobalMessage);
    
    // Hủy đăng ký khi component unmount (tắt app)
    return () => {
      unsubscribe();
    };
  }, []); // [] nghĩa là chỉ chạy 1 lần khi App bật lên

  // --- 2. GAME LOGIC LISTENER: Chỉ chạy khi gameState = playing ---
  useEffect(() => {
    let game = null;

    if (gameState === 'playing') {
      console.log("🎮 Game Started - Init Phaser");
      
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

      // Lắng nghe sự kiện chết (Gameplay specific)
      const handleGameMessage = (packet) => {
        if (packet.type === PacketType.PLAYER_DIED && packet.victimId === socket.myId) {
          console.log("💀 Player Died Packet Received");
          setIsDead(true);
          setKillerName(packet.killerName);
          setFinalScore(packet.score);

          // Xử lý riêng cho Guest (vì server không gửi USER_DATA_UPDATE cho guest)
          setUser(prevUser => {
            if (prevUser && prevUser.isGuest) {
              const savedGuest = localStorage.getItem('guest_data');
              const oldData = savedGuest ? JSON.parse(savedGuest) : prevUser;
              const updatedGuest = {
                ...oldData,
                coins: (oldData.coins || 0) + (packet.coins || 0),
                highScore: Math.max(oldData.highScore || 0, packet.score),
                totalKills: (oldData.totalKills || 0) + (packet.kills || 0),
                totalDeaths: (oldData.totalDeaths || 0) + 1
              };
              localStorage.setItem('guest_data', JSON.stringify(updatedGuest));
              return updatedGuest;
            }
            return prevUser;
          });
        }
      };

      const unsubscribe = socket.subscribe(handleGameMessage);

      return () => {
        console.log("🛑 Game Cleanup");
        unsubscribe();
        if (game) game.destroy(true);
        socket.resetGameScene();
      };
    }
  }, [gameState]);

  return (
    <div className="App">
      {gameState === 'login' && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}

      {gameState === 'home' && user && (
        <HomeScreen
          user={user}
          onPlayClick={(skinId) => handleStartGame(skinId)}
          onLogout={handleLogout}
        />
      )}

      {gameState === 'playing' && (
        <>
          <div id="phaser-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
          {!isDead && <HUD />}
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