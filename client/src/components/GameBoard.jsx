/**
 * GameBoard.jsx — ゲームメイン画面コンポーネント
 *
 * 役割:
 *   - ゲーム中に表示されるメイン画面を組み立てる
 *   - Canvas（描画）・Toolbar（ツール）・スコアボード・回答入力を1つにまとめる
 *   - 画家と回答者でUIを切り替える（isPainter フラグに基づく）
 *
 * 画面レイアウト:
 *   ┌──────────────────────────────────────────────┐
 *   │ ヘッダー: タイマー ／ お題（画家のみ） ／ スコア │
 *   ├──────────┬───────────────────┬───────────────┤
 *   │ Toolbar  │    Canvas         │  スコアボード  │
 *   │(画家のみ)│  (お絵かきエリア)  │  + 回答入力   │
 *   └──────────┴───────────────────┴───────────────┘
 *
 * Props（App.jsx から渡される）:
 *   room          - 現在のルーム状態（players, status, currentPainterId 等）
 *   playerId      - 自分の Socket ID
 *   word          - 今ターンのお題（自分が画家の場合のみ値がある）
 *   onStrokeEmit  - 線を引いたときに呼ばれるコールバック（Socket送信用）
 *   externalStroke- 他のプレイヤーの線データ（Socket受信）
 *   clearTrigger  - 全消去トリガー（数値が変わると Canvas がクリア）
 *   onSendGuess   - 回答を送信するコールバック
 *   onLocalClear  - 全消去ボタン（自分のキャンバスクリア + Socket emit）
 *   color/setColor, size/setSize, tool/setTool - 描画ツールの状態
 *
 * TODO（次のフェーズで追加予定）:
 *   - CHAT_MESSAGE 受信によるチャット履歴表示
 *   - START_GAME ボタン（ロビー状態のホスト向け）
 *   - CORRECT_ANSWER 受信時のトースト通知
 */

import React, { useState } from 'react';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import { Timer, Trophy, Send } from 'lucide-react';

