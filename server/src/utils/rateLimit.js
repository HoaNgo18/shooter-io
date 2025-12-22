
export function rateLimit(windowStr, limit, onExceeded) {
    // Chuyển đổi '10s' thành miliseconds (10000)
    const windowMs = parseInt(windowStr) * 1000;
    const ipMap = new Map();

    // Dọn dẹp bộ nhớ định kỳ (mỗi phút)
    setInterval(() => {
        const now = Date.now();
        for (const [ip, timestamps] of ipMap.entries()) {
            const validTimestamps = timestamps.filter(t => t > now - windowMs);
            if (validTimestamps.length === 0) {
                ipMap.delete(ip);
            } else {
                ipMap.set(ip, validTimestamps);
            }
        }
    }, 60000);

    return (ws) => {
        // Lấy IP của client
        const ip = ws._socket.remoteAddress;
        const now = Date.now();

        if (!ipMap.has(ip)) {
            ipMap.set(ip, []);
        }

        const timestamps = ipMap.get(ip);
        // Lọc bỏ các lần kết nối đã quá hạn (nằm ngoài cửa sổ thời gian)
        const validTimestamps = timestamps.filter(t => t > now - windowMs);
        
        // Cập nhật lại danh sách timestamp
        ipMap.set(ip, validTimestamps);

        // Kiểm tra giới hạn
        if (validTimestamps.length >= limit) {
            // Gọi callback xử lý khi vượt quá giới hạn (đóng kết nối)
            return onExceeded(ws);
        }

        // Ghi nhận lần kết nối mới
        validTimestamps.push(now);
    };
}