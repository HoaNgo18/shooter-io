
export class Quadtree {
  constructor(boundary, capacity) {
    this.boundary = boundary; // { x, y, width, height } (tính từ tâm)
    this.capacity = capacity; // Số lượng điểm tối đa trước khi chia nhỏ
    this.points = [];
    this.divided = false;
  }

  // Chia nhỏ node thành 4 phần
  subdivide() {
    const { x, y, width, height } = this.boundary;
    const w = width / 2;
    const h = height / 2;

    this.northeast = new Quadtree({ x: x + w, y: y - h, width: w, height: h }, this.capacity);
    this.northwest = new Quadtree({ x: x - w, y: y - h, width: w, height: h }, this.capacity);
    this.southeast = new Quadtree({ x: x + w, y: y + h, width: w, height: h }, this.capacity);
    this.southwest = new Quadtree({ x: x - w, y: y + h, width: w, height: h }, this.capacity);
    
    this.divided = true;
  }

  // Thêm một entity vào Quadtree
  insert(point) {
    // point phải có dạng { x, y, userData }
    if (!this.contains(this.boundary, point)) {
      return false;
    }

    if (this.points.length < this.capacity) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return (
      this.northeast.insert(point) ||
      this.northwest.insert(point) ||
      this.southeast.insert(point) ||
      this.southwest.insert(point)
    );
  }

  // Tìm các điểm trong khu vực range
  query(range, found) {
    if (!found) found = [];

    if (!this.intersects(this.boundary, range)) {
      return found;
    }

    for (let p of this.points) {
      if (this.contains(range, p)) {
        found.push(p);
      }
    }

    if (this.divided) {
      this.northeast.query(range, found);
      this.northwest.query(range, found);
      this.southeast.query(range, found);
      this.southwest.query(range, found);
    }

    return found;
  }

  // Helpers hình học
  contains(rect, point) {
    return (
      point.x >= rect.x - rect.width &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y - rect.height &&
      point.y <= rect.y + rect.height
    );
  }

  intersects(rectA, rectB) {
    return !(
      rectB.x - rectB.width > rectA.x + rectA.width ||
      rectB.x + rectB.width < rectA.x - rectA.width ||
      rectB.y - rectB.height > rectA.y + rectA.height ||
      rectB.y + rectB.height < rectA.y - rectA.height
    );
  }
}