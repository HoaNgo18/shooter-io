import React from 'react';
import './DeathScreen.css';

const DeathScreen = ({ killerName, score, onQuit, onRespawn, isArena = false, rank = null, isVictory = false }) => {

  // Kiểm tra xem có phải tự sát không?
  const isSuicide = !killerName || killerName === 'Yourself';

  return (
    <div className={`death-screen-container ${isVictory ? 'victory-mode' : ''}`}>

      {/* Tiêu đề */}
      <h1 className={`death-title ${isVictory ? 'victory-text' : ''}`}>
        {isVictory ? 'VICTORY' : (isArena ? 'ELIMINATED' : 'YOU DIED')}
      </h1>

      {/* Thông tin kẻ giết (Chỉ hiện khi chết) */}
      {!isVictory && (
        <div className="death-info">
          {isSuicide && !isArena ? (
            <span>💔 You eliminated yourself!</span>
          ) : (
            <span>
              Eliminated by: <strong className="killer-name">{killerName || 'Unknown'}</strong>
            </span>
          )}
        </div>
      )}

      {/* Thông tin Victory */}
      {isVictory && (
        <div className="death-info">
          <span style={{ color: '#FFD700', fontSize: '24px', fontWeight: 'bold' }}>
            YOU ARE THE CHAMPION!
          </span>
        </div>
      )}

      {/* Điểm số / Rank */}
      <div className="final-score-box">
        {rank !== null && rank !== undefined ? (
          <>
            <span className="score-label">RANK</span>
            <strong className="score-value" style={{ color: isVictory ? '#FFD700' : (rank === 1 ? '#FFD700' : '#FFF') }}>
              #{rank}
            </strong>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ marginBottom: '5px' }}>
                <span className="score-label">SCORE</span>
                <strong className="score-value">{score}</strong>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Nút bấm */}
      <div className="death-btn-group">
        {onRespawn && (
          <button
            onClick={onRespawn}
            className="death-btn respawn-btn"
          >
            PLAY AGAIN
          </button>
        )}

        <button
          onClick={onQuit}
          className="death-btn quit-btn"
        >
          {isArena ? 'MENU' : 'EXIT'}
        </button>
      </div>
    </div>
  );
};

export default DeathScreen;