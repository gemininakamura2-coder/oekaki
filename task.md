# 🚀 DrawDraw 開発詳細ロードマップ & AI引き継ぎガイドあ

> **【🤖 新しいAIモデル・別スレッドの担当者へ】**
> あなたはこの「DrawDraw（リアルタイムお絵描きクイズ）」プロジェクトの開発を引き継ぎました。
> 既存のコードを壊さずに作業を継続するため、**作業開始前に必ず以下の3つのファイルを全て読み込んでください（`view_file` ツールを使用）。**
> 
> 1. **`implementation_plan.md`**: 設計書・UIのルール・通信仕様など全容。
> 2. **`task.md`**: 実装ステップと現在の進捗（このファイル）。
> 3. **`phase_dataflow_guide.md`**: Socket.ioやデータ構造の仕組み・データの流れ。
> 
> これらを理解した上で、`task.md` の「今後のタスク（未着手）」の続きから実装を再開してください。

---

## 📍 現在のプロジェクト状態

- **OS**: Windows (PowerShell制限あり。コマンドは `cmd /c "..."` で実行)
- **Node.js**: v25.8.1 / **Express**: v5
- **プロジェクトルート**: `c:\Users\emb-work\draw`
- **現在のフェーズ**: **Phase 3 完了**（次ステップは Phase 4: ゲームサイクル）

