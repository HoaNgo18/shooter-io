import Phaser from 'phaser';
import { WEAPON_STATS, ITEM_CONFIG } from '@shared/constants';

export class EntityManager {
    constructor(scene) {
        this.scene = scene;

        // Groups
        this.projectileGroup = scene.add.group();
        this.foodGroup = scene.add.group();
        this.obstacleGroup = scene.add.group();
        this.chestGroup = scene.add.group();
        this.itemGroup = scene.add.group();
        this.explosionGroup = scene.add.group();

        // Data Maps
        this.foods = {};
        this.chests = {};
        this.items = {};
        this.nebulas = []; // Array for nebulas

        // Explosion tracking
        this.playedExplosions = new Set();
    }

    // --- FOOD LOGIC ---
    updateFoods(packet) {
        if (packet.foodsRemoved) {
            packet.foodsRemoved.forEach(id => {
                if (this.foods[id]) {
                    this.foods[id].destroy();
                    delete this.foods[id];
                }
            });
        }
        if (packet.foodsAdded) packet.foodsAdded.forEach(f => this.createFoodSprite(f));
        if (packet.foods) { // Full sync
            this.foodGroup.clear(true, true);
            this.foods = {};
            packet.foods.forEach(f => this.createFoodSprite(f));
        }
    }

