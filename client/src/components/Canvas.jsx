/**
 * Canvas.jsx — お絵描きキャンバスコンポーネント
 *
 * 役割:
 *   - HTML5 Canvas API を使って実際の描画処理を行う
 *   - マウス/タッチ操作を受け取り「線のデータ」として外部（Socket）に送る
 *   - 外部から受け取った線のデータをキャンバスに描画する（リアルタイム同期）
 *
 * 重要な設計ポイント「座標の正規化」:
 *   送受信する座標はすべてキャンバスの幅・高さに対する 0.0〜1.0 の割合にする。
 *   こうすることで、画面サイズが違う端末（スマホ・PC）でも
 *   同じ場所に線が描かれ、ズレが生じない。
 *   送信: 実座標 / キャンバスサイズ → 0〜1
 *   受信: 0〜1 × キャンバスサイズ → 実座標
 *
 * Props:
 *   isPainter     - true の場合のみ描画操作が可能（回答者は描けない）
 *   color         - 現在の描画色
 *   size          - 線の太さ（px）
 *   tool          - 'pen' | 'eraser'
 *   onStrokeEmit  - 線を1本引くたびに呼ばれるコールバック（Socketへ送信用）
 *   externalStroke- 外部（Socket）から受信した線データ。変化するたびに描画する
 *   clearTrigger  - 数値が更新されると全消去を実行する（Date.now()などを渡す）
 *   initialStrokes- 入室時に渡される過去の描画履歴（一括再生用）
 */

import React, { useRef, useEffect, useState } from 'react';

