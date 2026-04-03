/**
 * Results.jsx — ゲーム終了後のリザルト画面
 *
 * 役割:
 *   - GAME_END イベントで受信したランキングとギャラリーを表示する
 *   - ランキング: 1位〜の表彰台風表示（スコア順）
 *   - ギャラリー: 各ターンのイラストをカード形式で一覧表示
 *   - 「もう一度遊ぶ」「トップへ戻る」ボタン
 *
 * Props:
 *   rankings    - Player[] (points降順ソート済み): { name, points, isHost }
 *   gallery     - GalleryItem[]: { painterName, word, imageData, wasGuessed }
 *   playerId    - 自分の Socket ID（自分の行をハイライトするため）
 *   room        - ルーム情報（roomId の表示用）
 *
 * データ構造:
 *   Player:      { id, name, points, isHost }
 *   GalleryItem: { painterName, word, imageData, wasGuessed }
 */

import React, { useState } from 'react';
import { Trophy, Crown, Image, Home, RotateCcw } from 'lucide-react';

// ── メダル色定義（1位〜3位） ──
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // 金・銀・銅
const MEDAL_EMOJI = ['🥇', '🥈', '🥉'];

const Results = ({ rankings = [], gallery = [], playerId, room }) => {
  // ギャラリー画像の拡大表示用
  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <div className="results-screen">

      {/* ── ヘッダー ── */}
      <div className="results-header">
        <Trophy size={32} className="header-trophy" />
        <h1 className="results-title">ゲーム終了！</h1>
        <p className="results-subtitle">お疲れさまでした 🎉</p>
      </div>

      {/* ── ランキングセクション ── */}
      <section className="rankings-section">
        <h2 className="section-title">
          <Crown size={22} />
          ランキング
        </h2>

        {/* 表彰台: 上位3人を大きく表示 */}
        {rankings.length >= 2 && (
          <div className="podium">
            {rankings.slice(0, 3).map((player, index) => (
              <div
                key={player.id || index}
                className={`podium-item rank-${index + 1} ${player.id === playerId ? 'is-me' : ''}`}
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="podium-medal">{MEDAL_EMOJI[index]}</div>
                <div className="podium-name">{player.name}</div>
                <div
                  className="podium-score"
                  style={{ color: MEDAL_COLORS[index] }}
                >
                  {player.points.toLocaleString()} pts
                </div>
                <div
                  className="podium-bar"
                  style={{
                    height: `${index === 0 ? 120 : index === 1 ? 90 : 65}px`,
                    background: `linear-gradient(180deg, ${MEDAL_COLORS[index]}33, ${MEDAL_COLORS[index]}88)`,
                    borderTop: `3px solid ${MEDAL_COLORS[index]}`,
                  }}
                >
                  <span className="podium-rank">{index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4位以降のリスト */}
        {rankings.length > 3 && (
          <div className="rank-list">
            {rankings.slice(3).map((player, index) => (
              <div
                key={player.id || index + 3}
                className={`rank-row ${player.id === playerId ? 'is-me' : ''}`}
                style={{ animationDelay: `${(index + 3) * 0.1}s` }}
              >
                <span className="rank-number">{index + 4}</span>
                <span className="rank-name">{player.name}</span>
                <span className="rank-points">{player.points.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── ギャラリーセクション ── */}
      {gallery && gallery.length > 0 && (
        <section className="gallery-section">
          <h2 className="section-title">
            <Image size={22} />
            みんなのイラスト
          </h2>
          <div className="gallery-grid">
            {gallery.map((item, index) => (
              <div
                key={index}
                className="gallery-card white-panel"
                style={{ animationDelay: `${index * 0.08}s` }}
                onClick={() => setSelectedImage(item)}
              >
                <div className="gallery-image-wrapper">
                  <img
                    src={item.imageData}
                    alt={`${item.painterName}が描いた${item.word}`}
                    className="gallery-image"
                  />
                  {/* 正解/不正解バッジ */}
                  <span className={`gallery-badge ${item.wasGuessed ? 'guessed' : 'not-guessed'}`}>
                    {item.wasGuessed ? '正解！' : '不正解…'}
                  </span>
                </div>
                <div className="gallery-info">
                  <div className="gallery-word">
                    お題: <strong>{item.word}</strong>
                  </div>
                  <div className="gallery-painter">
                    🎨 {item.painterName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 画像拡大モーダル ── */}
      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage.imageData}
              alt={selectedImage.word}
              className="modal-image"
            />
            <div className="modal-info">
              <span className="modal-word">お題: <strong>{selectedImage.word}</strong></span>
              <span className="modal-painter">🎨 {selectedImage.painterName}</span>
            </div>
            <button className="modal-close" onClick={() => setSelectedImage(null)}>✕</button>
          </div>
        </div>
      )}

      {/* ── アクションボタン ── */}
      <div className="results-actions">
        <button
          className="btn-primary btn-action"
          onClick={() => window.location.href = '/'}
        >
          <Home size={18} />
          トップへ戻る
        </button>
      </div>

      <style jsx="true">{`
        /* ===================================================
           リザルト画面 全体
        =================================================== */
        .results-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px 60px;
          min-height: 100vh;
          box-sizing: border-box;
        }

        /* ── ヘッダー ── */
        .results-header {
          text-align: center;
          margin-bottom: 40px;
          animation: fadeSlideDown 0.6s ease;
        }
        .header-trophy {
          color: #f59e0b;
          margin-bottom: 8px;
        }
        .results-title {
          font-size: 2.4rem;
          font-weight: 800;
          background: linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 8px;
        }
        .results-subtitle {
          font-size: 1.1rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* ── セクション共通 ── */
        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 20px;
        }

        /* ===================================================
           ランキングセクション
        =================================================== */
        .rankings-section {
          width: 100%;
          margin-bottom: 48px;
          animation: fadeSlideDown 0.7s ease;
        }

        /* 表彰台 */
        .podium {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 24px;
          padding-top: 20px;
        }

        .podium-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: popUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .podium-item.rank-1 { order: 2; }  /* 中央 */
        .podium-item.rank-2 { order: 1; }  /* 左 */
        .podium-item.rank-3 { order: 3; }  /* 右 */

        .podium-medal {
          font-size: 2.2rem;
          margin-bottom: 6px;
          animation: bounce 1.5s ease infinite;
          animation-delay: inherit;
        }

        .podium-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 4px;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .podium-score {
          font-size: 1.1rem;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .podium-bar {
          width: 110px;
          border-radius: 12px 12px 0 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: height 0.6s ease;
        }

        .podium-rank {
          font-size: 1.8rem;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.6);
        }

        .podium-item.is-me .podium-name {
          color: var(--color-primary);
        }
        .podium-item.is-me .podium-bar {
          box-shadow: 0 0 16px rgba(37, 99, 235, 0.3);
        }

        /* 4位以降 */
        .rank-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 500px;
          margin: 0 auto;
        }

        .rank-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 20px;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          animation: fadeSlideRight 0.4s ease both;
        }
        .rank-row.is-me {
          border-color: var(--color-primary);
          background: var(--color-primary-light);
        }

        .rank-number {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-muted);
          width: 28px;
          text-align: center;
        }
        .rank-name {
          flex: 1;
          font-weight: 600;
          color: var(--text-primary);
        }
        .rank-points {
          font-weight: 700;
          color: var(--color-primary);
        }

        /* ===================================================
           ギャラリーセクション
        =================================================== */
        .gallery-section {
          width: 100%;
          animation: fadeSlideDown 0.8s ease;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
        }

        .gallery-card {
          overflow: hidden;
          cursor: pointer;
          transition: all 0.25s ease;
          animation: fadeScaleIn 0.5s ease both;
        }
        .gallery-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.12);
        }

        .gallery-image-wrapper {
          position: relative;
          aspect-ratio: 1;
          background: #ffffff;
          border-bottom: 1px solid var(--border-color);
          overflow: hidden;
        }
        .gallery-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .gallery-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .gallery-badge.guessed {
          background: rgba(34, 197, 94, 0.9);
          color: white;
        }
        .gallery-badge.not-guessed {
          background: rgba(239, 68, 68, 0.85);
          color: white;
        }

        .gallery-info {
          padding: 12px 16px;
        }
        .gallery-word {
          font-size: 0.9rem;
          color: var(--text-primary);
          margin-bottom: 4px;
        }
        .gallery-painter {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        /* ===================================================
           画像拡大モーダル
        =================================================== */
        .image-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
          padding: 20px;
        }
        .image-modal {
          position: relative;
          background: var(--bg-primary);
          border-radius: 20px;
          overflow: hidden;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: popUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .modal-image {
          width: 100%;
          aspect-ratio: 1;
          object-fit: contain;
          background: #fff;
        }
        .modal-info {
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--border-color);
        }
        .modal-word {
          font-size: 1rem;
          color: var(--text-primary);
        }
        .modal-painter {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .modal-close:hover {
          background: rgba(0, 0, 0, 0.7);
        }

        /* ===================================================
           アクションボタン
        =================================================== */
        .results-actions {
          display: flex;
          gap: 16px;
          margin-top: 48px;
          animation: fadeSlideDown 1s ease;
        }
        .btn-action {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          font-size: 1rem;
          border-radius: 12px;
        }

        /* ===================================================
           アニメーション
        =================================================== */
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes popUp {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        /* ===================================================
           レスポンシブ
        =================================================== */
        @media (max-width: 768px) {
          .results-title { font-size: 1.8rem; }
          .podium { gap: 10px; }
          .podium-bar { width: 80px; }
          .podium-name { font-size: 0.9rem; max-width: 80px; }
          .gallery-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
        }
      `}</style>
    </div>
  );
};

export default Results;
