# Chat Backend — MySQL + Firestore + Socket.IO

A 1:1 chat backend in **Node.js + TypeScript (strict)**.

- **MySQL**: users and chats (who is in which chat)
- **Firebase Firestore**: messages, read receipts, last-seen pointers
- **Socket.IO**: real-time delivery of new messages, read receipts and last-seen updates

---

## Project structure

```
chat_app/
├── docker-compose.yml              # local MySQL 8.4
├── README.md
└── server/
    ├── db/
    │   ├── migrations/             # schema (users, chats)
    │   └── seed/                   # 3 test users
    ├── src/
    │   ├── configs/                # env validation, MySQL pool, Firebase, logger
    │   ├── models/                 # data access: SQL queries + Firestore collections
    │   ├── services/               # business rules (shared by REST and sockets)
    │   ├── controllers/            # HTTP in/out
    │   ├── routes/                 # URL -> controller
    │   ├── middlewares/            # error handler, 404
    │   ├── sockets/                # Socket.IO setup, handshake, event handlers
    │   ├── helpers/                # AppError, zod schemas, async wrapper, domain events
    │   ├── scripts/                # SQL migration/seed runner
    │   ├── types/                  # shared response types
    │   └── index.ts                # entry point
    ├── example.env
    ├── Dockerfile
    ├── package.json
    └── tsconfig.json
```

Request flow: `route → controller (validate with zod) → service (rules) → model (MySQL / Firestore)`.
Socket events call the **same services** as the REST endpoints.

---

## Setup

### Prerequisites
- Node.js 20+
- Docker (for MySQL), or any MySQL 8.0.16+ server
- A Firebase project with Firestore enabled, **or** the Firestore emulator

### 1. Start MySQL
```bash
docker compose up -d
```

### 2. Configure environment
```bash
cd server
cp example.env .env
npm install
```

**Firestore — choose one:**

- **Real Firebase project:** Firebase Console → create a project → *Build → Firestore Database → Create database*.
  Then *Project settings → Service accounts → Generate new private key*, save the file as
  `server/firebase-service-account.json` (it is git-ignored) and set `FIREBASE_PROJECT_ID` in `.env`.
- **Emulator:** `npm i -g firebase-tools` (needs Java 11+), run
  `firebase emulators:start --only firestore --project demo-chat`, and in `.env` set
  `FIREBASE_PROJECT_ID=demo-chat` and `FIRESTORE_EMULATOR_HOST=localhost:8081` (use the port the emulator prints).

### 3. Create tables and test users
```bash
npm run db:migrate
npm run db:seed
```

Seeded users:

| Name    | id                                     |
|---------|----------------------------------------|
| Alice   | `11111111-1111-4111-8111-111111111111` |
| Bob     | `22222222-2222-4222-8222-222222222222` |
| Charlie | `33333333-3333-4333-8333-333333333333` |

### 4. Run
```bash
npm run start:dev      # development, auto-restart
# or
npm run build && npm start
```
Server: `http://localhost:8080` (health check: `GET /health`).

---

## REST API

All bodies are JSON. Errors always look like:
```json
{ "error": { "message": "Validation failed", "details": { "senderId": ["must be a valid UUID"] } } }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input (bad UUID, empty text, same user twice, malformed JSON) |
| 403 | User is not a member of the chat, or edits/deletes someone else's message |
| 404 | User, chat or message not found |
| 409 | Editing a message that has been deleted |

### 1. Create or get chat — `POST /chat/create`
```bash
curl -X POST localhost:8080/chat/create -H "Content-Type: application/json" \
  -d '{"userAId":"11111111-1111-4111-8111-111111111111","userBId":"22222222-2222-4222-8222-222222222222"}'
```
`201` if created, `200` if it already existed (same `chatId` either way, in any user order):
```json
{ "chatId": "9b2f…", "created": true,
  "chat": { "id": "9b2f…", "memberIds": ["1111…", "2222…"], "createdAt": "2026-10-20T09:30:00.000Z" } }
```

### 2. Send message — `POST /chat/:chatId/message/send`
```bash
curl -X POST localhost:8080/chat/<chatId>/message/send -H "Content-Type: application/json" \
  -d '{"senderId":"11111111-1111-4111-8111-111111111111","text":"Hi Bob!"}'
```
```json
{ "message": { "id": "Xk3…", "chatId": "9b2f…", "senderId": "1111…", "text": "Hi Bob!",
               "createdAt": "2026-10-20T09:31:00.123Z",
               "readBy": { "1111…": "2026-10-20T09:31:00.123Z" },
               "editedAt": null, "deletedAt": null } }
```
`text`: 1–2000 characters (trimmed). Sender must be a member of the chat.
The sender is marked as having read their own message, so "has user X read it?" is always `readBy[X]`.

### 3. Get messages — `GET /chat/:chatId/messages?limit=50&before=<messageId>`
Returns the latest `limit` messages (default 50, max 100), **ordered oldest → newest**.
To load older history, pass `before=<nextCursor>`.
```json
{ "messages": [
    { "id": "…", "text": "Hi Bob!", "createdAt": "…", "readBy": { "1111…": "…", "2222…": "…" },
      "editedAt": null, "deletedAt": null },
    { "id": "…", "text": "", "createdAt": "…", "readBy": { "2222…": "…" },
      "editedAt": null, "deletedAt": "…" }
  ],
  "nextCursor": "Ab1…" }
