import React, { useState } from 'react';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import { Timer, Trophy, Send } from 'lucide-react';

const GameBoard = ({ 
  room, 
  playerId, 
  word, 
  onStrokeEmit, 
  externalStroke, 
  clearTrigger,
  onSendGuess,
  onLocalClear,
  // 描画ツール用Props
  color, setColor,
  size, setSize,
  tool, setTool
}) => {
  const [guess, setGuess] = useState('');
  const isPainter = room.currentPainterId === playerId || room.status === 'LOBBY';
  const isLobby = room.status === 'LOBBY';

  const handleSubmitGuess = (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    onSendGuess(guess);
    setGuess('');
  };

  return (
    <div className="game-board">
      {/* 上部バー: お題 (画家のみ) or タイマー / スコア */}
      <div className="game-header white-panel">
        <div className="header-item">
          <Timer size={20} className="icon-blue" />
          <span className="timer-text">{room.timeLeft || 60}s</span>
        </div>

        <div className="header-center">
          {isPainter && !isLobby ? (
            <div className="word-display">
              <span className="label">お題:</span>
              <span className="word">{word}</span>
            </div>
          ) : (
            <div className="status-display">
              {isLobby ? '参加者待機中...' : '何を描いているか当てよう！'}
            </div>
          )}
        </div>

        <div className="header-item">
          <Trophy size={20} className="icon-gold" />
          <span className="score-text">
            {room.players.find(p => p.id === playerId)?.points || 0} pts
          </span>
        </div>
      </div>

      <div className="main-layout">
        {/* 左: ツールバー (画家のみ表示) */}
        <div className={`toolbar-wrapper ${isPainter ? 'visible' : 'hidden'}`}>
          <Toolbar 
            color={color} onColorChange={setColor}
            size={size} onSizeChange={setSize}
            tool={tool} onToolChange={setTool}
            onClear={onLocalClear}
          />
        </div>

        {/* 中央: キャンバス */}
        <div className="canvas-container white-panel">
          <Canvas 
            isPainter={isPainter}
            color={color} size={size} tool={tool}
            onStrokeEmit={onStrokeEmit}
            externalStroke={externalStroke}
            clearTrigger={clearTrigger}
          />
        </div>

        {/* 右: サイドバー (プレイヤーリスト + 回答エリア) */}
        <div className="sidebar white-panel">
          <div className="sidebar-section players">
            <h3>参加者 ({room.players.length})</h3>
            <ul className="player-list">
              {room.players.map(p => (
                <li key={p.id} className={`player-item ${p.id === room.currentPainterId ? 'painting' : ''}`}>
                  <span className="name">
                    {p.name} {p.id === room.currentPainterId && '🎨'}
                  </span>
                  <span className="pts">{p.points}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="sidebar-section guess-area">
            {!isPainter && !isLobby && (
              <form onSubmit={handleSubmitGuess} className="guess-form">
                <input 
                  type="text" 
                  placeholder="答えを入力..." 
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                />
                <button type="submit" className="btn-primary icon-only">
                  <Send size={18} />
                </button>
              </form>
            )}
            {isPainter && !isLobby && <p className="hint">あなたは画家です！伝わるように描こう！</p>}
            {isLobby && <p className="hint">開始を待っています...</p>}
          </div>
        </div>
      </div>

      <style jsx="true">{`
        .game-board {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          max-width: 1400px;
          height: 90vh;
        }
        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 30px;
        }
        .header-item { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem; }
        .icon-blue { color: var(--color-primary); }
        .icon-gold { color: #f59e0b; }
        
        .word-display { background: var(--color-primary-light); padding: 8px 20px; border-radius: 12px; border: 1px solid var(--color-primary); }
        .word-display .word { font-size: 1.5rem; font-weight: 800; color: var(--color-primary); margin-left: 10px; }
        .status-display { color: var(--text-secondary); font-weight: 600; }

        .main-layout { display: flex; gap: 20px; flex: 1; min-height: 0; }
        .toolbar-wrapper { width: 180px; transition: all 0.3s; }
        .toolbar-wrapper.hidden { opacity: 0; pointer-events: none; transform: translateX(-20px); width: 0; margin-right: -20px; }
        
        .canvas-container { flex: 1; position: relative; border-radius: 16px; overflow: hidden; }
        
        .sidebar { width: 300px; display: flex; flex-direction: column; padding: 20px; }
        .sidebar-section { margin-bottom: 20px; }
        .sidebar-section.players { flex: 1; overflow-y: auto; }
        .sidebar-section h3 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px; }
        
        .player-list { list-style: none; padding: 0; margin: 0; }
        .player-item { display: flex; justify-content: space-between; padding: 10px 14px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px; border: 1px solid transparent; }
        .player-item.painting { background: var(--color-primary-light); border-color: var(--color-primary); }
        .player-item .pts { font-weight: 700; color: var(--color-primary); }

        .guess-form { display: flex; gap: 10px; }
        .guess-form input { flex: 1; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; }
        .btn-primary.icon-only { width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; padding: 0; }
        .hint { font-size: 0.85rem; color: var(--text-muted); text-align: center; font-weight: 500; }
      `}</style>
    </div>
  );
};

export default GameBoard;
