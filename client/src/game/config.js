import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

export const gameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container', // ID của thẻ DIV trong React
  backgroundColor: '#1a1a1a',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false, // Bật true để xem hitbox
    },
  },
  scene: [GameScene], // Danh sách các màn chơi
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};