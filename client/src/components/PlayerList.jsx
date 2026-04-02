import React from 'react';
import { Users } from 'lucide-react';

/**
 * PlayerList.jsx — プレイヤー一覧（ロビー・ゲーム両用）
 * 
 * Props:
 *   players          - 参加者リスト (room.players)
 *   playerId         - 自分の Socket ID (「あなた」バッジ用)
 *   hostId           - ホストの Socket ID (「ホスト」バッジ・キック権限用)
 *   currentPainterId - 現在の画家の Socket ID (ゲーム時用、ハイライト&🎨)
 *   onKick           - キック時のコールバック (ホスト専用)
 *   mode             - 'lobby' | 'game' (表示内容を切り替える)
 */
const PlayerList = ({
  players,
  playerId,
  hostId,
  currentPainterId,
  onKick,
  mode = 'lobby'
}) => {
  const isLobby = mode === 'lobby';
  const isGame = mode === 'game';
  const isMeHost = hostId === playerId;

  return (
    <div className="players-section">
      {isLobby ? (
        <p className="section-label">
          <Users size={14} style={{ display: 'inline', marginRight: 6 }} />
          参加者 ({players.length}人)
        </p>
      ) : (
        <h3>参加者 ({players.length})</h3>
      )}

      <ul className="player-list">
        {players.map((p) => {
          const isPainting = isGame && p.id === currentPainterId;

          return (
            <li
              key={p.id}
              className={`player-item ${isPainting ? 'painting' : ''} ${isLobby ? 'lobby-mode' : 'game-mode'}`}
            >
              <span className="player-name">
                {p.name}
                {isPainting && ' 🎨'}
                {isLobby && p.id === playerId && <span className="me-badge">あなた</span>}
                {isLobby && p.id === hostId && <span className="host-badge">ホスト</span>}
              </span>

              {/* ゲーム時はスコア表示 */}
              {isGame && <span className="pts">{p.points}</span>}

              {/* ロビー時で自分がホストの場合、他人のキックボタンを表示 */}
              {isLobby && isMeHost && p.id !== playerId && (
                <button
                  className="kick-btn"
                  onClick={() => onKick && onKick(p.id)}
                  title="キックする"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <style jsx="true">{`
        .players-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          margin-bottom: ${isGame ? '20px' : '0'};
        }
        .section-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 10px 0;
        }
        .players-section h3 {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin: 0 0 12px 0;
        }
        .player-list {
          list-style: none;
          padding: 0;
          margin: 0;
          overflow-y: auto;
          /* ロビー時は上限を設けていたが、flex:1で広がるため親で制御 */
        }
        .player-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: 8px;
          margin-bottom: 6px;
          border: 1px solid transparent;
        }
        .player-item.game-mode {
          padding: 10px 14px;
          margin-bottom: 8px;
        }
        .player-item.painting {
          background: var(--color-primary-light);
          border-color: var(--color-primary);
        }
        .player-name {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .me-badge {
          background: var(--color-primary-light);
          color: var(--color-primary);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
        }
        .host-badge {
          background: #fef3c7;
          color: #d97706;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;
        }
        .kick-btn {
          background: #ffe4e6;
          color: var(--color-error);
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          cursor: pointer;
          font-weight: bold;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pts {
          font-weight: 700;
          color: var(--color-primary);
        }
      `}</style>
    </div>
  );
};

export default PlayerList;
