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

        // Spectate mode
        this.isSpectating = false;
        this.spectateTargetId = null;
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

        // Send Input (only if not spectating)
        if (!this.isSpectating) {
            const inputData = this.inputManager.getInputData();
            socket.send({ type: PacketType.INPUT, data: inputData });
        }

        // Update camera follow for spectate mode
        this.updateSpectateCamera();
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

        // Camera check - only follow own player if NOT spectating
        if (!this.isSpectating && socket.myId && this.players[socket.myId] && !this.cameras.main._follow) {
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

            // RED laser có tầm bắn quá lớn (1000px) -> không vẽ range circle
            if (weaponType === 'RED') {
                this.rangeCircle.setVisible(false);
                return;
            }

            const stats = WEAPON_STATS[weaponType] || WEAPON_STATS.BLUE;
            this.rangeCircle.setPosition(myPlayer.x, myPlayer.y);
            this.rangeCircle.setRadius(stats.range);
            this.rangeCircle.setVisible(true);
            this.rangeCircle.setStrokeStyle(2, myPlayer.isMoving && stats.requireStill ? 0xFF0000 : 0xFFFFFF, 0.5);
        } else {
            this.rangeCircle.setVisible(false);
        }
    }

    // --- SPECTATE MODE ---

    /**
     * Start spectating a target player
     * @param {string} targetId - ID of player to spectate
     */
    startSpectate(targetId) {
        console.log('[Spectate] Starting spectate for target:', targetId);
        console.log('[Spectate] Available players:', Object.keys(this.players));
        
        this.isSpectating = true;
        this.spectateTargetId = targetId;

        // Stop following current player first
        this.cameras.main.stopFollow();

        const target = this.players[targetId];
        console.log('[Spectate] Target found:', target ? 'YES' : 'NO');
        if (target && target.container) {
            console.log('[Spectate] Following target container');
            this.cameras.main.startFollow(target.container, true, 0.1, 0.1);
        } else {
            console.log('[Spectate] Target not found or no container, will retry in updateSpectateCamera');
        }
    }

    /**
     * Stop spectating and return to normal mode
     */
    stopSpectate() {
        this.isSpectating = false;
        this.spectateTargetId = null;

        this.cameras.main.stopFollow();

        // Return camera to own player if still exists
        const myPlayer = this.players[socket.myId];
        if (myPlayer && myPlayer.container) {
            this.cameras.main.startFollow(myPlayer.container);
        }
    }

    /**
     * Update camera to follow spectate target
     */
    updateSpectateCamera() {
        if (!this.isSpectating || !this.spectateTargetId) return;

        const target = this.players[this.spectateTargetId];
        if (target && target.container) {
            // Always ensure we're following the target when spectating
            if (this.cameras.main._follow !== target.container) {
                console.log('[Spectate] updateSpectateCamera - now following target:', this.spectateTargetId);
                this.cameras.main.startFollow(target.container, true, 0.1, 0.1);
            }
        }
    }

    /**
     * Switch spectate target to a new player
     * @param {string} newTargetId - New target player ID
     */
    switchSpectateTarget(newTargetId) {
        if (!newTargetId) {
            this.stopSpectate();
            return;
        }

        this.spectateTargetId = newTargetId;
        this.cameras.main.stopFollow();
        
        const newTarget = this.players[newTargetId];
        if (newTarget && newTarget.container) {
            this.cameras.main.startFollow(newTarget.container, true, 0.1, 0.1);
        }
    }
}