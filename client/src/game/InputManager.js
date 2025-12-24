import Phaser from 'phaser';
import { socket } from '../network/socket';
import { PacketType } from '@shared/packetTypes';

export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.keys = scene.input.keyboard.addKeys({
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
            THREE: Phaser.Input.Keyboard.KeyCodes.THREE,
            FOUR: Phaser.Input.Keyboard.KeyCodes.FOUR,
            FIVE: Phaser.Input.Keyboard.KeyCodes.FIVE
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mouse click -> Attack
        this.scene.input.on('pointerdown', () => {
            socket.send({ type: PacketType.ATTACK });
        });

        // Space -> Use Item
        this.scene.input.keyboard.on('keydown-SPACE', () => {
            socket.send({ type: PacketType.USE_ITEM });
        });

        // Slot selection
        const slotKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
        slotKeys.forEach((key, index) => {
            this.scene.input.keyboard.on(`keydown-${key}`, () => {
                socket.send({ type: PacketType.SELECT_SLOT, slotIndex: index });
            });
        });
    }

    getInputData() {
        const pointer = this.scene.input.activePointer;
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

        return {
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
    }
}