import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { gameConfig } from '../game/config';

const GameCanvas = () => {
  const gameRef = useRef(null);

  useEffect(() => {
    // Khởi tạo Phaser khi component được mount
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(gameConfig);
    }

    // Dọn dẹp khi component bị unmount (rất quan trọng trong React)
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    // Phaser sẽ inject canvas vào div này nhờ id="game-container"
    <div id="game-container" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} />
  );
};

export default GameCanvas;