/**
 * Toolbar.jsx — 描画ツールバーコンポーネント
 *
 * 役割:
 *   - カラーパレット（12色）を表示し、色の選択を管理する
 *   - ペンの太さ（4段階）の選択を管理する
 *   - 消しゴムモードと全消去ボタンを提供する
 *   - ツールの状態は Canvas.jsx の親（App.jsx or GameBoard.jsx）が持ち、
 *     このコンポーネントは「表示と入力」だけを担う（Controlled Component）
 *
 * Props:
 *   color         - 現在選択中の色コード（'#xxxxxx'）
 *   onColorChange - 色が変更されたときのコールバック
 *   size          - 現在のペンサイズ（px）
 *   onSizeChange  - サイズが変更されたときのコールバック
 *   tool          - 現在のツール ('pen' | 'eraser')
 *   onToolChange  - ツールが変更されたときのコールバック
 *   onClear       - 全消去ボタンが押されたときのコールバック
 */

import React from 'react';
import { Eraser, Trash2 } from 'lucide-react';

// ── お絵描き用カラーパレット（12色）──
// デザインシステム (implementation_plan.md セクション7.3) で定義した色
const COLORS = [
  '#000000', // 黒
  '#4b5563', // グレー
  '#ef4444', // 赤
  '#f97316', // オレンジ
  '#f59e0b', // 黄
  '#22c55e', // 緑
  '#10b981', // エメラルド
  '#06b6d4', // シアン
  '#3b82f6', // 青
  '#6366f1', // インディゴ
  '#8b5cf6', // 紫
  '#ec4899', // ピンク
];

// ── ペンサイズの選択肢（px単位）──
const SIZES = [2, 5, 10, 20]; // 細・中・太・極太

const Toolbar = ({
  color,
  onColorChange,
  size,
  onSizeChange,
  tool,
  onToolChange,
  onClear,
}) => {
  return (
    <div className="toolbar-container white-panel">

      {/* ── カラーパレット ── */}
      <div className="toolbar-section">
        <label>カラー</label>
        <div className="color-grid">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-btn ${
                // 消しゴムモード中は色ボタンをアクティブにしない
                color === c && tool === 'pen' ? 'active' : ''
                }`}
              style={{ backgroundColor: c }}
              onClick={() => {
                // 色を選んだときは自動的に pen モードに戻す
                onColorChange(c);
                onToolChange('pen');
              }}
            />
          ))}
        </div>
      </div>

      {/* ── ペンサイズ選択 ── */}
      <div className="toolbar-section">
        <label>太さ: {size}px</label>
        <div className="size-controls">
          {SIZES.map((s) => (
            <button
              key={s}
              className={`size-btn ${size === s ? 'active' : ''}`}
              onClick={() => onSizeChange(s)}
              title={`${s}px`}
            >
              {/* サイズの視覚的なプレビュー（丸の大きさでサイズを表現） */}
              <div
                style={{
                  width: s,
                  height: s,
                  borderRadius: '50%',
                  backgroundColor: 'currentColor',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ── ツールボタン ── */}
      <div className="toolbar-section tools">
        {/* 消しゴム: 白色で上書きすることで「消す」を実現（Canvas.jsx 参照） */}
        <button
          className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => onToolChange('eraser')}
          title="消しゴム"
        >
          <Eraser size={20} />
          <span>消しゴム</span>
        </button>

        {/* 全消去: キャンバス全体を白で塗りつぶす + 他全員にも伝える */}
        <button
          className="tool-btn danger"
          onClick={onClear}
          title="全消去"
        >
          <Trash2 size={20} />
          <span>全消去</span>
        </button>
      </div>

      <style jsx="true">{`
        .toolbar-container {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .toolbar-section label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }
        /* カラーパレットを4列グリッドで表示 */
        .color-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .color-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .color-btn:hover { transform: scale(1.1); }
        /* 選択中の色はボーダーを表示してハイライト */
        .color-btn.active { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }

        /* サイズ選択ボタン群 */
        .size-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-tertiary);
          padding: 4px;
          border-radius: 8px;
        }
        .size-btn {
          flex: 1;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .size-btn.active {
          background: white;
          color: var(--color-primary);
          box-shadow: var(--shadow-sm);
        }

        .tools {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .tool-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: var(--bg-tertiary);
          border: 1px solid transparent;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          color: var(--text-primary);
          transition: all 0.2s;
        }
        .tool-btn:hover { background: #ffffff; border-color: var(--border-color); }
        .tool-btn.active {
          background: var(--color-primary-light);
          color: var(--color-primary);
          border-color: var(--color-primary);
        }
        /* 全消去は赤系の danger スタイル */
        .tool-btn.danger { color: var(--color-error); }
        .tool-btn.danger:hover { background: #ffe4e6; border-color: #fecaca; }

        /* ===================================================
           スマホ向けレイアウト (レスポンシブ)
        =================================================== */
        @media (max-width: 900px) {
          .toolbar-container {
            flex-direction: row;
            flex-wrap: wrap;
            padding: 12px;
            gap: 16px;
            align-items: flex-end;
          }
          .toolbar-section { flex: 1; min-width: 140px; }
          .toolbar-section label { margin-bottom: 8px; }
          .color-grid { grid-template-columns: repeat(6, 1fr); gap: 6px; }
          .color-btn { width: auto; aspect-ratio: 1; border-radius: 4px; }
          .size-btn { height: 32px; }
          .tools { flex-direction: row; gap: 8px; }
          .tool-btn { flex: 1; padding: 10px; justify-content: center; }
          .tool-btn span { display: none; } /* アイコンのみにする */
        }
      `}</style>
    </div>
  );
};

export default Toolbar;
