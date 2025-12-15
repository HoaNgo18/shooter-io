import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { PacketType } from '@shared/packetTypes';
import { ClientPlayer } from '../entities/ClientPlayer';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.players = {}; 
        this.foods = {};   
        this.keys = null;
        this.projectileGroup = null;
        this.foodGroup = null;
        this.obstacleGroup = null;
        this.chestGroup = null;
        this.chests = {};       
        this.itemGroup = null;  
        this.items = {};        
    }

    create() {
        // 1. Background
        this.add.grid(0, 0, 5000, 5000, 100, 100, 0x1a1a1a, 1, 0x2a2a2a, 1);

        // 2. Input Keyboard
        this.keys = this.input.keyboard.addKeys({
            W: Phaser.Input.Keyboard.KeyCodes.W,
            A: Phaser.Input.Keyboard.KeyCodes.A,
            S: Phaser.Input.Keyboard.KeyCodes.S,
            D: Phaser.Input.Keyboard.KeyCodes.D,
            UP: Phaser.Input.Keyboard.KeyCodes.UP,
            DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
            LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
            RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE
        });

        // 3. Groups (KHỞI TẠO TRƯỚC KHI SOCKET CHẠY)
        this.projectileGroup = this.add.group();
        this.foodGroup = this.add.group();
        this.obstacleGroup = this.add.group();
        this.chestGroup = this.add.group();
        this.itemGroup = this.add.group();

        // 4. Input Mouse
        this.input.on('pointerdown', (pointer) => {
            socket.send({ type: PacketType.ATTACK });
        });

        console.log('GameScene Created - Waiting for socket...');

        // 🟢 5. SETUP SOCKET Ở CUỐI CÙNG (Fix lỗi Initialization Order)
        socket.setGameScene(this);
    }

    update(time, delta) {
        if (!socket.isConnected) return;

        // Logic Lerp Player
        const dt = delta / 1000;
        Object.values(this.players).forEach(player => {
            if (player.tick) {
                player.tick(dt);
            }
        });

        // Input Logic
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

        const inputData = {
            movement: {
                up: this.keys.W.isDown || this.keys.UP.isDown,
                down: this.keys.S.isDown || this.keys.DOWN.isDown,
                left: this.keys.A.isDown || this.keys.LEFT.isDown,
                right: this.keys.D.isDown || this.keys.RIGHT.isDown,
                space: this.keys.SPACE.isDown,
            },
            mouseX: worldPoint.x,
            mouseY: worldPoint.y
        };

        socket.send({ type: PacketType.INPUT, data: inputData });
    }

    // --- SOCKET HANDLERS ---

    initGame(data) {
        if (data.players) data.players.forEach(p => this.addPlayer(p));

        if (data.foods) {
            this.foodGroup.clear(true, true);
            this.foods = {};
            data.foods.forEach(f => this.createFoodSprite(f));
        }

        if (data.obstacles) {
            data.obstacles.forEach(obs => {
                const rock = this.add.circle(obs.x, obs.y, obs.radius, 0x888888);
                rock.setStrokeStyle(3, 0x555555);
                this.obstacleGroup.add(rock);
            });
        }

        if (data.chests) {
            this.chestGroup.clear(true, true);
            this.chests = {};
            data.chests.forEach(c => this.createChestSprite(c));
        }

        if (data.items) {
            this.itemGroup.clear(true, true);
            this.items = {};
            data.items.forEach(i => this.createItemSprite(i));
        }

        if (this.players[data.id]) {
            this.cameras.main.startFollow(this.players[data.id].container);
            this.cameras.main.setZoom(1);
        }
    }

    handleServerUpdate(packet) {
        // 🟢 LỚP BẢO VỆ TUYỆT ĐỐI (Fix lỗi crash: reading 'size' of undefined)
        if (!this.chestGroup || !this.itemGroup || !this.projectileGroup || !this.foodGroup) {
            return;
        }

        // 1. Update Players
        if (packet.players) {
            packet.players.forEach(p => {
                const player = this.players[p.id];
                if (player) {
                    if (player.updateServerData) player.updateServerData(p);
                    else player.update(p);
                } else {
                    this.addPlayer(p);
                }
            });
        }

        // 2. Update Foods
        if (packet.foodsRemoved) {
            packet.foodsRemoved.forEach(id => {
                if (this.foods[id]) {
                    this.foods[id].destroy();
                    delete this.foods[id];
                }
            });
        }
        if (packet.foodsAdded) packet.foodsAdded.forEach(f => this.createFoodSprite(f));
        if (packet.foods) { // Full sync fallback
            this.foodGroup.clear(true, true);
            this.foods = {};
            packet.foods.forEach(f => this.createFoodSprite(f));
        }

        // 3. Update Projectiles
        if (packet.projectiles) {
            this.projectileGroup.clear(true, true);
            packet.projectiles.forEach(p => {
                // Vẽ đạn dựa trên màu server gửi về (nếu có), mặc định vàng
                const color = p.color || 0xFFFF00; 
                const bullet = this.add.circle(p.x, p.y, 8, color);
                this.projectileGroup.add(bullet);
            });
        }

        // 4. Update Chests
        if (packet.chestsRemoved) {
            packet.chestsRemoved.forEach(id => {
                if (this.chests[id]) {
                    this.chests[id].destroy();
                    delete this.chests[id];
                }
            });
        }
        if (packet.chestsAdded) packet.chestsAdded.forEach(c => this.createChestSprite(c));

        // 5. Update Items
        if (packet.itemsRemoved) {
            packet.itemsRemoved.forEach(id => {
                if (this.items[id]) {
                    this.items[id].destroy();
                    delete this.items[id];
                }
            });
        }
        if (packet.itemsAdded) packet.itemsAdded.forEach(i => this.createItemSprite(i));
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

    createFoodSprite(f) {
        if (this.foods[f.id]) return;
        let color = 0xFFFFFF;
        if (f.type === 0) color = 0xFF4444;
        if (f.type === 1) color = 0x44FF44;
        if (f.type === 2) color = 0x4444FF;
        const food = this.add.circle(f.x, f.y, 5, color);
        this.foodGroup.add(food);
        this.foods[f.id] = food;
    }

    createChestSprite(c) {
        if (this.chests[c.id]) return;
        const chest = this.add.rectangle(c.x, c.y, 40, 40, 0xCD853F);
        chest.setStrokeStyle(2, 0xFFFFFF);
        this.chestGroup.add(chest);
        this.chests[c.id] = chest;
    }

    createItemSprite(i) {
        if (this.items[i.id]) return;

        let color = 0xFFFFFF;
        let text = "?";
        let fontSize = '11px';

        switch (i.type) {
            case 'HEALTH_PACK': color = 0xFF0000; text = "HP"; break;
            case 'SHIELD': color = 0x00FFFF; text = "SHD"; break;
            case 'SPEED': color = 0xFFFF00; text = "SPD"; break;
            case 'WEAPON_ROCKET': color = 0xFF4500; text = "RKT"; break;
            case 'WEAPON_SHOTGUN': color = 0xFFA500; text = "SHT"; break;
            case 'WEAPON_MACHINEGUN': color = 0xADFF2F; text = "MG"; break;
            case 'WEAPON_LASER': color = 0x00BFFF; text = "LSR"; break;
            default: if (i.type.includes('WEAPON')) { color = 0x9933FF; text = "W"; }
        }

        const container = this.add.container(i.x, i.y);
        const circle = this.add.circle(0, 0, 15, color);
        circle.setStrokeStyle(2, 0x000000);
        const label = this.add.text(0, 0, text, { fontSize, color: '#000000', fontFamily: 'Arial', fontWeight: 'bold' }).setOrigin(0.5);

        container.add([circle, label]);
        this.tweens.add({
            targets: container, scaleX: 1.15, scaleY: 1.15,
            yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut'
        });

        this.itemGroup.add(container);
        this.items[i.id] = container;
    }

    updateFoods(foodsData) {
        this.foodGroup.clear(true, true);
        this.foods = {};
        foodsData.forEach(f => this.createFoodSprite(f));
    }
    
    getLeaderboard() {
       return Object.values(this.players).map(p => ({ name: p.name, score: p.score })).sort((a,b) => b.score - a.score).slice(0, 10);
    }
}