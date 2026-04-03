/**
 * LobbyScreen.jsx — ロビー画面（入室後・ゲーム開始前の待機所）
 *
 * 役割:
 *   - 部屋に入った全員が集まる「待機所」として機能する
 *   - 全員が「画家」として自由にキャンバスに描くことができる（フリーボード）
 *   - ホストはここからゲームを開始する（START_GAME を emit）
 *   - QRコード・参加URLを共有してフレンドを招待できる
 *
 * 設計ポイント:
 *   - Canvas の isPainter を常に true にすることで全員が描ける
 *   - サーバー側は DRAW_STROKE を誰からでも中継するため追加実装不要
 *   - ゲーム開始時にサーバーから CLEAR_CANVAS が届き、落書きは自動リセットされる
 *
 * Props:
 *   room          - 現在のルーム状態（players, id, hostId 等）
 *   playerId      - 自分の Socket ID
 *   onStrokeEmit  - 線を引いたときのコールバック（Socket送信用）
 *   externalStroke- 他プレイヤーの線データ（Socket受信）
 *   clearTrigger  - 全消去トリガー
 *   onLocalClear  - 全消去ボタン処理（自分＋全員）
 *   onStartGame   - ホスト用ゲーム開始ボタンのコールバック
 *   onKick        - ホスト用キックボタンのコールバック
 *   handleCopy    - クリップボードコピー処理
 *   color/setColor, size/setSize, tool/setTool - 描画ツールの状態
 */

import React from 'react';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import LobbySidebar from './LobbySidebar';

const LobbyScreen = ({
  room,
  playerId,
  onStrokeEmit,
  externalStroke,
  clearTrigger,
  onLocalClear,
  onStartGame,
  onKick,
  handleCopy,
  color, setColor,
  size, setSize,
  tool, setTool,
}) => {
  return (
    <div className="lobby-screen">

      {/* ── メインレイアウト（キャンバス + サイドバー） ── */}
      <div className="lobby-layout">

        {/* 左: 描画ツールバー（ロビーでは全員が画家なので常に表示） */}
        <div className="toolbar-area">
          <Toolbar
            color={color} onColorChange={setColor}
            size={size} onSizeChange={setSize}
            tool={tool} onToolChange={setTool}
            onClear={onLocalClear}
          />
        </div>

        {/* 中央: フリーボードキャンバス */}
        <div className="canvas-wrapper-outer white-panel">
          {/* ロビーの見出し */}
          <div className="canvas-header">
            <span className="canvas-title">🎨 フリーボード</span>
          </div>
          <div className="canvas-body">
            <Canvas
              isPainter={true} // ロビーでは全員が画家として描ける
              color={color}
              size={size}
              tool={tool}
              onStrokeEmit={onStrokeEmit}
              externalStroke={externalStroke}
              clearTrigger={clearTrigger}
              initialStrokes={room.strokes} // 入室後の描画履歴を復元
            />
          </div>
        </div>

        {/* 右: サイドバー (LobbySidebarに分割) */}
        <LobbySidebar
          room={room}
          playerId={playerId}
          handleCopy={handleCopy}
          onKick={onKick}
          onStartGame={onStartGame}
        />
      </div>

      <style jsx="true">{`
        /* ロビー画面全体 */
        .lobby-screen {
          display: flex;
          flex-direction: column;
          width: 100%;
          min-height: 100vh;
          background-color: var(--bg-secondary);
          padding: 20px;
          box-sizing: border-box;
        }

        /* 横3列レイアウト */
        .lobby-layout {
          display: flex;
          gap: 20px;
          width: 100%;
          max-width: 1280px;
          height: calc(100vh - 40px);
          margin: 0 auto;
        }

        /* ツールバー */
        .toolbar-area {
          width: 180px;
          flex-shrink: 0;
        }

        /* キャンバスエリア */
        .canvas-wrapper-outer {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .canvas-header {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .canvas-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-secondary);
        }
        .canvas-body {
          flex: 1;
          min-height: 0;
          min-width: 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* ===================================================
           スマホ向けレイアウト (レスポンシブ)
        =================================================== */
        @media (max-width: 900px) {
          .lobby-screen {
            height: auto;
            min-height: 100vh;
          }
          .lobby-layout {
            flex-direction: column;
            height: auto;
            gap: 16px;
          }
          
          /* ツールバーを上部に配置 */
          .toolbar-area {
            width: 100%;
            order: 1;
          }

          /* キャンバスは中央 */
          .canvas-wrapper-outer {
            order: 2;
            width: 100%;
          }

          /* サイドバー（参加者・ゲーム開始）は下部へ */
          /* 注意: LobbySidebar単体でもwidth: 100%になるように修正が必要 */
        }
      `}</style>
    </div>
  );
};

export default LobbyScreen;
