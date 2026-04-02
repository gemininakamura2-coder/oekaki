const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const gameManager = require('./gameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// 静的ファイルの提供 (ビルドされたクライアント)
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));

// Express v5: ワイルドカードは {*path} 記法が必要
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// =====================================================================
// ヘルパー: ターンを開始する
// =====================================================================
function startTurn(roomId) {
  const room = gameManager.getRoom(roomId);
  if (!room || room.status !== 'PLAYING') return;

  // 現在の画家を決定
  const painterId = room.turnOrder[room.currentTurnIndex];
  room.currentPainterId = painterId;
  room.currentWord = gameManager.pickWord(room);
  room.timeLeft = 100;
  room.strokes = []; // ターン開始時にキャンバスをリセット

  console.log(
    `[DrawDraw] Turn start | Room: ${roomId} | Painter: ${painterId} | Word: ${room.currentWord} | Round: ${room.round}/${room.totalRounds}`
  );

  // 画家にだけお題を送る
  io.to(painterId).emit('YOUR_WORD', { word: room.currentWord });

  // 全員にゲーム状態を通知
  io.to(roomId).emit('GAME_STARTED', {
    painterId,
    round: room.round,
    totalRounds: room.totalRounds,
    timeLeft: room.timeLeft,
  });

  // キャンバスをクリアするよう全員に伝える
  io.to(roomId).emit('CLEAR_CANVAS');

  // 1秒毎にタイマーを送信
  room.timerInterval = setInterval(() => {
    const r = gameManager.getRoom(roomId);
    if (!r || r.status !== 'PLAYING') {
      clearInterval(room.timerInterval);
      return;
    }

    r.timeLeft--;
    io.to(roomId).emit('TIMER_TICK', { timeLeft: r.timeLeft });

    if (r.timeLeft <= 0) {
      // タイムアップ → ターン終了
      clearInterval(r.timerInterval);
      endTurn(roomId, 'timeout');
    }
  }, 1000);
}

// =====================================================================
// ヘルパー: ターンを終了する
// =====================================================================
function endTurn(roomId, reason) {
  const room = gameManager.getRoom(roomId);
  if (!room) return;

  clearInterval(room.timerInterval);

  // インデックスを進める
  room.currentTurnIndex++;

  // 全員が1回描いたら round++ (= 1周 = turnOrder.length 分のターン)
  const totalTurnsPerRound = room.turnOrder.length;
  if (room.currentTurnIndex >= totalTurnsPerRound * room.round) {
    room.round++;
  }

  // 全周回終了 → ゲームエンド
  if (room.round > room.totalRounds) {
    room.status = 'RESULT';
    const rankings = [...room.players].sort((a, b) => b.points - a.points);
    io.to(roomId).emit('GAME_END', { rankings, gallery: room.gallery });
    console.log(`[DrawDraw] Game ended | Room: ${roomId}`);
    return;
  }

  // 次のターンへ (turnOrderをラップアラウンド)
  const nextPainterId = room.turnOrder[room.currentTurnIndex % room.turnOrder.length];
  io.to(roomId).emit('TURN_END', { reason, nextPainterId });

  // 少し待ってから次のターンを開始
  setTimeout(() => startTurn(roomId), 3000);
}

