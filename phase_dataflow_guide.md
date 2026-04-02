# 🌱 DrawDraw まるわかり解説書 (Phase 1〜4 バックエンド完了時点)

このドキュメントは、今作っているアプリが**裏側でどうやって動いていて、みんなでお絵描きクイズができているのか**を、専門用語を極力噛み砕いて解説したガイドです。

---

## 📚 最初に覚える「3つの主役」

今の「DrawDraw」は、大きく分けて**3つの主役**が協力して動いています。

### 1. フロントエンド（React）= 「ユーザーの画面と手足」
- **役割**: ユーザーが見るきれいな画面を作り、「ボタンのクリック」や「絵を描く操作」を受け取る担当。
- **ファイル**: `client` フォルダ（`App.jsx`, `Lobby.jsx`, `Canvas.jsx`, `Toolbar.jsx`, `GameBoard.jsx` など）
- **例え**: レストランの「お客さん（とメニュー表）」

### 2. バックエンド（Express/Node.js）= 「裏側の管理人」
- **役割**: フロントエンドからのイベントを受け取り、ゲームを進行させ、全員に情報を配る中央管理者。
- **ファイル**: `server/index.js`, `server/gameManager.js`, `server/themes.json`
- **例え**: レストランの「厨房と店長」

### 3. リアルタイム通信（Socket.io）= 「超高速のトランシーバー」
- **役割**: リロードなしに、一瞬でデータを全員に届ける魔法の通信技術。
- **例え**: お客さんと厨房をつなぐ「トランシーバー」

---

## 🏗️ Phase 1: アプリが開くまでの基本の動き

1. ブラウザが `http://localhost:3000` にアクセス → サーバーが `client/dist` の `index.html` を返す
2. React アプリが起動し、Socket.io クライアントが接続待機状態に（`socket.js`）
3. `socket.connect()` はルーム作成・参加ボタン押下時に初めて呼ばれる（最初は接続しない）

---

## 🚪 Phase 2: ルーム管理と入室フロー

### ルーム作成 (CREATE_ROOM)
```
Lobby.jsx → socket.emit('CREATE_ROOM', { playerName })
  └→ server/index.js: gameManager.createRoom(socket.id, playerName)
  └→ server/gameManager.js: rooms Map に Room オブジェクト追加
  └→ server: socket.emit('JOIN_SUCCESS', { room, playerId })
  └→ App.jsx: setJoined(true), setRoom(room) → ゲーム画面へ
```

### 参加 (JOIN_ROOM)
```
Lobby.jsx → socket.emit('JOIN_ROOM', { roomId, playerName })
  └→ server: gameManager.joinRoom() でプレイヤー追加・turnOrder に追加
  └→ server: 参加者に JOIN_SUCCESS、全員に ROOM_UPDATE
  └→ App.jsx: 参加者に setRoom(), ホストは ROOM_UPDATE で players を更新
```

### URL パラメータによる自動入室
- `/?room=XXXXX` でアクセスすると `App.jsx` の `useState` 初期化時に `initialRoomId` にセットされ、`Lobby.jsx` のルームID入力欄に自動反映される。

### QRコード（Phase 3.5 先行実装済み）
- `App.jsx` のゲーム画面（サイドバー）に `QRCodeSVG` を直接実装
- QR値: `${window.location.origin}/?room=${room.id}`
- スキャン → URL参数でアクセス → 自動入室フロー

---

## 🎨 Phase 3: リアルタイム描画エンジン

### DRAW_STROKE — 描線のリレー
```
Canvas.jsx: マウス/タッチ操作 → 正規化座標(0〜1)に変換
  └→ onStrokeEmit(strokeData) → App.jsx
  └→ socket.emit('DRAW_STROKE', { roomId, strokeData })
  └→ server: room.strokes に保存 + socket.to(roomId).emit('DRAW_STROKE', strokeData)
  └→ 他の Canvas.jsx: externalStroke prop で受け取り → Canvas に描画
```

### 座標の正規化（スクリーンサイズ非依存）
- 送受信する座標はすべて `0.0〜1.0` の割合（Canvas幅・高さに対するパーセント）
- 送信側: `x / rect.width`, 受信側: `x * canvas.width` で実際のピクセルに戻す

### 履歴の復元（後から入った人への対応）
- 全描線を `room.strokes` にサーバーが溜め込む
- `JOIN_SUCCESS` のペイロードに `room.strokes` が含まれる
- `Canvas.jsx` は `initialStrokes` prop を受け取り、初回マウント時に一括再描画

---

## 🎮 Phase 4: ゲームロジック（バックエンド完成・フロントエンド接続待ち）

