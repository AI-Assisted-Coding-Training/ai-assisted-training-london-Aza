// Builds a display-ready roster from a `state` broadcast (docs/api-contract.md).
function suffixFor(id) {
  return id.slice(-4);
}

export function buildRoster(ownUserId, state) {
  const nameCounts = new Map();
  for (const user of state.users) {
    nameCounts.set(user.name, (nameCounts.get(user.name) ?? 0) + 1);
  }

  return state.users.map((user) => ({
    id: user.id,
    name: user.name,
    displayLabel: nameCounts.get(user.name) > 1 ? `${user.name} #${suffixFor(user.id)}` : user.name,
    isMe: user.id === ownUserId,
    isHost: user.id === state.hostId,
    hasVoted: user.hasVoted,
  }));
}
