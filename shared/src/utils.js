export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(start, end, t) {
  return start + (end - start) * t;
}

export function circleCollision(x1, y1, r1, x2, y2, r2) {
  return distance(x1, y1, x2, y2) < r1 + r2;
}

export function rectangleCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export function circleRectangleCollision(cx, cy, cr, rx, ry, rw, rh) {
  // Find closest point on rectangle to circle center
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  
  // Distance from circle center to closest point
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < cr;
}

export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function getRandomPosition(mapSize) {
  return {
    x: Math.random() * mapSize - mapSize / 2,
    y: Math.random() * mapSize - mapSize / 2
  };
}