// =====================================================================
// Socket.io イベントハンドラ
// =====================================================================
io.on('connection', (socket) => {
  console.log(`[DrawDraw] Player connected: ${socket.id}`);

  // ルーム作成
  socket.on('CREATE_ROOM', ({ playerName }) => {
    const room = gameManager.createRoom(socket.id, playerName);
    socket.join(room.id);
    socket.emit('JOIN_SUCCESS', { room, playerId: socket.id });
    console.log(`[DrawDraw] Room created: ${room.id} by ${playerName}`);
  });

  // ルーム参加
  socket.on('JOIN_ROOM', ({ roomId, playerName }) => {
    const room = gameManager.getRoom(roomId);
    if (!room) {
      return socket.emit('ERROR', { message: 'Room not found' });
    }

    gameManager.joinRoom(roomId, socket.id, playerName);
    socket.join(roomId);
    socket.emit('JOIN_SUCCESS', { room, playerId: socket.id });

    // 他のプレイヤーに通知
    io.to(roomId).emit('ROOM_UPDATE', { players: room.players });
    console.log(`[DrawDraw] Player ${playerName} joined room: ${roomId}`);
  });

  // ゲーム開始 (ホストのみ)
  socket.on('START_GAME', ({ roomId, totalRounds }) => {
    const room = gameManager.getRoom(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return; // ホストのみ許可
    if (room.players.length < 2) {
      return socket.emit('ERROR', { message: '2人以上必要です' });
    }

    room.status = 'PLAYING';
    room.totalRounds = totalRounds || 1;
    room.round = 1;
    room.currentTurnIndex = 0;
    room.usedWords = [];

    console.log(
      `[DrawDraw] Game started | Room: ${roomId} | Players: ${room.players.length} | Rounds: ${room.totalRounds}`
    );

    startTurn(roomId);
  });

  // 描画データの転送
  socket.on('DRAW_STROKE', ({ roomId, strokeData }) => {
    const room = gameManager.getRoom(roomId);
    if (room) {
      room.strokes.push(strokeData); // 履歴に保存
    }
    // 自分以外の全員に送信
    socket.to(roomId).emit('DRAW_STROKE', strokeData);
  });

  // 全消去のリレー
  socket.on('CLEAR_CANVAS', ({ roomId }) => {
    const room = gameManager.getRoom(roomId);
    if (room) {
      room.strokes = []; // 履歴も消去
    }
    socket.to(roomId).emit('CLEAR_CANVAS');
  });

  // 回答の送信
  socket.on('SUBMIT_GUESS', ({ roomId, text }) => {
    const room = gameManager.getRoom(roomId);
    if (!room || room.status !== 'PLAYING') return;

    // 画家自身は回答できない
    if (socket.id === room.currentPainterId) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    // ひらがな正規化して比較（カタカナ→ひらがな変換）
    const normalize = (str) =>
      str
        .trim()
        .replace(/[\u30A1-\u30F6]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) - 0x60)
        )
        .toLowerCase();

    const isCorrect = normalize(text) === normalize(room.currentWord);

    if (isCorrect) {
      // 正解！ポイント計算: 残り秒数 × 10
      const points = room.timeLeft * 10;

      // 正解者に加点
      player.points += points;

      // 画家にも加点
      const painter = room.players.find((p) => p.id === room.currentPainterId);
      if (painter) painter.points += points;

      io.to(roomId).emit('CORRECT_ANSWER', {
        winnerId: socket.id,
        winnerName: player.name,
        word: room.currentWord,
        points,
        players: room.players,
      });

      clearInterval(room.timerInterval);
      // 3秒後にターン終了
      setTimeout(() => endTurn(roomId, 'correct'), 3000);
    } else {
      // 不正解: チャットとして全員に流す
      io.to(roomId).emit('CHAT_MESSAGE', {
        playerName: player.name,
        text,
      });
    }
  });

  // ギャラリー保存 (画家が送信)
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
      room.status !== 'PLAYING' // タイムアウト前なら wasGuessed=true はクライアント側で制御
    );
  });

  // プレイヤーの強制退出
  socket.on('KICK_PLAYER', ({ roomId, targetId }) => {
    const room = gameManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;

    gameManager.leaveRoom(roomId, targetId);
    io.to(targetId).emit('KICKED', { message: 'ホストによって退出させられました' });
    io.to(roomId).emit('ROOM_UPDATE', { players: room.players });
  });

  socket.on('disconnect', () => {
    console.log(`[DrawDraw] Player disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[DrawDraw] Server running on http://localhost:${PORT}`);
});
