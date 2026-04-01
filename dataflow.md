# 📊 DrawDraw データフロー図 (Data Flow Diagrams)

> このドキュメントは DrawDraw アプリにおける **データの流れ** を視覚的にまとめたものです。
> 技術仕様の詳細は `implementation_plan.md` を参照してください。

---

## 1. 全体システムデータフロー

アプリ全体を通じて、データがどのように生成・転送・消費されるかの俯瞰図です。

```mermaid
flowchart TB
    subgraph Browser_Host["🖥️ ホスト (Host Browser)"]
        H_UI["React UI"]
        H_Canvas["Canvas API"]
        H_QR["QRCode 生成"]
        H_Socket["socket.io-client"]
    end

    subgraph Browser_Guest["📱 ゲスト (Guest Browser)"]
        G_UI["React UI"]
        G_Canvas["Canvas API"]
        G_Chat["チャット入力"]
        G_Socket["socket.io-client"]
    end

    subgraph Server["⚙️ サーバー (Node.js + Express)"]
        S_Socket["Socket.io Engine"]
        S_Room["Room Manager\n(rooms Map)"]
        S_Game["Game Logic\n(ターン/タイマー/判定)"]
        S_Words["themes.json\n(お題100語)"]
        S_Static["Static File Server\n(client/dist)"]
    end

    subgraph Render_Cloud["☁️ Render (本番)"]
        Server
    end

    %% 初期接続
    S_Static -- "HTML/JS/CSS" --> H_UI
    S_Static -- "HTML/JS/CSS" --> G_UI

    %% Socket 通信
    H_Socket <-- "WebSocket" --> S_Socket
    G_Socket <-- "WebSocket" --> S_Socket

    %% サーバー内部
    S_Socket --> S_Room
    S_Socket --> S_Game
    S_Game --> S_Words
    S_Room --> S_Game

    %% ホスト固有
    H_UI --> H_QR
    H_Canvas --> H_Socket

    %% ゲスト固有
    G_Chat --> G_Socket
    G_Canvas -.->|"受信した線を描画"| G_UI
```

---

## 2. ルーム作成〜参加のデータフロー

ホストがルームを作り、ゲストがQRコードで参加するまでの流れです。

```mermaid
sequenceDiagram
    actor Host as 🖥️ ホスト
    participant Server as ⚙️ サーバー
    participant RoomMap as 🗄️ rooms Map
    actor Guest as 📱 ゲスト

    rect rgb(30, 41, 59)
        Note over Host, Guest: Phase A: ルーム作成
        Host->>Server: CREATE_ROOM { playerName }
        Server->>RoomMap: 新規Room生成 (ID: 5桁英数字)
        RoomMap-->>Server: Room オブジェクト
        Server-->>Host: ROOM_CREATED { roomId }
        Host->>Host: QRコード生成 (URL: /?room=ID)
    end

    rect rgb(30, 59, 41)
        Note over Host, Guest: Phase B: ゲスト参加
        Guest->>Guest: QRスキャン → URL開く
        Guest->>Server: JOIN_ROOM { roomId, playerName }
        Server->>RoomMap: players配列に追加<br/>turnOrder末尾に追加
        Server-->>Guest: JOIN_SUCCESS { room全体の状態 }
        Server-->>Host: ROOM_UPDATE { 更新後 players }
    end
```

---

## 3. リアルタイム描画のデータフロー

**最もデータ量が多い通信**です。画家の指/マウスの動きを座標データとして毎フレーム送信します。

```mermaid
flowchart LR
    subgraph Painter["🎨 画家のブラウザ"]
        Touch["マウス/タッチ\nイベント"] --> Normalize["座標を 0~1 に\n正規化"]
        Normalize --> StrokeData["StrokeData\n{fromX, fromY,\ntoX, toY,\ncolor, size, tool}"]
        StrokeData --> LocalDraw["Canvas に\nローカル描画"]
        StrokeData --> Emit["socket.emit\nDRAW_STROKE"]
    end

    subgraph Server["⚙️ サーバー"]
        Receive["socket.on\nDRAW_STROKE"] --> Broadcast["socket.to(roomId)\n.emit\nDRAW_STROKE"]
    end

    subgraph Guesser["👀 回答者のブラウザ"]
        Listen["socket.on\nDRAW_STROKE"] --> Denormalize["座標を実際の\nCanvas サイズに\n復元"]
        Denormalize --> RemoteDraw["Canvas に\n描画反映"]
    end

    Emit --> Receive
    Broadcast --> Listen
```

### 座標の正規化について
```
送信時: fromX = 実際のX座標 / Canvas幅  (0.0 ~ 1.0)
受信時: 実際のX座標 = fromX × Canvas幅
```
> これにより、PCの大画面(800px)で描いた線が、スマホの小画面(360px)でも正しい位置に表示されます。

---

## 4. 回答〜正解判定のデータフロー

回答者のチャット入力がサーバーで判定され、結果が全員に配信される流れです。

