import { BaseScene } from './BaseScene';

export class GameScene extends BaseScene {
    constructor() {
        super('GameScene');
        this.isArena = false;
    }

    // Nếu Endless không có logic gì khác biệt hoàn toàn, 
    // bạn thậm chí không cần override hàm create/update nào cả!
}