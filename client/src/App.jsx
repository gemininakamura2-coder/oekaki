/**
 * App.jsx — DrawDraw のルートコンポーネント
 *
 * 役割:
 *   - アプリ全体の状態（ルーム情報・プレイヤーID・画面）を管理する
 *   - Socket.io のイベントリスナーをここで一元管理する
 *   - 画面の切り替えを行う:
 *       未参加 → Lobby（ロビー画面）
 *       参加済み → ゲーム画面（現在: Canvas直置き ※今後GameBoardに移行予定）
 *       キック → キック通知画面
 *
 * 状態管理の方針:
 *   - ルームの状態（players, status など）はサーバーからのイベントで更新する
 *   - 描画ツールの状態（color, size, tool）はここが保持し Canvas/GameBoard に渡す
 *
 * TODO（Phase 4 続き）:
 *   - GameBoard コンポーネントに切り替える（現在はCanvas直接使用）
 *   - GAME_STARTED / YOUR_WORD / TIMER_TICK / CORRECT_ANSWER / TURN_END / GAME_END
 *     のSocketリスナーを追加する
 *   - START_GAME ボタンに onClick を追加する
 */

import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import Lobby from './components/Lobby';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import { QRCodeSVG } from 'qrcode.react';

function App() {
  // ── ルーム・プレイヤー情報 ──
  const [room, setRoom] = useState(null);       // 現在のルーム状態（全プレイヤー情報を含む）
  const [playerId, setPlayerId] = useState(''); // 自分の Socket ID
  const [joined, setJoined] = useState(false);  // ルームに参加済みかどうか

  // ── エラー・KICKの状態 ──
  const [error, setError] = useState('');
  const [isKicked, setIsKicked] = useState(false); // ホストにキックされたかどうか

  // ── URLパラメータからルームIDを取得（QRコードスキャン対応）──
  // ページ読み込み時のみ評価するため useState の初期化関数で処理する
  const [initialRoomId, setInitialRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  });

  // ── 描画ツールの状態（Canvas と Toolbar で共有） ──
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(5);
  const [tool, setTool] = useState('pen');

  // ── Canvas の描画同期用 ──
  const [externalStroke, setExternalStroke] = useState(null); // 他プレイヤーの線データ
  const [clearTrigger, setClearTrigger] = useState(0);         // 全消去トリガー（増加で発火）

  // ===================================================================
  // Socket.io イベントリスナーの登録
  // useEffect のクリーンアップで必ず off() して二重登録を防ぐ
  // ===================================================================
  useEffect(() => {

    // JOIN_SUCCESS: ルーム参加（作成 or 参加）に成功したとき
    // サーバーから現在のルーム状態を受け取り、ゲーム画面に切り替える
    const onJoinSuccess = ({ room, playerId: pid }) => {
      setRoom(room);
      setPlayerId(pid);
      setJoined(true);
      setIsKicked(false);
      setInitialRoomId(''); // URLパラメータの初期値は使用済みなのでクリア
      setError('');
    };

    // ERROR: サーバーがエラーを返したとき（ルームが見つからないなど）
    const onError = ({ message }) => {
      setError(message);
      socket.disconnect(); // エラーが起きたら接続を切る
    };

    // ROOM_UPDATE: プレイヤーが入退出してプレイヤーリストが変わったとき
    // players 配列だけを差し替えることで、他の情報（strokes など）を保持する
    const onRoomUpdate = ({ players }) => {
      setRoom((prev) => (prev ? { ...prev, players } : null));
    };

    // KICKED: ホストに強制退出させられたとき
    // ロビーに戻してエラーメッセージを表示する
    const onKicked = ({ message }) => {
      setRoom(null);
      setJoined(false);
      setIsKicked(true);
      setError(message);
      socket.disconnect();
    };

    // DRAW_STROKE: 他のプレイヤーが线を引いたとき
    // Canvas の externalStroke prop に渡すことで再描画をトリガーする
    const onDrawStroke = (strokeData) => {
      setExternalStroke(strokeData);
    };

    // CLEAR_CANVAS: 他プレイヤーが全消去したとき、またはターン開始時
    // clearTrigger に Date.now() を渡してユニークな数値で Canvas を再トリガー
    const onClearCanvas = () => {
      setClearTrigger(Date.now());
    };

    // イベントリスナーを登録
    socket.on('JOIN_SUCCESS', onJoinSuccess);
    socket.on('ERROR', onError);
    socket.on('ROOM_UPDATE', onRoomUpdate);
    socket.on('KICKED', onKicked);
    socket.on('DRAW_STROKE', onDrawStroke);
    socket.on('CLEAR_CANVAS', onClearCanvas);

    // クリーンアップ: コンポーネントが unmount されるときに登録解除
    // これをしないと開発の HMR（ホットリロード）時に二重登録が起きる
    return () => {
      socket.off('JOIN_SUCCESS', onJoinSuccess);
      socket.off('ERROR', onError);
      socket.off('ROOM_UPDATE', onRoomUpdate);
      socket.off('KICKED', onKicked);
      socket.off('DRAW_STROKE', onDrawStroke);
      socket.off('CLEAR_CANVAS', onClearCanvas);
    };
  }, []); // 空の依存配列 = マウント時に1回だけ登録

  // ===================================================================
  // イベント送信ハンドラー
  // ===================================================================

  /**
   * Canvas で線を引いたとき呼ばれる。
   * 正規化済みの strokeData を DRAW_STROKE イベントで送信する。
   */
  const handleStrokeEmit = (strokeData) => {
    socket.emit('DRAW_STROKE', { roomId: room.id, strokeData });
  };

  /**
   * 「全消去」ボタンが押されたとき。
   * 確認ダイアログを表示してから自分のキャンバスをクリアし、
   * サーバー経由で全員のキャンバスもクリアする。
   */
  const handleLocalClear = () => {
    if (window.confirm('キャンバスをすべて消去しますか？')) {
      setClearTrigger(Date.now()); // 自分のキャンバスをクリア
      socket.emit('CLEAR_CANVAS', { roomId: room.id }); // 全員に通知
    }
  };

  /**
   * ホストが「×ボタン」を押してプレイヤーをキックするとき。
   */
  const handleKick = (targetId) => {
    if (window.confirm('このプレイヤーを退出させますか？')) {
      socket.emit('KICK_PLAYER', { roomId: room.id, targetId });
    }
  };

  // ===================================================================
  // 画面の条件分岐レンダリング
  // ===================================================================

  // キックされた場合の通知画面
  if (isKicked) {
    return (
      <div className="app">
        <div className="white-panel room-info">
          <h2 style={{ color: 'var(--color-error)' }}>退出させられました</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
          <button className="btn-primary" onClick={() => setIsKicked(false)}>
            ロビーに戻る
          </button>
        </div>
      </div>
    );
  }

  // 未参加の場合はロビー画面を表示
  if (!joined) {
    return (
      <div className="app">
        <Lobby initialRoomId={initialRoomId} />
        {/* サーバーエラー（ルームなしなど）をトースト風に表示 */}
        {error && <p className="global-error">{error}</p>}
      </div>
    );
  }

  // ── ゲーム画面 ──
  // TODO: このブロックを GameBoard コンポーネントに移行する（Phase 4 続き）
  const isHost = room.hostId === playerId;

  return (
    <div className="app">
      <div className="game-container">

        {/* 左: 描画ツールバー */}
        <div className="toolbar-area">
          <Toolbar
            color={color} onColorChange={setColor}
            size={size} onSizeChange={setSize}
            tool={tool} onToolChange={setTool}
            onClear={handleLocalClear}
          />
        </div>

        {/* 中央: キャンバス本体 */}
        <div className="white-panel canvas-area">
          <Canvas
            isPainter={true} // TODO: GameBoard移行時に room.currentPainterId === playerId に変更
            color={color} size={size} tool={tool}
            onStrokeEmit={handleStrokeEmit}
            externalStroke={externalStroke}
            clearTrigger={clearTrigger}
            initialStrokes={room.strokes} // 入室時の履歴を復元
          />
        </div>

        {/* 右: サイドバー（ルーム情報・QR・プレイヤー一覧・ゲーム開始ボタン） */}
        <div className="white-panel sidebar">

          {/* ルームIDとステータスバッジ */}
          <div className="room-header">
            <h2>ルーム: {room.id}</h2>
            <span className="badge">{room.status}</span>
          </div>

          {/* QRコード（参加者がスマホでスキャンして参加できる） */}
          {/* QR の値: ?room=XXXXX で直接入室できるURL */}
          <div className="qr-container">
            <p className="qr-hint">QRで募集</p>
            <div className="qr-box">
              <QRCodeSVG value={`${window.location.origin}/?room=${room.id}`} size={120} />
            </div>
            <p className="qr-url">
              またはURLを共有:<br />
              {`${window.location.origin}/?room=${room.id}`}
            </p>
          </div>

          {/* プレイヤー一覧とキックボタン（ホストのみ表示） */}
          <div className="player-list-container">
            <h3>参加者一覧 ({room.players.length})</h3>
            <ul className="player-list">
              {room.players.map((player) => (
                <li key={player.id} className="player-item">
                  <span className="player-name">
                    {player.name}
                    {/* 自分自身には「(あなた)」ラベルを付ける */}
                    {player.id === playerId && <span className="me-label">(あなた)</span>}
                  </span>
                  {/* ホストのみ、自分以外のプレイヤーをキックできる */}
                  {isHost && player.id !== playerId && (
                    <button className="kick-btn" onClick={() => handleKick(player.id)}>×</button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* ゲーム開始ボタン（ホストのみ表示） */}
          {/* TODO: onClick で socket.emit('START_GAME', ...) を追加する */}
          {isHost && (
            <div className="host-controls">
              <button
                className="btn-primary start-btn"
                disabled={room.players.length < 2} // 2人以上必要
              >
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
        /* ゲームエリア: 横3列レイアウト */
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
        /* ルームID + ステータスバッジ */
        .room-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1rem;
        }
        .room-header h2 { margin: 0; font-size: 1.2rem; color: var(--color-primary); }
        /* QRコードエリア */
        .qr-container { display: flex; flex-direction: column; align-items: center; padding: 12px; background: white; border-radius: 8px; margin-bottom: 1.5rem; text-align: center; border: 1px dashed var(--border-color); }
        .qr-hint { margin: 0 0 8px 0; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .qr-box { background: white; padding: 4px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .qr-url { margin: 8px 0 0 0; font-size: 0.7rem; color: var(--text-muted); word-break: break-all; }
        /* ステータスバッジ */
        .badge {
          background: var(--color-primary-light);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-primary);
        }
        /* プレイヤーリスト */
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
        .me-label { color: var(--color-primary); font-size: 0.7rem; font-weight: 600; }
        /* キックボタン */
        .kick-btn {
          background: #ffe4e6; color: var(--color-error); border: none;
          width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
          font-weight: bold;
        }
        /* ゲーム開始ボタン（一番下に固定） */
        .host-controls { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color); }
        .start-btn { width: 100%; padding: 0.8rem; }
        /* エラートースト（画面下部に固定） */
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
