import React from 'react';
import { socket } from '../network/socket';
import { PacketType } from '@shared/packetTypes';

const DeathScreen = ({ killerName, score, onQuit }) => {
  const handleRespawn = () => {
    // Gửi lệnh hồi sinh lên server
    socket.send({ type: PacketType.RESPAWN });
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      color: 'white', zIndex: 20
    }}>
      <h1 style={{ color: '#FF5252', fontSize: '48px', margin: '0 0 20px 0' }}>YOU DIED</h1>
      <p style={{ fontSize: '20px', marginBottom: '15px' }}>
        Final Score: <strong style={{ color: '#FFD700' }}>{score}</strong>
      </p>
      <p style={{ fontSize: '20px', marginBottom: '30px' }}>
        Killed by: <strong style={{ color: '#FFD700' }}>{killerName || 'Unknown'}</strong>
      </p>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <button 
          onClick={handleRespawn}
          style={{
            padding: '15px 40px', fontSize: '20px', fontWeight: 'bold',
            background: '#4CAF50', color: 'white', border: 'none',
            borderRadius: '10px', cursor: 'pointer',
            boxShadow: '0 4px 0 #388E3C'
          }}
        >
          PLAY AGAIN
        </button>

        <button 
          onClick={onQuit}
          style={{
            padding: '15px 40px', fontSize: '20px', fontWeight: 'bold',
            background: '#FF6B6B', color: 'white', border: 'none',
            borderRadius: '10px', cursor: 'pointer',
            boxShadow: '0 4px 0 #CC5555'
          }}
        >
          BACK TO MENU
        </button>
      </div>
    </div>
  );
};

export default DeathScreen;