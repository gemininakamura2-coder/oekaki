import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Play } from 'lucide-react';
import PlayerList from './PlayerList';

/**
 * LobbySidebar.jsx — ロビー画面の右側サイドバー
 *
 * 役割:
 *   - ルームIDと参加URL（QRコード）の表示とコピー機能
 *   - 参加プレイヤーの一覧表示（PlayerListを使用）
 *   - ホスト専用のキック機能とゲーム開始コントロール
 */
const LobbySidebar = ({
  room,
  playerId,
  handleCopy,
  onKick,
  onStartGame,
}) => {
  const isHost = room.hostId === playerId;
  // ゲーム開始に必要な周回数（ホストが選択）
  const [totalRounds, setTotalRounds] = useState(2);
  // 参加URL（QRコードと共有リンクで使用）
  const shareUrl = `${window.location.origin}/?room=${room.id}`;

  return (
    <div className="lobby-sidebar white-panel">

      {/* ── ルームID（クリックでコピー） ── */}
      <div className="room-id-section">
        <h2
          className="room-id-text"
          onClick={() => handleCopy(room.id, 'ルームID')}
          title="クリックでコピー"
        >
          ルーム: <span className="room-id-value">{room.id}</span> 📋
        </h2>
      </div>

      {/* ── QRコード & 参加URL ── */}
      <div className="qr-section">
        <p className="section-label">友達を招待しよう！</p>
        <div className="qr-box">
          <QRCodeSVG value={shareUrl} size={110} />
        </div>
        <p
          className="share-url"
          onClick={() => handleCopy(shareUrl, 'URL')}
          title="クリックでコピー"
        >
          URLをコピー 📋<br />
          <span className="url-text">{shareUrl}</span>
        </p>
      </div>

      {/* ── プレイヤー一覧 ── */}
      <PlayerList
        players={room.players}
        playerId={playerId}
        hostId={room.hostId}
        onKick={onKick}
        mode="lobby"
      />

      {/* ── ゲーム開始ボタン（ホストのみ表示） ── */}
      {isHost && (
        <div className="start-section">
          {/* 周回数セレクター */}
          <div className="rounds-selector">
            <label>ラウンド数</label>
            <div className="rounds-btns">
              {[1, 2, 3].map((r) => (
                <button
                  key={r}
                  className={`round-btn ${totalRounds === r ? 'active' : ''}`}
                  onClick={() => setTotalRounds(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-primary start-btn"
            onClick={() => onStartGame(totalRounds)}
            disabled={room.players.length < 2} // 2人以上必要
            title={room.players.length < 2 ? '2人以上集まったら開始できます' : ''}
          >
            <Play size={18} />
            ゲームを開始する
          </button>
          {room.players.length < 2 && (
            <p className="start-hint">あと{2 - room.players.length}人必要です</p>
          )}
        </div>
      )}
      {/* ホスト以外向けのメッセージ */}
      {!isHost && (
        <div className="waiting-msg">
          <p>ホストがゲームを開始するまで</p>
          <p>自由に落書きして待ってね🖌️</p>
        </div>
      )}

      <style jsx="true">{`
        /* サイドバー全体 */
        .lobby-sidebar {
          width: 280px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
          overflow-y: auto;
        }

        /* セクション共通ラベル */
        .section-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin: 0 0 10px 0;
        }

        /* ルームID */
        .room-id-section {
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 16px;
        }
        .room-id-text {
          margin: 0;
          font-size: 1.1rem;
          cursor: pointer;
          user-select: none;
          transition: color 0.2s;
        }
        .room-id-text:hover { color: var(--color-primary); }
        .room-id-value {
          color: var(--color-primary);
          font-size: 1.3rem;
          font-weight: 800;
        }

        /* QRコード */
        .qr-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 16px;
        }
        .qr-box {
          background: white;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }
        .share-url {
          margin-top: 10px;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
          word-break: break-all;
          cursor: pointer;
          user-select: none;
          transition: opacity 0.2s;
        }
        .share-url:hover { opacity: 0.7; }
        .url-text { font-size: 0.7rem; }

        /* ゲーム開始エリア */
        .start-section {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-top: 1px solid var(--border-color);
          padding-top: 16px;
        }
        .rounds-selector label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 8px;
        }
        .rounds-btns { display: flex; gap: 8px; }
        .round-btn {
          flex: 1; padding: 8px; border: 2px solid var(--border-color);
          border-radius: 8px; background: white; cursor: pointer;
          font-weight: 700; font-size: 1rem; transition: all 0.2s;
        }
        .round-btn.active {
          border-color: var(--color-primary);
          color: var(--color-primary);
          background: var(--color-primary-light);
        }
        .start-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0.85rem;
        }
        .start-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .start-hint {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-align: center;
          margin: 0;
        }

        /* ホスト以外の待機メッセージ */
        .waiting-msg {
          margin-top: auto;
          border-top: 1px solid var(--border-color);
          padding-top: 16px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
        }
        .waiting-msg p { margin: 4px 0; }

        /* ===================================================
           スマホ向けレイアウト (レスポンシブ)
        =================================================== */
        @media (max-width: 900px) {
          .lobby-sidebar { 
            width: 100%; 
            height: auto; 
            padding: 16px;
          }
          .qr-section { display: none; } /* スマホの同じ画面ではQRは不要 */
          .start-btn { padding: 12px; }
        }
      `}</style>
    </div>
  );
};

export default LobbySidebar;
