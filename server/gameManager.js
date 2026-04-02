/**
 * DrawDraw Game Manager
 */

const themes = require('./themes.json');

const rooms = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(result)) return generateRoomId();
  return result;
}

function createRoom(hostId, hostName) {
  const roomId = generateRoomId();
  const room = {
    id: roomId,
    hostId: hostId,
    status: 'LOBBY',
    players: [
      {
        id: hostId,
        name: hostName,
        points: 0,
        isHost: true,
      },
    ],
    // ゲーム進行管理
    turnOrder: [hostId],       // 描画順 (player id の配列)
    currentTurnIndex: 0,
    currentWord: null,
    currentPainterId: null,
    round: 1,
    totalRounds: 1,
    timeLeft: 100,
    timerInterval: null,
    usedWords: [],             // 重複防止
    // データ
    strokes: [],               // 描画履歴
    gallery: [],
  };
  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) {
  return rooms.get(roomId);
}

function joinRoom(roomId, playerId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const player = {
    id: playerId,
    name: playerName,
    points: 0,
    isHost: false,
  };

  room.players.push(player);
  room.turnOrder.push(playerId); // 描画順に追加
  return room;
}

function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.players = room.players.filter((p) => p.id !== playerId);
  room.turnOrder = room.turnOrder.filter((id) => id !== playerId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }

  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  return room;
}

/**
 * お題をランダムに選出する。
 * 既出のお題 (usedWords) を除外し、全語使い切ったらリセット。
 * @param {object} room
 * @returns {string} 選ばれたお題
 */
function pickWord(room) {
  let available = themes.filter((w) => !room.usedWords.includes(w));
  if (available.length === 0) {
    // 全語使い切ったらリセット
    room.usedWords = [];
    available = [...themes];
  }
  const word = available[Math.floor(Math.random() * available.length)];
  room.usedWords.push(word);
  return word;
}

function saveGalleryItem(roomId, painterName, word, imageData, wasGuessed) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.gallery.push({
    painterName,
    word,
    imageData,
    wasGuessed,
  });
}

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  pickWord,
  saveGalleryItem,
};
