/**
 * socket.js — Socket.io クライアントのシングルトンインスタンス
 *
 * アプリ全体でこの1つのインスタンスを使い回す。
 * 複数のコンポーネントが同じ接続を共有できるのは、このモジュールが
 * 一度しか評価されない ES Module の仕組みのおかげ。
 */

import { io } from 'socket.io-client';

// 接続先URL。開発中は Vite(3001) とサーバー(3000) が別ポートなのでURLを指定する。
// 本番環境（Renderなど）では同一オリジンになるので undefined でOKになる。
const SERVER_URL =
  process.env.NODE_ENV === 'production'
    ? undefined          // 本番: 同一オリジンに自動接続
    : 'http://localhost:3000'; // 開発: サーバーの明示的なURL

export const socket = io(SERVER_URL, {
  // autoConnect: false にすることで、画面表示時点では接続しない。
  // ロビーで「部屋を作る」「参加する」ボタンを押したときに socket.connect() を呼ぶ。
  autoConnect: false,
});

// 開発中のデバッグ用: すべてのイベントをコンソールに出力する
socket.onAny((event, ...args) => {
  console.log(`[Socket受信] ${event}:`, args);
});
