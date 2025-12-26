import { BaseScene } from './BaseScene';

export class ArenaScene extends BaseScene {
    constructor() {
        super('ArenaScene');
        this.isArena = true;
        this.aliveCount = 10;
    }

    create() {
        super.create(); // Gọi logic chung (tạo map, input, socket...)
        
        // Logic riêng: Ví dụ hiển thị vòng bo nếu cần
        console.log("Arena Mode Initialized");
    }

    // Override lại để xử lý thêm aliveCount
    handleServerUpdate(packet) {
        super.handleServerUpdate(packet); // Gọi logic chung (di chuyển, bắn súng...)

        // Logic riêng của Arena
        if (packet.aliveCount !== undefined) {
            this.aliveCount = packet.aliveCount;
        }
        
        // Ví dụ: Logic cập nhật vòng bo (Safe Zone)
        if (packet.zone) {
             // Vẽ vòng bo đỏ thu hẹp lại
             this.updateZoneVisuals(packet.zone);
        }
    }
    
    updateZoneVisuals(zoneData) {
        // Code vẽ vòng bo
    }
}