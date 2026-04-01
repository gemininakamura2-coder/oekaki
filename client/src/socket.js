import { io } from 'socket.io-client';

// サーバーのURL。本番環境（同一オリジン）と開発環境（localhost:3000）に対応
const URL = process.env.NODE_ENV === 'production' 
  ? undefined 
  : 'http://localhost:3000';

export const socket = io(URL, {
  autoConnect: false, // 明示的に connect() するまで接続しない
});

// デバッグ用
socket.onAny((event, ...args) => {
  console.log(`[SocketEvent] ${event}:`, args);
});
