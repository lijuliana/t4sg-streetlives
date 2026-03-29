import type { MatrixClient } from "matrix-js-sdk";

/**
 * Ensures the Matrix client has joined the given room.
 *
 * After the initial sync completes (inside getMatrixClient), any room the
 * backend has already added the guest to will appear in client.getRoom().
 * If the room is already present this is a fast no-op.
 *
 * If the room is not yet in the sync state (e.g. the backend sent the invite
 * just before this session started), we attempt an explicit join. This covers
 * the case where the invite arrived in a prior sync window that the current
 * guest device hasn't seen yet.
 *
 * This is the seam for future room-loading logic: history pagination, read
 * receipts, member list fetching, etc. should all live here.
 */
export async function ensureRoomJoined(
  client: MatrixClient,
  roomId: string,
): Promise<void> {
  const room = client.getRoom(roomId);
  // Room is in sync state AND the client has fully joined (not just invited).
  if (room?.getMyMembership() === "join") return;

  console.log("[roomManager] Not yet joined, attempting join:", roomId);
  await client.joinRoom(roomId);
  console.log("[roomManager] Joined room:", roomId);
}
