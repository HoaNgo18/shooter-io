import React, { useState, useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene } from './game/scenes/GameScene';
import { ArenaScene } from './game/scenes/ArenaScene';
import HUD from './components/HUD';
import DeathScreen from './components/DeathScreen';
import HomeScreen from './components/HomeScreen';
import SpectateOverlay from './components/SpectateOverlay';
import { socket } from './network/socket';
import { PacketType } from '@shared/packetTypes';
import './components/ArenaUI.css';

function App() {
  const [gameState, setGameState] = useState('home');
  const [user, setUser] = useState(null);
  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState('');
  const [finalScore, setFinalScore] = useState(0);
  const [arenaRank, setArenaRank] = useState(null);

  // Arena state
  const [arenaCountdown, setArenaCountdown] = useState(null);
  const [arenaPlayerCount, setArenaPlayerCount] = useState(0);
  const [arenaWinner, setArenaWinner] = useState(null);
  const [arenaWaitTime, setArenaWaitTime] = useState(60);
  const arenaTimeoutRef = useRef(null);

  // Spectate state
  const [isSpectating, setIsSpectating] = useState(false);
  const [spectateTargetName, setSpectateTargetName] = useState('');
  const [killerId, setKillerId] = useState(null);
  const [killerIsBot, setKillerIsBot] = useState(false);

  // Safe timeout cleanup
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

    // Small delay to ensure connection
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
    setIsSpectating(false);
    setSpectateTargetName('');
    setKillerId(null);
    setKillerIsBot(false);
    socket.stopSpectate();
    if (socket.isInArena) {
      socket.leaveArena();
      // DO NOT close socket here - we need it for HomeScreen to work
      // socket.ws.close() was causing skin equip to fail after Arena
    }
  };

  const handleRespawn = () => {
    setIsDead(false);
    setKillerName('');
    setKillerId(null);
    setKillerIsBot(false);
    setIsSpectating(false);
    socket.send({ type: PacketType.RESPAWN });
  };

  // Handle starting spectate mode
  const handleStartSpectate = () => {
    if (killerId && killerId !== 'ZONE' && killerId !== socket.myId) {
      socket.startSpectate(killerId);
      setIsDead(false);
      setIsSpectating(true);
      setSpectateTargetName(killerName);
    }
  };

  // Handle exiting spectate mode
  const handleExitSpectate = () => {
    socket.stopSpectate();
    setIsSpectating(false);
    setSpectateTargetName('');
    handleQuitToMenu();
  };

  // GLOBAL LISTENER
  useEffect(() => {
    const handleGlobalMessage = (packet) => {
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
            arenaWins: packet.arenaWins !== undefined ? packet.arenaWins : prevUser.arenaWins,
            arenaTop2: packet.arenaTop2 !== undefined ? packet.arenaTop2 : prevUser.arenaTop2,
            arenaTop3: packet.arenaTop3 !== undefined ? packet.arenaTop3 : prevUser.arenaTop3
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

      // PLAYER DIED EVENT
      if (packet.type === PacketType.PLAYER_DIED && packet.victimId === socket.myId) {
        setIsDead(true);
        setKillerName(packet.killerName);
        setKillerId(packet.killerId);
        setKillerIsBot(packet.killerIsBot || false);
        setFinalScore(packet.score);
        setArenaRank(packet.rank || '?');

        // Handle Guest Data update
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
        // Removed auto-redirect. User must manually exit.
      }

      // Spectate updates
      if (packet.type === PacketType.SPECTATE_UPDATE) {
        setIsSpectating(packet.isSpectating);
        if (packet.targetName) {
          setSpectateTargetName(packet.targetName);
        }
      }

      // Spectate target died - update target name
      if (packet.type === PacketType.SPECTATE_TARGET_DIED) {
        if (packet.canSpectateKiller && packet.newTargetName) {
          setSpectateTargetName(packet.newTargetName);
        } else {
          // Target died and no new target available
          setIsSpectating(false);
          setSpectateTargetName('');
          // Show death screen again
          setIsDead(true);
        }
      }
    };

    const unsubscribe = socket.subscribe(handleGlobalMessage);
    return () => {
      unsubscribe();
      socket.resetGameScene();
      clearArenaTimeout();
    };
  }, []);

  // GAME INITIALIZATION
  useEffect(() => {
    let game = null;

    if (gameState === 'playing') {
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
        if (game) game.destroy(true);
        socket.resetGameScene();
      };
    }

    if (gameState === 'arena_playing') {
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
        <div className="arena-waiting-container">


          <h1 className="arena-title">ARENA</h1>

          {arenaCountdown !== null ? (
            <div className="arena-countdown-container">
              <p className="arena-countdown-text">Match starts in...</p>
              <div className="arena-countdown-number">
                {arenaCountdown}
              </div>
            </div>
          ) : (
            <div className="arena-status-container">
              <p className="arena-status-text">Waiting for players...</p>
              <div className="arena-player-count">
                {arenaPlayerCount} / 10
              </div>

              {/* Simplified text form */}
              <p className="arena-wait-time">
                Auto-start in {arenaWaitTime}s
              </p>
              <p className="arena-hint">
                (Bots will join if not full)
              </p>
            </div>
          )}

          <button
            onClick={handleLeaveArena}
            className="arena-cancel-btn"
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Arena Playing */}
      {gameState === 'arena_playing' && (
        <>
          <div id="phaser-container" className="phaser-container" />
          {!isDead && !arenaWinner && !isSpectating && <HUD isArena={true} />}

          {/* Spectate Overlay */}
          {isSpectating && (
            <SpectateOverlay
              targetName={spectateTargetName}
              onExit={handleExitSpectate}
            />
          )}

          {/* Victory Screen */}
          {arenaWinner && (
            <DeathScreen
              isVictory={true}
              killerName={null}
              score={arenaWinner.score}
              rank={1}
              onQuit={() => {
                handleQuitToMenu();
                socket.fullReset(); // Ensure full reset on quit
              }}
              onRespawn={null} // No respawn in Arena
            />
          )}

          {/* Death screen - no respawn, but can spectate */}
          {isDead && !arenaWinner && !isSpectating && (
            <DeathScreen
              isArena={true}
              isVictory={false}
              killerName={killerName}
              score={finalScore}
              rank={arenaRank}
              onQuit={handleQuitToMenu}
              onRespawn={null}
              onSpectate={handleStartSpectate}
              canSpectate={killerId && killerId !== 'ZONE' && killerId !== socket.myId && !killerIsBot}
            />
          )}
        </>
      )}

      {/* Normal Game */}
      {gameState === 'playing' && (
        <>
          <div id="phaser-container" className="phaser-container" />
          {!isDead && !isSpectating && <HUD />}

          {/* Spectate Overlay */}
          {isSpectating && (
            <SpectateOverlay
              targetName={spectateTargetName}
              onExit={handleExitSpectate}
            />
          )}

          {/* Death screen - can respawn or spectate */}
          {isDead && !isSpectating && (
            <DeathScreen
              killerName={killerName}
              score={finalScore}
              onQuit={handleQuitToMenu}
              onRespawn={handleRespawn}
              onSpectate={handleStartSpectate}
              canSpectate={killerId && killerId !== socket.myId && !killerIsBot}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;