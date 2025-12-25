// client/src/game/scenes/ArenaScene.js
import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { PacketType } from '@shared/packetTypes';
import { ClientPlayer } from '../entities/ClientPlayer';
import { WEAPON_STATS, MAP_SIZE } from '@shared/constants';
import { AssetLoader } from '../AssetLoader';
import { InputManager } from '../InputManager';
import { EntityManager } from '../EntityManager';

export class ArenaScene extends Phaser.Scene {
    constructor() {
        super('ArenaScene');
        this.players = {};
        this.entityManager = null;
        this.inputManager = null;
        this.rangeCircle = null;
        this.isArena = true;
        this.lastRangeUpdate = 0;
    }

    preload() {
        AssetLoader.preload(this);
    }

    create() {
        // 1. Setup Background
        const bg = this.add.tileSprite(0, 0, MAP_SIZE, MAP_SIZE, 'background');
        bg.setDepth(-100);

        // 2. Initialize Managers
        this.entityManager = new EntityManager(this);
        this.inputManager = new InputManager(this);

        // 3. Setup UI/Helpers
        this.createRangeCircle();

        // 4. Create Arena-specific UI (alive count)
        this.aliveCountText = this.add.text(16, 16, 'Alive: 10', {
            fontSize: '24px',
            fill: '#FFD700',
            fontFamily: 'Arial',
            stroke: '#000',
            strokeThickness: 4
        }).setScrollFactor(0).setDepth(1000);

        console.log('ArenaScene Created - Waiting for socket...');

        // 5. Connect Socket Logic
        socket.setGameScene(this);
    }

    createRangeCircle() {
        this.rangeCircle = this.add.circle(0, 0, 100, 0xFFFFFF, 0);
        this.rangeCircle.setStrokeStyle(2, 0xFFFFFF, 0.3);
        this.rangeCircle.setDepth(10);
    }

    update(time, delta) {
        if (!socket.isConnected) return;

        const dt = delta / 1000;

        // 1. Update Players
        Object.values(this.players).forEach(player => {
            if (player.tick) player.tick(dt);
        });

        if (!this.lastRangeUpdate || time - this.lastRangeUpdate > 100) {
            this.updateRangeCircle();
            this.lastRangeUpdate = time;
        }

        // 3. Send Input
        const inputData = this.inputManager.getInputData();
        socket.send({ type: PacketType.INPUT, data: inputData });
    }

    updateRangeCircle() {
        const myPlayer = this.players[socket.myId];
        if (myPlayer && myPlayer.container.visible) {
            const weaponType = myPlayer.weaponType || 'BLUE';
            const stats = WEAPON_STATS[weaponType] || WEAPON_STATS.BLUE;

            this.rangeCircle.x = myPlayer.x;
            this.rangeCircle.y = myPlayer.y;
            this.rangeCircle.radius = stats.range;
            this.rangeCircle.setVisible(true);

            if (stats.requireStill && myPlayer.isMoving) {
                this.rangeCircle.setStrokeStyle(2, 0xFF0000, 0.5);
            } else {
                this.rangeCircle.setStrokeStyle(2, 0xFFFFFF, 0.3);
            }
        } else {
            this.rangeCircle.setVisible(false);
        }
    }

    // --- SOCKET HANDLERS ---

    initGame(data) {
        console.log('[ArenaScene] initGame called', data);

        // Init Players
        if (data.players) {
            data.players.forEach(p => this.updateOrAddPlayer(p));
        }

        // Delegate entity init to manager
        this.entityManager.updateFoods({ foods: data.foods });
        this.entityManager.initObstacles(data.obstacles);
        this.entityManager.initNebulas(data.nebulas);
        this.entityManager.updateChests({ chests: data.chests });
        this.entityManager.updateItems({ items: data.items });

        // Camera Follow
        if (this.players[data.id]) {
            this.cameras.main.startFollow(this.players[data.id].container);
            this.cameras.main.setZoom(1);
        }
    }

    handleServerUpdate(packet) {
        // 1. Update Players
        if (packet.players) {
            packet.players.forEach(p => this.updateOrAddPlayer(p));
        }

        // Ensure Camera Follows Me
        if (socket.myId && this.players[socket.myId] && !this.cameras.main._follow) {
            this.cameras.main.startFollow(this.players[socket.myId].container);
        }

        // 2. Delegate updates to EntityManager
        this.entityManager.updateFoods(packet);
        this.entityManager.updateProjectiles(packet.projectiles);
        this.entityManager.updateExplosions(packet.explosions);
        this.entityManager.updateChests(packet);
        this.entityManager.updateItems(packet);

        // 3. Update alive count
        if (packet.aliveCount !== undefined && this.aliveCountText) {
            this.aliveCountText.setText(`Alive: ${packet.aliveCount}`);
        }
    }

    updateOrAddPlayer(pData) {
        const player = this.players[pData.id];
        if (player) {
            if (player.updateServerData) player.updateServerData(pData);
            else player.update(pData);
        } else {
            this.addPlayer(pData);
        }
    }

    addPlayer(playerData) {
        if (this.players[playerData.id]) return;
        this.players[playerData.id] = new ClientPlayer(this, playerData);
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.players[id].destroy();
            delete this.players[id];
        }
    }

    getLeaderboard() {
        return Object.values(this.players)
            .map(p => ({ name: p.name, score: p.score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }
}
