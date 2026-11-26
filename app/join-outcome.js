// Distinguishes a first join from a rejoin after a lost connection (AC10):
// the backend treats a reconnect as a brand-new user with no prior vote.
export function describeJoinOutcome({ isReconnect }) {
  return isReconnect ? "You've rejoined as a new participant." : null;
}