```mermaid
flowchart TD
    subgraph Guesser["👀 回答者"]
        Input["チャット入力\n「りんご」"] --> Submit["socket.emit\nSUBMIT_GUESS\n{ text: 'りんご' }"]
    end

    subgraph Server["⚙️ サーバー"]
        Receive["socket.on\nSUBMIT_GUESS"]
        Check1{"送信者は\n画家ではない？"}
        Normalize["テキストを\nひらがなに正規化"]
        Compare{"お題と\n一致？"}
        CalcPoint["ポイント計算\n残り秒数 × 10"]
        SaveCanvas["画家に\nSAVE_CANVAS要求"]

        Receive --> Check1
        Check1 -- "Yes" --> Normalize
        Check1 -- "No (画家)" --> Reject["無視"]
        Normalize --> Compare
    end

    subgraph Results["📤 結果配信"]
        Wrong["CHAT_MESSAGE\n{ name, text }\n→ 全員に表示"]
        Correct["CORRECT_ANSWER\n{ winner, word, points }\n→ 全員に配信"]
        TurnEnd["TURN_END\n→ 次の画家へ"]
    end

    Compare -- "不正解" --> Wrong
    Compare -- "正解！" --> CalcPoint
    CalcPoint --> SaveCanvas
    SaveCanvas --> Correct
    Correct --> TurnEnd
```

---

## 5. ゲーム全体のステート遷移とデータの流れ

ゲームの状態（LOBBY → PLAYING → RESULT）が変わるたびに、どんなデータが生成・消費されるかを示します。

```mermaid
stateDiagram-v2
    [*] --> LOBBY

    state LOBBY {
        direction LR
        [*] --> 待機中
        待機中 --> 待機中 : ROOM_UPDATE\n(プレイヤー増減)
        待機中 --> 待機中 : KICK_PLAYER\n(強制退出)
    }

    LOBBY --> PLAYING : START_GAME\n{totalRounds}

    state PLAYING {
        direction LR
        [*] --> ターン開始

        state ターン開始 {
            direction TB
            s1[お題選出] --> s2[YOUR_WORD → 画家]
            s2 --> s3[GAME_STARTED → 全員]
            s3 --> s4[タイマー開始 100s]
        }

        ターン開始 --> 描画中 : TIMER_TICK\n(毎秒)

        state 描画中 {
            direction TB
            d1[DRAW_STROKE\n画家→サーバー→全員]
            d2[SUBMIT_GUESS\n回答者→サーバー]
            d3[CHAT_MESSAGE\n不正解→全員]
        }

        描画中 --> ターン終了 : 正解 or\nタイムアウト

        state ターン終了 {
            direction TB
            e1[CORRECT_ANSWER\nor TURN_END]
            e2[SAVE_CANVAS\n画像保存]
            e3[次の画家を選定]
        }

        ターン終了 --> ターン開始 : 次のターン
    }

    PLAYING --> RESULT : 全周回完了\nGAME_END

    state RESULT {
        direction LR
        r1[rankings: 順位一覧]
        r2[gallery: 全イラスト]
    }

    RESULT --> LOBBY : もう一度遊ぶ
    RESULT --> [*] : 退出
```

---

## 6. キック（強制退出）のデータフロー

```mermaid
flowchart TD
    subgraph Host["🖥️ ホスト"]
        Click["❌ キックボタン\nクリック"] --> KickEmit["socket.emit\nKICK_PLAYER\n{ roomId, targetId }"]
    end

    subgraph Server["⚙️ サーバー"]
        KickReceive["socket.on\nKICK_PLAYER"]
        AuthCheck{"socket.id\n=== room.hostId？"}
        Remove["players から削除\nturnOrder から削除"]
        IsPainter{"キック対象は\n現在の画家？"}
        SkipTurn["ターンスキップ\n→ 次の画家へ"]

        KickReceive --> AuthCheck
        AuthCheck -- "Yes" --> Remove
        AuthCheck -- "No" --> Reject2["拒否（何もしない）"]
        Remove --> IsPainter
        IsPainter -- "Yes" --> SkipTurn
        IsPainter -- "No" --> Update["ROOM_UPDATE\n全員に配信"]
        SkipTurn --> Update
    end

    subgraph Kicked["🚫 キックされた人"]
        KickedNotify["KICKED 受信\n→「退出されました」\n画面表示"]
    end

    KickEmit --> KickReceive
    Remove --> KickedNotify
```

---

## 7. デプロイ時のデータフロー

```mermaid
flowchart LR
    subgraph Dev["💻 開発環境"]
        Code["ソースコード"] --> Git["Git Push"]
    end

    subgraph Render["☁️ Render"]
        Build["npm run install:all\n&& npm run build:all"]
        Start["npm start\n(node server/index.js)"]
        Static["Express が\nclient/dist を配信"]
        WS["Socket.io が\nWebSocket を処理"]

        Git --> Build
        Build --> Start
        Start --> Static
        Start --> WS
    end

    subgraph Users["🌍 ユーザー"]
        PC["PC ブラウザ"]
        Phone["スマホ ブラウザ"]
    end

    Static -- "HTML/JS/CSS\n(HTTPS)" --> PC
    Static -- "HTML/JS/CSS\n(HTTPS)" --> Phone
    WS <-- "WebSocket\n(WSS)" --> PC
    WS <-- "WebSocket\n(WSS)" --> Phone
```
