/**
 * gameManager.js — サーバーサイドのゲームデータ管理モジュール
 *
 * 役割:
 *   - 実行中の全ルームをメモリ上（rooms Map）で管理する
 *   - ルームの作成・参加・退出・お題選出などの「データ操作」を担当
 *   - Socket.io の通信ロジック（index.js）とデータ管理を分離するための層
 *
 * 注意:
 *   - データはサーバーのメモリ上に保存されるため、サーバー再起動でリセットされる
 *   - 永続化が必要になった場合は DB（MongoDB等）への移行を検討する
 */

const themes = require('./themes.json'); // お題ワードリスト（100語）

// ===================================================================
// ルームデータの保管場所
// Key: roomId (5桁英数字), Value: Room オブジェクト
// ===================================================================
const rooms = new Map();

// ===================================================================
// ヘルパー: ユニークなルームIDを生成する
// ===================================================================
/**
 * 5桁のランダムな英数字IDを生成する。
 * 既に存在するIDと被った場合は再帰的に再生成する。
 * @returns {string} 未使用のルームID
 */
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // 万が一既存IDと被ったら再生成（確率は非常に低いが安全のため）
  if (rooms.has(result)) return generateRoomId();
  return result;
}

// ===================================================================
// ルーム操作関数
// ===================================================================

/**
 * 新しいルームを作成してメモリに登録する。
 * ホストプレイヤーも同時に追加される。
 * @param {string} hostId - ホストの Socket ID
 * @param {string} hostName - ホストのプレイヤー名
 * @returns {object} 作成された Room オブジェクト
 */
function createRoom(hostId, hostName) {
  const roomId = generateRoomId();

  const room = {
    id: roomId,
    hostId: hostId,
    status: 'LOBBY', // LOBBY → PLAYING → RESULT の3ステートで遷移

    // プレイヤー管理
    players: [
      {
        id: hostId,
        name: hostName,
        points: 0,    // 累計スコア
        isHost: true,
      },
    ],

    // ゲーム進行管理
    turnOrder: [hostId],   // 描画順（入室順に追加されていく）
    currentTurnIndex: 0,   // turnOrder の現在位置
    currentWord: null,     // 今ターンのお題（画家のみに送る）
    currentPainterId: null, // 今ターンの画家の Socket ID

    // ラウンド管理
    round: 1,         // 現在の周回数（1-based）
    totalRounds: 1,   // ホストが設定した総周回数
    timeLeft: 100,    // 残り秒数

    // タイマー制御用（setInterval の返り値）
    timerInterval: null,

    // お題の重複防止
    usedWords: [], // 使用済みお題リスト。全語使い切ったら自動リセット

    // 描画データ
    strokes: [],   // リアルタイム描画履歴（後から入った人の復元用・ターン開始でリセット）
    gallery: [],   // 各ターンのイラスト保存（リザルト画面で使用）
  };

  rooms.set(roomId, room);
  return room;
}

/**
 * 指定ルームIDの Room オブジェクトを取得する。
 * @param {string} roomId
 * @returns {object|undefined}
 */
function getRoom(roomId) {
  return rooms.get(roomId);
}

/**
 * 既存ルームにプレイヤーを追加する。
 * players 配列と turnOrder（描画順）の両方に追加する。
 * @param {string} roomId
 * @param {string} playerId - 参加者の Socket ID
 * @param {string} playerName
 * @returns {object|null} 更新後の Room、ルームが存在しない場合は null
 */
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
  room.turnOrder.push(playerId); // 描画順にも追加（入室順）
  return room;
}

/**
 * プレイヤーをルームから退出させる（切断・キック両方で使用）。
 * - プレイヤーが0人になったらルーム自体を削除する
 * - ホストが抜けた場合は次のプレイヤーに自動でホストを移譲する
 * @param {string} roomId
 * @param {string} playerId
 * @returns {object|null} 更新後の Room、ルームが削除された場合は null
 */
function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  // players と turnOrder の両方から除外する
  room.players = room.players.filter((p) => p.id !== playerId);
  room.turnOrder = room.turnOrder.filter((id) => id !== playerId);

  // 全員がいなくなったらルームを削除
  if (room.players.length === 0) {
    rooms.delete(roomId);
    return null;
  }

  // ホストが退出した場合、次のプレイヤーを自動的にホストに昇格
  if (room.hostId === playerId && room.players.length > 0) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  return room;
}

// ===================================================================
// ゲームロジック関数
// ===================================================================

/**
 * ランダムにお題を1語選出する。
 * すでに使ったお題（room.usedWords）は除外する。
 * 全語使い切った場合は usedWords をリセットして再利用する。
 * @param {object} room - Room オブジェクト
 * @returns {string} 選ばれたお題の文字列
 */
function pickWord(room) {
  // 未使用のお題だけに絞る
  let available = themes.filter((w) => !room.usedWords.includes(w));

  // 全部使い切ったらリセット（無限に続けるため）
  if (available.length === 0) {
    room.usedWords = [];
    available = [...themes];
  }

  // ランダムに1語選んで使用済みリストに追加
  const word = available[Math.floor(Math.random() * available.length)];
  room.usedWords.push(word);
  return word;
}

/**
 * ターン終了時にそのターンのイラストをギャラリーに保存する。
 * リザルト画面のギャラリーカードに使用する。
 * @param {string} roomId
 * @param {string} painterName - 描いたプレイヤーの名前
 * @param {string} word - そのターンのお題
 * @param {string} imageData - Canvas.toDataURL() で取得した Base64 画像文字列
 * @param {boolean} wasGuessed - 正解が出たかどうか
 */
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

// ===================================================================
// エクスポート
// ===================================================================
module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  pickWord,
  saveGalleryItem,
};
