# AI CONTEXT: IO GAME PROJECT (WEB-GAME)

## 1. Tổng Quan Dự Án
* **Mô tả:** Game multiplayer thời gian thực (IO style) sinh tồn và chiến đấu.
* **Kiến trúc:** Server-Authoritative (Server tính toán vật lý/va chạm, Client chỉ gửi input và render).
* **Mô hình thư mục:** Monorepo (quản lý `client`, `server`, `shared` bằng npm workspaces).

## 2. Tech Stack (Công nghệ)

### Hiện tại (MVP Status)
* **Server:** Node.js, Express, WebSocket (`ws` library), MongoDB (Mongoose), JWT Auth.
* **Client:** Vanilla JS, HTML5 Canvas API (vẽ hình học cơ bản), CSS thuần.
* **Protocol:** JSON packets qua WebSocket.
* **Build Tool:** Vite.

### Mục tiêu Tương lai (Target Architecture)
* **Client Framework:** React (cho UI/HUD) + Phaser (cho Game Render Engine).
* **Server Optimization:** Thêm Quadtree (va chạm), chuyển sang Socket.io (nếu cần), Binary Protocol (Schema.io/Protobuf) để nén dữ liệu.
* **Gameplay:** Hệ thống Level up, Evolution (tiến hóa), Skins, Weapons đa dạng.

## 3. Cấu trúc Thư mục Chính
```text
my-io-game/
├── shared/           # Logic dùng chung (Constants, Packet Types, Utils)
├── server/           # Backend Logic
│   ├── src/
│   │   ├── core/     # Server loop, Game logic, Physics
│   │   ├── entities/ # Player, Projectile classes
│   │   ├── db/       # MongoDB Models
│   │   └── api/      # REST API (Auth)
├── client/           # Frontend (Hiện tại là Vanilla JS)
│   ├── src/
│   │   ├── core/     # Network, Input handling, Game Loop
│   │   ├── renderer/ # Canvas rendering logic
│   │   ├── entities/ # Client-side interpolation entities
│   │   └── ui/       # DOM manipulation for UI
```
## 4. Trạng thái Hiện tại (Current State)
### Server: Đã chạy ổn định (npm run dev:server).

* [x] Kết nối MongoDB.

* [x] WebSocket connection & Broadcasting.

* [x] Logic di chuyển và va chạm cơ bản (Circle collision).

* [x] API Đăng ký/Đăng nhập lưu vào DB.

### Client: Đã hiển thị và chơi được (npm run dev:client).

* [x] Login Screen & HUD cơ bản.

* [x] Render nhân vật (hình tròn), đạn, lưới map.

* [x] Gửi Input (WASD/Mouse) lên server.

* [x] Nội suy vị trí (Interpolation) cơ bản để mượt chuyển động.

* Shared: Đã đồng bộ PacketType và Constants.

## 5. Roadmap & Todo List (Việc cần làm)
### Giai đoạn 1: Refactor Client (Ưu tiên cao nhất)
[ ] Khởi tạo lại Client: Xóa code Vanilla JS, cài đặt React + Vite.

[ ] Tích hợp Phaser: Setup GameScene trong Phaser để thay thế Canvas API.

[ ] Chuyển đổi UI: Viết lại Login Form và HUD thành React Components.

[ ] Quản lý Assets: Thêm folder public/assets để load ảnh (Sprite) thay vì vẽ hình tròn.

### Giai đoạn 2: Server Optimization
[ ] Quadtree: Cài đặt cấu trúc dữ liệu Quadtree để tối ưu kiểm tra va chạm (hiện tại đang dùng 2 vòng lặp lồng nhau - O(N^2)).

[ ] Spatial Hashing: Chia bản đồ thành các ô lưới (Grid) để quản lý gửi gói tin (chỉ gửi thông tin cho player ở gần).

[ ] Lag Compensation: Cài đặt Client-side Prediction (dự đoán di chuyển) và Reconciliation.

### Giai đoạn 3: Gameplay Features
[ ] Hệ thống XP/Level: Server tính XP khi kill, gửi update level về client.

[ ] Hệ thống Vũ khí: Thêm class Weapon riêng biệt, hitbox khác nhau (kiếm, cung, búa).

[ ] Leaderboard Realtime: Cập nhật BXH liên tục.

## 6. Quy ước Code (Conventions)
* Modules: Sử dụng ES Modules (import/export) toàn bộ dự án.

* Tọa độ: Server là gốc (x, y thực tế). Client có renderX, renderY (để nội suy).

* Database: Không lưu state game realtime vào DB. DB chỉ lưu User Profile (Gold, Highscore, Skin).

* Security: Luôn validate input từ client, không tin tưởng dữ liệu vị trí client gửi lên.