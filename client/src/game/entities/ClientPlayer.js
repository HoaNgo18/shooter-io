import Phaser from 'phaser';
import { socket } from '../../network/socket';

export class ClientPlayer {
    constructor(scene, playerData) {
        this.scene = scene;
        this.id = playerData.id;
        this.name = playerData.name;
        this.score = playerData.score || 0;

        // Lưu vị trí hiện tại
        this.x = playerData.x;
        this.y = playerData.y;

        // 🟢 QUAN TRỌNG: Biến lưu vị trí đích (Target) để Lerp
        this.targetX = playerData.x;
        this.targetY = playerData.y;

        // --- 1. Tạo Container ---
        this.container = scene.add.container(playerData.x, playerData.y);

        // Xác định màu: Mình (Xanh), Địch (Đỏ)
        this.isMe = (this.id === socket.myId); 
        const color = this.isMe ? 0x4CAF50 : 0xE53935;

        // Vẽ thân (Circle)
        const circle = scene.add.circle(0, 0, 20, color);
        
        // Vẽ súng (Rectangle)
        const weapon = scene.add.rectangle(15, 0, 20, 8, 0xFFFFFF);

        this.container.add([weapon, circle]);
        this.container.setDepth(1); // Lớp dưới

        // --- 2. Tạo Tên & Thanh Máu ---
        
        // Tên (Giữ nguyên code của bạn)
        this.text = scene.add.text(playerData.x, playerData.y - 40, this.name, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        this.text.setDepth(2);

        // 🟢 BỔ SUNG: Thanh máu (Thêm mới)
        // Nền đen
        this.healthBarBg = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 6, 0x000000);
        this.healthBarBg.setDepth(2);
        
        // Thanh máu xanh (Máu thực tế)
        this.healthBar = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 4, 0x00FF00);
        this.healthBar.setDepth(2);
    }

    // 🟢 HÀM 1: Nhận dữ liệu từ Server (Chỉ lưu đích đến & State)
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

        // 🟢 BỔ SUNG: Cập nhật Thanh Máu
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
    }

    // 🟢 HÀM 2: Chạy mỗi frame để di chuyển mượt (Lerp)
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

        // 2. 🟢 BỔ SUNG: Thanh máu chạy theo người
        this.healthBarBg.x = this.container.x;
        this.healthBarBg.y = this.container.y - (25 * currentScale);

        this.healthBar.x = this.container.x;
        this.healthBar.y = this.container.y - (25 * currentScale);
    }

    destroy() {
        this.container.destroy();
        this.text.destroy();
        // 🟢 BỔ SUNG: Xóa thanh máu khi player thoát/chết hẳn
        this.healthBar.destroy();
        this.healthBarBg.destroy();
    }
}