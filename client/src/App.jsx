/**
 * App.jsx — DrawDraw のルートコンポーネント
 *
 * 役割:
 *   - アプリ全体の状態（ルーム情報・プレイヤーID）を管理する
 *   - Socket.io のイベントリスナーをここで一元管理する
 *   - 画面の切り替えを担当する:
 *
 *       [未参加]          → EntryScreen（名前入力・部屋を探す）
 *       [参加済/LOBBY]    → LobbyScreen（みんなで自由描き・招待・ゲーム開始）
 *       [参加済/PLAYING]  → GameBoard  （クイズ本番）
 *       [KICKED]          → キック通知画面
 *
 * 設計方針:
 *   - 状態管理（room, playerId, joined 等）と Socket リスナーはここに集約する
 *   - 各画面コンポーネント（EntryScreen/LobbyScreen/GameBoard）は表示に専念する
 *   - 描画ツールの状態（color, size, tool）もここが保持し各画面に渡す
 *
 * TODO（Phase 4 続き）:
 *   - GAME_STARTED / YOUR_WORD / TIMER_TICK / CORRECT_ANSWER / TURN_END / GAME_END
 *     のSocketリスナーを追加して GameBoard と接続する
 */

import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import confetti from 'canvas-confetti';
import EntryScreen from './components/EntryScreen';
import LobbyScreen from './components/LobbyScreen';
import GameBoard from './components/GameBoard';
import Results from './components/Results';

