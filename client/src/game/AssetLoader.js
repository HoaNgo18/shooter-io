export class AssetLoader {
    static preload(scene) {
        // Load ship sprites
        scene.load.image('ship_default', '/Ships/playerShip1_red.png');
        for (let i = 1; i <= 9; i++) {
            // Logic load ship_1 -> ship_9 có thể dùng loop nếu tên file có quy luật, 
            // nhưng ở đây tên file không đồng nhất hoàn toàn nên ta map thủ công hoặc giữ nguyên list cũ cho an toàn
        }
        // Để ngắn gọn, tôi giữ lại các lệnh load quan trọng:
        scene.load.image('ship_1', '/Ships/playerShip2_red.png');
        scene.load.image('ship_2', '/Ships/playerShip3_red.png');
        scene.load.image('ship_3', '/Ships/ufoRed.png');
        scene.load.image('ship_4', '/Ships/spaceShips_001.png');
        scene.load.image('ship_5', '/Ships/spaceShips_002.png');
        scene.load.image('ship_6', '/Ships/spaceShips_004.png');
        scene.load.image('ship_7', '/Ships/spaceShips_007.png');
        scene.load.image('ship_8', '/Ships/spaceShips_008.png');
        scene.load.image('ship_9', '/Ships/spaceShips_009.png');

        // Bots
        scene.load.image('bot_black', '/Enemies/enemyBlack1.png');
        scene.load.image('bot_blue', '/Enemies/enemyBlue2.png');
        scene.load.image('bot_green', '/Enemies/enemyGreen3.png');
        scene.load.image('bot_red', '/Enemies/enemyRed4.png');

        // Meteors
        const meteorFiles = [
            'meteorBrown_big1.png', 'meteorBrown_big2.png', 'meteorBrown_big3.png', 'meteorBrown_big4.png',
            'meteorBrown_med1.png', 'meteorBrown_med3.png', 'meteorBrown_small1.png', 'meteorBrown_small2.png',
            'meteorBrown_tiny1.png', 'meteorBrown_tiny2.png',
            'meteorGrey_big1.png', 'meteorGrey_big2.png', 'meteorGrey_big3.png', 'meteorGrey_big4.png',
            'meteorGrey_med1.png', 'meteorGrey_med2.png', 'meteorGrey_small1.png', 'meteorGrey_small2.png',
            'meteorGrey_tiny1.png', 'meteorGrey_tiny2.png', 'spaceMeteors_001.png', 'spaceMeteors_002.png',
            'spaceMeteors_003.png', 'spaceMeteors_004.png'
        ];
        meteorFiles.forEach(file => scene.load.image(file.replace('.png', ''), '/Meteors/' + file));

        // Background & Effects
        scene.load.image('background', '/Backgrounds/blue.png');
        scene.load.image('laserBlue01', '/Lasers/laserBlue05.png');
        scene.load.image('laserGreen01', '/Lasers/laserGreen13.png');
        scene.load.image('laserRed01', '/Lasers/laserRed16.png');
        scene.load.image('star1', '/Effects/star1.png');
        scene.load.image('star2', '/Effects/star2.png');
        scene.load.image('shield', '/Effects/shield3.png');

        // Chests & Stations
        scene.load.image('chest1', '/Chests/spaceBuilding_001.png');
        scene.load.image('chest2', '/Chests/spaceBuilding_018.png');
        scene.load.image('chest3', '/Chests/spaceBuilding_025.png');
        scene.load.image('station1', '/Stations/spaceStation_018.png');
        scene.load.image('station2', '/Stations/spaceStation_019.png');
        scene.load.image('station3', '/Stations/spaceStation_022.png');
        scene.load.image('station4', '/Stations/spaceStation_023.png');

        // Nebulas
        scene.load.image('nebula1', '/Nebulas/fart00.png');
        scene.load.image('nebula2', '/Nebulas/fart01.png');
        scene.load.image('nebula3', '/Nebulas/fart02.png');
        scene.load.image('nebula4', '/Nebulas/fart03.png');
        scene.load.image('nebula5', '/Nebulas/fart04.png');

        // Items
        scene.load.image('item_health_pack', '/Power-ups/pill_red.png');
        scene.load.image('item_boost', '/Power-ups/bolt_gold.png');
        scene.load.image('item_shield', '/Power-ups/shield_bronze.png');
        scene.load.image('item_bronze_coin', '/Power-ups/star_bronze.png');
        scene.load.image('item_silver_coin', '/Power-ups/star_silver.png');
        scene.load.image('item_gold_coin', '/Power-ups/star_gold.png');
        scene.load.image('item_weapon_blue', '/Lasers/laserBlue04.png');
        scene.load.image('item_weapon_green', '/Lasers/laserGreen08.png');
        scene.load.image('item_weapon_red', '/Lasers/laserRed04.png');
        scene.load.image('item_invisible', '/Power-ups/hidden.png');
        scene.load.image('item_bomb', '/Power-ups/floating_mine.png');
    }
}