const Canvas = ({
  isPainter,
  color = '#000000',
  size = 5,
  tool = 'pen',
  onStrokeEmit,
  externalStroke,
  clearTrigger,
  initialStrokes = [],
  saveCanvasTrigger, // 追加: 保存トリガー (Date.now() 等)
  onSaveCanvas,      // 追加: 画家が描いたイラストを上に渡すコールバック
}) => {
  // canvas 要素への参照（DOM に直接アクセスするために使う）
  const canvasRef = useRef(null);
  // Canvas 2D 描画コンテキスト（実際の描画命令を発行する）
  const contextRef = useRef(null);
  // マウント時点のキャンバスの論理サイズを保持する
  // ※ canvas.width/height はDPRスケール後の値なので別管理が必要
  const logicalSizeRef = useRef({ width: 0, height: 0 });

  // isPainter と onSaveCanvas を ref で保持する。
  // useEffect の依存配列に入れると、ターン切替時の isPainter 変更や
  // 親の再レンダリングによる onSaveCanvas の参照変更で保存が再発火してしまうため。
  const isPainterRef = useRef(isPainter);
  isPainterRef.current = isPainter;
  const onSaveCanvasRef = useRef(onSaveCanvas);
  onSaveCanvasRef.current = onSaveCanvas;

  const [isDrawing, setIsDrawing] = useState(false); // 現在ドラッグ中かどうか
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 }); // 前のマウス/タッチ位置

  // ── クリアトリガー監視 ──
  // clearTrigger (数値) が変化したら全消去を実行する。
  // ゼロの初期値ではクリアしないよう条件を付ける。
  useEffect(() => {
    if (clearTrigger > 0) {
      clearAllLines();
    }
  }, [clearTrigger]);

  // ── キャンバス画像のエクスポート ──
  // 正解が出た時やタイムアップ時に、ギャラリー保存用の画像データを取り出す。
  // 依存配列は saveCanvasTrigger だけに絞り、isPainter/onSaveCanvas の変化では発火しない。
  useEffect(() => {
    if (saveCanvasTrigger > 0 && isPainterRef.current) {
      const canvas = canvasRef.current;
      if (canvas && onSaveCanvasRef.current) {
        // PNGのBase64データとして取得
        const imageData = canvas.toDataURL('image/png');
        onSaveCanvasRef.current(imageData);
      }
    }
  }, [saveCanvasTrigger]);

  /**
   * キャンバス全体を白で塗りつぶす（全消去）。
   * 消しゴムと違い、すべての線を一度に消す。
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

  // ── キャンバスの初期化 ──
  // コンポーネントのマウント時に1回だけ実行する。
  // canvas.width/height をここで設定すると描画内容がリセットされるため
  // 初期化時にしか行わない。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // デバイスピクセル比（DPR）を考慮して高解像度ディスプレイに対応する。
    // DPR=2（Retina）の場合、canvas の実際のピクセル数を2倍にすることで
    // ぼやけを防ぐ。
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // 論理サイズ（CSSで見えているサイズ）を保存
    logicalSizeRef.current = { width: rect.width, height: rect.height };

    // 実際のピクセルバッファをDPR倍にしてシャープにする
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const context = canvas.getContext('2d');
    context.scale(dpr, dpr); // DPRに合わせてスケーリング
    context.lineCap = 'round';  // 線の両端を丸くする
    context.lineJoin = 'round'; // 折れ曲がりも丸くする
    contextRef.current = context;

    // 初期背景を白にする（透明のままだと黒背景になることがある）
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
  }, []); // 依存配列が空 = 初回マウント時のみ実行

  // ── 描画履歴の再生 ──
  // 後から入室したプレイヤーへの対応。
  // JOIN_SUCCESS で受け取った過去の全ストロークを高速で再描画する。
  useEffect(() => {
    if (initialStrokes && initialStrokes.length > 0 && contextRef.current) {
      initialStrokes.forEach((stroke) => {
        drawFromData(stroke);
      });
    }
  }, [initialStrokes]); // initialStrokes が渡されたときのみ実行

  // ── 外部ストロークの描画 ──
  // Socket 経由で他のプレイヤーの線データが届いたとき、
  // externalStroke prop が変化するので、それを検知して描画する。
  useEffect(() => {
    if (!externalStroke) return;
    drawFromData(externalStroke);
  }, [externalStroke]);

  /**
   * 正規化座標（0〜1）を実座標に変換してキャンバスに線を引く。
   * 自分の描画にもSocket受信データにもこの関数を使う。
   * @param {object} data - StrokeData { fromX, fromY, toX, toY, color, size, tool }
   */
  const drawFromData = (data) => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    const logicalWidth = logicalSizeRef.current?.width || canvas.width;
    const logicalHeight = logicalSizeRef.current?.height || canvas.height;

    // 正規化座標（0〜1）→ 実際のピクセル座標に変換
    const fromX = data.fromX * logicalWidth;
    const fromY = data.fromY * logicalHeight;
    const toX = data.toX * logicalWidth;
    const toY = data.toY * logicalHeight;

    ctx.beginPath();
    // 消しゴムのときは白色で上書きする（実際には白で塗っているだけ）
    ctx.strokeStyle = data.tool === 'eraser' ? '#ffffff' : data.color;
    ctx.lineWidth = data.size;
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.closePath();
  };

  // ── スマホ向けスクロール防止対策 ──
  // React17以降、onTouchMove はデフォルトで passive: true として登録されるため、
  // Reactのハンドラー内で e.preventDefault() を呼んでもスクロールを防げない。
  // そのため、ネイティブのイベントリスナーとして passive: false で直接登録し、
  // ドラッグ中の画面のスクロールやPull-to-Refreshを完全に無効化する。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventScroll = (e) => {
      // マルチタッチ時のズーム操作や、スクロール操作を無効化
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  // ── マウス/タッチイベントハンドラー ──

  /** ドラッグ開始: 描画中フラグを立てて開始地点を記録 */
  const startDrawing = (e) => {
    if (!isPainter) return; // 回答者は描けない
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);
    setLastPos({ x, y });
  };

  /**
   * ドラッグ中: 前の位置から現在の位置に線を引く。
   * 同時に正規化した座標を onStrokeEmit でSocketへ送信する。
   * ドラッグ中はこれが連続で呼ばれる（マウス移動ごと）ため、
   * 線が「点の連続」として描かれる。
   */
  const draw = (e) => {
    if (!isDrawing || !isPainter) return;

    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = contextRef.current;

    // ── ローカルに即時描画（レスポンスを感じさせるため自分の画面には即反映） ──
    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();

    // ── Socket 経由で他の全員に送信（正規化座標に変換） ──
    if (onStrokeEmit) {
      const logicalWidth = logicalSizeRef.current?.width || rect.width;
      const logicalHeight = logicalSizeRef.current?.height || rect.height;
      onStrokeEmit({
        fromX: lastPos.x / logicalWidth, // 0〜1 の割合に変換
        fromY: lastPos.y / logicalHeight,
        toX: x / logicalWidth,
        toY: y / logicalHeight,
        color,
        size,
        tool,
      });
    }

    setLastPos({ x, y });
  };

  /** ドラッグ終了: 描画中フラグを解除 */
  const stopDrawing = () => {
    setIsDrawing(false);
  };

  /**
   * マウスイベントとタッチイベントの座標を統一して取得する。
   * また、キャンバスの表示サイズ（CSS）と実際のサイズ（バッファ）の
   * 比率（scale）を考慮して正確な座標を返す。
   * @param {MouseEvent|TouchEvent} e
   * @returns {{ x: number, y: number }} キャンバス内の論理座標
   */
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // タッチイベントとマウスイベントで取得方法が違う
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // CSS サイズと論理サイズの比率（画面が縮小表示されているとズレを生む）
    const logicalWidth = logicalSizeRef.current?.width || rect.width;
    const logicalHeight = logicalSizeRef.current?.height || rect.height;
    const scaleX = logicalWidth / rect.width;
    const scaleY = logicalHeight / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  return (
    <div className="canvas-wrapper">
      <canvas
        ref={canvasRef}
        // マウスイベント（PC向け）
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing} // キャンバス外にでたら描画停止
        // タッチイベント（スマホ・タブレット向け）
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
          touch-action: none; /* スマホでのスクロール無効化（描画中に画面が動かないように） */
        }
        .main-canvas {
          width: 100%;
          height: 100%;
          /* isPainter のときは十字カーソル、回答者のときはデフォルト */
          cursor: ${isPainter ? 'crosshair' : 'default'};
        }
      `}</style>
    </div>
  );
};

export default Canvas;
