import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { PacketType } from '@shared/packetTypes';
import { ClientPlayer } from '../entities/ClientPlayer';
import { WEAPON_STATS, MAP_SIZE, ITEM_CONFIG } from '@shared/constants';

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
        this.nebulas = [];

        // Thêm range circle cho player
        this.rangeCircle = null;

        // Group cho explosions
        this.explosionGroup = null;
        this.playedExplosions = new Set();
    }

    preload() {
        // Load ship sprites
        this.load.image('ship_default', '/Ships/playerShip1_red.png');
        this.load.image('ship_1', '/Ships/playerShip2_red.png');
        this.load.image('ship_2', '/Ships/playerShip3_red.png');
        this.load.image('ship_3', '/Ships/ufoRed.png');
        this.load.image('ship_4', '/Ships/spaceShips_001.png');
        this.load.image('ship_5', '/Ships/spaceShips_002.png');
        this.load.image('ship_6', '/Ships/spaceShips_004.png');
        this.load.image('ship_7', '/Ships/spaceShips_007.png');
        this.load.image('ship_8', '/Ships/spaceShips_008.png');
        this.load.image('ship_9', '/Ships/spaceShips_009.png');

        //Load enemy ship sprites for bots
        this.load.image('bot_black', '/Enemies/enemyBlack1.png');
        this.load.image('bot_blue', '/Enemies/enemyBlue2.png');
        this.load.image('bot_green', '/Enemies/enemyGreen3.png');
        this.load.image('bot_red', '/Enemies/enemyRed4.png');

        // Load meteor sprites for obstacles
        const meteorFiles = [
            'meteorBrown_big1.png', 'meteorBrown_big2.png', 'meteorBrown_big3.png', 'meteorBrown_big4.png',
            'meteorBrown_med1.png', 'meteorBrown_med3.png', 'meteorBrown_small1.png', 'meteorBrown_small2.png',
            'meteorBrown_tiny1.png', 'meteorBrown_tiny2.png',
            'meteorGrey_big1.png', 'meteorGrey_big2.png', 'meteorGrey_big3.png', 'meteorGrey_big4.png',
            'meteorGrey_med1.png', 'meteorGrey_med2.png', 'meteorGrey_small1.png', 'meteorGrey_small2.png',
            'meteorGrey_tiny1.png', 'meteorGrey_tiny2.png', 'spaceMeteors_001.png', 'spaceMeteors_002.png',
            'spaceMeteors_003.png', 'spaceMeteors_004.png'
        ];
        meteorFiles.forEach(file => this.load.image(file.replace('.png', ''), '/Meteors/' + file));

        //Load background 
        this.load.image('background', '/Backgrounds/blue.png');

        //Load laser sprites
        this.load.image('laserBlue01', '/Lasers/laserBlue05.png');
        this.load.image('laserGreen01', '/Lasers/laserGreen13.png');
        this.load.image('laserRed01', '/Lasers/laserRed16.png');

        //Load stars
        this.load.image('star1', '/Effects/star1.png');
        this.load.image('star2', '/Effects/star2.png');

        //Load chests sprites
        this.load.image('chest1', '/Chests/spaceBuilding_001.png');
        this.load.image('chest2', '/Chests/spaceBuilding_018.png');
        this.load.image('chest3', '/Chests/spaceBuilding_025.png');

        //Load nebula sprite
        this.load.image('nebula1', '/Nebulas/fart00.png');
        this.load.image('nebula2', '/Nebulas/fart01.png');
        this.load.image('nebula3', '/Nebulas/fart02.png');
        this.load.image('nebula4', '/Nebulas/fart03.png');
        this.load.image('nebula5', '/Nebulas/fart04.png');

        //Load station sprite
        this.load.image('station1', '/Stations/spaceStation_018.png');
        this.load.image('station2', '/Stations/spaceStation_019.png');
        this.load.image('station3', '/Stations/spaceStation_022.png');
        this.load.image('station4', '/Stations/spaceStation_023.png');

        //Load item icons
        this.load.image('item_health_pack', '/Power-ups/pill_red.png');
        this.load.image('item_boost', '/Power-ups/bolt_gold.png');
        this.load.image('item_shield', '/Power-ups/shield_bronze.png');
        this.load.image('item_bronze_coin', '/Power-ups/star_bronze.png');
        this.load.image('item_silver_coin', '/Power-ups/star_silver.png');
        this.load.image('item_gold_coin', '/Power-ups/star_gold.png');
        this.load.image('item_weapon_blue', '/Lasers/laserBlue04.png');
        this.load.image('item_weapon_green', '/Lasers/laserGreen08.png');
        this.load.image('item_weapon_red', '/Lasers/laserRed04.png');

        //Load explosion sprite

        //Load shield sprite
        this.load.image('shield', '/Effects/shield3.png');

        this.load.image('item_invisible', '/Power-ups/hidden.png');      // Icon mắt
        this.load.image('item_bomb', '/Power-ups/floating_mine.png');
    }

    create() {

        //  Tạo background repeating
        const bg = this.add.tileSprite(0, 0, MAP_SIZE, MAP_SIZE, 'background');
        bg.setDepth(-100);

        this.playedExplosions = new Set();

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
            SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
            ONE: Phaser.Input.Keyboard.KeyCodes.ONE,     // Chọn slot 1
            TWO: Phaser.Input.Keyboard.KeyCodes.TWO,     // Chọn slot 2
            THREE: Phaser.Input.Keyboard.KeyCodes.THREE, // Chọn slot 3
            FOUR: Phaser.Input.Keyboard.KeyCodes.FOUR,
            FIVE: Phaser.Input.Keyboard.KeyCodes.FIVE
        });

        // 3. Groups (KHỞI TẠO TRƯỚC KHI SOCKET CHẠY)
        this.projectileGroup = this.add.group();
        this.foodGroup = this.add.group();
        this.obstacleGroup = this.add.group();
        this.chestGroup = this.add.group();
        this.itemGroup = this.add.group();
        this.explosionGroup = this.add.group();

        // 4. Tạo Range Circle (Ở layer dưới cùng)
        this.rangeCircle = this.add.circle(0, 0, 100, 0xFFFFFF, 0);
        this.rangeCircle.setStrokeStyle(2, 0xFFFFFF, 0.3);
        this.rangeCircle.setDepth(10); // Dưới mọi thứ

        // 5. Input Mouse
        this.input.on('pointerdown', (pointer) => {
            socket.send({ type: PacketType.ATTACK });
        });

        // 2. Space dùng Item
        this.input.keyboard.on('keydown-SPACE', () => {
            socket.send({ type: PacketType.USE_ITEM });
        });

        // 3. Chọn Inventory Slot (1-4)
        this.input.keyboard.on('keydown-ONE', () => {
            socket.send({ type: PacketType.SELECT_SLOT, slotIndex: 0 });
        });
        this.input.keyboard.on('keydown-TWO', () => {
            socket.send({ type: PacketType.SELECT_SLOT, slotIndex: 1 });
        });
        this.input.keyboard.on('keydown-THREE', () => {
            socket.send({ type: PacketType.SELECT_SLOT, slotIndex: 2 });
        });
        this.input.keyboard.on('keydown-FOUR', () => {
            socket.send({ type: PacketType.SELECT_SLOT, slotIndex: 3 });
        });
        this.input.keyboard.on('keydown-FIVE', () => {
            socket.send({ type: PacketType.SELECT_SLOT, slotIndex: 4 });
        });

        console.log('GameScene Created - Waiting for socket...');

        // 6. SETUP SOCKET Ở CUỐI CÙNG (Fix lỗi Initialization Order)
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

        // Cập nhật Range Circle theo player hiện tại
        const myPlayer = this.players[socket.myId];
        if (myPlayer && myPlayer.container.visible) {
            const weaponType = myPlayer.weaponType || 'BLUE';
            const stats = WEAPON_STATS[weaponType] || WEAPON_STATS.BLUE;
            // Cập nhật vị trí và kích thước
            this.rangeCircle.x = myPlayer.x;
            this.rangeCircle.y = myPlayer.y;
            this.rangeCircle.radius = stats.range;
            this.rangeCircle.setVisible(true);

            // Đổi màu nếu là Sniper và đang di chuyển (không bắn được)
            if (stats.requireStill && myPlayer.isMoving) {
                this.rangeCircle.setStrokeStyle(2, 0xFF0000, 0.5); // Đỏ = không bắn được
            } else {
                this.rangeCircle.setStrokeStyle(2, 0xFFFFFF, 0.3); // Trắng = bình thường
            }
        } else {
            this.rangeCircle.setVisible(false);
        }

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
        if (data.players) {
            data.players.forEach(p => {
                const player = this.players[p.id];
                if (player) {
                    if (player.updateServerData) player.updateServerData(p);
                } else {
                    this.addPlayer(p);
                }
            });
        }

        if (data.foods) {
            this.foodGroup.clear(true, true);
            this.foods = {};
            data.foods.forEach(f => this.createFoodSprite(f));
        }

        if (data.obstacles) {
            this.obstacleGroup.clear(true, true);
            data.obstacles.forEach(obs => {
                // Lấy sprite key trực tiếp từ server (đã được random sẵn)
                const spriteKey = obs.sprite || 'meteorBrown_med1'; // Fallback nếu thiếu

                const meteor = this.add.sprite(obs.x, obs.y, spriteKey);

                // Scale kích thước dựa trên width từ server
                const scale = obs.width / 90;
                meteor.setScale(scale);

                // Xoay ngẫu nhiên (Rotation)
                meteor.setRotation(Phaser.Math.RND.rotation());

                // Animation: Tự xoay tại chỗ
                const duration = Phaser.Math.RND.between(20000, 60000) * (scale > 1.5 ? 3 : 1);

                this.tweens.add({
                    targets: meteor,
                    angle: Math.random() > 0.5 ? 360 : -360,
                    duration: duration,
                    repeat: -1,
                    ease: 'Linear'
                });

                this.obstacleGroup.add(meteor);
            });
        }

        if (data.nebulas) {
            // Xóa cũ nếu có (đề phòng)
            this.nebulas.forEach(n => n.destroy());
            this.nebulas = [];

            // Tạo mới
            data.nebulas.forEach(b => this.createNebula(b));
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
        // LỚP BẢO VỆ TUYỆT ĐỐI (Fix lỗi crash: reading 'size' of undefined)
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
        if (socket.myId && this.players[socket.myId]) {
            // Nếu camera chưa follow ai, bắt nó follow mình
            if (!this.cameras.main._follow) {
                console.log("Camera now following player:", socket.myId);
                this.cameras.main.startFollow(this.players[socket.myId].container);
                this.cameras.main.setZoom(1);
            }
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

        // 3. Update Projectiles (với laser sprites)
        if (packet.projectiles) {
            this.projectileGroup.clear(true, true);
            packet.projectiles.forEach(p => {
                if (p.weaponType === 'BOMB') {
                    // 1. Vẽ BOM
                    const bombSprite = this.add.sprite(p.x, p.y, 'item_bomb'); // Dùng key 'item_bomb' đã load (floating_mine.png)

                    // Chỉnh kích thước
                    bombSprite.setDisplaySize(32, 32);
                    bombSprite.setDepth(5);

                    // LOGIC QUAY: Xoay dựa trên thời gian thực
                    // Quay 1 vòng (360 độ) mỗi 500ms
                    const rotationSpeed = 0.01;
                    bombSprite.rotation = Date.now() * rotationSpeed;

                    this.projectileGroup.add(bombSprite);

                } else {
                    // 2. Vẽ ĐẠN THƯỜNG (Giữ nguyên code cũ)
                    const stats = WEAPON_STATS[p.weaponType] || WEAPON_STATS.BLUE;
                    const laserSprite = stats.laserSprite || 'laserBlue01';

                    const laser = this.add.sprite(p.x, p.y, laserSprite);
                    laser.setRotation(p.angle + Math.PI / 2);
                    laser.setScale(1.0);
                    laser.setDepth(5);
                    this.projectileGroup.add(laser);
                }
            });
        }

        //  4. Update Explosions (Hiệu ứng nổ)
        if (packet.explosions) {
            packet.explosions.forEach(e => {
                if (this.playedExplosions.has(e.id)) return;
                this.playedExplosions.add(e.id);
                // Vẽ vòng tròn nổ với hiệu ứng
                const circle = this.add.circle(e.x, e.y, e.radius, 0xFF4400, 0.4);
                circle.setStrokeStyle(3, 0xFF0000, 0.8);

                // Animation phóng to + mờ dần
                this.tweens.add({
                    targets: circle,
                    scaleX: 1.5,
                    scaleY: 1.5,
                    alpha: 0,
                    duration: 350,
                    ease: 'Power2',
                    onComplete: () => circle.destroy()
                });

                this.explosionGroup.add(circle);
            });
        }

        // 5. Update Chests
        if (packet.chestsRemoved) {
            packet.chestsRemoved.forEach(id => {
                if (this.chests[id]) {
                    this.chests[id].destroy();
                    delete this.chests[id];
                }
            });
        }
        if (packet.chestsAdded) packet.chestsAdded.forEach(c => this.createChestSprite(c));

        // 6. Update Items
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
        // 1. Random chọn 1 trong 3 loại sao
        const texture = Phaser.Math.RND.pick(['star1', 'star2']);
        // 2. Tạo Sprite thay vì Circle
        const food = this.add.sprite(f.x, f.y, texture);
        // 3. Chỉnh kích thước
        // Food hitbox server là 5, nhưng ảnh sao cần to hơn chút để nhìn cho rõ
        // Set khoảng 24x24 pixel là đẹp
        food.setDisplaySize(24, 24);
        // 4. Thêm hiệu ứng xoay tròn (Tween)
        this.tweens.add({
            targets: food,
            alpha: 0.5,                  // Mờ dần xuống 50%
            scaleX: food.scaleX * 0.8,   // Co lại còn 80% kích thước gốc
            scaleY: food.scaleY * 0.8,
            duration: Phaser.Math.RND.between(500, 1000), // Mỗi ngôi sao nhấp nháy tốc độ khác nhau
            yoyo: true,                  // Đảo ngược lại (Sáng -> Mờ -> Sáng)
            repeat: -1,                  // Lặp vô hạn
            ease: 'Sine.easeInOut'       // Hiệu ứng mượt mà
        });
        // 5. Thêm vào Group và Map quản lý
        this.foodGroup.add(food);
        this.foods[f.id] = food;
    }

    createChestSprite(c) {
        if (this.chests[c.id]) return;
        let texture;
        const isStation = (c.type === 'STATION');
        if (isStation) {
            texture = Phaser.Math.RND.pick(['station1', 'station2', 'station3', 'station4']);
        } else {
            texture = Phaser.Math.RND.pick(['chest1', 'chest2', 'chest3']);
        }
        const sprite = this.add.sprite(c.x, c.y, texture);
        if (isStation) {
            if (c.width && c.height) {
                sprite.setDisplaySize(c.width, c.height);
            } else {
                sprite.setDisplaySize(86, 24);
            }

            sprite.setTint(0xDDDDDD);

            // SỬA: Thay animation scale bằng rotation
            this.tweens.add({
                targets: sprite,
                angle: 360,
                duration: 15000, // 15 giây/vòng
                repeat: -1,
                ease: 'Linear'
            });
        } else {
            // Chest thường thì hình vuông là đúng
            sprite.setDisplaySize(40, 40);
            sprite.setTint(0xFFFFFF);
        }

        this.chestGroup.add(sprite);
        this.chests[c.id] = sprite;
    }

    createNebula(data) {
        // Tạo Container để chứa "cụm" mây
        const container = this.add.container(data.x, data.y);

        // --- TẠO HIỆU ỨNG CỤM (CLUSTER) ---
        // Thay vì vẽ 1 sprite, ta vẽ 3 sprite xếp chồng lệch nhau để tạo độ dày
        const cloudCount = 3;

        for (let i = 0; i < cloudCount; i++) {
            // Random sprite
            const tex = Phaser.Math.RND.pick(['nebula1', 'nebula2', 'nebula3', 'nebula4', 'nebula5']);

            // Tạo độ lệch ngẫu nhiên (offset) xung quanh tâm để tạo cảm giác đám mây to
            // Offset trong khoảng -30% đến +30% bán kính
            const offsetX = Phaser.Math.RND.between(-data.radius * 0.3, data.radius * 0.3);
            const offsetY = Phaser.Math.RND.between(-data.radius * 0.3, data.radius * 0.3);

            const cloud = this.add.image(offsetX, offsetY, tex);

            // Scale to hơn logic cũ một chút
            // Logic cũ: * 2.5 -> Logic mới: * 3.5 để bao trùm rộng hơn
            // Giả sử ảnh gốc khoảng 256px
            const baseScale = (data.radius * 3.5) / 256;

            // Mỗi mây con có kích thước random nhẹ
            cloud.setScale(baseScale * Phaser.Math.RND.realInRange(0.8, 1.2));

            // Xoay ngẫu nhiên góc ảnh để không bị lặp lại pattern
            cloud.setRotation(Phaser.Math.RND.rotation());

            // Màu sắc: Nhuộm tím đặc trưng
            cloud.setTint(0x9C27B0);

            // Alpha thấp để các lớp mây hòa trộn vào nhau
            cloud.setAlpha(0.4);

            container.add(cloud);
        }

        // Set depth cao để che khuất người chơi (tạo cảm giác ẩn nấp)
        container.setDepth(15);

        // Hiệu ứng: Cả cụm mây xoay chậm lờ đờ
        this.tweens.add({
            targets: container,
            angle: 360,
            duration: 50000 + Math.random() * 20000, // 50-70 giây/vòng
            repeat: -1,
            ease: 'Linear'
        });

        this.nebulas.push(container);
    }

    createItemSprite(itemData) {
        if (this.items[itemData.id]) return;

        const config = ITEM_CONFIG[itemData.type];
        if (!config) {
            console.error('Unknown item type:', itemData.type);
            return;
        }

        // Create container
        const container = this.add.container(itemData.x, itemData.y);

        // === VÒNG GLOW BÊN NGOÀI (màu trắng, có hiệu ứng phóng to thu nhỏ) ===
        const outerGlowRadius = 25;
        const outerGlow = this.add.circle(0, 0, outerGlowRadius, 0xFFFFFF, 0.2);
        outerGlow.setStrokeStyle(2, 0xFFFFFF, 0.4);

        // === VÒNG MÀU BÊN TRONG (màu theo loại item: xanh/vàng/đỏ) ===
        const innerGlowRadius = 18;
        const innerGlow = this.add.circle(0, 0, innerGlowRadius, config.glowColor, 0.3);
        innerGlow.setStrokeStyle(2, config.glowColor, 0.6);

        // === ITEM SPRITE ===
        const sprite = this.add.sprite(0, 0, config.sprite);

        // --- SỬA ĐỔI TẠI ĐÂY ---
        // Thay vì dùng setScale (dựa trên ảnh gốc), ta dùng setDisplaySize (ép về size mong muốn)

        if (itemData.type === 'BOMB' || itemData.type === 'INVISIBLE') {
            // Ép kích thước cố định cho 2 món này (vì ảnh gốc quá to hoặc không đều)
            sprite.setDisplaySize(30, 30);
        } else {
            // Các item cũ giữ nguyên logic scale 0.6
            sprite.setScale(0.6);
        }

        sprite.setOrigin(0.5);

        // Add to container (thứ tự: outerGlow → innerGlow → sprite)
        container.add([outerGlow, innerGlow, sprite]);
        container.setDepth(12);

        // === ANIMATIONS ===

        // 1. Pulsing OUTER glow (vòng trắng bên ngoài)
        this.tweens.add({
            targets: outerGlow,
            scaleX: 1.3,
            scaleY: 1.3,
            alpha: 0.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 2. Pulsing INNER glow (vòng màu bên trong - nhịp nhanh hơn)
        this.tweens.add({
            targets: innerGlow,
            scaleX: 1.15,
            scaleY: 1.15,
            alpha: 0.5,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 2. Floating animation
        this.tweens.add({
            targets: container,
            y: container.y - 10,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 3. Rotation (for weapons only)
        if (itemData.type.includes('WEAPON')) {
            this.tweens.add({
                targets: sprite,
                angle: 360,
                duration: 3000,
                repeat: -1,
                ease: 'Linear'
            });
        }

        // 4. Sparkle particles (for coins and special items)
        const particles = this.add.particles(0, 0, 'star1', {
            speed: { min: 20, max: 50 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 800,
            frequency: 300,
            tint: config.glowColor // Dùng màu của vòng inner (xanh/vàng/đỏ)
        });
        container.add(particles);

        // === PICKUP NOTIFICATION SETUP ===
        container.setData('itemType', itemData.type);
        container.setData('itemName', config.name);

        this.itemGroup.add(container);
        this.items[itemData.id] = container;
    }

    updateFoods(foodsData) {
        this.foodGroup.clear(true, true);
        this.foods = {};
        foodsData.forEach(f => this.createFoodSprite(f));
    }

    getLeaderboard() {
        return Object.values(this.players).map(p => ({ name: p.name, score: p.score })).sort((a, b) => b.score - a.score).slice(0, 10);
    }
}