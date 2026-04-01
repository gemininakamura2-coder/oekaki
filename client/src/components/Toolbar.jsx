import React from 'react';
import { Eraser, Trash2, Minus, Plus } from 'lucide-react';

const COLORS = [
  '#000000', '#4b5563', '#ef4444', '#f97316',
  '#f59e0b', '#22c55e', '#10b981', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'
];

const SIZES = [2, 5, 10, 20];

const Toolbar = ({
  color,
  onColorChange,
  size,
  onSizeChange,
  tool,
  onToolChange,
  onClear
}) => {
  return (
    <div className="toolbar-container white-panel">
      {/* カラーパレット */}
      <div className="toolbar-section">
        <label>カラー</label>
        <div className="color-grid">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-btn ${color === c && tool === 'pen' ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                onColorChange(c);
                onToolChange('pen');
              }}
            />
          ))}
        </div>
      </div>

      {/* 筆の太さ */}
      <div className="toolbar-section">
        <label>太さ: {size}px</label>
        <div className="size-controls">
          {SIZES.map((s) => (
            <button
              key={s}
              className={`size-btn ${size === s ? 'active' : ''}`}
              onClick={() => onSizeChange(s)}
            >
              <div style={{ width: s, height: s, borderRadius: '50%', backgroundColor: 'currentColor' }} />
            </button>
          ))}
        </div>
      </div>

      {/* ツールボタン */}
      <div className="toolbar-section tools">
        <button
          className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => onToolChange('eraser')}
          title="消しゴム"
        >
          <Eraser size={20} />
          <span>消しゴム</span>
        </button>

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
        .color-btn.active { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }

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
        .tool-btn.danger {
          color: var(--color-error);
        }
        .tool-btn.danger:hover {
          background: #ffe4e6;
          border-color: #fecaca;
        }
      `}</style>
    </div>
  );
};

export default Toolbar;
