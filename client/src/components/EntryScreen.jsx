/**
 * EntryScreen.jsx — アプリの入口画面
 *
 * 役割:
 *   - ゲームに参加する前の「受付」として機能する
 *   - プレイヤー名の入力・部屋の作成・部屋への参加を行う
 *   - URLパラメータ (?room=XXXXX) からルームIDを読み取る（QRコード対応）
 *
 * 通信:
 *   socket.emit('CREATE_ROOM', { playerName })
 *   socket.emit('JOIN_ROOM', { roomId, playerName })
 *   → 応答は App.jsx 側の 'JOIN_SUCCESS' リスナーで受け取る
 *
 * Props:
 *   initialRoomId - URLパラメータから渡されるルームID（QRコードスキャン時に自動入力）
 */

import React, { useState } from 'react';
import { socket } from '../socket';
import { Plus, LogIn } from 'lucide-react';

const EntryScreen = ({ initialRoomId }) => {
  const [playerName, setPlayerName] = useState('');
  // URLパラメータで渡されたルームIDがあれば初期値として設定する（QRコード対応）
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [nameError, setNameError] = useState('');  // 名前フィールドのバリデーションエラー
  const [roomError, setRoomError] = useState('');  // ルームIDフィールドのバリデーションエラー

  /**
   * 「新しい部屋を作る」ボタン処理。
   * Socket に接続してから CREATE_ROOM イベントを送る。
   * 応答（JOIN_SUCCESS）は App.jsx のリスナーで受け取る。
   */
  const handleCreateRoom = () => {
    setNameError('');
    setRoomError('');
    if (!playerName.trim()) return setNameError('名前を入力してください');

    // ここで初めて Socket.io に接続する（ページ読み込み時は接続しない設計）
    socket.connect();
    socket.emit('CREATE_ROOM', { playerName: playerName.trim() });
  };

  /**
   * 「参加する」ボタン処理。
   * ルームIDと名前の両方が入力されていることを確認してから JOIN_ROOM を送る。
   */
  const handleJoinRoom = () => {
    setNameError('');
    setRoomError('');
    if (!playerName.trim()) return setNameError('名前を入力してください');
    if (!roomId.trim()) return setRoomError('ルームIDを入力してください');

    socket.connect();
    socket.emit('JOIN_ROOM', { roomId: roomId.trim(), playerName: playerName.trim() });
  };

  return (
    <div className="entry-container">
      <div className="white-panel entry-panel">
        <h1 className="logo">DrawDraw</h1>
        <p className="subtitle">リアルタイムお絵描きクイズ</p>

        {/* ── 名前入力フォーム ── */}
        <div className="form-group">
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

        <div className="actions">
          {/* ── 部屋を作るボタン ── */}
          <button className="btn-primary create-btn" onClick={handleCreateRoom}>
            <Plus size={20} />
            新しい部屋を作る
          </button>

          <div className="divider">
            <span>または</span>
          </div>

          {/* ── 部屋に参加するフォーム ── */}
          <div className="join-container">
            <div className="join-group">
              <input
                type="text"
                className="input-text"
                placeholder="ルームID (5文字)"
                value={roomId}
                onChange={(e) => {
                  // 大文字に自動変換（ルームIDは大文字英数字）
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
        .entry-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          background-color: var(--bg-secondary);
        }
        .entry-panel {
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
        .field-error {
          color: var(--color-error);
          font-size: 0.85rem;
          margin-top: 8px;
          margin-bottom: 0;
          text-align: left;
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
        /* 「または」セパレーター */
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
        .join-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
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

        /* ===================================================
           スマホ向けレイアウト (レスポンシブ)
        =================================================== */
        @media (max-width: 768px) {
          .entry-panel { padding: 32px 24px; }
          .logo { font-size: 2.8rem; }
          .subtitle { margin-bottom: 2.5rem; }
          .join-group { flex-direction: column; }
          .join-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
};

export default EntryScreen;
