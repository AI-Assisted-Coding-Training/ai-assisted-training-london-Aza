// Join failure messaging. Browsers can't read the HTTP status behind a failed
// WebSocket upgrade, so a malformed link is caught locally; anything else
// (full room, unreachable backend, etc.) shares one generic message.
import { isValidRoomId } from './room.js';

export function describeJoinFailure(roomId) {
  if (!isValidRoomId(roomId)) {
    return 'This session link is invalid.';
  }
  return "Couldn't join this session. It may be full or no longer available.";
}
