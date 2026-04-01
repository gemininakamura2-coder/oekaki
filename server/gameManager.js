/**
 * DrawDraw Game Manager
 */

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
    strokes: [], // 描画履歴
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
  return room;
}

function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.players = room.players.filter((p) => p.id !== playerId);

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
  saveGalleryItem,
};
