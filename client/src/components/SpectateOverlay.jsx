import React from 'react';
import './SpectateOverlay.css';

const SpectateOverlay = ({ targetName, onExit }) => {
  return (
    <div className="spectate-overlay">
      <div className="spectate-header">
        <span className="spectate-icon">👁</span>
        <span className="spectate-label">SPECTATING</span>
        <span className="spectate-target-name">{targetName || 'Unknown'}</span>
      </div>
      
      <button 
        className="spectate-exit-btn"
        onClick={onExit}
      >
        EXIT TO MENU
      </button>
    </div>
  );
};

export default SpectateOverlay;