```
`nextCursor` is `null` when there are no older messages.
Deleted messages stay in the list with empty `text` and `deletedAt` set; edited ones have `editedAt` set.

### 4. Mark message read — `POST /chat/:chatId/message/:messageId/read`
```bash
curl -X POST localhost:8080/chat/<chatId>/message/<messageId>/read -H "Content-Type: application/json" \
  -d '{"userId":"22222222-2222-4222-8222-222222222222"}'
```
Returns the updated message. Idempotent: the first read time is kept. The sender is already in `readBy`, so marking your own message is a no-op.
To show "seen" ticks, check `readBy` for the **other** member's id.

### Edit message — `POST /chat/:chatId/message/:messageId/edit`
```bash
curl -X POST localhost:8080/chat/<chatId>/message/<messageId>/edit -H "Content-Type: application/json" \
  -d '{"userId":"11111111-1111-4111-8111-111111111111","text":"Hi Bob! (fixed typo)"}'
```
Returns the updated message with `editedAt` set. Only the sender can edit (`403` otherwise); a deleted message can't be edited (`409`).

### Delete message — `POST /chat/:chatId/message/:messageId/delete`
```bash
curl -X POST localhost:8080/chat/<chatId>/message/<messageId>/delete -H "Content-Type: application/json" \
  -d '{"userId":"11111111-1111-4111-8111-111111111111"}'
```
Soft delete: the text is erased and `deletedAt` is set, but the message keeps its place in the history
(clients show "This message was deleted"). Only the sender can delete (`403` otherwise). Deleting twice is a no-op.

### 5. Update last seen — `POST /chat/:chatId/lastseen`
```bash
curl -X POST localhost:8080/chat/<chatId>/lastseen -H "Content-Type: application/json" \
  -d '{"userId":"22222222-2222-4222-8222-222222222222","messageId":"<messageId>"}'
```
```json
{ "lastSeen": { "chatId": "…", "userId": "2222…", "messageId": "Xk3…", "updatedAt": "…" }, "updated": true }
```
Only moves forward: a message older than the current last-seen one returns `updated: false` and the current value.

### 6. List user chats — `GET /user/:userId/chats`
```json
{ "chats": [ { "id": "9b2f…", "memberIds": ["1111…", "2222…"], "createdAt": "…" } ] }
```
Newest chat first.

### Extra (for testing) — `POST /user/create`
`{ "name": "Dave" }` → `201 { "user": { "id": "…", "name": "Dave", "createdAt": "…" } }`

---

## Socket.IO

Connect with the user id in the handshake:
```js
import { io } from "socket.io-client";
const socket = io("http://localhost:8080", { auth: { userId: "11111111-1111-4111-8111-111111111111" } });
```
Unknown or invalid user ids are rejected (`connect_error`). The user id is taken from the handshake, never from event payloads.

### Client → server
Each event takes a payload and an optional acknowledgement callback, which receives
`{ ok: true, data }` or `{ ok: false, error: { message, details? } }`.

| Event | Payload | Ack data |
|---|---|---|
| `chat:join` | `{ chatId }` | `{ chatId }` — must be a member |
| `chat:leave` | `{ chatId }` | `{ chatId }` |
| `message:send` | `{ chatId, text }` | the created message |
| `message:read` | `{ chatId, messageId }` | the updated message |
| `message:edit` | `{ chatId, messageId, text }` | the edited message |
| `message:delete` | `{ chatId, messageId }` | the deleted message |
| `lastseen:update` | `{ chatId, messageId }` | `{ lastSeen, updated }` |

```js
socket.emit("chat:join", { chatId }, (res) => console.log(res));
socket.emit("message:send", { chatId, text: "Hello" }, (res) => console.log(res));
```

### Server → client
| Event | Sent to | Payload |
|---|---|---|
| `message:new` | everyone who joined the chat | message |
| `message:edited` | everyone who joined the chat | message (new text, `editedAt`) |
| `message:deleted` | everyone who joined the chat | message (empty text, `deletedAt`) |
| `message:read` | everyone who joined the chat | `{ chatId, messageId, userId, readAt }` |
| `lastseen:updated` | everyone who joined the chat | `{ chatId, userId, messageId, updatedAt }` |
| `chat:created` | both members (all their connected devices) | chat |

These fire whether the action came through REST or through a socket.

### Demo
With the server running, `npm run demo:socket` connects Alice and Bob, has them join their chat, sends
messages over both the socket and REST, marks a message read, updates last seen, shows Bob being refused
when he tries to delete Alice's message, then has Alice edit and delete it, and prints every event each
user receives.

---

## Data model

**MySQL**
```
users (id CHAR(36) PK, name, created_at)
chats (id CHAR(36) PK, user_low_id FK, user_high_id FK, created_at,
       UNIQUE(user_low_id, user_high_id), CHECK(user_low_id < user_high_id))
```

**Firestore**
```
chats/{chatId}/messages/{messageId}  { senderId, text, createdAt, readBy: { userId: Timestamp },
                                       editedAt?, deletedAt? }
chats/{chatId}/lastSeen/{userId}     { messageId, messageCreatedAt, updatedAt }
```