function App() {
  // ── ルーム・プレイヤー情報 ──
  const [room, setRoom] = useState(null);       // 現在のルーム状態（全プレイヤー情報を含む）
  const [playerId, setPlayerId] = useState(''); // 自分の Socket ID
  const [joined, setJoined] = useState(false);  // ルームに参加済みかどうか

  // ── エラー・KICKの状態 ──
  const [error, setError] = useState('');
  const [isKicked, setIsKicked] = useState(false);   // ホストにキックされたかどうか
  const [copiedMsg, setCopiedMsg] = useState('');    // クリップボードコピー後のトースト文言

  // ── URLパラメータからルームIDを取得（QRコードスキャン対応）──
  // ページ読み込み時のみ評価するため useState の初期化関数で処理する
  const [initialRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  });

  // ── 描画ツールの状態（Canvas と Toolbar で共有） ──
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(5);
  const [tool, setTool] = useState('pen');

  // ── Canvas の描画同期用 ──
  const [externalStroke, setExternalStroke] = useState(null); // 他プレイヤーの線データ
  const [clearTrigger, setClearTrigger] = useState(0);        // 全消去トリガー（増加で発火）

  // ── ゲーム進行用（Phase 4 続きで実装） ──
  const [word, setWord] = useState('');        // 自分がお題の画家のとき使う
  const [messages, setMessages] = useState([]); // チャットメッセージ履歴
  const [correctToast, setCorrectToast] = useState(null); // 正解時のトースト情報
  const [rankings, setRankings] = useState(null); // ゲーム終了後のランキング
  const [gallery, setGallery] = useState(null); // ゲーム終了後のギャラリー
  const [saveCanvasTrigger, setSaveCanvasTrigger] = useState(0); // ギャラリー保存用トリガー

  // ===================================================================
  // Socket.io イベントリスナーの登録
  // useEffect のクリーンアップで必ず off() して二重登録を防ぐ
  // ===================================================================
  useEffect(() => {

    // JOIN_SUCCESS: ルーム参加（作成 or 参加）に成功したとき
    const onJoinSuccess = ({ room, playerId: pid }) => {
      setRoom(room);
      setPlayerId(pid);
      setJoined(true);
      setIsKicked(false);
      setError('');
    };

    // ERROR: サーバーがエラーを返したとき（ルームが見つからないなど）
    const onError = ({ message }) => {
      setError(message);
      socket.disconnect();
    };

    // ROOM_UPDATE: プレイヤーが入退出してプレイヤーリストが変わったとき
    // players 配列だけを差し替えることで、他の情報（strokes 等）を保持する
    const onRoomUpdate = ({ players }) => {
      setRoom((prev) => (prev ? { ...prev, players } : null));
    };

    // KICKED: ホストに強制退出させられたとき
    const onKicked = ({ message }) => {
      setRoom(null);
      setJoined(false);
      setIsKicked(true);
      setError(message);
      socket.disconnect();
    };

    // DRAW_STROKE: 他プレイヤーが線を引いたとき
    // Canvas の externalStroke prop に渡すことで再描画をトリガーする
    const onDrawStroke = (strokeData) => {
      setExternalStroke(strokeData);
    };

    // CLEAR_CANVAS: 全消去または新ターン開始時のキャンバスリセット
    const onClearCanvas = () => {
      setClearTrigger(Date.now());
    };

    // GAME_STARTED: ターンが開始されたとき
    const onGameStarted = (data) => {
      setRoom((prev) => prev ? {
        ...prev,
        status: 'PLAYING',
        currentPainterId: data.painterId,
        round: data.round,
        totalRounds: data.totalRounds,
        timeLeft: data.timeLeft
      } : null);
      setMessages([]);
      setCorrectToast(null);
      // 前ターンの保存トリガーをリセット（isPainter変更時の再発火を防ぐ）
      setSaveCanvasTrigger(0);
    };

    // YOUR_WORD: 自分がお題の画家のときにお題を受け取る
    const onYourWord = ({ word }) => {
      setWord(word);
    };

    // TIMER_TICK: 1秒ごとのタイマー更新
    const onTimerTick = ({ timeLeft }) => {
      setRoom((prev) => prev ? { ...prev, timeLeft } : null);
      // タイムアップ（timeLeft === 0）時にキャンバスを保存する。
      // TURN_END ではなくここで行う理由: 最終ターンのタイムアウトでは
      // TURN_END が送信されず GAME_END が直接送信されるため、
      // TURN_END に頼ると最終ターンの絵が保存されない。
      if (timeLeft === 0) {
        setSaveCanvasTrigger(Date.now());
      }
    };

    // CORRECT_ANSWER: 誰かが正解したとき
    const onCorrectAnswer = (data) => {
      setRoom((prev) => prev ? { ...prev, players: data.players } : null);
      setCorrectToast({
        winnerName: data.winnerName,
        word: data.word,
        points: data.points
      });
      // 紙吹雪演出
      confetti({ particleCount: 120, spread: 90, origin: { x: 0.5, y: 0.3 } });
      // 正解が出た瞬間に、画家の画面ではキャンバスを画像化してサーバーに送る
      setSaveCanvasTrigger(Date.now());
    };

    // CHAT_MESSAGE: 誰かが不正解またはチャットを送信したとき
    const onChatMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    // TURN_END: ターンが終了して次のターンに移る前
    const onTurnEnd = ({ reason, nextPainterId }) => {
      // タイムアウト保存は TIMER_TICK(0) で処理済みなのでここでは不要
      setRoom((prev) => prev ? { ...prev, currentPainterId: nextPainterId } : null);
      setWord('');
      // 正解トーストは数秒間残るためここでは消さなくても良いが、ターン終了時には一応クリア
      setCorrectToast(null);
    };

    // GAME_END: ゲームがすべて終了したとき
    const onGameEnd = ({ rankings, gallery }) => {
      setRoom((prev) => prev ? { ...prev, status: 'RESULT' } : null);
      setRankings(rankings);
      setGallery(gallery);
      // ゲーム終了時にトリガーをリセット
      setSaveCanvasTrigger(0);
    };

    // イベントリスナーを登録
    socket.on('JOIN_SUCCESS', onJoinSuccess);
    socket.on('ERROR', onError);
    socket.on('ROOM_UPDATE', onRoomUpdate);
    socket.on('KICKED', onKicked);
    socket.on('DRAW_STROKE', onDrawStroke);
    socket.on('CLEAR_CANVAS', onClearCanvas);
    socket.on('GAME_STARTED', onGameStarted);
    socket.on('YOUR_WORD', onYourWord);
    socket.on('TIMER_TICK', onTimerTick);
    socket.on('CORRECT_ANSWER', onCorrectAnswer);
    socket.on('CHAT_MESSAGE', onChatMessage);
    socket.on('TURN_END', onTurnEnd);
    socket.on('GAME_END', onGameEnd);

    // クリーンアップ: unmount 時に登録解除（HMRでの二重登録防止）
    return () => {
      socket.off('JOIN_SUCCESS', onJoinSuccess);
      socket.off('ERROR', onError);
      socket.off('ROOM_UPDATE', onRoomUpdate);
      socket.off('KICKED', onKicked);
      socket.off('DRAW_STROKE', onDrawStroke);
      socket.off('CLEAR_CANVAS', onClearCanvas);
      socket.off('GAME_STARTED', onGameStarted);
      socket.off('YOUR_WORD', onYourWord);
      socket.off('TIMER_TICK', onTimerTick);
      socket.off('CORRECT_ANSWER', onCorrectAnswer);
      socket.off('CHAT_MESSAGE', onChatMessage);
      socket.off('TURN_END', onTurnEnd);
      socket.off('GAME_END', onGameEnd);
    };
  }, []);

  // ===================================================================
  // 共有ハンドラー（複数画面から使用）
  // ===================================================================

  /**
   * 線を引いたとき。正規化済みの strokeData を Socket 経由で送信する。
   */
  const handleStrokeEmit = (strokeData) => {
    socket.emit('DRAW_STROKE', { roomId: room.id, strokeData });
  };

  /**
   * 全消去ボタン。確認後に自分のキャンバスをクリアし全員に通知する。
   */
  const handleLocalClear = () => {
    if (window.confirm('キャンバスをすべて消去しますか？')) {
      setClearTrigger(Date.now());
      socket.emit('CLEAR_CANVAS', { roomId: room.id });
    }
  };

  /**
   * ホストがゲームを開始するとき。ラウンド数を指定して START_GAME を送る。
   * @param {number} totalRounds - 選択されたラウンド数（1〜3）
   */
  const handleStartGame = (totalRounds) => {
    socket.emit('START_GAME', { roomId: room.id, totalRounds });
  };

  /**
   * ホストがプレイヤーをキックするとき。
   * @param {string} targetId - キック対象のSocket ID
   */
  const handleKick = (targetId) => {
    if (window.confirm('このプレイヤーを退出させますか？')) {
      socket.emit('KICK_PLAYER', { roomId: room.id, targetId });
    }
  };

  /**
   * 指定テキストをクリップボードにコピーし、2秒間トーストを表示する。
   * @param {string} text - コピーするテキスト
   * @param {string} label - トーストに表示するラベル（例: 'ルームID'）
   */
  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMsg(`${label} をコピーしました！`);
      setTimeout(() => setCopiedMsg(''), 2000);
    });
  };

  /**
   * 画家がターンの結果（正解/タイムアップ）のイラストをサーバーに送る。
   */
  const handleSaveCanvas = (imageData) => {
    socket.emit('SAVE_CANVAS', { roomId: room.id, imageData });
  };

  // ===================================================================
  // 画面の条件分岐レンダリング
  // ===================================================================

  // キックされた場合の通知画面
  if (isKicked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
        <div className="white-panel" style={{ padding: '48px', textAlign: 'center', maxWidth: 400 }}>
          <h2 style={{ color: 'var(--color-error)' }}>退出させられました</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
          <button className="btn-primary" onClick={() => setIsKicked(false)}>
            受付画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // 未参加 → 受付画面（EntryScreen）
  if (!joined) {
    return (
      <>
        <EntryScreen initialRoomId={initialRoomId} />
        {/* サーバーエラーをトースト風に表示（ルームが見つからないなど） */}
        {error && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#334155', padding: '12px 24px', borderRadius: 30,
            color: 'white', fontWeight: 600, boxShadow: 'var(--shadow-lg)'
          }}>
            {error}
          </div>
        )}
      </>
    );
  }

  // 共通の描画 props（LobbyScreen と GameBoard で同じものを渡す）
  const drawingProps = {
    room,
    playerId,
    onStrokeEmit: handleStrokeEmit,
    externalStroke,
    clearTrigger,
    onLocalClear: handleLocalClear,
    color, setColor,
    size, setSize,
    tool, setTool,
    saveCanvasTrigger,
    onSaveCanvas: handleSaveCanvas,
  };

  // 参加済み / ロビー待機中 または ゲーム中・リザルト
  return (
    <>
      {room.status === 'LOBBY' ? (
        <LobbyScreen
          {...drawingProps}
          onStartGame={handleStartGame}
          onKick={handleKick}
          handleCopy={handleCopy}
        />
      ) : room.status === 'PLAYING' ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-secondary)', padding: 20 }}>
          <GameBoard
            {...drawingProps}
            word={word}
            messages={messages}
            correctToast={correctToast}
            onSendGuess={(text) => socket.emit('SUBMIT_GUESS', { roomId: room.id, text })}
          />
        </div>
      ) : room.status === 'RESULT' ? (
        <Results
          rankings={rankings}
          gallery={gallery}
          playerId={playerId}
          room={room}
        />
      ) : null}

      {/* 共通のコピー完了通知（Toast） */}
      {copiedMsg && <div className="copy-toast">{copiedMsg}</div>}
      <style>{`
        .copy-toast {
          position: fixed; bottom: 64px; left: 50%; transform: translateX(-50%);
          background: #22c55e; padding: 10px 22px; border-radius: 30px;
          color: white; font-weight: 600; font-size: 0.9rem;
          box-shadow: var(--shadow-lg);
          animation: fadeInUp 0.2s ease;
          z-index: 1000;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}

export default App;
