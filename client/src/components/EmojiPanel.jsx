import React from 'react';
import './EmojiPanel.css';

const EMOJIS = ['😀', '😎', '😂', '🤣', '😍', '🔥', '💀', '👍', '👎', '🎯'];

const EmojiPanel = ({ onSelect, onClose }) => {
  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="emoji-panel-overlay" onClick={onClose}>
      <div className="emoji-panel" onClick={(e) => e.stopPropagation()}>
        <div className="emoji-panel-header">
          <span>Select Emoji</span>
          <button className="emoji-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="emoji-grid">
          {EMOJIS.map((emoji, index) => (
            <button
              key={index}
              className="emoji-btn"
              onClick={() => handleEmojiClick(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="emoji-hint">Press E to close</div>
      </div>
    </div>
  );
};

export default EmojiPanel;
