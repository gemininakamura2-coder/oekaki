/**
 * index.js — DrawDraw メインサーバー
 *
 * 役割:
 *   - Express で静的ファイル（ビルド済みReact）を配信する
 *   - Socket.io でクライアントとリアルタイム通信を行う
 *   - ゲームサイクル（ターン開始・タイマー・終了）を制御する
 *
 * ゲームの状態遷移:
 *   LOBBY → (START_GAME) → PLAYING → (全周回終了) → RESULT
 *
 * 主なSocket.ioイベント:
 *   受信: CREATE_ROOM, JOIN_ROOM, START_GAME, DRAW_STROKE,
 *         CLEAR_CANVAS, SUBMIT_GUESS, SAVE_CANVAS, KICK_PLAYER
 *   送信: JOIN_SUCCESS, ROOM_UPDATE, GAME_STARTED, YOUR_WORD,
 *         TIMER_TICK, DRAW_STROKE, CLEAR_CANVAS, CHAT_MESSAGE,
 *         CORRECT_ANSWER, TURN_END, GAME_END, KICKED, ERROR
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const gameManager = require('./gameManager');

const app = express();
const server = http.createServer(app);

// Socket.io サーバーを作成。CORS はすべてのオリジンを許可（開発用）。
// 本番環境では origin を実際のドメインに絞ることを推奨。
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// ===================================================================
// 静的ファイル配信
// ビルド済みの React アプリ（client/dist）を Express で配信する。
// Socket.io と同一のサーバーが担当することで CORS 設定が不要になる。
// ===================================================================
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

// Express v5: ワイルドカードは {*path} 記法が必要（v4 の '*' は非推奨）
// React Router でルーティングする場合でも index.html を返す SPA 設定
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ===================================================================
// ゲームサイクルのヘルパー関数
// Socket.io イベントハンドラーからこれらを呼ぶことで、
// ターン進行のロジックをイベントハンドラーと分離している。
// ===================================================================

/**
 * ターンを開始する。
 * 1. 今ターンの画家を turnOrder から決定する
 * 2. お題をランダムに選出して画家だけに送る
 * 3. 全員に GAME_STARTED (ターン開始合図) を送る
 * 4. 1秒ごとに TIMER_TICK を送るタイマーを開始する
 * @param {string} roomId
 */
function startTurn(roomId) {
  const room = gameManager.getRoom(roomId);
  // ゲームが終了・中断されていたら何もしない
  if (!room || room.status !== 'PLAYING') return;

  // ── 画家の決定 ──
  // turnOrder は入室順の Socket ID 配列。currentTurnIndex で今の番を管理する。
  const painterId = room.turnOrder[room.currentTurnIndex % room.turnOrder.length];
  room.currentPainterId = painterId;

  // ── お題の選出 ──
  room.currentWord = gameManager.pickWord(room);
  room.timeLeft = 100;
  room.strokes = []; // ターン開始時にサーバーの描画履歴をリセット
  room.currentTurnGuessed = false; // 正解フラグをリセット（SAVE_CANVAS で wasGuessed として使用）

  console.log(
    `[DrawDraw] ターン開始 | ルーム: ${roomId} | 画家: ${painterId} | お題: ${room.currentWord} | Round: ${room.round}/${room.totalRounds}`
  );

  // ── 画家だけにお題を伝える（他の人には秘密！） ──
  io.to(painterId).emit('YOUR_WORD', { word: room.currentWord });

  // ── 全員にターン開始を通知 ──
  io.to(roomId).emit('GAME_STARTED', {
    painterId,
    round: room.round,
    totalRounds: room.totalRounds,
    timeLeft: room.timeLeft,
  });

  // ── キャンバスをクリア ──
  // 新しいターンの最初はいつも真っ白なキャンバスから始める
  io.to(roomId).emit('CLEAR_CANVAS');

  // ── カウントダウンタイマーを開始 ──
  // 1秒ごとに timeLeft を減らして全員に送信する
  room.timerInterval = setInterval(() => {
    const r = gameManager.getRoom(roomId);
    // ルームが消えていたり、ゲームが終わっていたらタイマーを止める
    if (!r || r.status !== 'PLAYING') {
      clearInterval(room.timerInterval);
      return;
    }

    r.timeLeft--;
    io.to(roomId).emit('TIMER_TICK', { timeLeft: r.timeLeft });

    // 0秒になったらタイムアップ（誰も正解できなかった）
    // 3秒の猶予を設けてクライアントがキャンバスを保存する時間を確保する。
    // これがないと最終ターンで GAME_END が先に送信され、
    // ギャラリーにイラストが含まれない。
    if (r.timeLeft <= 0) {
      clearInterval(r.timerInterval);
      setTimeout(() => endTurn(roomId, 'timeout'), 3000);
    }
  }, 1000);
}

