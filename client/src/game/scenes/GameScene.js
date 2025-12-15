import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { PacketType } from '@shared/packetTypes';
import { ClientPlayer } from '../entities/ClientPlayer';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.players = {}; // Object chứa các instance của ClientPlayer
        this.foods = {};   // Map quản lý food theo ID để xóa nhanh (O(1))
        this.keys = null;
        this.projectileGroup = null;
        this.foodGroup = null;
        this.obstacleGroup = null;
        this.chestGroup = null; // Group chứa sprite Chest
        this.chests = {};       // Map quản lý Chest

        this.itemGroup = null;  // Group chứa sprite Item
        this.items = {};        // Map quản lý Item
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
            SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE
        });

        // 4. Groups 
        this.projectileGroup = this.add.group();
        this.foodGroup = this.add.group();
        this.obstacleGroup = this.add.group();
        this.chestGroup = this.add.group();
        this.itemGroup = this.add.group();
        // Layering: Food < Item < Chest < Obstacle < Projectile < Player

        // 5. Input Mouse (Click để bắn)
        this.input.on('pointerdown', (pointer) => {
            socket.send({ type: PacketType.ATTACK });
        });

        console.log('GameScene Created');
    }

    // SỬA: Thêm tham số time, delta để tính toán Lerp
    update(time, delta) {
        if (!socket.isConnected) return;

        // LOGIC LERP: Loop qua các player để di chuyển mượt
        const dt = delta / 1000;
        Object.values(this.players).forEach(player => {
            // Kiểm tra xem hàm tick có tồn tại không trước khi gọi (để tránh crash nếu ClientPlayer chưa update)
            if (player.tick) {
                player.tick(dt);
            }
        });

        // Mouse: Tính lại tọa độ World dựa trên Camera hiện tại
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
        if (data.players) {
            data.players.forEach(p => this.addPlayer(p));
        }

        // LOGIC MỚI: Init Foods và lưu vào Map
        if (data.foods) {
            this.foodGroup.clear(true, true);
            this.foods = {}; // Reset map
            data.foods.forEach(f => this.createFoodSprite(f));
        }

        // Vẽ chướng ngại vật
        if (data.obstacles) {
            data.obstacles.forEach(obs => {
                const rock = this.add.circle(obs.x, obs.y, obs.radius, 0x888888);
                rock.setStrokeStyle(3, 0x555555);
                this.obstacleGroup.add(rock);
            });
        }

        // Init Chests
        if (data.chests) {
            this.chestGroup.clear(true, true);
            this.chests = {};
            data.chests.forEach(c => this.createChestSprite(c));
        }

        // Init Items
        if (data.items) {
            this.itemGroup.clear(true, true);
            this.items = {};
            data.items.forEach(i => this.createItemSprite(i));
        }

        // Camera follow
        if (this.players[data.id]) {
            this.cameras.main.startFollow(this.players[data.id].container);
            this.cameras.main.setZoom(1);
        }
    }

    handleServerUpdate(packet) {
        // 1. Update Players
        if (packet.players) {
            packet.players.forEach(p => {
                const player = this.players[p.id];
                if (player) {
                    // QUAN TRỌNG: Gọi hàm này để set mục tiêu Lerp
                    if (player.updateServerData) {
                        player.updateServerData(p);
                    } else {
                        player.update(p); // Fallback cho code cũ
                    }
                } else {
                    this.addPlayer(p);
                }
            });
        }

        // 2. Update Foods (DELTA OPTIMIZATION)
        // Xóa food bị ăn (Server gửi id trong mảng foodsRemoved)
        if (packet.foodsRemoved && packet.foodsRemoved.length > 0) {
            packet.foodsRemoved.forEach(id => {
                if (this.foods[id]) {
                    this.foods[id].destroy(); // Xóa sprite Phaser
                    delete this.foods[id];    // Xóa khỏi Map
                }
            });
        }

        // Thêm food mới sinh (Server gửi object trong mảng foodsAdded)
        if (packet.foodsAdded && packet.foodsAdded.length > 0) {
            packet.foodsAdded.forEach(f => this.createFoodSprite(f));
        }

        // Hỗ trợ update full list (như code cũ của bạn) nếu server gửi gói tin cũ
        if (packet.foods) {
            this.foodGroup.clear(true, true);
            this.foods = {};
            packet.foods.forEach(f => this.createFoodSprite(f));
        }

        // 3. Update Projectiles
        if (packet.projectiles) {
            this.projectileGroup.clear(true, true);
            packet.projectiles.forEach(p => {
                const bullet = this.add.circle(p.x, p.y, 8, 0xFFFF00);
                this.projectileGroup.add(bullet);
            });
        }

        // 🟢 Update Chests
        if (packet.chestsRemoved) {
            packet.chestsRemoved.forEach(id => {
                if (this.chests[id]) {
                    this.chests[id].destroy();
                    delete this.chests[id];
                    // Thêm hiệu ứng nổ bùm ở đây thì tuyệt
                }
            });
        }
        if (packet.chestsAdded) {
            packet.chestsAdded.forEach(c => this.createChestSprite(c));
        }

        // 🟢 Update Items
        if (packet.itemsRemoved) {
            packet.itemsRemoved.forEach(id => {
                if (this.items[id]) {
                    this.items[id].destroy();
                    delete this.items[id];
                }
            });
        }
        if (packet.itemsAdded) {
            packet.itemsAdded.forEach(i => this.createItemSprite(i));
        }
    }

    addPlayer(playerData) {
        if (this.players[playerData.id]) return;
        // Tạo instance mới của ClientPlayer
        this.players[playerData.id] = new ClientPlayer(this, playerData);
    }

    removePlayer(id) {
        if (this.players[id]) {
            this.players[id].destroy();
            delete this.players[id];
        }
    }

    // Helper: Tách hàm tạo food để tái sử dụng
    createFoodSprite(f) {
        if (this.foods[f.id]) return; // Đã tồn tại thì bỏ qua

        let color = 0xFFFFFF;
        if (f.type === 0) color = 0xFF4444;
        if (f.type === 1) color = 0x44FF44;
        if (f.type === 2) color = 0x4444FF;

        const food = this.add.circle(f.x, f.y, 5, color);
        this.foodGroup.add(food);

        // Lưu vào Map để quản lý xóa nhanh
        this.foods[f.id] = food;
    }

    createChestSprite(c) {
        if (this.chests[c.id]) return;

        // Vẽ Chest: Hình vuông màu nâu/cam (Tượng trưng thùng hàng không gian)
        const chest = this.add.rectangle(c.x, c.y, 40, 40, 0xCD853F);
        chest.setStrokeStyle(2, 0xFFFFFF);

        this.chestGroup.add(chest);
        this.chests[c.id] = chest;
    }

    createItemSprite(i) {
        if (this.items[i.id]) return;

        let color = 0xFFFFFF;
        let text = "?";
        let fontSize = '11px'; // Chữ nhỏ vừa vặn

        switch (i.type) {
            // --- Vật phẩm hỗ trợ ---
            case 'HEALTH_PACK':
                color = 0xFF0000; // Đỏ
                text = "HP";      // Health
                break;
            case 'SHIELD':
                color = 0x00FFFF; // Cyan
                text = "SHD";     // Shield
                break;
            case 'SPEED':
                color = 0xFFFF00; // Vàng
                text = "SPD";     // Speed
                break;

            // --- Vũ khí (Weapon) ---
            case 'WEAPON_ROCKET':
                color = 0xFF4500; // Cam đậm (Rocket)
                text = "RKT";
                break;
            case 'WEAPON_SHOTGUN':
                color = 0xFFA500; // Cam (Shotgun)
                text = "SHT";
                break;
            case 'WEAPON_MACHINEGUN':
                color = 0xADFF2F; // Xanh nõn chuối (Machine Gun)
                text = "MG";
                break;
            case 'WEAPON_LASER':
                color = 0x00BFFF; // Xanh biển (Laser)
                text = "LSR";
                break;

            default:
                // Fallback cho loại lạ
                if (i.type.includes('WEAPON')) {
                    color = 0x9933FF;
                    text = "W";
                }
        }

        // Vẽ Item: Tròn nhỏ phát sáng
        const container = this.add.container(i.x, i.y);

        // Vòng tròn nền
        const circle = this.add.circle(0, 0, 15, color);
        // Thêm viền đen mỏng để chữ dễ đọc hơn trên nền sáng
        circle.setStrokeStyle(2, 0x000000);

        // Chữ viết tắt
        const label = this.add.text(0, 0, text, {
            fontSize: fontSize,
            color: '#000000',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5); // Căn giữa chữ vào tâm vòng tròn

        container.add([circle, label]);

        // Tween item nhấp nháy/bay bay cho đẹp
        this.tweens.add({
            targets: container,
            scaleX: 1.15,
            scaleY: 1.15,
            yoyo: true,
            repeat: -1,
            duration: 600,
            ease: 'Sine.easeInOut'
        });

        this.itemGroup.add(container);
        this.items[i.id] = container;
    }

    // Giữ lại hàm cũ trỏ về logic mới để không break code
    updateFoods(foodsData) {
        this.foodGroup.clear(true, true);
        this.foods = {};
        foodsData.forEach(f => this.createFoodSprite(f));
    }

    getLeaderboard() {
        const list = Object.values(this.players).map(p => ({
            name: p.name, // Giả định ClientPlayer có thuộc tính name
            score: p.score // Giả định ClientPlayer có thuộc tính score
        }));
        return list.sort((a, b) => b.score - a.score).slice(0, 10);
    }
}