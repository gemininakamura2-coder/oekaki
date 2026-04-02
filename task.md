# 🚀 DrawDraw 開発詳細ロードマップ & AI引き継ぎガイド

> **【🤖 新しいAIモデル・別スレッドの担当者へ】**
> あなたはこの「DrawDraw（リアルタイムお絵描きクイズ）」プロジェクトの開発を引き継ぎました。
> 既存のコードを壊さずに作業を継続するため、**作業開始前に必ず以下のファイルを全て読み込んでください（`view_file` ツールを使用）。**
>
> 1. **`implementation_plan.md`**: 設計書・UIのルール・通信仕様など全容。
> 2. **`task.md`**: 実装ステップと現在の進捗（このファイル）。
> 3. **`phase_dataflow_guide.md`**: Socket.ioやデータ構造の仕組み・データの流れ。
>
> これらを理解した上で、`task.md` の「今後のタスク（未着手）」の続きから実装を再開してください。

---

## 📍 現在のプロジェクト状態

- **OS**: Windows (PowerShell制限あり。`&&`は使えないので `;` でコマンドを区切る)
- **Node.js**: v25.8.1 / **Express**: v5
- **プロジェクトルート**: `c:\Users\emb-work\draw`
- **現在のフェーズ**: **Phase 4 バックエンド完了**（次ステップは Phase 4 フロントエンド接続）

### 現在の主要ファイル構成と役割

| ファイル | 役割 | 状態 |
|---|---|---|
| `server/index.js` | Socket.io イベントハンドラー全般。ゲームサイクル管理 | ✅ 完成 |
| `server/gameManager.js` | ルーム・プレイヤーデータ管理。`pickWord()` 選出ロジック | ✅ 完成 |
| `server/themes.json` | お題ワードリスト 100語 | ✅ 完成 |
| `client/src/App.jsx` | メイン状態管理。ロビー/ゲーム画面の切替。QR・キック機能 | ⚠️ ゲームイベント未接続 |
| `client/src/components/Lobby.jsx` | 名前入力、ルーム作成・参加UI | ✅ 完成 |
| `client/src/components/GameBoard.jsx` | ゲームメイン画面の骨格（Canvas・Toolbar・チャット入力・スコア表示） | ⚠️ App.jsxと未接続・チャット履歴なし |
| `client/src/components/Canvas.jsx` | お絵描きエンジン（正規化座標・履歴復元） | ✅ 完成 |
| `client/src/components/Toolbar.jsx` | 色・太さ・消しゴムUI | ✅ 完成 |
| `client/src/socket.js` | Socket.io クライアント接続インスタンス | ✅ 完成 |

---

## ✅ 完了済みタスク

### Phase 0: 資料・設計フェーズ
- [x] 技術選定と採用理由の明文化 (`implementation_plan.md`)
- [x] システムアーキテクチャ図・シーケンス図の作成
- [x] デザインシステムの定義（CSS Variables）

### Phase 1: 環境構築とベースサーバー
- [x] server/client フォルダの初期化・依存パッケージインストール
- [x] Express + Socket.io 基本サーバー作成

### Phase 2: ルーム管理と入室フロー
- [x] RoomID 生成とメモリ管理 (`gameManager.js`)
- [x] ルーム作成・参加フォームUI (`Lobby.jsx`)
- [x] URLパラメータ (`?room=XXXXX`) による自動入室 (`App.jsx`)
- [x] ホストによるプレイヤー強制退出・KICK機能

### Phase 3: リアルタイム描画エンジン
- [x] Canvas 描画コンポーネント（正規化座標 0〜1）
- [x] リアルタイム描画リレー (`DRAW_STROKE`)
- [x] パレットツール（12色・4段階太さ・消しゴム）(`Toolbar.jsx`)
- [x] 描画履歴の保存と復元（`room.strokes` → `JOIN_SUCCESS` 時に全送信）

### Phase 3.5: QRコード機能（Phase 5予定だったが先行実装済み）
- [x] QRコード表示（`qrcode.react` の `QRCodeSVG` を `App.jsx` 内に直接実装）
  - `${window.location.origin}/?room=${room.id}` を QR 値に設定
  - サイドバーにQRコードとURL文字列を両方表示

