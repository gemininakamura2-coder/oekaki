import React, { useState } from 'react';
import { socket } from '../socket';
import { Users, Plus, LogIn } from 'lucide-react';

const Lobby = ({ initialRoomId }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [roomError, setRoomError] = useState('');

  const handleCreateRoom = () => {
    setNameError('');
    setRoomError('');
    setError('');

    if (!playerName) return setNameError('名前を入力してください');
    socket.connect();
    socket.emit('CREATE_ROOM', { playerName });
  };

  const handleJoinRoom = () => {
    setNameError('');
    setRoomError('');
    setError('');

    if (!playerName) return setNameError('名前を入力してください');
    if (!roomId) return setRoomError('ルームIDを入力してください');
    socket.connect();
    socket.emit('JOIN_ROOM', { roomId, playerName });
  };

  return (
    <div className="lobby-container">
      <div className="white-panel main-panel">
        <h1 className="logo">DrawDraw</h1>
        <p className="subtitle">リアルタイムお絵描きクイズ</p>

        <div className="form-group" style={{ marginBottom: nameError ? '1rem' : '2.5rem' }}>
          <label>あなたの名前</label>
          <input
            type="text"
            className="input-text"
            placeholder="例: たろう"
            value={playerName}
            onChange={(e) => {
              setPlayerName(e.target.value);
              setNameError('');
            }}
          />
          {nameError && <p className="field-error">{nameError}</p>}
        </div>

        {error && <p className="global-error-text">{error}</p>}

        <div className="actions">
          <button className="btn-primary create-btn" onClick={handleCreateRoom}>
            <Plus size={20} />
            新しい部屋を作る
          </button>

          <div className="divider">
            <span>または</span>
          </div>

          <div className="join-container">
            <div className="join-group">
              <input
                type="text"
                className="input-text"
                placeholder="ルームID (5文字)"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value.toUpperCase());
                  setRoomError('');
                }}
                maxLength={5}
              />
              <button className="btn-primary join-btn" onClick={handleJoinRoom}>
                <LogIn size={20} />
                参加する
              </button>
            </div>
            {roomError && <p className="field-error">{roomError}</p>}
          </div>
        </div>
      </div>

      <style jsx="true">{`
        .lobby-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          background-color: var(--bg-secondary);
        }
        .main-panel {
          width: 100%;
          max-width: 450px;
          padding: 48px;
          text-align: center;
        }
        .logo {
          font-size: 3.5rem;
          margin: 0;
          color: var(--color-primary);
          font-weight: 800;
          letter-spacing: -0.025em;
        }
        .subtitle {
          color: var(--text-secondary);
          margin-bottom: 3.5rem;
          font-size: 1.1rem;
          font-weight: 500;
        }
        .form-group {
          text-align: left;
          margin-bottom: 2.5rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.6rem;
          color: var(--text-primary);
          font-size: 0.95rem;
          font-weight: 600;
        }
        .global-error-text {
          color: var(--color-error);
          font-size: 0.95rem;
          margin-top: -1.5rem;
          margin-bottom: 1.5rem;
          background: #ffe4e6;
          padding: 8px;
          border-radius: 6px;
          text-align: center;
        }
        .field-error {
          color: var(--color-error);
          font-size: 0.85rem;
          margin-top: 8px;
          margin-bottom: 0;
          text-align: left;
        }
        .join-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
        }
        .actions {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .create-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 1.1rem;
          padding: 1rem;
        }
        .divider {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 500;
        }
        .divider::before, .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border-color);
          margin: 0 16px;
        }
        .join-group {
          display: flex;
          gap: 12px;
          width: 100%;
        }
        .join-btn {
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 1rem 1.5rem;
        }
      `}</style>
    </div>
  );
};

export default Lobby;
