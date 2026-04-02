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
 *   - CORRECT_ANSWER 受信時のトースト通知
 */

import React, { useState, useEffect, useRef } from 'react';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import PlayerList from './PlayerList';
import { Timer, Trophy, Send } from 'lucide-react';

const GameBoard = ({
    room,
    playerId,
    word,          // 自分が画家のときだけセットされるお題
    messages = [], // チャット履歴
    correctToast,  // 正解トースト
    onStrokeEmit,
    externalStroke,
    clearTrigger,
    onSendGuess,
    onLocalClear,
    // 描画ツール用の状態（GameBoard の子コンポーネントで共有）
    color, setColor,
    size, setSize,
    tool, setTool,
    saveCanvasTrigger,
    onSaveCanvas,
}) => {
    // 回答入力フォームのテキスト
    const [guess, setGuess] = useState('');
    const messagesEndRef = useRef(null);

    const isPainter = room.currentPainterId === playerId;

    // チャット更新時に自動スクロール
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
        <div className="game-board" style={{ position: 'relative' }}>

            {/* 正解時のトースト通知 */}
            {correctToast && (
                <div className="correct-toast">
                    <div className="toast-title">🎊 {correctToast.winnerName} さんが正解！</div>
                    <div className="toast-word">お題: <span>{correctToast.word}</span></div>
                    <div className="toast-points">(+{correctToast.points}pt)</div>
                </div>
            )}

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
                    {isPainter ? (
                        // 画家用: お題を大きく表示（他の人には見えない）
                        <div className="word-display">
                            <span className="label">お題:</span>
                            <span className="word">{word}</span>
                        </div>
                    ) : (
                        // 回答者: もわかる?のメッセージ
                        <div className="status-display">何を描いているか当てよう！</div>
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
                        saveCanvasTrigger={saveCanvasTrigger}
                        onSaveCanvas={onSaveCanvas}
                    // ゲーム中はターン開始でキャンバスがサーバー側からリセットされるため
                    // initialStrokes はロビー時のみ使用（今後調整予定）
                    />
                </div>

                {/* 右カラム: スコアボード + 回答入力エリア */}
                <div className="sidebar white-panel">

                    {/* プレイヤー一覧とスコア */}
                    <PlayerList
                        players={room.players}
                        playerId={playerId}
                        hostId={room.hostId}
                        currentPainterId={room.currentPainterId}
                        mode="game"
                    />

                    {/* チャット履歴表示エリア */}
                    <div className="chat-container">
                        {messages.map((m, i) => (
                            <div key={i} className="chat-message">
                                <span className="chat-author">{m.playerName}:</span>
                                <span className="chat-text">{m.text}</span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 回答入力エリア */}
                    <div className="sidebar-section guess-area">
                        {/* 回答者かつゲーム中のときのみ入力フォームを表示 */}
                        {!isPainter && (
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
                        {isPainter && (
                            <p className="hint">あなたは画家です！伝わるように描こう！</p>
                        )}
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
        .sidebar-section h3 { font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px; }

        /* チャット履歴 */
        .chat-container {
          flex: 1;
          overflow-y: auto;
          background: #f8fafc;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          border: 1px solid var(--border-color);
        }
        .chat-message {
          font-size: 0.85rem;
          word-break: break-all;
        }
        .chat-author {
          font-weight: 700;
          color: var(--text-secondary);
          margin-right: 6px;
        }

        /* 回答フォーム */
        .guess-form { display: flex; gap: 10px; }
        .guess-form input { flex: 1; padding: 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 1rem; }
        .btn-primary.icon-only { width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; padding: 0; }
        .hint { font-size: 0.85rem; color: var(--text-muted); text-align: center; font-weight: 500; }

        /* トースト通知 */
        .correct-toast {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(34, 197, 94, 0.95);
          backdrop-filter: blur(8px);
          color: white;
          padding: 24px 48px;
          border-radius: 20px;
          text-align: center;
          box-shadow: 0 10px 25px rgba(34, 197, 94, 0.4);
          z-index: 100;
          animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .toast-title { font-size: 1.4rem; font-weight: 800; margin-bottom: 8px; }
        .toast-word { font-size: 1.2rem; font-weight: 600; }
        .toast-word span { font-size: 1.6rem; font-weight: 800; color: #ffeb3b; margin-left: 8px; }
        .toast-points { font-size: 1rem; font-weight: 600; opacity: 0.9; margin-top: 4px; }
        
        @keyframes popIn {
          0% { opacity: 0; transform: translate(-50%, -40%) scale(0.8); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
        </div>
    );
};

export default GameBoard;
