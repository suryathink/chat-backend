/**
 * End-to-end demo of the real-time layer. Needs the server running.
 * Usage: npm run demo:socket
 *
 * Alice and Bob connect, join their chat, and exchange events over sockets
 * and REST; every event each of them receives is printed.
 */
import { io, type Socket } from "socket.io-client";
import type { AckResponse } from "../sockets/types";

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:8080";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
};

const connect = (name: string, userId: string): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = io(BASE_URL, { auth: { userId }, reconnection: false });
    for (const event of [
      "chat:created",
      "message:new",
      "message:edited",
      "message:deleted",
      "message:read",
      "lastseen:updated",
    ]) {
      socket.on(event, (payload: unknown) => console.log(`  [${name} received] ${event}`, payload));
    }
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });

const emit = <T>(socket: Socket, event: string, payload: unknown): Promise<AckResponse<T>> =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

const pause = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

const step = (title: string) => console.log(`\n=== ${title}`);

const run = async () => {
  step("Invalid user is rejected at the handshake");
  await connect("Nobody", "not-a-uuid").catch((err: Error) => console.log("  connect_error:", err.message));

  step("Alice and Bob connect");
  const alice = await connect("Alice", ALICE);
  const bob = await connect("Bob", BOB);

  step("New user Dave; chat Bob<->Dave created over REST (Bob gets chat:created)");
  const { user: dave } = await post<{ user: { id: string } }>("/user/create", { name: "Dave" });
  await post("/chat/create", { userAId: BOB, userBId: dave.id });
  await pause();

  step("Both join the Alice<->Bob chat");
  const { chatId } = await post<{ chatId: string }>("/chat/create", { userAId: ALICE, userBId: BOB });
  console.log("  Alice join ack:", await emit(alice, "chat:join", { chatId }));
  console.log("  Bob join ack:", await emit(bob, "chat:join", { chatId }));

  step("Alice sends a message over the socket");
  const sent = await emit<{ id: string }>(alice, "message:send", { chatId, text: "Hello over Socket.IO" });
  console.log("  Alice send ack ok:", sent.ok);
  await pause();

  step("Bob sends a message over REST (socket clients still get message:new)");
  await post(`/chat/${chatId}/message/send`, { senderId: BOB, text: "Hello over REST" });
  await pause();

  if (sent.ok) {
    step("Bob marks Alice's message read and updates last seen (Alice is notified)");
    await emit(bob, "message:read", { chatId, messageId: sent.data.id });
    await emit(bob, "lastseen:update", { chatId, messageId: sent.data.id });
    await pause();

    step("Bob tries to delete Alice's message (only the sender may)");
    console.log("  ", await emit(bob, "message:delete", { chatId, messageId: sent.data.id }));

    step("Alice edits, then deletes her message (Bob is notified of both)");
    await emit(alice, "message:edit", { chatId, messageId: sent.data.id, text: "Hello (edited)" });
    await pause();
    await emit(alice, "message:delete", { chatId, messageId: sent.data.id });
    await pause();

    step("Editing a deleted message is rejected");
    console.log("  ", await emit(alice, "message:edit", { chatId, messageId: sent.data.id, text: "again" }));
  }

  step("Validation errors come back in the ack");
  console.log("  ", await emit(alice, "message:send", { chatId, text: "" }));

  alice.close();
  bob.close();
};

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
