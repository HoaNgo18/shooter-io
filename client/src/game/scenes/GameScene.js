import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { PacketType } from '@shared/packetTypes';
import { ClientPlayer } from '../entities/ClientPlayer'; // 🟢 Import class mới

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.players = {}; // Object chứa các instance của ClientPlayer
        this.keys = null;
        this.projectileGroup = null;
        this.foodGroup = null;
    }

    create() {
        // 1. Setup Socket
        socket.setGameScene(this);

        // 2. Background
        this.add.grid(0, 0, 5000, 5000, 100, 100, 0x1a1a1a, 1, 0x2a2a2a, 1);

        // 3. Input Keyboard (Full WASD + Arrow + Space)
        this.keys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D,
            UP: Phaser.Input.Keyboard.KeyCodes.UP,
            DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
            LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
            RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
            ONE: Phaser.Input.Keyboard.KeyCodes.ONE,
            TWO: Phaser.Input.Keyboard.KeyCodes.TWO,
            THREE: Phaser.Input.Keyboard.KeyCodes.THREE
        });

        // 4. Groups
        this.projectileGroup = this.add.group();
        this.foodGroup = this.add.group();
        this.obstacleGroup = this.add.group();

        // 5. Input Mouse (Click để bắn)
        this.input.on('pointerdown', (pointer) => {
            // console.log('🖱️ Shoot at:', pointer.worldX, pointer.worldY);
            socket.send({ type: PacketType.ATTACK });
        });

        console.log('🎮 GameScene Created');
    }

    update() {
        if (!socket.isConnected) return;

        // 🟢 FIX LỖI GHIM CHUỘT: Tính lại tọa độ World dựa trên Camera hiện tại
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        const inputData = {
            movement: {
                up: this.keys.W.isDown || this.keys.UP.isDown,
                down: this.keys.S.isDown || this.keys.DOWN.isDown,
                left: this.keys.A.isDown || this.keys.LEFT.isDown,
                right: this.keys.D.isDown || this.keys.RIGHT.isDown,
                space: this.keys.SPACE.isDown,
                num1: this.keys.ONE.isDown,
                num2: this.keys.TWO.isDown,
                num3: this.keys.THREE.isDown
            },
            mouseX: worldPoint.x, // Dùng tọa độ thực tế đã tính toán
            mouseY: worldPoint.y
        };

        socket.send({ type: PacketType.INPUT, data: inputData });
    }

    // --- SOCKET HANDLERS ---

    initGame(data) {
        if (data.players) {
            data.players.forEach(p => this.addPlayer(p));
        }
        if (data.foods) {
            this.updateFoods(data.foods);
        }
        // 🟢 Vẽ chướng ngại vật
        if (data.obstacles) {
            data.obstacles.forEach(obs => {
                // Vẽ hình tròn màu xám làm đá
                const rock = this.add.circle(obs.x, obs.y, obs.radius, 0x888888);
                // Thêm viền cho đẹp
                rock.setStrokeStyle(3, 0x555555);
                this.obstacleGroup.add(rock);
            });
        }

        // Camera follow
        if (this.players[data.id]) {
            this.cameras.main.startFollow(this.players[data.id].container);
            this.cameras.main.setZoom(1); // Zoom mặc định
        }
    }

    handleServerUpdate(packet) {
        // 1. Update Players
        if (packet.players) {
            packet.players.forEach(p => {
                const player = this.players[p.id];
                if (player) {
                    player.update(p); // 🟢 Gọi hàm update của ClientPlayer
                } else {
                    this.addPlayer(p);
                }
            });
        }

        // 2. Update Foods
        if (packet.foods) {
            this.updateFoods(packet.foods);
        }

        // 3. Update Projectiles
        if (packet.projectiles) {
            this.projectileGroup.clear(true, true);
            packet.projectiles.forEach(p => {
                // Vẽ đạn
                const bullet = this.add.circle(p.x, p.y, 8, 0xFFFF00);
                this.projectileGroup.add(bullet);
            });
        }
    }

    addPlayer(playerData) {
        if (this.players[playerData.id]) return;
        // 🟢 Tạo instance mới của ClientPlayer
        this.players[playerData.id] = new ClientPlayer(this, playerData);
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.players[id].destroy(); // 🟢 Gọi hàm hủy sạch sẽ
            delete this.players[id];
        }
    }

    updateFoods(foodsData) {
        this.foodGroup.clear(true, true);
        foodsData.forEach(f => {
            let color = 0xFFFFFF;
            if (f.type === 0) color = 0xFF4444; // Đỏ nhạt
            if (f.type === 1) color = 0x44FF44; // Xanh lá
            if (f.type === 2) color = 0x4444FF; // Xanh dương

            const food = this.add.circle(f.x, f.y, 5, color);
            this.foodGroup.add(food);
        });
    }

    // 🟢 Hỗ trợ Leaderboard cho HUD
    getLeaderboard() {
        const list = Object.values(this.players).map(p => ({
            name: p.name,
            score: p.score
        }));
        // Sắp xếp giảm dần
        return list.sort((a, b) => b.score - a.score).slice(0, 10);
    }
}