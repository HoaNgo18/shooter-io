// src/game/scenes/BaseScene.js
import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { PacketType } from '@shared/packetTypes';
import { ClientPlayer } from '../entities/ClientPlayer';
import { WEAPON_STATS, MAP_SIZE } from '@shared/constants';
import { AssetLoader } from '../AssetLoader';
import { InputManager } from '../InputManager';
import { EntityManager } from '../EntityManager';

export class BaseScene extends Phaser.Scene {
    constructor(key) {
        super(key);
        this.players = {};
        this.entityManager = null;
        this.inputManager = null;
        this.rangeCircle = null;
        this.isArena = false; // Mặc định là Endless
    }

    preload() {
        AssetLoader.preload(this);
    }

    create() {
        // 1. Setup Background chung
        const bg = this.add.tileSprite(0, 0, MAP_SIZE, MAP_SIZE, 'background');
        bg.setDepth(-100);

        // 2. Initialize Managers
        this.entityManager = new EntityManager(this);
        this.inputManager = new InputManager(this);

        // 3. UI Helpers
        this.createRangeCircle();

        // 4. Hook socket
        socket.setGameScene(this);
        
        console.log(`${this.scene.key} Created & Ready`);
    }

    update(time, delta) {
        if (!socket.isConnected) return;
        const dt = delta / 1000;

        // Update Players
        Object.values(this.players).forEach(player => {
            if (player.tick) player.tick(dt);
        });

        // Update Range Circle
        this.updateRangeCircle();

        // Send Input
        const inputData = this.inputManager.getInputData();
        socket.send({ type: PacketType.INPUT, data: inputData });
    }

    // --- LOGIC XỬ LÝ SERVER CHUNG ---

    initGame(data) {
        // Xử lý Players
        if (data.players) {
            data.players.forEach(p => this.updateOrAddPlayer(p));
        }

        // Xử lý Entities (Food, Obstacles, Chests...)
        this.entityManager.updateFoods({ foods: data.foods });
        this.entityManager.initObstacles(data.obstacles);
        this.entityManager.initNebulas(data.nebulas);
        this.entityManager.updateChests({ chests: data.chests });
        this.entityManager.updateItems({ items: data.items });

        // Camera Follow
        if (this.players[data.id]) {
            this.cameras.main.startFollow(this.players[data.id].container);
        }
    }

    handleServerUpdate(packet) {
        // Sync Players
        if (packet.players) {
            packet.players.forEach(p => this.updateOrAddPlayer(p));
        }

        // Camera check
        if (socket.myId && this.players[socket.myId] && !this.cameras.main._follow) {
            this.cameras.main.startFollow(this.players[socket.myId].container);
        }

        // Delegate cho EntityManager (Đã bao gồm fix lỗi Chest ma ở đây)
        this.entityManager.updateFoods(packet);
        this.entityManager.updateProjectiles(packet.projectiles);
        this.entityManager.updateExplosions(packet.explosions);
        this.entityManager.updateChests(packet);
        this.entityManager.updateItems(packet);
    }

    // --- CÁC HÀM PLAYER HELPER ---
    updateOrAddPlayer(pData) {
        const player = this.players[pData.id];
        if (player) {
            if (player.updateServerData) player.updateServerData(pData);
        } else {
            this.players[pData.id] = new ClientPlayer(this, pData);
        }
    }

    addPlayer(playerData) {
        if (!this.players[playerData.id]) {
            this.players[playerData.id] = new ClientPlayer(this, playerData);
        }
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.players[id].destroy();
            delete this.players[id];
        }
    }

    createRangeCircle() {
        this.rangeCircle = this.add.circle(0, 0, 100, 0xFFFFFF, 0);
        this.rangeCircle.setStrokeStyle(2, 0xFFFFFF, 0.3);
        this.rangeCircle.setDepth(10);
    }

    updateRangeCircle() {
        const myPlayer = this.players[socket.myId];
        if (myPlayer && myPlayer.container.visible) {
            const weaponType = myPlayer.weaponType || 'BLUE';
            const stats = WEAPON_STATS[weaponType] || WEAPON_STATS.BLUE;
            this.rangeCircle.setPosition(myPlayer.x, myPlayer.y);
            this.rangeCircle.setRadius(stats.range);
            this.rangeCircle.setVisible(true);
            this.rangeCircle.setStrokeStyle(2, myPlayer.isMoving && stats.requireStill ? 0xFF0000 : 0xFFFFFF, 0.5);
        } else {
            this.rangeCircle.setVisible(false);
        }
    }
}