### ゲームサイクルの全体像
```
ホスト: START_GAME → server
  └→ room.status = 'PLAYING', room.totalRounds = n
  └→ startTurn(roomId) を呼ぶ

startTurn(roomId):
  1. turnOrder[currentTurnIndex] で画家を決定
  2. pickWord(room) でお題選出 (usedWords で重複除外)
  3. 画家に YOUR_WORD { word }
  4. 全員に GAME_STARTED { painterId, round, totalRounds, timeLeft }
  5. 全員に CLEAR_CANVAS (ターン開始時にキャンバスリセット)
  6. setInterval で 1秒ごとに TIMER_TICK { timeLeft } を送信

回答者: SUBMIT_GUESS { roomId, text }
  → カタカナ→ひらがな正規化して currentWord と比較
  → 正解: 残り秒数×10 を正解者&画家に加点
         → CORRECT_ANSWER { winnerId, winnerName, word, points, players }
         → clearInterval → 3秒後に endTurn('correct')
  → 不正解: CHAT_MESSAGE { playerName, text } を全員に配信

画家: SAVE_CANVAS { roomId, imageData }
  → gallery に { painterName, word, imageData, wasGuessed } を保存

endTurn(roomId, reason):
  1. currentTurnIndex++
  2. 全員1回描いたら round++
  3. round > totalRounds → GAME_END { rankings, gallery }, status = 'RESULT'
  4. まだ続く → 3秒後に startTurn() を再呼び出し
```

### お題選出ロジック (`server/gameManager.js` の `pickWord`)
```javascript
// themes.json の100語から、すでに使ったもの(usedWords)を除外してランダム選出
// 全語使い切ったら usedWords をリセットして再利用
function pickWord(room) {
  let available = themes.filter(w => !room.usedWords.includes(w));
  if (available.length === 0) { room.usedWords = []; available = [...themes]; }
  const word = available[Math.floor(Math.random() * available.length)];
  room.usedWords.push(word);
  return word;
}
```

### フロントエンドで受信すべきイベント（未実装）
| サーバー→クライアント | タイミング | フロントでやること |
|---|---|---|
| `GAME_STARTED` | ゲーム開始・次ターン | `room.status='PLAYING'`, `currentPainterId`, `round` 更新 |
| `YOUR_WORD` | 画家のみ | `word` ステートに保存して GameBoard に渡す |
| `TIMER_TICK` | 毎秒 | `room.timeLeft` 更新 |
| `CORRECT_ANSWER` | 正解時 | スコア更新・正解トースト表示・confetti |
| `TURN_END` | ターン終了 | UI をターン間に切り替え |
| `CHAT_MESSAGE` | 不正解回答 | チャット履歴に追加 |
| `GAME_END` | 全周終了 | Results 画面に遷移 |

---

## 🗂️ データ構造リファレンス

### Room（サーバーメモリ上）
```javascript
{
  id: 'R9XZ2',           // 5桁英数字
  hostId: 'socketId',
  status: 'LOBBY' | 'PLAYING' | 'RESULT',
  players: Player[],
  turnOrder: [id, id, ...],     // 描画順
  currentTurnIndex: 0,
  currentPainterId: 'socketId',
  currentWord: 'りんご',
  round: 1,
  totalRounds: 3,
  timeLeft: 85,           // 残り秒数
  timerInterval: null,    // setInterval の参照
  usedWords: ['りんご'],  // 既出お題（重複防止）
  strokes: StrokeData[],  // 描画履歴（ターン開始でリセット）
  gallery: GalleryItem[],
}
```

### Player
```javascript
{ id: 'socketId', name: 'たろう', points: 850, isHost: true }
```

### StrokeData（座標は0〜1の正規化値）
```javascript
{ fromX: 0.2, fromY: 0.3, toX: 0.21, toY: 0.31, color: '#ef4444', size: 5, tool: 'pen' }
```

### GalleryItem
```javascript
{ painterName: 'たろう', word: 'りんご', imageData: 'data:image/png;base64,...', wasGuessed: true }
```

---

## 📁 ファイル構成（現在時点）

```
draw/
├── package.json             ← 一括ビルド/起動スクリプト
├── implementation_plan.md   ← 技術設計書（UIルール・通信仕様の詳細はこちら）
├── task.md                  ← 開発ロードマップ・進捗（このドキュメントの姉妹）
├── phase_dataflow_guide.md  ← このファイル
│
├── server/
│   ├── index.js             ← Socket.io イベントハンドラー + startTurn/endTurn
│   ├── gameManager.js       ← rooms Map, createRoom/joinRoom/leaveRoom/pickWord
│   └── themes.json          ← お題100語
│
└── client/
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx          ← ルート。状態管理・画面切替・QR・KICK ⚠️ゲームイベント未接続
        ├── index.css        ← グローバルCSS（CSS Variables）
        ├── socket.js        ← Socket.io シングルトン
        └── components/
            ├── Lobby.jsx    ← 入室UI ✅完成
            ├── GameBoard.jsx← ゲーム画面の骨格 ⚠️App.jsxと未接続・チャット履歴なし
            ├── Canvas.jsx   ← 描画エンジン ✅完成
            └── Toolbar.jsx  ← 色・太さ・消しゴム ✅完成
```
