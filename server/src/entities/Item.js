import { ITEM_CONFIG } from '../../../shared/src/constants.js';

export class Item {
  constructor(x, y, type) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 18;
    
    // Lấy config từ constants
    this.config = ITEM_CONFIG[type] || {};
    this.effect = this.config.effect || {};
    
    // Metadata for client rendering
    this.sprite = this.config.sprite;
    this.glowColor = this.config.glowColor;
    
    // Lifetime (30 seconds before despawn)
    this.createdAt = Date.now();
    this.lifetime = 30000;
  }
  
  shouldDespawn() {
    return Date.now() - this.createdAt > this.lifetime;
  }
  
  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      type: this.type,
      sprite: this.sprite,
      glowColor: this.glowColor,
      rarity: this.rarity
    };
  }
}