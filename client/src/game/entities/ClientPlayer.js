// client/src/game/entities/ClientPlayer.js - SPRITE VERSION
import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { SKINS } from '@shared/constants';

export class ClientPlayer {
    constructor(scene, playerData) {
        this.scene = scene;
        this.isMe = (socket.myId === playerData.id);
        
        this.id = playerData.id;
        this.name = playerData.name;
        this.score = playerData.score || 0;
        this.x = playerData.x;
        this.y = playerData.y;
        this.targetX = playerData.x;
        this.targetY = playerData.y;
        this.targetAngle = playerData.angle || 0;

        // === CREATE CONTAINER ===
        this.container = scene.add.container(playerData.x, playerData.y);
        
        // Skin
        this.skinId = playerData.skinId || 'default';
        const skinInfo = SKINS.find(s => s.id === this.skinId);
        const color = skinInfo ? skinInfo.color : 0xFFFFFF;

        // === SHIP SPRITE ===
        this.shipSprite = this.createShipSprite(this.skinId);
        
        // === THRUST FLAME (Hiệu ứng lửa) ===
        this.thrustFlame = scene.add.graphics();
        this.updateThrustFlame(false);

        // === SHIELD EFFECT ===
        this.shieldCircle = scene.add.circle(0, 0, 30, 0x00FFFF, 0);
        this.shieldCircle.setStrokeStyle(3, 0x00FFFF, 0.6);
        this.shieldCircle.setVisible(false);

        // Add to container
        this.container.add([this.thrustFlame, this.shipSprite, this.shieldCircle]);
        this.container.setDepth(10);

        // === UI (Tên & Thanh máu) ===
        this.text = scene.add.text(playerData.x, playerData.y - 40, this.name, {
            fontSize: '14px', fontFamily: 'Arial', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3, align: 'center'
        }).setOrigin(0.5);
        this.text.setDepth(100);

        this.healthBarBg = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 6, 0x000000);
        this.healthBarBg.setDepth(100);

        this.healthBar = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 4, 0x00FF00);
        this.healthBar.setDepth(100);
    }

    createShipSprite(skinId) {
        const textureKey = this.getShipTextureKey(skinId);
        const sprite = this.scene.add.sprite(0, 0, textureKey);
        sprite.setScale(0.5); // Adjust scale as needed
        return sprite;
    }

    getShipTextureKey(skinId) {
        const textureMap = {
            'default': 'ship_default',
            'red': 'ship_red',
            'blue': 'ship_blue',
            'gold': 'ship_gold',
            'dark': 'ship_dark'
        };
        return textureMap[skinId] || 'ship_default';
    }

    updateThrustFlame(isBoosting) {
        this.thrustFlame.clear();
        
        if (isBoosting) {
            // Vẽ lửa phía sau tàu (giả sử mũi lên, đuôi xuống)
            // Đuôi tàu ở y ≈ +16, x = 0
            this.thrustFlame.fillStyle(0xFF6600, 0.8);
            this.thrustFlame.fillTriangle(
                -4, 16,   // Trái đuôi
                4, 16,    // Phải đuôi
                0, 26 + Math.random() * 5  // Đỉnh lửa
            );
            
            // Lửa vàng bên trong
            this.thrustFlame.fillStyle(0xFFFF00, 0.6);
            this.thrustFlame.fillTriangle(
                -2, 16,
                2, 16,
                0, 22
            );
        }
    }

    updateServerData(data) {
        if (data.dead) {
            this.setVisibleState(false);
            return;
        }

        // Update targets for lerp
        this.targetX = data.x;
        this.targetY = data.y;
        this.targetAngle = data.angle;

        // Update game data
        this.score = data.score;
        this.weaponType = data.weapon || 'PISTOL';
        this.isMoving = data.isMoving || false;
        this.isBoosting = data.isBoosting || false;

        // Update thrust flame
        this.updateThrustFlame(this.isBoosting);

        // Update skin
        if (data.skinId && data.skinId !== this.skinId) {
            this.skinId = data.skinId;
            
            // Recreate ship sprite with new texture
            this.shipSprite.destroy();
            this.shipSprite = this.createShipSprite(this.skinId);
            this.container.addAt(this.shipSprite, 1);
        }

        // Health bar
        if (data.maxHealth) {
            const percent = Math.max(0, data.health / data.maxHealth);
            this.healthBar.width = 40 * percent;
            this.healthBar.fillColor = percent < 0.3 ? 0xFF0000 : 0x00FF00;
        }

        // Scale
        if (data.radius) {
            const defaultRadius = 20;
            const scale = data.radius / defaultRadius;
            this.container.setScale(scale);
        }

        // Shield
        if (data.hasShield) {
            this.shieldCircle.setVisible(true);
            this.shieldCircle.radius = (data.radius || 20) + 8;
        } else {
            this.shieldCircle.setVisible(false);
        }

        // Hidden in nebula
        const isHidden = data.hi;
        if (isHidden) {
            if (this.isMe) {
                this.setAlphaState(0.5);
                this.setVisibleState(true);
            } else {
                this.setVisibleState(false);
            }
        } else {
            this.setVisibleState(true);
            this.setAlphaState(1);
        }
    }

    tick(dt) {
        if (!this.container.visible) return;

        const t = 0.2; // Lerp factor

        // Smooth position
        this.container.x = Phaser.Math.Linear(this.container.x, this.targetX, t);
        this.container.y = Phaser.Math.Linear(this.container.y, this.targetY, t);

        // Smooth rotation (Sprite mũi hướng lên, không cần offset)
        this.container.rotation = this.targetAngle;

        this.x = this.container.x;
        this.y = this.container.y;

        // Update thrust flame animation
        if (this.isBoosting) {
            this.updateThrustFlame(true);
        }

        // Sync UI
        const currentScale = this.container.scaleX;
        this.text.x = this.container.x;
        this.text.y = this.container.y - (40 * currentScale);

        this.healthBarBg.x = this.container.x;
        this.healthBarBg.y = this.container.y - (25 * currentScale);

        this.healthBar.x = this.container.x;
        this.healthBar.y = this.container.y - (25 * currentScale);
    }

    setVisibleState(isVisible) {
        this.container.setVisible(isVisible);
        this.text.setVisible(isVisible);
        this.healthBar.setVisible(isVisible);
        this.healthBarBg.setVisible(isVisible);
    }

    setAlphaState(alpha) {
        this.container.setAlpha(alpha);
        this.text.setAlpha(alpha);
        this.healthBar.setAlpha(alpha);
        this.healthBarBg.setAlpha(alpha);
    }

    destroy() {
        this.container.destroy();
        this.text.destroy();
        this.healthBar.destroy();
        this.healthBarBg.destroy();
    }
}