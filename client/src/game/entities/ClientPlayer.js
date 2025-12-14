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
        this.isMe = (this.id === socket.myId); // Lưu lại biến này để dùng sau
        const color = this.isMe ? 0x4CAF50 : 0xE53935;

        // Vẽ thân (Circle)
        const circle = scene.add.circle(0, 0, 20, color);
        
        // Vẽ súng (Rectangle)
        const weapon = scene.add.rectangle(15, 0, 20, 8, 0xFFFFFF);

        this.container.add([weapon, circle]);
        this.container.setDepth(1); // Lớp dưới

        // --- 2. Tạo Tên ---
        this.text = scene.add.text(playerData.x, playerData.y - 40, this.name, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        
        this.text.setDepth(2); // Lớp trên cùng
    }

    // 🟢 HÀM 1: Nhận dữ liệu từ Server (Chỉ lưu đích đến & State)
    updateServerData(data) {
        // 1. Xử lý Chết/Sống
        if (data.dead) {
            this.container.setVisible(false);
            this.text.setVisible(false);
            return;
        }
        
        // Nếu đang sống thì hiện lên
        this.container.setVisible(true);
        this.text.setVisible(true);

        // 2. Cập nhật Đích đến (Target) thay vì gán vị trí ngay
        this.targetX = data.x;
        this.targetY = data.y;

        // Góc quay: Nếu là địch thì xoay theo server, mình thì xoay theo chuột (đã xử lý ở Scene)
        // Nhưng để đơn giản và đồng bộ, ta cứ gán theo server
        this.container.rotation = data.angle;

        // 3. Cập nhật dữ liệu game
        this.score = data.score;

        // 4. Xử lý Lớn lên (Scale)
        if (data.radius) {
            const defaultRadius = 20;
            const scale = data.radius / defaultRadius;
            this.container.setScale(scale);
            // Text không scale theo để giữ nguyên độ nét
        }
    }

    // 🟢 HÀM 2: Chạy mỗi frame để di chuyển mượt (Lerp)
    tick(dt) {
        // Nếu nhân vật đang ẩn (chết) thì không cần tính toán di chuyển
        if (!this.container.visible) return;

        const t = 0.2; // Hệ số làm mượt (0.1 -> 0.3)

        // Nội suy vị trí Container từ từ về phía Target
        this.container.x = Phaser.Math.Linear(this.container.x, this.targetX, t);
        this.container.y = Phaser.Math.Linear(this.container.y, this.targetY, t);

        // Cập nhật vị trí Text theo Container
        this.text.x = this.container.x;
        
        // Điều chỉnh độ cao của tên dựa theo kích thước nhân vật
        const currentScale = this.container.scaleX;
        this.text.y = this.container.y - (40 * currentScale);

        // Cập nhật tọa độ public (nếu cần dùng ở ngoài)
        this.x = this.container.x;
        this.y = this.container.y;
    }

    destroy() {
        this.container.destroy();
        this.text.destroy();
    }
}