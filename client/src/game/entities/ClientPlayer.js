import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { SKINS } from '@shared/constants';

export class ClientPlayer {
    constructor(scene, playerData) {
        this.scene = scene;
        if (socket.myId === playerData.id) { // Chỉ in ra log của chính mình
            console.log("MY PLAYER DATA:", playerData);
            console.log("MY SKIN ID:", playerData.skinId);
        }
        this.id = playerData.id;
        this.name = playerData.name;
        this.score = playerData.score || 0;

        // Lưu vị trí hiện tại
        this.x = playerData.x;
        this.y = playerData.y;

        // Biến lưu vị trí đích (Target) để Lerp
        this.targetX = playerData.x;
        this.targetY = playerData.y;

        this.weaponType = playerData.weapon || 'PISTOL';
        this.isMoving = playerData.isMoving || false;

        // --- 1. Tạo Container ---
        this.container = scene.add.container(playerData.x, playerData.y);
        const skinId = playerData.skinId || 'default';
        const skinInfo = SKINS.find(s => s.id === skinId);
        const color = skinInfo ? skinInfo.color : 0xFFFFFF;
        // -----------------------

        // Vẽ thân (Circle) - Dùng biến color đã lấy được
        const circle = scene.add.circle(0, 0, 20, color);

        // Vẽ súng (Rectangle)
        const weapon = scene.add.rectangle(15, 0, 20, 8, 0xFFFFFF);

        this.container.add([weapon, circle]);
        this.container.setDepth(1); // Lớp dưới

        // --- 2. Tạo Tên & Thanh Máu ---

        // Tên 
        this.text = scene.add.text(playerData.x, playerData.y - 40, this.name, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        this.text.setDepth(2);

        // Thanh máu 
        // Nền đen
        this.healthBarBg = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 6, 0x000000);
        this.healthBarBg.setDepth(2);

        // Shield bar
        this.shieldCircle = scene.add.circle(0, 0, 25, 0x00FFFF, 0);
        this.shieldCircle.setStrokeStyle(3, 0x00FFFF, 0.6);
        this.container.add(this.shieldCircle); // Add vào container để tự động follow
        this.shieldCircle.setVisible(false); // Ẩn mặc định

        // Thanh máu xanh (Máu thực tế)
        this.healthBar = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 4, 0x00FF00);
        this.healthBar.setDepth(2);
    }

    // Hàm 1: Nhận dữ liệu từ Server (Chỉ lưu đích đến & State)
    updateServerData(data) {
        // 1. Xử lý Chết/Sống
        if (data.dead) {
            this.container.setVisible(false);
            this.text.setVisible(false);
            this.healthBar.setVisible(false);   // Ẩn máu
            this.healthBarBg.setVisible(false); // Ẩn nền máu
            return;
        }

        // Nếu đang sống thì hiện lên
        this.container.setVisible(true);
        this.text.setVisible(true);
        this.healthBar.setVisible(true);
        this.healthBarBg.setVisible(true);

        // 2. Cập nhật Đích đến (Target)
        this.targetX = data.x;
        this.targetY = data.y;

        // Cập nhật góc quay
        this.container.rotation = data.angle;

        // 3. Cập nhật dữ liệu game (Score)
        this.score = data.score;

        // Cập nhật weapon type & movement state
        this.weaponType = data.weapon || 'PISTOL';
        this.isMoving = data.isMoving || false;

        // Cập nhật Thanh Máu
        if (data.maxHealth) {
            // Tính phần trăm máu (Max là 40px chiều rộng)
            const percent = Math.max(0, data.health / data.maxHealth);
            this.healthBar.width = 40 * percent;

            // Đổi màu: Máu thấp (<30%) thì đỏ, còn lại xanh
            if (percent < 0.3) {
                this.healthBar.fillColor = 0xFF0000;
            } else {
                this.healthBar.fillColor = 0x00FF00;
            }
        }

        // 4. Xử lý Lớn lên (Scale)
        if (data.radius) {
            const defaultRadius = 20;
            const scale = data.radius / defaultRadius;
            this.container.setScale(scale);
        }

        // Hiệu ứng Shield
        // Cập nhật shield visual
        if (data.hasShield) {
            this.shieldCircle.setVisible(true);
            this.shieldCircle.radius = (data.radius || 20) + 8; // Lớn hơn player 1 chút
        } else {
            this.shieldCircle.setVisible(false);
        }
    }

    // HÀM 2: Chạy mỗi frame để di chuyển mượt (Lerp)
    tick(dt) {
        // Nếu nhân vật đang ẩn (chết) thì không cần tính toán di chuyển
        if (!this.container.visible) return;

        const t = 0.2; // Hệ số làm mượt

        // Nội suy vị trí Container
        this.container.x = Phaser.Math.Linear(this.container.x, this.targetX, t);
        this.container.y = Phaser.Math.Linear(this.container.y, this.targetY, t);

        // Cập nhật tọa độ public
        this.x = this.container.x;
        this.y = this.container.y;

        // --- ĐỒNG BỘ UI THEO NGƯỜI ---
        const currentScale = this.container.scaleX;

        // 1. Tên
        this.text.x = this.container.x;
        this.text.y = this.container.y - (40 * currentScale);

        // 2. Thanh máu chạy theo người
        this.healthBarBg.x = this.container.x;
        this.healthBarBg.y = this.container.y - (25 * currentScale);

        this.healthBar.x = this.container.x;
        this.healthBar.y = this.container.y - (25 * currentScale);
    }

    destroy() {
        this.container.destroy();
        this.text.destroy();
        // Xóa thanh máu khi player thoát/chết hẳn
        this.healthBar.destroy();
        this.healthBarBg.destroy();
        this.shieldCircle.destroy();
    }
}