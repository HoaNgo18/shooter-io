import React, { useEffect, useState } from 'react';
import { socket } from '../network/socket';
import { MAP_SIZE, ITEM_CONFIG, WEAPON_STATS } from '@shared/constants';
import './HUD.css';

const MINIMAP_SIZE = 150;

const HUD = ({ isArena = false }) => {
  const [stats, setStats] = useState({
    lives: 3,
    maxLives: 3,
    score: 0,
    currentAmmo: 3,
    maxAmmo: 3,
    weapon: 'BLUE',
    inventory: [null, null, null, null, null],
    selectedSlot: 0
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [myPos, setMyPos] = useState({ x: 0, y: 0 });
  const [kingPos, setKingPos] = useState(null);
  const [aliveCount, setAliveCount] = useState(10);
  const [pickupNotif, setPickupNotif] = useState(null);

  // Use interval to poll data from gameScene
  // Giảm throttle để inventory responsive hơn
  useEffect(() => {
    let lastUpdate = Date.now();
    const UPDATE_THROTTLE = 100; // Giảm từ 250ms xuống 100ms

    const updateInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdate < UPDATE_THROTTLE) return;
      lastUpdate = now;

      if (!socket.gameScene || !socket.myId) return;

      const scene = socket.gameScene;
      const myPlayer = scene.players?.[socket.myId];

      if (myPlayer) {
        const serverMaxAmmo = myPlayer.maxAmmo || 3;
        const newInventory = myPlayer.inventory || [null, null, null, null, null];
        const newSelectedSlot = myPlayer.selectedSlot !== undefined ? myPlayer.selectedSlot : 0;

        setStats(prev => {
          // Check all fields including inventory and selectedSlot
          const inventoryChanged = JSON.stringify(prev.inventory) !== JSON.stringify(newInventory);
          const slotChanged = prev.selectedSlot !== newSelectedSlot;

          if (prev.lives !== myPlayer.lives ||
            prev.score !== myPlayer.score ||
            prev.currentAmmo !== myPlayer.currentAmmo ||
            prev.weapon !== myPlayer.weaponType ||
            prev.maxAmmo !== serverMaxAmmo ||
            inventoryChanged ||
            slotChanged) {
            return {
              lives: myPlayer.lives || 3,
              maxLives: myPlayer.maxLives || 3,
              score: myPlayer.score || 0,
              currentAmmo: myPlayer.currentAmmo !== undefined ? myPlayer.currentAmmo : serverMaxAmmo,
              maxAmmo: serverMaxAmmo,
              weapon: myPlayer.weaponType || 'BLUE',
              inventory: newInventory,
              selectedSlot: newSelectedSlot
            };
          }
          return prev;
        });
        setMyPos({ x: myPlayer.x, y: myPlayer.y });
      }

      if (scene.players) {
        const sorted = Object.values(scene.players)
          .filter(p => !p.dead && p.name)
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 10);

        setLeaderboard(prev => {
          const newIds = sorted.map(p => p.id + p.score).join(',');
          const oldIds = prev.map(p => p.id + p.score).join(',');
          if (newIds !== oldIds) {
            return sorted.map(p => ({
              id: p.id,
              name: p.name,
              score: p.score || 0,
              x: p.x,
              y: p.y
            }));
          }
          return prev;
        });

        if (sorted.length > 0) {
          setKingPos({ x: sorted[0].x, y: sorted[0].y });
        }

        if (isArena) {
          const alive = scene.aliveCount !== undefined ? scene.aliveCount : 10;
          setAliveCount(alive);
        }
      }

      setIsConnected(socket.isConnected);
    }, 250);

    const unsubscribe = socket.subscribe((packet) => {
      if (packet.type === 'ITEM_PICKED_UP' && packet.playerId === socket.myId) {
        const config = ITEM_CONFIG[packet.itemType];
        if (config) {
          setPickupNotif({
            name: config.name,
            description: config.description
          });
          setTimeout(() => setPickupNotif(null), 1500);
        }
      }
    });

    return () => {
      clearInterval(updateInterval);
      unsubscribe();
    };
  }, [isArena]);

  const worldToMinimap = (x, y) => {
    const shiftedX = x + (MAP_SIZE / 2);
    const shiftedY = y + (MAP_SIZE / 2);

    const ratioX = shiftedX / MAP_SIZE;
    const ratioY = shiftedY / MAP_SIZE;

    return {
      left: ratioX * MINIMAP_SIZE,
      top: ratioY * MINIMAP_SIZE
    };
  };

  const getAmmoColor = () => {
    const weaponStats = WEAPON_STATS[stats.weapon];
    return weaponStats ? '#' + weaponStats.color.toString(16).padStart(6, '0') : '#00E5FF';
  };

  const getItemImage = (type) => {
    if (!type) return null;
    switch (type) {
      case 'SPEED_BOOST': return '/Power-ups/bolt_gold.png';
      case 'SHIELD': return '/Power-ups/shield_gold.png';
      case 'INVISIBLE': return '/Power-ups/hidden.png';
      case 'BOMB': return '/Power-ups/floating_mine.png';
      default: return null;
    }
  };

  const myMinimapPos = worldToMinimap(myPos.x, myPos.y);
  const kingMinimapPos = kingPos ? worldToMinimap(kingPos.x, kingPos.y) : null;

  return (
    <div className="hud-container">

      {/* Stats (Lives, Score, Ammo, Alive) */}
      <div className="hud-stats-container">

        {/* Lives Row */}
        <div className="hud-row">
          <span className="hud-label">LIVES</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: stats.maxLives }).map((_, index) => (
              <img
                key={index}
                src="/UI/playerLife3_red.png"
                alt="life"
                className={`life-icon ${index < stats.lives ? 'life-active' : 'life-lost'}`}
              />
            ))}
          </div>
        </div>

        {/* Score Row */}
        <div className="hud-row" style={{ alignItems: 'baseline' }}>
          <span className="hud-label">SCORE</span>
          <span className="score-val">
            {stats.score.toString().padStart(6, '0')}
          </span>
        </div>

        {/* Ammo Row */}
        <div className="hud-row">
          <span className="hud-label">AMMO</span>
          <div className="ammo-bar-container">
            {Array.from({ length: stats.maxAmmo }).map((_, index) => (
              <div key={index}
                className="ammo-bullet"
                style={{
                  backgroundColor: index < stats.currentAmmo ? getAmmoColor() : 'transparent',
                  boxShadow: index < stats.currentAmmo ? `0 0 8px ${getAmmoColor()}` : 'none',
                  opacity: index < stats.currentAmmo ? 1 : 0.1,
                }}
              />
            ))}
          </div>
        </div>

        {/* Alive Row */}
        {isArena && (
          <div className="hud-row" style={{ alignItems: 'baseline' }}>
            <span className="hud-label">ALIVE</span>
            <span className="alive-val">
              {aliveCount} <span style={{ fontSize: '14px', color: '#AAA' }}>/ 10</span>
            </span>
          </div>
        )}

      </div>

      {/* Leaderboard */}
      <div className="hud-leaderboard">
        <h3 className="leaderboard-title">🏆 Top Players</h3>
        <div className="leader-list">
          {leaderboard.length > 0 ? leaderboard.map((player, index) => (
            <div key={player.id} className={`leader-item ${player.id === socket.myId ? 'me' : ''}`}>
              <span>
                <span className="leader-rank">#{index + 1}</span>
                {player.name || 'Unknown'}
              </span>
              <span>{player.score}</span>
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#aaa', fontSize: '12px' }}>Waiting...</div>
          )}
        </div>
      </div>

      {/* Minimap */}
      <div className="hud-minimap" style={{ width: `${MINIMAP_SIZE}px`, height: `${MINIMAP_SIZE}px` }}>
        <div className="minimap-axis h"></div>
        <div className="minimap-axis v"></div>

        <div className="minimap-player" style={{ left: myMinimapPos.left, top: myMinimapPos.top }} />

        {kingMinimapPos && (
          <div className="minimap-king" style={{ left: kingMinimapPos.left, top: kingMinimapPos.top }}>
            <div className="king-icon">👑</div>
          </div>
        )}
      </div>

      {/* Notification */}
      {pickupNotif && (
        <div className="hud-notif">
          <div className="notif-name">+ {pickupNotif.name}</div>
          <div className="notif-desc">{pickupNotif.description}</div>
        </div>
      )}

      {/* Inventory */}
      <div className="hud-inventory">
        {stats.inventory.map((item, index) => (
          <div key={index} className={`inv-slot ${index === stats.selectedSlot ? 'selected' : ''}`}>
            <span className="slot-num">{index + 1}</span>
            {item && (
              <img
                src={getItemImage(item)}
                alt={item}
                className="slot-img"
              />
            )}
          </div>
        ))}
      </div>

    </div>
  );
};

export default HUD;