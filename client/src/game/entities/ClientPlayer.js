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
    }

    createShipSprite(skinId) {
        const textureKey = this.getShipTextureKey(skinId);
        const sprite = this.scene.add.sprite(0, 0, textureKey);
        sprite.setScale(0.5); // Adjust scale as needed
        return sprite;
    }

    getShipTextureKey(skinId) {
        // Bot sprites
        const botTextureMap = {
            'bot_black': 'bot_black',
            'bot_blue': 'bot_blue',
            'bot_green': 'bot_green',
            'bot_red': 'bot_red'
        };

        // Player sprites (Mapping từ Skin ID -> Texture Key đã Preload)
        const playerTextureMap = {
            'default': 'ship_default',
            'ship_1': 'ship_1',
            'ship_2': 'ship_2',
            'ship_3': 'ship_3',
            'ship_4': 'ship_4',
            'ship_5': 'ship_5',
            'ship_6': 'ship_6',
            'ship_7': 'ship_7',
            'ship_8': 'ship_8',
            'ship_9': 'ship_9'
        };

        if (botTextureMap[skinId]) {
            return botTextureMap[skinId];
        }

        // Nếu tìm thấy key tương ứng thì trả về, không thì trả về mặc định
        return playerTextureMap[skinId] || 'ship_default';
    }

    updateThrustFlame(isBoosting) {
        this.thrustFlame.clear();

        if (isBoosting) {
            // Kiểm tra xem là Bot hay Player
            const isBot = this.skinId.startsWith('bot_');

            // Nếu là Bot (ảnh hướng xuống), lửa phải vẽ ở tọa độ Âm (phía trên tâm)
            // Nếu là Player (ảnh hướng lên), lửa vẽ ở tọa độ Dương (phía dưới tâm)
            const direction = isBot ? -1 : 1;

            // Vẽ lửa cam (lớp ngoài)
            this.thrustFlame.fillStyle(0xFF6600, 0.8);
            this.thrustFlame.fillTriangle(
                -4, 16 * direction,   // Trái đuôi
                4, 16 * direction,    // Phải đuôi
                0, (26 + Math.random() * 5) * direction  // Đỉnh ngọn lửa
            );

            // Vẽ lửa vàng (lớp trong)
            this.thrustFlame.fillStyle(0xFFFF00, 0.6);
            this.thrustFlame.fillTriangle(
                -2, 16 * direction,
                2, 16 * direction,
                0, 22 * direction
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

        // Smooth rotation
        // Kiểm tra nếu là bot (sprite hướng XUỐNG) thì KHÔNG cần offset
        // Nếu là player (sprite hướng LÊN) thì cần offset +90°
        const isBot = this.skinId.startsWith('bot_');
        const rotationOffset = isBot ? (-Math.PI / 2) : 0; // Bot cần +90° để sprite khớp
        this.container.rotation = this.targetAngle + rotationOffset;

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
    }

    setVisibleState(isVisible) {
        this.container.setVisible(isVisible);
        this.text.setVisible(isVisible);
    }

    setAlphaState(alpha) {
        this.container.setAlpha(alpha);
        this.text.setAlpha(alpha);
    }

    destroy() {
        this.container.destroy();
        this.text.destroy();
    }
}