/**
 * ターンを終了する（正解 or タイムアップの両方で呼ばれる）。
 * 1. タイマーを停止する
 * 2. currentTurnIndex を進める
 * 3. 全員が1回描いたら round を増やす
 * 4. 全周回終了なら GAME_END を送ってゲームを終わらせる
 * 5. まだ続くなら 3秒後に次のターンを開始する
 * @param {string} roomId
 * @param {'correct'|'timeout'} reason - 終了理由
 */
function endTurn(roomId, reason) {
  const room = gameManager.getRoom(roomId);
  if (!room) return;

  // タイマーを確実に止める（正解時はすでに止まっているが念のため）
  clearInterval(room.timerInterval);

  // ── ターンインデックスを進める ──
  room.currentTurnIndex++;

  // ── ラウンド管理 ──
  // turnOrder.length 人分のターンが完了したら = 全員が1回描いた = 1ラウンド終了
  const totalTurnsPerRound = room.turnOrder.length;
  if (room.currentTurnIndex >= totalTurnsPerRound * room.round) {
    room.round++;
  }

  // ── 全周回終了チェック ──
  if (room.round > room.totalRounds) {
    room.status = 'RESULT';
    // スコア順にプレイヤーを並べてランキングを作る
    const rankings = [...room.players].sort((a, b) => b.points - a.points);
    io.to(roomId).emit('GAME_END', { rankings, gallery: room.gallery });
    console.log(`[DrawDraw] ゲーム終了 | ルーム: ${roomId}`);
    return;
  }

  // ── 次のターンへ ──
  const nextPainterId = room.turnOrder[room.currentTurnIndex % room.turnOrder.length];
  io.to(roomId).emit('TURN_END', { reason, nextPainterId });

  // 3秒のインターバルを挟んでプレイヤーが結果を確認できる時間を設ける
  setTimeout(() => startTurn(roomId), 3000);
}

