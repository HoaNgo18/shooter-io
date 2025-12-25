import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { SKINS, WEAPON_STATS } from '@shared/constants';

// 1. TỐI ƯU: Đưa map ra ngoài để không phải khởi tạo lại mỗi lần gọi hàm
const SHIP_TEXTURE_MAP = {
    // Bots
    'bot_black': 'bot_black',
    'bot_blue': 'bot_blue',
    'bot_green': 'bot_green',
    'bot_red': 'bot_red',
    // Players
    'default': 'ship_default',
    'ship_1': 'ship_1', 'ship_2': 'ship_2', 'ship_3': 'ship_3',
    'ship_4': 'ship_4', 'ship_5': 'ship_5', 'ship_6': 'ship_6',
    'ship_7': 'ship_7', 'ship_8': 'ship_8', 'ship_9': 'ship_9'
};

export class ClientPlayer {
    constructor(scene, playerData) {
        this.scene = scene;
        this.isMe = (socket.myId === playerData.id);

        this.id = playerData.id;
        this.name = playerData.name;

        // Data sync initialization
        this.updateLocalData(playerData);
        this.targetX = playerData.x;
        this.targetY = playerData.y;
        this.targetAngle = playerData.angle || 0;

        // === VISUAL SETUP ===
        this.container = scene.add.container(playerData.x, playerData.y);
        this.container.setDepth(10);

        // 1. Thrust Flame
        this.thrustFlame = scene.add.graphics();

        // 2. Ammo Container (Nằm dưới tàu)
        this.ammoContainer = scene.add.container(0, 0);
        this.ammoOrbs = [];

        // 3. Ship Sprite
        this.skinId = playerData.skinId || 'default';
        this.shipSprite = this.createShipSprite(this.skinId);

        // 4. Shield
        this.shieldSprite = scene.add.sprite(0, 0, 'shield');
        this.shieldSprite.setScale(0.8).setVisible(false).setAlpha(0.8);

        // 5. Name Tag
        this.text = scene.add.text(0, -40, this.name, {
            fontSize: '14px', fontFamily: 'Arial', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5).setDepth(100);

        // Add to container (Order matters: Flame -> Ammo -> Ship -> Shield)
        this.container.add([this.thrustFlame, this.ammoContainer, this.shipSprite, this.shieldSprite]);

        // State trackers
        this.lastAmmoCount = -1;
        this.lastWeaponType = '';
        this.lastMaxAmmo = 0;
        this.lastFlameUpdate = 0;  // ← THÊM
        this.lastAmmoRotate = 0;

        // Init visuals
        this.updateThrustFlame(false);
    }

    updateLocalData(data) {
        this.score = data.score || 0;
        this.x = data.x;
        this.y = data.y;
    }

    createShipSprite(skinId) {
        // 2. TỐI ƯU: Truy xuất trực tiếp từ constant map
        const textureKey = SHIP_TEXTURE_MAP[skinId] || 'ship_default';
        const sprite = this.scene.add.sprite(0, 0, textureKey);
        sprite.setScale(0.5);
        return sprite;
    }

    updateThrustFlame(isBoosting) {
        this.thrustFlame.clear();
        if (!isBoosting) return; // Code gọn hơn

        const isBot = this.skinId.startsWith('bot_');
        const direction = isBot ? -1 : 1;

        // Config based on speed state
        const config = this.isSpeedUp
            ? { scale: 1.4, outer: 0x00FFFF, inner: 0xFFFFFF }
            : { scale: 1.3, outer: 0xFF6600, inner: 0xFFFF00 };

        const { scale, outer, inner } = config;

        // Draw Outer
        this.thrustFlame.fillStyle(outer, 0.8);
        this.thrustFlame.fillTriangle(
            -4 * scale, 16 * direction,
            4 * scale, 16 * direction,
            0, (26 + Math.random() * 5) * direction * scale
        );

        // Draw Inner
        this.thrustFlame.fillStyle(inner, 0.6);
        this.thrustFlame.fillTriangle(
            -2 * scale, 16 * direction,
            2 * scale, 16 * direction,
            0, 22 * direction * scale
        );
    }

    updateAmmoVisuals(count, weaponType, maxAmmo) {
        // Reset
        this.ammoOrbs.forEach(orb => orb.destroy());
        this.ammoOrbs = [];
        if (count <= 0) return;

        const stats = WEAPON_STATS[weaponType] || WEAPON_STATS.BLUE;
        const radius = 35;
        const startAngle = -Math.PI / 2;
        const actualMax = maxAmmo || stats.maxAmmo || 1;
        const angleStep = (Math.PI * 2) / actualMax;

        for (let i = 0; i < count; i++) {
            const angle = startAngle + (i * angleStep);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const orb = this.scene.add.circle(x, y, 2.5, stats.color, 1);
            orb.setStrokeStyle(0.5, 0xFFFFFF, 0.8);

            this.scene.tweens.add({
                targets: orb,
                alpha: 0.6, scale: 1.3, duration: 600,
                yoyo: true, repeat: -1
            });

            this.ammoContainer.add(orb);
            this.ammoOrbs.push(orb);
        }
    }

    updateServerData(data) {
        if (data.dead) {
            this.setVisibleState(false);
            return;
        }

        // Logic sync giữ nguyên vì đã ổn
        this.targetX = data.x;
        this.targetY = data.y;
        this.targetAngle = data.angle;
        this.score = data.score;
        this.weaponType = data.weapon || 'PISTOL';
        this.isMoving = data.isMoving || false;
        this.isBoosting = data.isBoosting || false;
        this.isSpeedUp = data.isSpeedUp || false;

        this.updateThrustFlame(this.isBoosting);

        // Check ammo changes
        if (data.currentAmmo !== undefined && (
            data.currentAmmo !== this.lastAmmoCount ||
            data.weapon !== this.lastWeaponType ||
            data.maxAmmo !== this.lastMaxAmmo
        )) {
            this.updateAmmoVisuals(data.currentAmmo, data.weapon || 'BLUE', data.maxAmmo);
            this.lastAmmoCount = data.currentAmmo;
            this.lastWeaponType = data.weapon || 'BLUE';
            this.lastMaxAmmo = data.maxAmmo;
        }

        // Check skin changes
        if (data.skinId && data.skinId !== this.skinId) {
            this.skinId = data.skinId;
            this.shipSprite.destroy();
            this.shipSprite = this.createShipSprite(this.skinId);
            // Re-add to container at correct index (sau ammo, trước shield)
            this.container.addAt(this.shipSprite, 2);
        }

        // Scale
        if (data.radius) {
            this.container.setScale(data.radius / 20);
        }

        // Shield
        if (data.hasShield) {
            this.shieldSprite.setVisible(true);
            const shieldScale = (data.radius || 20) / 20 * 0.4;
            this.shieldSprite.setScale(shieldScale);

            if (!this.scene.tweens.isTweening(this.shieldSprite)) {
                this.scene.tweens.add({
                    targets: this.shieldSprite,
                    alpha: { from: 0.8, to: 0.5 },
                    duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                });
            }
        } else {
            this.shieldSprite.setVisible(false);
            this.scene.tweens.killTweensOf(this.shieldSprite);
        }

        // Visibility (Nebula / Invisible)
        const isHidden = data.hi;
        if (isHidden) {
            this.isMe ? (this.setAlphaState(0.5), this.setVisibleState(true)) : this.setVisibleState(false);
        } else {
            this.setVisibleState(true);
            this.setAlphaState(1);
        }
    }

    tick(dt) {
        if (!this.container.visible) return;

        // Interpolation mượt hơn với lerp factor động
        const distance = Math.hypot(this.targetX - this.container.x, this.targetY - this.container.y);
        const t = distance > 100 ? 0.3 : 0.15; // Lerp nhanh hơn khi xa

        this.container.x = Phaser.Math.Linear(this.container.x, this.targetX, t);
        this.container.y = Phaser.Math.Linear(this.container.y, this.targetY, t);

        const isBot = this.skinId.startsWith('bot_');
        const rotationOffset = isBot ? (-Math.PI / 2) : 0;
        this.container.rotation = this.targetAngle + rotationOffset;

        // ✅ THÊM: Sync properties để HUD và các component khác truy cập được
        this.x = this.container.x;
        this.y = this.container.y;

        // Throttle flame animation
        if (this.isBoosting && (!this.lastFlameUpdate || Date.now() - this.lastFlameUpdate > 50)) {
            this.updateThrustFlame(true);
            this.lastFlameUpdate = Date.now();
        }

        // Throttle ammo rotation
        if (this.ammoContainer && (!this.lastAmmoRotate || Date.now() - this.lastAmmoRotate > 100)) {
            this.ammoContainer.rotation += 0.2;
            this.lastAmmoRotate = Date.now();
        }
    }

    setVisibleState(isVisible) {
        this.container.setVisible(isVisible);
        // Nếu Text add vào container thì không cần dòng dưới, còn nếu add rời thì cần:
        // this.text.setVisible(isVisible); 
    }

    setAlphaState(alpha) {
        this.container.setAlpha(alpha);
    }

    destroy() {
        this.scene.tweens.killTweensOf(this.container);
        this.scene.tweens.killTweensOf(this.shieldSprite);
        this.scene.tweens.killTweensOf(this.thrustFlame);
        this.container.destroy();
        // Text nằm trong container sẽ tự hủy, nếu nằm ngoài thì cần destroy thủ công
        // this.text.destroy(); 
    }
}