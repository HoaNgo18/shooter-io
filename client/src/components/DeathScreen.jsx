import React from 'react';
import './DeathScreen.css';

const DeathScreen = ({ killerName, score, onQuit, onRespawn }) => {

  // Kiểm tra xem có phải tự sát không?
  // Lưu ý: Server cần gửi killerName trùng với tên mình nếu tự sát, 
  // hoặc chúng ta so sánh ID nếu App.jsx truyền xuống (ở đây làm đơn giản theo tên)
  const isSuicide = !killerName || killerName === 'Yourself';

  return (
    <div className="death-screen-container">

      {/* Tiêu đề */}
      <h1 className="death-title">
        YOU DIED
      </h1>

      {/* Thông tin kẻ giết */}
      <div className="death-info">
        {isSuicide ? (
          <span>💔 Bạn đã tự sát!</span>
        ) : (
          <span>
            Bị hạ gục bởi: <strong className="killer-name">{killerName || 'Unknown'}</strong>
          </span>
        )}
      </div>

      {/* Điểm số */}
      <div className="final-score-box">
        <span className="score-label">Final Score:</span>
        <strong className="score-value">{score}</strong>
      </div>

      {/* Nút bấm */}
      <div className="death-btn-group">
        <button
          onClick={onRespawn}
          className="death-btn respawn-btn"
        >
          CHƠI LẠI
        </button>

        <button
          onClick={onQuit}
          className="death-btn quit-btn"
        >
          THOÁT
        </button>
      </div>
    </div>
  );
};

export default DeathScreen;