### 現在の主要ファイル構成と役割
- **[App.jsx](file:///c:/Users/emb-work/draw/client/src/App.jsx)**: メインの状態管理。Socket接続、入室、キック受信、描画リレー。
- **[Lobby.jsx](file:///c:/Users/emb-work/draw/client/src/components/Lobby.jsx)**: 名前入力、ルーム作成・参加のUIとSocket送信。
- **[Canvas.jsx](file:///c:/Users/emb-work/draw/client/src/components/Canvas.jsx)**: お絵描きエンジン。正規化座標処理と描画履歴の再現。
- **[Toolbar.jsx](file:///c:/Users/emb-work/draw/client/src/components/Toolbar.jsx)**: 描画ツール（色・太さ・消しゴム）のUI。
- **[index.js (Server)](file:///c:/Users/emb-work/draw/server/index.js)**: 通信制御。描画データのリレーと履歴保存のトリガー。
- **[gameManager.js](file:///c:/Users/emb-work/draw/server/gameManager.js)**: データ管理。ルーム情報、プレイヤーリスト、全描画履歴(`strokes`)の保持。

---

## ✅ 完了済みタスク

### Phase 0: 資料・設計フェーズ (Design & Documentation)
- [x] **技術選定と採用理由の明文化** ✅
    - `implementation_plan.md` に記載。React(Vite) + Socket.io + Tailwind(Vanilla CSS) の選定理由を明記。
- [x] **システムアーキテクチャ図の作成** ✅
    - `dataflow.md` に記載。フロント(Canvas) -> サーバー -> 他クライアントのデータフローを図解。
- [x] **デザインシステムの定義** ✅
    - `implementation_plan.md` セクション7.1/7.2 に白・青を基調としたクリーンデザインを定義。

### Phase 1: 環境構築とベースサーバー (Infrastructure)
- [x] **server/client フォルダの初期化** ✅
    - 依存パッケージのインストール完了。一括起動スクリプトをルートの `package.json` に設定。
- [x] **Express + Socket.io 基本サーバー作成** ✅
    - **ファイル**: [server/index.js](file:///c:/Users/emb-work/draw/server/index.js)
    - **内容**: 3000番ポートで待機し、静的ファイル配信とSocket接続の基本を構築。

### Phase 2: ルーム管理と入室フロー (Room Logic)
- [x] **RoomID 生成とメモリ管理** ✅
    - **ファイル**: [gameManager.js](file:///c:/Users/emb-work/draw/server/gameManager.js) (`generateRoomId`)
    - **内容**: `Map` オブジェクトを使用して、実行中の全ルームの状態をサーバー上で管理。
- [x] **ルーム作成・参加フォームのUI** ✅
    - **ファイル**: [Lobby.jsx](file:///c:/Users/emb-work/draw/client/src/components/Lobby.jsx)
    - **内容**: `CREATE_ROOM`, `JOIN_ROOM` イベントの送信機能を実装。
- [x] **URL パラメータによる自動入室** ✅
    - **ファイル**: [App.jsx](file:///c:/Users/emb-work/draw/client/src/App.jsx) (useEffect)
    - **内容**: `?room=ABCDE` でアクセスした際、自動でルームIDが入力される機能を実装。
- [x] **ホストによるプレイヤー強制退出 (KICK)** ✅
    - **ロジック**: [index.js](file:///c:/Users/emb-work/draw/server/index.js) (`KICK_PLAYER`) / [gameManager.js](file:///c:/Users/emb-work/draw/server/gameManager.js) (`leaveRoom`)
    - **UI**: [App.jsx](file:///c:/Users/emb-work/draw/client/src/App.jsx) (参加者一覧の×ボタン)
    - **内容**: ホストのみが他プレイヤーをキックでき、キックされた側はロビーに戻される仕組み。

### Phase 3: リアルタイム描画エンジン (Core Drawing)
- [x] **Canvas 描画コンポーネント** ✅
    - **ファイル**: [Canvas.jsx](file:///c:/Users/emb-work/draw/client/src/components/Canvas.jsx)
    - **内容**: HTML5 Canvasを使用。マウス/タッチ座標を `getBoundingClientRect` で正規化（0.0～1.0）し、解像度に依存しない同期を実現。
- [x] **リアルタイム描画リレー** ✅
    - **ロジック**: [index.js](file:///c:/Users/emb-work/draw/server/index.js) (`DRAW_STROKE`)
    - **内容**: 書いた線を即座に他の全員へ転送。画家自身も受信データで描画することで完全同期を実現。
- [x] **パレットツール (色・太さ・消しゴム)** ✅
    - **ファイル**: [Toolbar.jsx](file:///c:/Users/emb-work/draw/client/src/components/Toolbar.jsx)
    - **内容**: 12色のカラーパレット、3段階の太さ調整、消しゴムモード機能を実装。
- [x] **描画履歴の保存と復元（履歴同期）** ✅
    - **ロジック**: [gameManager.js](file:///c:/Users/emb-work/draw/server/gameManager.js) (`strokes` 配列)
    - **内容**: 全ての線をサーバーの `strokes` 配列に保存。新しく入室したプレイヤーには `JOIN_SUCCESS` 時にこれまでの全データを送信し、[Canvas.jsx](file:///c:/Users/emb-work/draw/client/src/components/Canvas.jsx) の初回マウント時に再現。

---

## 📋 今後のタスク（未着手）

### Phase 4: ゲームロジック実装 (Game Mechanics)

- [x] [Backend] お題リスト (`themes.json`) 作成と選出ロジック
    - **ファイル**: `server/themes.json` 新規作成 ✅
    - **内容**: implementation_plan.md セクション10 のワードリスト（100語）をJSON配列として保存。`pickWord(room)` 関数が `room.usedWords` を除外してランダム選出。全語使い切ったら自動リセット。
    - **形式**: `["りんご", "バナナ", "イチゴ", ...]`

- [x] [Backend] ターン制・プレイヤー交代ロジック
    - **ファイル**: `server/index.js`, `server/gameManager.js` ✅
    - **内容**: `START_GAME` → `status: 'PLAYING'`、`startTurn()` でお題選出・`YOUR_WORD` 送信・タイマー開始。タイムアップで `endTurn('timeout')`。`currentTurnIndex++`、全員1回描いたら `round++`。`round > totalRounds` で `GAME_END`。

- [ ] [Frontend] 画家用のお題表示と、回答者用のチャット入力 UI
    - **ファイル**: `client/src/components/GameBoard.jsx` を新規作成、`client/src/components/Chat.jsx` を新規作成
    - **内容**: GameBoard は Canvas, Toolbar, Chat, Scoreboard, Timer を組み合わせたメイン画面。画家にはお題をヘッダーに大きく表示。回答者にはチャット入力フォーム（Enter で `SUBMIT_GUESS` 送信）。不正解メッセージもチャット欄に表示。
    - **参照**: `implementation_plan.md` セクション7.5「ゲーム画面」

- [x] [Backend] 正解判定・ポイント計算・タイマー同期
    - **ファイル**: `server/index.js` ✅
    - **内容**: `SUBMIT_GUESS` → 画家でないことを確認 → カタカナ→ひらがな正規化で比較 → 正解なら `残り秒数 × 10` を正解者と画家に加点 → `CORRECT_ANSWER` 送信 → タイマー停止 → 3秒後 `TURN_END`

- [ ] **Checkpoint**: 1ゲーム（n周）のサイクルが正常に回り、正解時にスコアが加算され、全周回終了後にGAME_ENDが発火すること

---

### Phase 5: プレミアムデザイン & ギャラリー機能 (UI/UX Polish)

- [ ] [Frontend] グラスモーフィズムデザインの全体適用
    - **ファイル**: `client/src/index.css` を書き換え
    - **内容**: `implementation_plan.md` セクション7.2 の CSS Variables を適用。Google Fonts から Inter と Noto Sans JP を読み込み。全パネルに `backdrop-filter: blur(12px)` + 半透明背景。
    - **フォント読み込み**: `client/index.html` の `<head>` に Google Fonts の `<link>` を追加

- [ ] [Frontend] `canvas-confetti` による正解時の演出
    - **ファイル**: `client/src/components/GameBoard.jsx` に追記
    - **内容**: `CORRECT_ANSWER` イベント受信時に `confetti()` を呼び出し。画面全体に紙吹雪を表示。

- [ ] [Frontend] ランキング表示（表彰台アニメーション等）
    - **ファイル**: `client/src/components/Results.jsx` を新規作成
    - **内容**: `GAME_END` で受信した `rankings` を1位から順に表示。CSSアニメーションでフェードイン。

- [ ] [Common] ギャラリー機能: イラストのキャプチャ保存と一覧表示
    - **Backend**: `SAVE_CANVAS` 受信時に `room.gallery` に `GalleryItem` を push
    - **Frontend** (`Results.jsx`): `GAME_END` で受信した `gallery` をカード形式で表示。各カードに「お題」「描いた人」「イラスト画像（`<img src={imageData}>`）」を配置。
    - **参照**: `implementation_plan.md` セクション4.4「GalleryItem」、セクション7.5「リザルト画面」

- [ ] [Frontend] ホスト画面での QRコード 生成・表示
    - **ファイル**: `client/src/components/QRDisplay.jsx` を新規作成
    - **内容**: `qrcode.react` の `<QRCodeSVG>` コンポーネントを使用。`value` に `${window.location.origin}/?room=${roomId}` を設定。ダークモードに合わせた配色。
    - **参照**: `implementation_plan.md` セクション8「URL設計」

- [ ] [Frontend] スマホ向けレスポンシブ最適化
    - **ファイル**: `client/src/index.css` に追記
    - **内容**: `@media (max-width: 768px)` でサイドバーを下部に配置、Canvasを画面幅いっぱいに拡大。タッチでの描画がスムーズに動作することを確認。


### Phase 6: 最終調整とデプロイ (Production)

- [ ] [Backend] ポート番号・環境変数対応
    - **ファイル**: `server/index.js`
    - **内容**: `process.env.PORT` の利用確認（既に対応済みだが、最終チェック）。本番環境では CORS を適切に制限。

- [ ] [Common] Render へのデプロイと最終動作確認
    - **手順**: GitHub にプッシュ → Render で「New Web Service」 → リポジトリを接続 → Build Command: `npm run install:all && npm run build:all`, Start Command: `npm start`
    - **参照**: `implementation_plan.md` セクション9「デプロイ設定」

- [ ] **Final Check**: 外部ネットワークからのスマホ参加・プレイ確認
    - デプロイされたURLにPCとスマホからアクセスし、ルーム作成→QR参加→ゲームプレイ→リザルト表示の全フローを確認
