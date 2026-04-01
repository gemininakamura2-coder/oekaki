import React, { useRef, useEffect, useState } from 'react';

const Canvas = ({
  isPainter,
  color = '#000000',
  size = 5,
  tool = 'pen',
  onStrokeEmit, // 描画時に外部（Socket）へデータを渡すためのコールバック
  externalStroke, // 外部（Socket）から受信した描画データ
  clearTrigger, // 全消去を実行するためのトリガー
  initialStrokes = [] // 過去の描画履歴（入室時のみ使用）
}) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const logicalSizeRef = useRef({ width: 0, height: 0 }); // マウント時の論理サイズを保持
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (clearTrigger > 0) {
      clearAllLines();
    }
  }, [clearTrigger]);

  /**
   * キャンバスを真っ白にクリア
   */
  const clearAllLines = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    const logicalWidth = logicalSizeRef.current?.width || canvas.width;
    const logicalHeight = logicalSizeRef.current?.height || canvas.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  };


  /**
   * キャンバスの初期化 (サイズ設定など)
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    logicalSizeRef.current = { width: rect.width, height: rect.height };

    // サイズ設定 (これを実行すると中身が消えるので、初期化時のみ行う)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const context = canvas.getContext('2d');
    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // 初期背景を白にする
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
  }, []); // 初回マウント時のみ実行

  /**
   * 描画履歴の再生
   */
  useEffect(() => {
    if (initialStrokes && initialStrokes.length > 0 && contextRef.current) {
      initialStrokes.forEach(stroke => {
        drawFromData(stroke);
      });
    }
  }, [initialStrokes]); // 履歴データが渡されたときのみ実行

  // 外部からの描画データを受信したとき
  useEffect(() => {
    if (!externalStroke) return;
    drawFromData(externalStroke);
  }, [externalStroke]);

  /**
   * 座標を正規化 (0-1) -> 実際の座標に変換して描画
   */
  const drawFromData = (data) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const logicalWidth = logicalSizeRef.current?.width || canvas.width;
    const logicalHeight = logicalSizeRef.current?.height || canvas.height;

    const fromX = data.fromX * logicalWidth;
    const fromY = data.fromY * logicalHeight;
    const toX = data.toX * logicalWidth;
    const toY = data.toY * logicalHeight;

    ctx.beginPath();
    ctx.strokeStyle = data.tool === 'eraser' ? '#ffffff' : data.color;
    ctx.lineWidth = data.size;
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.closePath();
  };

  const startDrawing = (e) => {
    if (!isPainter) return;
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);
    setLastPos({ x, y });
  };

  const draw = (e) => {
    if (!isDrawing || !isPainter) return;

    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = contextRef.current;

    // ローカル描画
    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();

    // 正規化して外部へ通知 (fromX, fromY, toX, toY は 0..1)
    if (onStrokeEmit) {
      const logicalWidth = logicalSizeRef.current?.width || rect.width;
      const logicalHeight = logicalSizeRef.current?.height || rect.height;
      onStrokeEmit({
        fromX: lastPos.x / logicalWidth,
        fromY: lastPos.y / logicalHeight,
        toX: x / logicalWidth,
        toY: y / logicalHeight,
        color,
        size,
        tool
      });
    }

    setLastPos({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const logicalWidth = logicalSizeRef.current?.width || rect.width;
    const logicalHeight = logicalSizeRef.current?.height || rect.height;
    const scaleX = logicalWidth / rect.width;
    const scaleY = logicalHeight / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="main-canvas"
      />
      <style jsx="true">{`
        .canvas-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #ffffff;
          border-radius: var(--radius-md, 12px);
          overflow: hidden;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-md);
          touch-action: none; /* スマホでスクロール防止 */
        }
        .main-canvas {
          width: 100%;
          height: 100%;
          cursor: ${isPainter ? 'crosshair' : 'default'};
        }
      `}</style>
    </div>
  );
};

export default Canvas;