### Phase 4: ゲームロジック バックエンド
- [x] お題リスト (`server/themes.json`) 作成 — 100語のJSON配列
- [x] `pickWord(room)` 選出ロジック — `usedWords` で重複除外、全語使い切りで自動リセット
- [x] ターン制・プレイヤー交代ロジック (`server/index.js`)
  - `START_GAME` → `startTurn()` → `YOUR_WORD` 送信 → 1秒タイマー → `TIMER_TICK`
  - タイムアップ → `endTurn('timeout')` → 3秒後に次のターン
  - 全員1回描いたら `round++`、全周回終了で `GAME_END`
- [x] 正解判定・ポイント計算 (`server/index.js`)
  - `SUBMIT_GUESS` → カタカナ→ひらがな正規化で比較
  - 正解: `残り秒数×10` を正解者と画家の両方に加点 → `CORRECT_ANSWER` → 3秒後 `TURN_END`
  - 不正解: `CHAT_MESSAGE` として全員に配信
- [x] ギャラリー保存 (`SAVE_CANVAS` → `room.gallery` に追記)

---

## 📋 今後のタスク（未着手）

### Phase 4 続き: フロントエンドとバックエンドの接続

- [ ] **[Frontend] App.jsx をゲームサイクルに対応させる（最重要）**
  - **ファイル**: `client/src/App.jsx`
  - **内容**:
    - `joined` 状態のときに `GameBoard` コンポーネントに切り替える（現在はキャンバスとToolbarを直接置いている）
    - `START_GAME` イベントを emit するボタンを接続（現在ボタンは存在するが `onClick` なし）
    - 以下のSocket.ioイベントを受信するリスナーを追加:
      - `GAME_STARTED` → `room.status`, `room.currentPainterId`, `room.round` を更新
      - `YOUR_WORD` → `word` ステートに保存（画家のみ受信）
      - `TIMER_TICK` → `room.timeLeft` を更新
      - `CORRECT_ANSWER` → 正解表示・スコア更新
      - `TURN_END` → 次のターン状態に更新
      - `GAME_END` → Results画面に遷移

- [ ] **[Frontend] GameBoard.jsx の完成**
  - **ファイル**: `client/src/components/GameBoard.jsx`
  - **内容**:
    - チャット履歴の表示エリアを追加（`CHAT_MESSAGE` を受け取り一覧表示）
    - ホストが `START_GAME` を送れるボタンをロビー状態のときに表示
    - `CORRECT_ANSWER` 受信時に「〇〇さんが正解！」トースト通知

- [ ] **Checkpoint**: ゲーム開始ボタンを押すと画家にお題が表示され、回答者がチャットで答えられ、スコアが動くこと

---

### Phase 5: プレミアムデザイン & ギャラリー機能

- [ ] **[Frontend] `canvas-confetti` による正解時の演出**
  - `CORRECT_ANSWER` イベント受信時に `confetti()` を呼び出し

- [ ] **[Frontend] Results.jsx — ランキング表示とギャラリー**
  - `GAME_END` で受信した `rankings` (Player[]) を1位から表示
  - 同じく `gallery` (GalleryItem[]) をカード形式で表示（お題・描いた人・イラスト画像）
  - 「もう一度遊ぶ」/「トップへ戻る」ボタン

- [ ] **[Frontend] グラスモーフィズムデザインの全体適用**
  - `client/src/index.css` で全パネルに `backdrop-filter: blur(12px)` + 半透明背景

- [ ] **[Frontend] スマホ向けレスポンシブ最適化**
  - `@media (max-width: 768px)` でサイドバーを下部に、キャンバスを全幅に

---

### Phase 6: 最終調整とデプロイ

- [ ] **[Common] Render へのデプロイと最終動作確認**
  - GitHub にプッシュ → Render で「New Web Service」 → リポジトリを接続
  - Build Command: `npm run install:all && npm run build:all`
  - Start Command: `npm start`

- [ ] **Final Check**: 外部ネットワークからのスマホ参加・プレイ確認
  - デプロイURLにPCとスマホからアクセスし、QR参加→ゲームプレイ→リザルト表示の全フローを確認
