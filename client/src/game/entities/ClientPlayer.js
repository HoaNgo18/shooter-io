import Phaser from 'phaser';
import { socket } from '../../network/socket';

export class ClientPlayer {
    constructor(scene, playerData) {
        this.scene = scene;
        this.id = playerData.id;
        this.name = playerData.name;
        this.score = playerData.score || 0;

        // --- 1. Tạo Container (Chứa thân + súng để xoay cùng nhau) ---
        this.container = scene.add.container(playerData.x, playerData.y);

        // Xác định màu: Mình (Xanh), Địch (Đỏ)
        const isMe = (this.id === socket.myId);
        const color = isMe ? 0x4CAF50 : 0xE53935;

        // Vẽ thân (Circle)
        const circle = scene.add.circle(0, 0, 20, color);
        
        // Vẽ súng (Rectangle)
        const weapon = scene.add.rectangle(15, 0, 20, 8, 0xFFFFFF);

        this.container.add([weapon, circle]);
        this.container.setDepth(1); // Lớp dưới

        // --- 2. Tạo Tên (Text riêng biệt để không bị xoay theo người) ---
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

    update(data) {
        // 1. Xử lý Chết/Sống
        if (data.dead) {
            this.container.setVisible(false);
            this.text.setVisible(false);
            return;
        }
        
        // Nếu đang sống thì hiện lên
        this.container.setVisible(true);
        this.text.setVisible(true);

        // 2. Cập nhật vị trí & Góc quay
        // (Sau này có thể thêm lerp vào đây để mượt hơn)
        this.container.x = data.x;
        this.container.y = data.y;
        this.container.rotation = data.angle;

        // Tên luôn đi theo người nhưng không xoay
        this.text.x = data.x;
        // Điều chỉnh độ cao của tên dựa theo kích thước nhân vật
        const currentScale = this.container.scaleX; // Lấy scale hiện tại
        this.text.y = data.y - (40 * currentScale);

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

    destroy() {
        this.container.destroy();
        this.text.destroy();
    }
}