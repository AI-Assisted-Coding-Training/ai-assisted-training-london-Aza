// Reconnect delay after an unexpected WebSocket close.
const SERVER_SHUTDOWN_CLOSE_CODE = 1001;
const SERVER_SHUTDOWN_DELAY_MS = 3000;
const DEFAULT_DELAY_MS = 2000;

export function reconnectDelayMs(closeCode) {
  return closeCode === SERVER_SHUTDOWN_CLOSE_CODE ? SERVER_SHUTDOWN_DELAY_MS : DEFAULT_DELAY_MS;
}