    createFoodSprite(f) {
        if (this.foods[f.id]) return;
        const texture = Phaser.Math.RND.pick(['star1', 'star2']);
        const food = this.scene.add.sprite(f.x, f.y, texture);
        food.setDisplaySize(24, 24);

        this.scene.tweens.add({
            targets: food,
            alpha: 0.5,
            scaleX: food.scaleX * 0.8,
            scaleY: food.scaleY * 0.8,
            duration: Phaser.Math.RND.between(500, 1000),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.foodGroup.add(food);
        this.foods[f.id] = food;
    }

    // --- PROJECTILE LOGIC ---
    updateProjectiles(projectilesData) {
        if (!projectilesData) return;
        this.projectileGroup.clear(true, true);

        projectilesData.forEach(p => {
            if (p.weaponType === 'BOMB') {
                this.renderBomb(p);
            } else {
                const stats = WEAPON_STATS[p.weaponType] || WEAPON_STATS.BLUE;
                const laserSprite = stats.laserSprite || 'laserBlue01';
                const laser = this.scene.add.sprite(p.x, p.y, laserSprite);
                laser.setRotation(p.angle + Math.PI / 2);
                laser.setScale(1.0);
                laser.setDepth(5);
                this.projectileGroup.add(laser);
            }
        });
    }

    /**
     * Render bomb đơn giản kiểu Astro Party
     * - Đặt bomb → hiển thị mine sprite (xoay chậm)
     * - Enemy vào range → xoay nhanh 0.5s → nổ
     */
    renderBomb(p) {
        const container = this.scene.add.container(p.x, p.y);
        container.setDepth(5);

        const isTriggered = p.isTriggered;
        const triggerProgress = p.triggerProgress || 0;

        // Bomb sprite
        const bombSprite = this.scene.add.sprite(0, 0, 'item_bomb');
        bombSprite.setDisplaySize(36, 36);
        container.add(bombSprite);

        // TRIGGERED: Chỉ xoay nhanh, KHÔNG scale
        if (isTriggered) {
            // Xoay cực nhanh - tốc độ tăng dần
            const spinSpeed = 20 + triggerProgress * 40; // 20 -> 60 rad/s
            bombSprite.setRotation(Date.now() * spinSpeed * 0.001);

            // Flash màu đỏ -> trắng khi sắp nổ
            if (triggerProgress > 0.7) {
                bombSprite.setTint(0xFFFFFF);
            } else {
                bombSprite.setTint(0xFF6666);
            }
        } else {
            // Idle: xoay chậm nhẹ
            bombSprite.setRotation(Date.now() * 0.001);
        }

        this.projectileGroup.add(container);
    }

    // --- EXPLOSION LOGIC ---
    updateExplosions(explosionsData) {
        if (!explosionsData) return;

        explosionsData.forEach(e => {
            if (this.playedExplosions.has(e.id)) return;
            this.playedExplosions.add(e.id);

            this.createExplosionEffect(e.x, e.y, e.radius);
        });
    }

    /**
     * Tạo explosion effect với multiple layers
     */
    createExplosionEffect(x, y, radius) {
        // Layer 1: Core flash (trắng sáng)
        const coreFlash = this.scene.add.circle(x, y, radius * 0.3, 0xFFFFFF, 1);
        this.scene.tweens.add({
            targets: coreFlash,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 150,
            ease: 'Power2',
            onComplete: () => coreFlash.destroy()
        });

        // Layer 2: Inner explosion (cam/đỏ)
        const innerExplosion = this.scene.add.circle(x, y, radius * 0.5, 0xFF6600, 0.8);
        this.scene.tweens.add({
            targets: innerExplosion,
            scaleX: 1.8,
            scaleY: 1.8,
            alpha: 0,
            duration: 250,
            ease: 'Power2',
            onComplete: () => innerExplosion.destroy()
        });

        // Layer 3: Outer explosion (đỏ đậm)
        const outerExplosion = this.scene.add.circle(x, y, radius, 0xFF2200, 0.5);
        outerExplosion.setStrokeStyle(4, 0xFF0000, 0.8);
        this.scene.tweens.add({
            targets: outerExplosion,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => outerExplosion.destroy()
        });

        // Layer 4: Shockwave ring
        const shockwave = this.scene.add.circle(x, y, radius * 0.2, 0xFFFFFF, 0);
        shockwave.setStrokeStyle(3, 0xFFAA00, 0.8);
        this.scene.tweens.add({
            targets: shockwave,
            scaleX: 3,
            scaleY: 3,
            duration: 350,
            ease: 'Cubic.easeOut',
            onComplete: () => shockwave.destroy()
        });
        this.scene.tweens.add({
            targets: shockwave,
            alpha: 0,
            duration: 350,
            ease: 'Power2'
        });

        // Particles (sparks)
        const particleCount = 8;
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2;
            const particle = this.scene.add.circle(x, y, 4, 0xFFAA00, 1);

            const targetX = x + Math.cos(angle) * radius * 1.5;
            const targetY = y + Math.sin(angle) * radius * 1.5;

            this.scene.tweens.add({
                targets: particle,
                x: targetX,
                y: targetY,
                scaleX: 0.2,
                scaleY: 0.2,
                alpha: 0,
                duration: 300 + Math.random() * 150,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }

        this.explosionGroup.add(coreFlash);
        this.explosionGroup.add(innerExplosion);
        this.explosionGroup.add(outerExplosion);
        this.explosionGroup.add(shockwave);
    }

    // --- OBSTACLE LOGIC ---
    initObstacles(obstaclesData) {
        if (!obstaclesData) return;
        this.obstacleGroup.clear(true, true);
        obstaclesData.forEach(obs => {
            const spriteKey = obs.sprite || 'meteorBrown_med1';
            const meteor = this.scene.add.sprite(obs.x, obs.y, spriteKey);
            const scale = obs.width / 90;
            meteor.setScale(scale);
            meteor.setRotation(Phaser.Math.RND.rotation());

            const duration = Phaser.Math.RND.between(20000, 60000) * (scale > 1.5 ? 3 : 1);
            this.scene.tweens.add({
                targets: meteor,
                angle: Math.random() > 0.5 ? 360 : -360,
                duration: duration,
                repeat: -1,
                ease: 'Linear'
            });

            this.obstacleGroup.add(meteor);
        });
    }

    // --- NEBULA LOGIC ---
    initNebulas(nebulasData) {
        if (!nebulasData) return;
        this.nebulas.forEach(n => n.destroy());
        this.nebulas = [];

        nebulasData.forEach(data => {
            const container = this.scene.add.container(data.x, data.y);
            const cloudCount = 3;

            for (let i = 0; i < cloudCount; i++) {
                const tex = Phaser.Math.RND.pick(['nebula1', 'nebula2', 'nebula3', 'nebula4', 'nebula5']);
                const offsetX = Phaser.Math.RND.between(-data.radius * 0.3, data.radius * 0.3);
                const offsetY = Phaser.Math.RND.between(-data.radius * 0.3, data.radius * 0.3);

                const cloud = this.scene.add.image(offsetX, offsetY, tex);
                const baseScale = (data.radius * 3.5) / 256;
                cloud.setScale(baseScale * Phaser.Math.RND.realInRange(0.8, 1.2));
                cloud.setRotation(Phaser.Math.RND.rotation());
                cloud.setTint(0x9C27B0);
                cloud.setAlpha(0.4);

                container.add(cloud);
            }

            container.setDepth(15);
            this.scene.tweens.add({
                targets: container,
                angle: 360,
                duration: 50000 + Math.random() * 20000,
                repeat: -1,
                ease: 'Linear'
            });

            this.nebulas.push(container);
        });
    }

    // --- CHEST LOGIC ---
    updateChests(packet) {
        if (packet.chestsRemoved) {
            packet.chestsRemoved.forEach(id => {
                if (this.chests[id]) {
                    this.chests[id].destroy();
                    delete this.chests[id];
                }
            });
        }
        if (packet.chestsAdded) packet.chestsAdded.forEach(c => this.createChestSprite(c));
        if (packet.chests) {
            this.chestGroup.clear(true, true);
            this.chests = {};
            packet.chests.forEach(c => this.createChestSprite(c));
        }
    }

    createChestSprite(c) {
        if (this.chests[c.id]) return;
        let texture;
        const isStation = (c.type === 'STATION');

        if (isStation) {
            texture = Phaser.Math.RND.pick(['station1', 'station2', 'station3', 'station4']);
            const sprite = this.scene.add.sprite(c.x, c.y, texture);
            sprite.setDisplaySize(c.width || 86, c.height || 24);
            sprite.setTint(0xDDDDDD);

            this.scene.tweens.add({
                targets: sprite,
                angle: 360,
                duration: 15000,
                repeat: -1,
                ease: 'Linear'
            });
            this.chestGroup.add(sprite);
            this.chests[c.id] = sprite;
        } else {
            texture = Phaser.Math.RND.pick(['chest1', 'chest2', 'chest3']);
            const sprite = this.scene.add.sprite(c.x, c.y, texture);
            sprite.setDisplaySize(40, 40);
            sprite.setTint(0xFFFFFF);
            this.chestGroup.add(sprite);
            this.chests[c.id] = sprite;
        }
    }

    // --- ITEM LOGIC ---
    updateItems(packet) {
        // 1. Tạo Set chứa các ID bị xóa để tra cứu cho nhanh
        const removedIds = new Set();
        if (packet.itemsRemoved) {
            packet.itemsRemoved.forEach(id => removedIds.add(String(id)));
        }

        // 2. Xử lý XÓA trước (dọn dẹp các item cũ trên màn hình)
        if (packet.itemsRemoved) {
            packet.itemsRemoved.forEach(rawId => {
                const id = String(rawId);
                if (this.items[id]) {
                    this.items[id].destroy();
                    delete this.items[id];
                }
            });
        }

        // 3. Xử lý THÊM MỚI
        if (packet.itemsAdded) {
            packet.itemsAdded.forEach(itemData => {
                const id = String(itemData.id);

                // === [FIX LOGIC GHOST ITEM] ===
                // Nếu item này vừa sinh ra mà đã nằm trong danh sách bị xóa (removedIds)
                // Nghĩa là nó bị ăn ngay trong cùng 1 frame -> ĐỪNG VẼ NÓ RA
                if (removedIds.has(id)) {
                    return; // Bỏ qua, không tạo sprite
                }

                this.createItemSprite(itemData);
            });
        }
    }

    createItemSprite(itemData) {
        if (this.items[itemData.id]) return;
        const config = ITEM_CONFIG[itemData.type];
        if (!config) return;

        const container = this.scene.add.container(itemData.x, itemData.y);

        // Visual construction (Glows, Sprite, Particles) - Giữ nguyên logic cũ nhưng gọn hơn
        const outerGlow = this.scene.add.circle(0, 0, 25, 0xFFFFFF, 0.2).setStrokeStyle(2, 0xFFFFFF, 0.4);
        const innerGlow = this.scene.add.circle(0, 0, 18, config.glowColor, 0.3).setStrokeStyle(2, config.glowColor, 0.6);
        const sprite = this.scene.add.sprite(0, 0, config.sprite);
        sprite.setOrigin(0.5);

        if (itemData.type === 'BOMB' || itemData.type === 'INVISIBLE') {
            sprite.setDisplaySize(30, 30);
        } else {
            sprite.setScale(0.6);
        }

        container.add([outerGlow, innerGlow, sprite]);
        container.setDepth(12);

        // Animations
        this.scene.tweens.add({ targets: outerGlow, scaleX: 1.3, scaleY: 1.3, alpha: 0.1, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.scene.tweens.add({ targets: innerGlow, scaleX: 1.15, scaleY: 1.15, alpha: 0.5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.scene.tweens.add({ targets: container, y: container.y - 10, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        if (itemData.type.includes('WEAPON')) {
            this.scene.tweens.add({ targets: sprite, angle: 360, duration: 3000, repeat: -1, ease: 'Linear' });
        }

        this.itemGroup.add(container);
        this.items[itemData.id] = container;
    }
}