// ===================================================================
// Socket.io イベントハンドラー
// クライアントから受信する各イベントに対する処理を定義する。
// ===================================================================
io.on('connection', (socket) => {
  console.log(`[DrawDraw] 接続: ${socket.id}`);

  // ─────────────────────────────────────────────────────────────────
  // CREATE_ROOM: ホストが「部屋を作る」ボタンを押したとき
  // ─────────────────────────────────────────────────────────────────
  socket.on('CREATE_ROOM', ({ playerName }) => {
    // gameManager でルームを作成（Socket ID が hostId になる）
    const room = gameManager.createRoom(socket.id, playerName);

    // ソケットをルームのチャンネルに参加させる（後で io.to(roomId) で全員に送れるようになる）
    socket.join(room.id);

    // 作成成功をホスト本人に通知
    socket.emit('JOIN_SUCCESS', { room, playerId: socket.id });
    console.log(`[DrawDraw] ルーム作成: ${room.id} by ${playerName}`);
  });

  // ─────────────────────────────────────────────────────────────────
  // JOIN_ROOM: プレイヤーが「参加する」ボタンを押したとき
  // ─────────────────────────────────────────────────────────────────
  socket.on('JOIN_ROOM', ({ roomId, playerName }) => {
    const room = gameManager.getRoom(roomId);

    // ルームIDが存在しない場合はエラーを返す
    if (!room) {
      return socket.emit('ERROR', { message: 'ルームが見つかりません' });
    }

    // プレイヤーをルームデータに追加
    gameManager.joinRoom(roomId, socket.id, playerName);
    socket.join(roomId);

    // 参加成功を本人に通知（現在のルーム状態をフルで送る）
    socket.emit('JOIN_SUCCESS', { room, playerId: socket.id });

    // ルーム内の全員に「誰かが入ってきた」ことを通知（プレイヤーリストを更新させる）
    io.to(roomId).emit('ROOM_UPDATE', { players: room.players });
    console.log(`[DrawDraw] 参加: ${playerName} → ルーム ${roomId}`);
  });

  // ─────────────────────────────────────────────────────────────────
  // START_GAME: ホストが「ゲームを開始する」ボタンを押したとき
  // ─────────────────────────────────────────────────────────────────
  socket.on('START_GAME', ({ roomId, totalRounds }) => {
    const room = gameManager.getRoom(roomId);
    if (!room) return;

    // セキュリティチェック: ホスト以外はゲームを開始できない
    if (room.hostId !== socket.id) return;

    // 2人以上いないと開始できない（1人では成立しない）
    if (room.players.length < 2) {
      return socket.emit('ERROR', { message: '2人以上必要です' });
    }

    // ゲーム状態を初期化してから最初のターンを開始
    room.status = 'PLAYING';
    room.totalRounds = totalRounds || 1;
    room.round = 1;
    room.currentTurnIndex = 0;
    room.usedWords = []; // お題の使用済みリストをリセット

    console.log(
      `[DrawDraw] ゲーム開始 | ルーム: ${roomId} | 参加者: ${room.players.length}人 | ${room.totalRounds}ラウンド`
    );

    startTurn(roomId);
  });

  // ─────────────────────────────────────────────────────────────────
  // DRAW_STROKE: 画家がキャンバスに線を描いたとき（マウス移動ごとに発火）
  // ─────────────────────────────────────────────────────────────────
  socket.on('DRAW_STROKE', ({ roomId, strokeData }) => {
    const room = gameManager.getRoom(roomId);
    if (room) {
      // サーバーに描画履歴を積む（後から入ってくるプレイヤーへの復元用）
      room.strokes.push(strokeData);
    }
    // 送信者（画家）以外の全員にリレーする
    // ※ 画家自身は既にローカルで描画済みなので除外
    socket.to(roomId).emit('DRAW_STROKE', strokeData);
  });

  // ─────────────────────────────────────────────────────────────────
  // CLEAR_CANVAS: 画家が「全消去」ボタンを押したとき
  // ─────────────────────────────────────────────────────────────────
  socket.on('CLEAR_CANVAS', ({ roomId }) => {
    const room = gameManager.getRoom(roomId);
    if (room) {
      room.strokes = []; // 履歴もリセット（新入りも真っ白キャンバスを見る）
    }
    // 画家以外にキャンバスのクリアを伝える
    socket.to(roomId).emit('CLEAR_CANVAS');
  });

  // ─────────────────────────────────────────────────────────────────
  // SUBMIT_GUESS: 回答者がチャットで回答を送ったとき
  // ─────────────────────────────────────────────────────────────────
  socket.on('SUBMIT_GUESS', ({ roomId, text }) => {
    const room = gameManager.getRoom(roomId);
    if (!room || room.status !== 'PLAYING') return;

    // 画家は自分で正解できない（不公正なため）
    if (socket.id === room.currentPainterId) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // ── 正誤判定 ──
    // カタカナ→ひらがなに変換してから比較することで、
    // 「りんご」「リンゴ」などの表記ブレに対応する
    const normalize = (str) =>
      str
        .trim()
        .replace(/[\u30A1-\u30F6]/g, (ch) =>
          // カタカナのコードポイントから 0x60 引くとひらがなになる
          String.fromCharCode(ch.charCodeAt(0) - 0x60)
        )
        .toLowerCase();

    const isCorrect = normalize(text) === normalize(room.currentWord);

    if (isCorrect) {
      // ── 正解！ ──
      // スコアは「残り秒数 × 10点」。残り時間が多いほど高得点。
      const points = room.timeLeft * 10;

      // 正解者と画家の両方に加点する（チームプレイを促す仕組み）
      player.points += points;
      const painter = room.players.find((p) => p.id === room.currentPainterId);
      if (painter) painter.points += points;

      // 全員に正解を発表（お題が公開される）
      io.to(roomId).emit('CORRECT_ANSWER', {
        winnerId: socket.id,
        winnerName: player.name,
        word: room.currentWord,
        points,
        players: room.players, // 更新後のスコアも一緒に送る
      });

      // 正解フラグを立てる（SAVE_CANVAS で wasGuessed として使用）
      room.currentTurnGuessed = true;

      // タイマーを止めてターンを終わらせる（3秒後）
      clearInterval(room.timerInterval);
      setTimeout(() => endTurn(roomId, 'correct'), 3000);
    } else {
      // ── 不正解 ──
      // 回答内容をチャットとして全員に流す（誰が何を答えたか見える）
      io.to(roomId).emit('CHAT_MESSAGE', {
        playerName: player.name,
        text,
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // SAVE_CANVAS: ターン終了直前に画家がイラストを送ったとき
  // リザルト画面のギャラリーに保存するため
  // ─────────────────────────────────────────────────────────────────
  socket.on('SAVE_CANVAS', ({ roomId, imageData }) => {
    const room = gameManager.getRoom(roomId);
    if (!room) return;

    const painter = room.players.find((p) => p.id === socket.id);
    if (!painter) return;

    gameManager.saveGalleryItem(
      roomId,
      painter.name,
      room.currentWord,
      imageData,
      room.currentTurnGuessed // 正解が出たかどうか（startTurn で false、SUBMIT_GUESS 正解時に true）
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // KICK_PLAYER: ホストがプレイヤーをルームから強制退出させるとき
  // ─────────────────────────────────────────────────────────────────
  socket.on('KICK_PLAYER', ({ roomId, targetId }) => {
    const room = gameManager.getRoom(roomId);
    // ホスト権限チェック（ホスト以外は kick 不可）
    if (!room || room.hostId !== socket.id) return;

    // ルームデータからプレイヤーを削除
    gameManager.leaveRoom(roomId, targetId);

    // 対象プレイヤーに退出を通知（フロントエンドはロビーに戻る）
    io.to(targetId).emit('KICKED', { message: 'ホストによって退出させられました' });

    // 残ったメンバー全員にプレイヤーリストの更新を通知
    io.to(roomId).emit('ROOM_UPDATE', { players: room.players });
  });

  // ─────────────────────────────────────────────────────────────────
  // disconnect: クライアントが切断したとき（ブラウザを閉じるなど）
  // ─────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[DrawDraw] 切断: ${socket.id}`);
    // TODO(Phase 7): 切断時のクリーンアップ
    //   1. 切断プレイヤーを leaveRoom() で除外 → 残りメンバーに ROOM_UPDATE
    //   2. 切断者が画家だった場合 → clearInterval + endTurn() でターンスキップ
    //   3. 切断者がホストだった場合 → leaveRoom() 内で自動ホスト移譲済み
    //   4. 全員切断 → leaveRoom() がルーム自体を削除（timerInterval のクリアも必要）
  });
});

// ===================================================================
// サーバー起動
// PORT 環境変数は Render などのホスティングサービスが自動で設定する
// ===================================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[DrawDraw] サーバー起動: http://localhost:${PORT}`);
});
