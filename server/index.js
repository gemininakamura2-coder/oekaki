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
  })


});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[DrawDraw] Server running on http://localhost:${PORT}`);
});
