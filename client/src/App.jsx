import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import Lobby from './components/Lobby';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import { QRCodeSVG } from 'qrcode.react';

function App() {
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [initialRoomId, setInitialRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  });
  const [isKicked, setIsKicked] = useState(false);
  const [externalStroke, setExternalStroke] = useState(null);

  // 描画ツール用
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(5);
  const [tool, setTool] = useState('pen');
  const [clearTrigger, setClearTrigger] = useState(0);

  useEffect(() => {

    const onJoinSuccess = ({ room, playerId: pid }) => {
      setRoom(room);
      setPlayerId(pid);
      setJoined(true);
      setIsKicked(false);
      setError('');
    };

    const onError = ({ message }) => {
      setError(message);
      socket.disconnect();
    };

    const onRoomUpdate = ({ players }) => {
      setRoom(prev => prev ? { ...prev, players } : null);
    };

    const onKicked = ({ message }) => {
      setRoom(null);
      setJoined(false);
      setIsKicked(true);
      setError(message);
      socket.disconnect();
    };

    const onDrawStroke = (strokeData) => {
      setExternalStroke(strokeData);
    };

    const onClearCanvas = () => {
      setClearTrigger(Date.now());
    };

    socket.on('JOIN_SUCCESS', onJoinSuccess);
    socket.on('ERROR', onError);
    socket.on('ROOM_UPDATE', onRoomUpdate);
    socket.on('KICKED', onKicked);
    socket.on('DRAW_STROKE', onDrawStroke);
    socket.on('CLEAR_CANVAS', onClearCanvas);

    return () => {
      socket.off('JOIN_SUCCESS', onJoinSuccess);
      socket.off('ERROR', onError);
      socket.off('ROOM_UPDATE', onRoomUpdate);
      socket.off('KICKED', onKicked);
      socket.off('DRAW_STROKE', onDrawStroke);
      socket.off('CLEAR_CANVAS', onClearCanvas);
    };
  }, []);

  const handleStrokeEmit = (strokeData) => {
    socket.emit('DRAW_STROKE', { roomId: room.id, strokeData });
  };

  const handleLocalClear = () => {
    if (window.confirm('キャンバスをすべて消去しますか？')) {
      setClearTrigger(Date.now());
      socket.emit('CLEAR_CANVAS', { roomId: room.id });
    }
  };

  const handleKick = (targetId) => {
    if (window.confirm('このプレイヤーを退出させますか？')) {
      socket.emit('KICK_PLAYER', { roomId: room.id, targetId });
    }
  };

  if (isKicked) {
    return (
      <div className="app">
        <div className="white-panel room-info">
          <h2 style={{ color: 'var(--color-error)' }}>退出させられました</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
          <button className="btn-primary" onClick={() => setIsKicked(false)}>ロビーに戻る</button>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="app">
        <Lobby initialRoomId={initialRoomId} />
        {error && <p className="global-error">{error}</p>}
      </div>
    );
  }

  const isHost = room.hostId === playerId;

  return (
    <div className="app">
      <div className="game-container">
        <div className="toolbar-area">
          <Toolbar
            color={color} onColorChange={setColor}
            size={size} onSizeChange={setSize}
            tool={tool} onToolChange={setTool}
            onClear={handleLocalClear}
          />
        </div>

        <div className="white-panel canvas-area">
          <Canvas
            isPainter={true} color={color} size={size} tool={tool}
            onStrokeEmit={handleStrokeEmit}
            externalStroke={externalStroke}
            clearTrigger={clearTrigger}
            initialStrokes={room.strokes}
          />
        </div>

        <div className="white-panel sidebar">
          <div className="room-header">
            <h2>ルーム: {room.id}</h2>
            <span className="badge">{room.status}</span>
          </div>

          <div className="qr-container">
            <p className="qr-hint">QRで募集</p>
            <div className="qr-box">
              <QRCodeSVG value={`${window.location.origin}/?room=${room.id}`} size={120} />
            </div>
            <p className="qr-url">またはURLを共有:<br />{`${window.location.origin}/?room=${room.id}`}</p>
          </div>
          <div className="player-list-container">
            <h3>参加者一覧 ({room.players.length})</h3>
            <ul className="player-list">
              {room.players.map((player) => (
                <li key={player.id} className="player-item">
                  <span className="player-name">
                    {player.name}
                    {player.id === playerId && <span className="me-label">(あなた)</span>}
                  </span>
                  {isHost && player.id !== playerId && (
                    <button className="kick-btn" onClick={() => handleKick(player.id)}>×</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {isHost && (
            <div className="host-controls">
              <button className="btn-primary start-btn" disabled={room.players.length < 2}>
                ゲームを開始する
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx="true">{`
        .app {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background-color: var(--bg-secondary);
          padding: 20px;
          box-sizing: border-box;
        }
        .game-container {
          display: flex;
          gap: 20px;
          width: 100%;
          max-width: 1280px;
          height: 80vh;
        }
        .toolbar-area {
          width: 180px;
          flex-shrink: 0;
        }
        .canvas-area {
          flex: 1;
          height: 100%;
          overflow: hidden;
        }
        .sidebar {
          width: 280px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .room-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1rem;
        }
        .room-header h2 { margin: 0; font-size: 1.2rem; color: var(--color-primary); }
        .qr-container { display: flex; flex-direction: column; align-items: center; padding: 12px; background: white; border-radius: 8px; margin-bottom: 1.5rem; text-align: center; border: 1px dashed var(--border-color); }
        .qr-hint { margin: 0 0 8px 0; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .qr-box { background: white; padding: 4px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .qr-url { margin: 8px 0 0 0; font-size: 0.7rem; color: var(--text-muted); word-break: break-all; }
        .badge {
          background: var(--color-primary-light);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-primary);
        }
        .player-list-container h3 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; }
        .player-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; }
        .player-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: var(--bg-tertiary);
          margin-bottom: 8px;
          border-radius: 8px;
        }
        .player-name { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
        .host-label { color: #f59e0b; font-size: 0.75rem; font-weight: 700; background: #fffbeb; padding: 2px 6px; border-radius: 4px; border: 1px solid #fef3c7; }
        .me-label { color: var(--color-primary); font-size: 0.7rem; font-weight: 600; }
        .kick-btn {
          background: #ffe4e6; color: var(--color-error); border: none;
          width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
          font-weight: bold;
        }
        .host-controls { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color); }
        .start-btn { width: 100%; padding: 0.8rem; }
        .hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; text-align: center; }
        .global-error {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          background: #334155; padding: 12px 24px; border-radius: 30px;
          color: white; font-weight: 600; box-shadow: var(--shadow-lg);
        }
      `}</style>
    </div>
  );
}

export default App;
