// Shareable session links: the room id lives in a `room` query param.
export function parseRoomFromUrl(url) {
  const room = new URL(url).searchParams.get('room');
  return room ? room : null;
}

export function buildShareableLink(baseUrl, roomId) {
  const link = new URL(baseUrl);
  link.searchParams.set('room', roomId);
  return link.toString();
}
