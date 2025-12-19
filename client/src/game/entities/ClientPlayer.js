import Phaser from 'phaser';
import { socket } from '../../network/socket';
import { SKINS } from '@shared/constants';

export class ClientPlayer {
    constructor(scene, playerData) {
        this.scene = scene;
        // Xác định xem đây có phải là chính mình không để xử lý hiển thị khác biệt
        this.isMe = (socket.myId === playerData.id);

        if (this.isMe) {
            console.log("MY PLAYER DATA:", playerData);
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

        // --- 1. Tạo Container (Chứa Thân + Súng + Shield) ---
        this.container = scene.add.container(playerData.x, playerData.y);
        
        // Skin
        this.skinId = playerData.skinId || 'default';
        const skinInfo = SKINS.find(s => s.id === this.skinId);
        const color = skinInfo ? skinInfo.color : 0xFFFFFF;
        
        // Vẽ thân (Circle)
        this.circle = scene.add.circle(0, 0, 20, color);

        // Vẽ súng (Rectangle)
        const weapon = scene.add.rectangle(15, 0, 20, 8, 0xFFFFFF);

        // Shield (Thêm vào container để tự đi theo)
        this.shieldCircle = scene.add.circle(0, 0, 25, 0x00FFFF, 0);
        this.shieldCircle.setStrokeStyle(3, 0x00FFFF, 0.6);
        this.shieldCircle.setVisible(false); // Ẩn mặc định

        this.container.add([weapon, this.circle, this.shieldCircle]);
        this.container.setDepth(10); // Layer Player (cao hơn đất)

        // --- 2. Tạo Tên & Thanh Máu (Nằm ngoài container để không xoay theo người) ---

        // Tên 
        this.text = scene.add.text(playerData.x, playerData.y - 40, this.name, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
        this.text.setDepth(100); // UI luôn ở trên cùng

        // Thanh máu nền đen
        this.healthBarBg = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 6, 0x000000);
        this.healthBarBg.setDepth(100);

        // Thanh máu xanh
        this.healthBar = scene.add.rectangle(playerData.x, playerData.y - 25, 40, 4, 0x00FF00);
        this.healthBar.setDepth(100);
    }

    // Hàm 1: Nhận dữ liệu từ Server
    updateServerData(data) {
        // 1. Xử lý Chết
        if (data.dead) {
            this.setVisibleState(false);
            return;
        }

        // 2. Cập nhật Đích đến (Target)
        this.targetX = data.x;
        this.targetY = data.y;

        // Cập nhật góc quay (chỉ xoay container, không xoay tên/máu)
        this.container.rotation = data.angle;

        // 3. Cập nhật dữ liệu game
        this.score = data.score;
        this.weaponType = data.weapon || 'PISTOL';
        this.isMoving = data.isMoving || false;

        // Update skin if changed
        if (data.skinId && data.skinId !== this.skinId) {
            this.skinId = data.skinId;
            const skinInfo = SKINS.find(s => s.id === this.skinId);
            const newColor = skinInfo ? skinInfo.color : 0xFFFFFF;
            this.circle.fillColor = newColor;
        }

        // Cập nhật Thanh Máu
        if (data.maxHealth) {
            const percent = Math.max(0, data.health / data.maxHealth);
            this.healthBar.width = 40 * percent;
            this.healthBar.fillColor = percent < 0.3 ? 0xFF0000 : 0x00FF00;
        }

        // 4. Xử lý Lớn lên (Scale)
        if (data.radius) {
            const defaultRadius = 20;
            const scale = data.radius / defaultRadius;
            this.container.setScale(scale);
        }

        // 5. Hiệu ứng Shield
        if (data.hasShield) {
            this.shieldCircle.setVisible(true);
            this.shieldCircle.radius = (data.radius || 20) + 8;
        } else {
            this.shieldCircle.setVisible(false);
        }

        // 6. --- XỬ LÝ TÀNG HÌNH (NEBULA/BUSH) ---
        const isHidden = data.hi; // Lấy cờ từ server

        if (isHidden) {
            if (this.isMe) {
                // Nếu là mình: Hiện mờ mờ (Alpha 0.5)
                this.setAlphaState(0.5);
                this.setVisibleState(true); 
            } else {
                // Nếu là địch: Ẩn hoàn toàn (Cả người, tên, máu)
                this.setVisibleState(false);
            }
        } else {
            // Không núp: Hiện rõ ràng
            this.setVisibleState(true);
            this.setAlphaState(1);
        }
    }

    // Helper: Ẩn/Hiện toàn bộ thành phần
    setVisibleState(isVisible) {
        this.container.setVisible(isVisible);
        this.text.setVisible(isVisible);
        this.healthBar.setVisible(isVisible);
        this.healthBarBg.setVisible(isVisible);
    }

    // Helper: Chỉnh độ mờ toàn bộ thành phần
    setAlphaState(alpha) {
        this.container.setAlpha(alpha);
        this.text.setAlpha(alpha);
        this.healthBar.setAlpha(alpha);
        this.healthBarBg.setAlpha(alpha);
    }

    // HÀM 2: Chạy mỗi frame để di chuyển mượt (Lerp)
    tick(dt) {
        // Nếu nhân vật đang ẩn hoàn toàn (visible = false) thì không cần render vị trí
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

        // Cập nhật vị trí Tên & Máu theo Container
        this.text.x = this.container.x;
        this.text.y = this.container.y - (40 * currentScale);

        this.healthBarBg.x = this.container.x;
        this.healthBarBg.y = this.container.y - (25 * currentScale);

        this.healthBar.x = this.container.x;
        this.healthBar.y = this.container.y - (25 * currentScale);
    }

    destroy() {
        this.container.destroy();
        this.text.destroy();
        this.healthBar.destroy();
        this.healthBarBg.destroy();
        // shieldCircle nằm trong container nên tự hủy theo container
    }
}