const GameBoard = ({
  room,
  playerId,
  word,          // 自分が画家のときだけセットされるお題
  onStrokeEmit,
  externalStroke,
  clearTrigger,
  onSendGuess,
  onLocalClear,
  // 描画ツール用の状態（GameBoard の子コンポーネントで共有）
  color, setColor,
  size, setSize,
  tool, setTool,
}) => {
  // 回答入力フォームのテキスト
  const [guess, setGuess] = useState('');

  // 自分が今ターンの画家かどうか
  // ロビー状態（LOBBY）のときはホストが仮の「画家」として描ける
  const isPainter = room.currentPainterId === playerId || room.status === 'LOBBY';

  // まだゲームが始まっていない（参加者待機中）
  const isLobby = room.status === 'LOBBY';

  /**
   * 回答フォームのサブミット処理。
   * 空文字は送信しない。送信後は入力欄をクリアする。
   */
  const handleSubmitGuess = (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    onSendGuess(guess.trim());
    setGuess('');
  };

  return (
    <div className="game-board">

      {/* ── ヘッダーバー ── */}
      <div className="game-header white-panel">
        {/* 左: タイマー */}
        <div className="header-item">
          <Timer size={20} className="icon-blue" />
          <span className="timer-text">
            {/* ゲーム中は残り秒数、ロビー中はデフォルト値を表示 */}
            {room.timeLeft ?? 100}s
          </span>
        </div>

        {/* 中央: 画家にはお題を表示、回答者には「当ててね」のメッセージ */}
        <div className="header-center">
          {isPainter && !isLobby ? (
            // 画家用: お題を大きく表示（他の人には見えない）
            <div className="word-display">
              <span className="label">お題:</span>
              <span className="word">{word}</span>
            </div>
          ) : (
            // 回答者 or ロビー中: 状態に応じたメッセージ
            <div className="status-display">
              {isLobby ? '参加者待機中...' : '何を描いているか当てよう！'}
            </div>
          )}
        </div>

        {/* 右: 自分の現在スコア */}
        <div className="header-item">
          <Trophy size={20} className="icon-gold" />
          <span className="score-text">
            {room.players.find((p) => p.id === playerId)?.points ?? 0} pts
          </span>
        </div>
      </div>

      {/* ── メインエリア（水平3カラム） ── */}
      <div className="main-layout">

        {/* 左カラム: ツールバー（画家のみ表示、回答者には非表示） */}
        {/* opacityとpointer-eventsで視覚的・操作的に非表示にする */}
        <div className={`toolbar-wrapper ${isPainter ? 'visible' : 'hidden'}`}>
          <Toolbar
            color={color} onColorChange={setColor}
            size={size} onSizeChange={setSize}
            tool={tool} onToolChange={setTool}
            onClear={onLocalClear}
          />
        </div>

        {/* 中央カラム: キャンバス本体 */}
        <div className="canvas-container white-panel">
          <Canvas
            isPainter={isPainter}
            color={color} size={size} tool={tool}
            onStrokeEmit={onStrokeEmit}
            externalStroke={externalStroke}
            clearTrigger={clearTrigger}
            // ゲーム中はターン開始でキャンバスがサーバー側からリセットされるため
            // initialStrokes はロビー時のみ使用（今後調整予定）
          />
        </div>

        {/* 右カラム: スコアボード + 回答入力エリア */}
        <div className="sidebar white-panel">

          {/* プレイヤー一覧とスコア */}
          <div className="sidebar-section players">
            <h3>参加者 ({room.players.length})</h3>
            <ul className="player-list">
              {room.players.map((p) => (
                <li
                  key={p.id}
                  className={`player-item ${
                    // 今ターンの画家を青くハイライト
                    p.id === room.currentPainterId ? 'painting' : ''
                  }`}
                >
                  <span className="name">
                    {p.name}
                    {/* 今ターンの画家にはパレット絵文字を表示 */}
                    {p.id === room.currentPainterId && ' 🎨'}
                  </span>
                  <span className="pts">{p.points}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 回答入力エリア */}
          <div className="sidebar-section guess-area">
            {/* 回答者かつゲーム中のときのみ入力フォームを表示 */}
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
            {/* 画家への励ましメッセージ */}
            {isPainter && !isLobby && (
              <p className="hint">あなたは画家です！伝わるように描こう！</p>
            )}
            {/* ロビー待機中のメッセージ */}
            {isLobby && <p className="hint">開始を待っています...</p>}
          </div>
        </div>
      </div>

      <style jsx="true">{`
        /* ゲームボード全体: 縦方向に積む */
        .game-board {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          max-width: 1400px;
          height: 90vh;
        }

        /* ヘッダー: 左・中・右の3列 */
        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 30px;
        }
        .header-item { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem; }
        .icon-blue { color: var(--color-primary); }
        .icon-gold { color: #f59e0b; }

        /* お題表示（画家のみ表示される青枠） */
        .word-display { background: var(--color-primary-light); padding: 8px 20px; border-radius: 12px; border: 1px solid var(--color-primary); }
        .word-display .word { font-size: 1.5rem; font-weight: 800; color: var(--color-primary); margin-left: 10px; }
        .status-display { color: var(--text-secondary); font-weight: 600; }

        /* メインレイアウト: 横3列 */
        .main-layout { display: flex; gap: 20px; flex: 1; min-height: 0; }

        /* ツールバー: 非表示時はアニメーションで縮む */
        .toolbar-wrapper { width: 180px; transition: all 0.3s; }
        .toolbar-wrapper.hidden {
          opacity: 0;
          pointer-events: none; /* クリックを無効化 */
          transform: translateX(-20px);
          width: 0;
          margin-right: -20px;
        }

        .canvas-container { flex: 1; position: relative; border-radius: 16px; overflow: hidden; }

        /* 右サイドバー */
        .sidebar { width: 300px; display: flex; flex-direction: column; padding: 20px; }
        .sidebar-section { margin-bottom: 20px; }
        .sidebar-section.players { flex: 1; overflow-y: auto; }
        .sidebar-section h3 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px; }

        /* プレイヤーリスト */
        .player-list { list-style: none; padding: 0; margin: 0; }
        .player-item {
          display: flex; justify-content: space-between;
          padding: 10px 14px; background: var(--bg-tertiary);
          border-radius: 8px; margin-bottom: 8px; border: 1px solid transparent;
        }
        /* 今ターンの画家をハイライト */
        .player-item.painting { background: var(--color-primary-light); border-color: var(--color-primary); }
        .player-item .pts { font-weight: 700; color: var(--color-primary); }

        /* 回答フォーム */
        .guess-form { display: flex; gap: 10px; }
        .guess-form input { flex: 1; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; }
        .btn-primary.icon-only { width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; padding: 0; }
        .hint { font-size: 0.85rem; color: var(--text-muted); text-align: center; font-weight: 500; }
      `}</style>
    </div>
  );
};

export default GameBoard;
