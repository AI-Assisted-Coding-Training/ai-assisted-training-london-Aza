// Room id generation and validation for shareable session links.
// Must stay in sync with the backend's required pattern (docs/api-contract.md).
const ROOM_ID_PATTERN = /^[a-z0-9]{4,32}(-[a-z0-9]{4,32})*$/;
const SEGMENT_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SEGMENT_LENGTH = 4;
const SEGMENT_COUNT = 2;

function randomSegment() {
  const bytes = new Uint8Array(SEGMENT_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => SEGMENT_CHARS[byte % SEGMENT_CHARS.length]).join('');
}

export function generateRoomId() {
  return Array.from({ length: SEGMENT_COUNT }, randomSegment).join('-');
}
