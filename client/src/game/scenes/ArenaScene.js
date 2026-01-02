import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { PacketType } from '@shared/packetTypes';
import { ClientPlayer } from '../entities/ClientPlayer';
import { WEAPON_STATS, MAP_SIZE, ARENA_CONFIG } from '@shared/constants';
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

        // Zone variables
        this.zoneData = null;
        this.zoneGraphics = null;
        this.zoneWarningText = null;

        // Spectate mode
        this.isSpectating = false;
        this.spectateTargetId = null;
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

        // 4. ZONE VISUALS INIT
        this.zoneGraphics = this.add.graphics();
        this.zoneGraphics.setDepth(100);

        // Text cảnh báo
        this.zoneWarningText = this.add.text(0, 0, "⚠️ DANGER ZONE ⚠️", {
            fontSize: '40px',
            fontFamily: 'Arial',
            color: '#ff0000',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        });
        this.zoneWarningText.setOrigin(0.5);
        this.zoneWarningText.setScrollFactor(0);
        this.zoneWarningText.setPosition(this.scale.width / 2, this.scale.height / 3);
        this.zoneWarningText.setDepth(200);
        this.zoneWarningText.setVisible(false);

        // 5. Create Arena-specific UI (alive count)
        this.aliveCount = 10;

        // 6. Connect Socket Logic
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

        // 2. Update Range Circle Visuals
        this.updateRangeCircle();

        // 3. Send Input (only if not spectating)
        if (!this.isSpectating) {
            const inputData = this.inputManager.getInputData();
            socket.send({ type: PacketType.INPUT, data: inputData });
        }

        // 4. UPDATE WARNING TEXT ANIMATION
        if (this.zoneWarningText.visible) {
            this.zoneWarningText.setAlpha(0.5 + Math.sin(time / 150) * 0.5);
        }

        // 5. Update camera follow for spectate mode
        this.updateSpectateCamera();
    }

    updateRangeCircle() {
        const myPlayer = this.players[socket.myId];
        if (myPlayer && myPlayer.container.visible && !this.isSpectating) {
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
        if (packet.aliveCount !== undefined) {
            this.aliveCount = packet.aliveCount;
        }

        // 4. HANDLE ZONE UPDATE
        if (packet.zone) {
            this.zoneData = packet.zone;
            this.drawZone();
            this.checkZoneWarning();
        }
    }

    // --- ZONE VISUAL LOGIC ---

    drawZone() {
        if (!this.zoneData || !this.zoneGraphics) return;

        const zoneKey = `${this.zoneData.x}_${this.zoneData.y}_${this.zoneData.r}`;
        if (this.lastZoneKey === zoneKey) return;
        this.lastZoneKey = zoneKey;

        const g = this.zoneGraphics;
        g.clear();

        const r = Math.max(0, this.zoneData.r);
        const x = this.zoneData.x;
        const y = this.zoneData.y;

        const mapSize = MAP_SIZE * 2;

        if (r > 0) {
            g.fillStyle(ARENA_CONFIG.ZONE.COLOR_DANGER, 0.4);

            const segments = 64;
            const angleStep = (Math.PI * 2) / segments;

            for (let i = 0; i < segments; i++) {
                const angle1 = i * angleStep;
                const angle2 = (i + 1) * angleStep;

                const x1 = x + Math.cos(angle1) * r;
                const y1 = y + Math.sin(angle1) * r;
                const x2 = x + Math.cos(angle2) * r;
                const y2 = y + Math.sin(angle2) * r;

                const outerDist = mapSize;
                const ox1 = x + Math.cos(angle1) * outerDist;
                const oy1 = y + Math.sin(angle1) * outerDist;
                const ox2 = x + Math.cos(angle2) * outerDist;
                const oy2 = y + Math.sin(angle2) * outerDist;

                g.beginPath();
                g.moveTo(x1, y1);
                g.lineTo(x2, y2);
                g.lineTo(ox2, oy2);
                g.lineTo(ox1, oy1);
                g.closePath();
                g.fillPath();
            }
        } else {
            g.fillStyle(ARENA_CONFIG.ZONE.COLOR_DANGER, 0.4);
            g.fillRect(x - mapSize, y - mapSize, mapSize * 2, mapSize * 2);
        }

        // VẼ VIỀN BO (TRẮNG)
        if (r > 0) {
            g.lineStyle(
                ARENA_CONFIG.ZONE.BORDER_WIDTH,
                ARENA_CONFIG.ZONE.COLOR_BORDER,
                1.0
            );
            g.strokeCircle(x, y, r);
        }
    }

    checkZoneWarning() {
        const myPlayer = this.players[socket.myId];
        if (!myPlayer || !this.zoneData) return;

        const dist = Phaser.Math.Distance.Between(
            myPlayer.x,
            myPlayer.y,
            this.zoneData.x,
            this.zoneData.y
        );

        if (dist > this.zoneData.r) {
            this.zoneWarningText.setVisible(true);
        } else {
            this.zoneWarningText.setVisible(false);
        }
    }

    // --- HELPER METHODS ---
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

    // --- EMOJI HANDLER ---
    handleEmoji(playerId, emoji) {
        const player = this.players[playerId];
        if (player && player.showEmoji) {
            player.showEmoji(emoji);
        }
    }

    // --- SPECTATE MODE ---

    /**
     * Start spectating a target player
     * @param {string} targetId - ID of player to spectate
     */
    startSpectate(targetId) {
        this.isSpectating = true;
        this.spectateTargetId = targetId;

        const target = this.players[targetId];
        if (target && target.container) {
            this.cameras.main.startFollow(target.container, true, 0.1, 0.1);
        }
    }

    /**
     * Stop spectating and return to normal mode
     */
    stopSpectate() {
        this.isSpectating = false;
        this.spectateTargetId = null;

        // Return camera to own player if still exists
        const myPlayer = this.players[socket.myId];
        if (myPlayer && myPlayer.container) {
            this.cameras.main.startFollow(myPlayer.container);
        } else {
            this.cameras.main.stopFollow();
        }
    }

    /**
     * Update camera to follow spectate target
     */
    updateSpectateCamera() {
        if (!this.isSpectating || !this.spectateTargetId) return;

        const target = this.players[this.spectateTargetId];
        if (target && target.container && !this.cameras.main._follow) {
            this.cameras.main.startFollow(target.container, true, 0.1, 0.1);
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
        const newTarget = this.players[newTargetId];
        if (newTarget && newTarget.container) {
            this.cameras.main.startFollow(newTarget.container, true, 0.1, 0.1);
        }
    }
}