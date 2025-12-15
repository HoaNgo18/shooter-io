export class Item {
  constructor(x, y, type) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.type = type; // ITEM_TYPES...
    this.radius = 15;
  }
}