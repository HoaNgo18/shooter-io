import React, { useState, useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene } from './game/scenes/GameScene';
import { ArenaScene } from './game/scenes/ArenaScene';
import HUD from './components/HUD';
import DeathScreen from './components/DeathScreen';
import HomeScreen from './components/HomeScreen';
import { socket } from './network/socket';
import { PacketType } from '@shared/packetTypes';

function App() {
  const [gameState, setGameState] = useState('home');
  const [user, setUser] = useState(null);
  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  // Arena state
  const [arenaCountdown, setArenaCountdown] = useState(null);
  const [arenaPlayerCount, setArenaPlayerCount] = useState(0);
  const [arenaWinner, setArenaWinner] = useState(null);
  const [arenaWaitTime, setArenaWaitTime] = useState(60);
  const arenaTimeoutRef = useRef(null);

  // Hàm dọn dẹp timeout an toàn
  const clearArenaTimeout = () => {
    if (arenaTimeoutRef.current) {
      clearTimeout(arenaTimeoutRef.current);
      arenaTimeoutRef.current = null;
    }
  };

  const handleStartGame = async (selectedSkinId) => {
    clearArenaTimeout();
    setIsDead(false);
    setKillerName('');
    setFinalScore(0);

    const skinToUse = selectedSkinId || user.equippedSkin || 'default';

    socket.isInArena = false;
    socket.arenaRoomId = null;

    if (socket.ws) {
      socket.ws.close();
      socket.ws = null;
      socket.isConnected = false;
      socket.gameScene = null;
      socket.initData = null;
    }

    try {
      await socket.connect({
        token: localStorage.getItem('game_token'),
        name: user.username
      });
    } catch (err) {
      alert('Cannot connect to game server!');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    socket.send({
      type: PacketType.RESPAWN,
      skinId: skinToUse
    });
    setGameState('playing');
  };

  const handleStartArena = async (selectedSkinId) => {
    clearArenaTimeout();

    setIsDead(false);
    setKillerName('');
    setFinalScore(0);
    setArenaWinner(null);
    setArenaCountdown(null);
    setArenaWaitTime(60);
    setArenaPlayerCount(0);

    const skinToUse = selectedSkinId || user.equippedSkin || 'default';

    try {
      // if (socket.ws) {
      //   socket.ws.close();
      //   socket.ws = null;
      //   socket.isConnected = false;
      // }

      await socket.connectArena({
        token: localStorage.getItem('game_token'),
        name: user.username,
        skinId: skinToUse
      });

      setGameState('arena_waiting');
    } catch (err) {
      console.error('Arena connection error:', err);
      alert('Cannot connect to arena server!');
    }
  };

  const handleLeaveArena = () => {
    socket.leaveArena();
    if (socket.ws) {
      socket.ws.close();
      socket.ws = null;
      socket.isConnected = false;
    }
    setGameState('home');
    setArenaCountdown(null);
    setArenaPlayerCount(0);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    socket.fullReset();
    localStorage.removeItem('game_token');
    localStorage.removeItem('game_username');
    setUser(null);
  };

  const handleQuitToMenu = () => {
    clearArenaTimeout();

    setIsDead(false);
    setGameState('home');
    setArenaWinner(null);
    setArenaCountdown(null);
    if (socket.isInArena) {
      socket.leaveArena();
      if (socket.ws) {
        socket.ws.close();
        socket.ws = null;
        socket.isConnected = false;
      }
    }
  };

  const handleRespawn = () => {
    setIsDead(false);
    setKillerName('');
    socket.send({ type: PacketType.RESPAWN });
  };

  // USEEFFECT 1: GLOBAL LISTENER (ĐÃ TỐI ƯU - Xử lý tất cả packets)
  useEffect(() => {
    const handleGlobalMessage = (packet) => {
      // Debug log cho arena
      if (packet.type && packet.type.startsWith('arena')) {
        console.log('[App] Arena packet:', packet.type);
      }

      // User data updates
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
            equippedSkin: packet.equippedSkin !== undefined ? packet.equippedSkin : prevUser.equippedSkin,
            arenaWins: packet.arenaWins !== undefined ? packet.arenaWins : prevUser.arenaWins
          };
        });
      }

      // Arena packets
      if (packet.type === PacketType.ARENA_STATUS) {
        setArenaPlayerCount(packet.playerCount || 0);
        if (packet.waitTimeRemaining !== undefined) {
          setArenaWaitTime(Math.ceil(packet.waitTimeRemaining / 1000));
        }
      }

      if (packet.type === PacketType.ARENA_COUNTDOWN) {
        setArenaCountdown(packet.seconds);
      }

      if (packet.type === PacketType.ARENA_START) {
        setGameState('arena_playing');
        setArenaCountdown(null);
      }

      // ✅ XỬ LÝ DEATH CHO CẢ NORMAL VÀ ARENA
      if (packet.type === PacketType.PLAYER_DIED && packet.victimId === socket.myId) {
        console.log("Player Died");
        setIsDead(true);
        setKillerName(packet.killerName);
        setFinalScore(packet.score);

        // Xử lý riêng cho Guest
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

      if (packet.type === PacketType.ARENA_VICTORY) {
        setArenaWinner({
          name: packet.winnerName,
          score: packet.score,
          isMe: packet.winnerId === socket.myId
        });
      }

      if (packet.type === PacketType.ARENA_END) {
        clearArenaTimeout();

        // Thiết lập timeout mới và lưu vào Ref
        arenaTimeoutRef.current = setTimeout(() => {
          setGameState('home');
          setArenaWinner(null);
          socket.resetGameScene();
          arenaTimeoutRef.current = null; // Reset ref sau khi chạy xong
        }, 5000);
      }
    };

    const unsubscribe = socket.subscribe(handleGlobalMessage);
    return () => {
      unsubscribe();
      socket.resetGameScene();
      clearArenaTimeout();
    };
  }, []);

  // ✅ USEEFFECT 2: GAME INITIALIZATION (Khởi tạo Phaser khi vào game)
  useEffect(() => {
    let game = null;

    if (gameState === 'playing') {
      console.log("🎮 Normal Game Started");

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

      return () => {
        console.log("🛑 Normal Game Cleanup");
        if (game) game.destroy(true);
        socket.resetGameScene();
      };
    }

    if (gameState === 'arena_playing') {
      console.log("⚔️ Arena Started");

      socket.resetGameScene();

      const config = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'phaser-container',
        physics: { default: 'arcade', arcade: { debug: false } },
        scene: [ArenaScene],
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }
      };
      game = new Phaser.Game(config);

      return () => {
        console.log("🛑 Arena Cleanup");
        if (game) game.destroy(true);
        socket.resetGameScene();
      };
    }
  }, [gameState]);

  return (
    <div className="App">
      {gameState === 'home' && (
        <HomeScreen
          user={user}
          onPlayClick={(skinId) => handleStartGame(skinId)}
          onArenaClick={(skinId) => handleStartArena(skinId)}
          onLogout={handleLogout}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Arena Waiting Room */}
      {gameState === 'arena_waiting' && (
        <div style={{
          width: '100vw', height: '100vh',
          background: 'linear-gradient(135deg, #1a0a0a 0%, #2d1515 50%, #1a0a0a 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontFamily: 'Arial, sans-serif'
        }}>
          <h1 style={{ fontSize: '48px', color: '#FF4444', marginBottom: '20px' }}>
            ⚔️ ĐẤU TRƯỜNG
          </h1>

          {arenaCountdown !== null ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', marginBottom: '20px' }}>Trận đấu bắt đầu trong...</p>
              <div style={{
                fontSize: '80px', fontWeight: 'bold',
                color: '#FFD700',
                textShadow: '0 0 30px rgba(255,215,0,0.5)'
              }}>
                {arenaCountdown}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', marginBottom: '10px' }}>Đang chờ người chơi...</p>
              <div style={{
                fontSize: '48px', fontWeight: 'bold',
                color: '#FFD700', marginBottom: '20px'
              }}>
                {arenaPlayerCount} / 10
              </div>
              <p style={{ fontSize: '18px', color: '#888' }}>
                Phòng sẽ tự động bắt đầu sau {arenaWaitTime}s
              </p>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                (Bot sẽ được thêm nếu không đủ người)
              </p>
            </div>
          )}

          <button
            onClick={handleLeaveArena}
            style={{
              marginTop: '40px', padding: '15px 40px',
              fontSize: '18px', fontWeight: 'bold',
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid #FF4444',
              color: '#FF4444', borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            HỦY
          </button>
        </div>
      )}

      {/* Arena Playing */}
      {gameState === 'arena_playing' && (
        <>
          <div id="phaser-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />
          {!isDead && !arenaWinner && <HUD isArena={true} />}

          {/* Victory Screen */}
          {arenaWinner && (
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.8)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, color: '#fff'
            }}>
              {arenaWinner.isMe ? (
                <>
                  <h1 style={{ fontSize: '64px', color: '#FFD700', marginBottom: '20px' }}>
                    🏆 CHIẾN THẮNG! 🏆
                  </h1>
                  <p style={{ fontSize: '24px' }}>Bạn là người sống sót cuối cùng!</p>
                  <p style={{ fontSize: '32px', color: '#FFD700', marginTop: '20px' }}>
                    Điểm: {arenaWinner.score}
                  </p>
                </>
              ) : (
                <>
                  <h1 style={{ fontSize: '48px', color: '#FF4444', marginBottom: '20px' }}>
                    TRẬN ĐẤU KẾT THÚC
                  </h1>
                  <p style={{ fontSize: '24px' }}>Người chiến thắng:</p>
                  <p style={{ fontSize: '36px', color: '#FFD700', marginTop: '10px' }}>
                    {arenaWinner.name}
                  </p>
                </>
              )}
              <p style={{ fontSize: '18px', color: '#888', marginTop: '30px' }}>
                Đang quay về menu...
              </p>
            </div>
          )}

          {/* Death screen - không có respawn */}
          {isDead && !arenaWinner && (
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, color: '#fff'
            }}>
              <h1 style={{ fontSize: '48px', color: '#FF4444' }}>BẠN ĐÃ BỊ LOẠI!</h1>
              <p style={{ fontSize: '24px', marginTop: '20px' }}>
                Bị tiêu diệt bởi: <span style={{ color: '#FFD700' }}>{killerName}</span>
              </p>
              <p style={{ fontSize: '20px', marginTop: '10px' }}>
                Điểm của bạn: {finalScore}
              </p>
              <p style={{ fontSize: '16px', color: '#888', marginTop: '30px' }}>
                Đang theo dõi trận đấu...
              </p>
              <button
                onClick={handleQuitToMenu}
                style={{
                  marginTop: '20px', padding: '12px 30px',
                  fontSize: '16px', background: '#333',
                  border: 'none', color: '#fff',
                  borderRadius: '8px', cursor: 'pointer'
                }}
              >
                THOÁT VỀ MENU
              </button>
            </div>
          )}
        </>
      )}

      {/* Normal Game */}
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