"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const PlanningPoker = require("../app.js");

test("generateRoomId produces ids that pass isValidRoomId", () => {
  for (let i = 0; i < 20; i++) {
    const id = PlanningPoker.generateRoomId();
    assert.equal(PlanningPoker.isValidRoomId(id), true, id);
  }
});

test("isValidRoomId accepts the documented example and rejects bad formats", () => {
  assert.equal(PlanningPoker.isValidRoomId("xk29-4plm"), true);
  assert.equal(PlanningPoker.isValidRoomId("abcd"), true);
  assert.equal(PlanningPoker.isValidRoomId(""), false);
  assert.equal(PlanningPoker.isValidRoomId("ABCD"), false); // must be lowercase
  assert.equal(PlanningPoker.isValidRoomId("abc"), false); // segment too short
  assert.equal(PlanningPoker.isValidRoomId("-abcd"), false); // leading dash
  assert.equal(PlanningPoker.isValidRoomId("abcd--efgh"), false); // double dash
  assert.equal(PlanningPoker.isValidRoomId(null), false);
});

test("getRoomIdFromSearch reads the room query param", () => {
  assert.equal(PlanningPoker.getRoomIdFromSearch("?room=xk29-4plm"), "xk29-4plm");
  assert.equal(PlanningPoker.getRoomIdFromSearch("?other=1"), null);
  assert.equal(PlanningPoker.getRoomIdFromSearch(""), null);
  assert.equal(PlanningPoker.getRoomIdFromSearch("?room="), null);
});

test("buildShareUrl composes the join link", () => {
  const url = PlanningPoker.buildShareUrl("xk29-4plm", "https://example.com", "/");
  assert.equal(url, "https://example.com/?room=xk29-4plm");
});

test("validateDisplayName enforces the 1-32 trimmed character rule (AC03)", () => {
  assert.deepEqual(PlanningPoker.validateDisplayName("  "), {
    valid: false,
    error: "Enter a display name to join.",
  });
  assert.deepEqual(PlanningPoker.validateDisplayName("a".repeat(33)), {
    valid: false,
    error: "Display name must be 32 characters or fewer.",
  });
  assert.deepEqual(PlanningPoker.validateDisplayName("  Alice  "), {
    valid: true,
    name: "Alice",
  });
  assert.equal(PlanningPoker.validateDisplayName("a".repeat(32)).valid, true);
});

test("buildSocketUrl includes room and name, and deck only when provided", () => {
  const url = PlanningPoker.buildSocketUrl("xk29-4plm", "Alice");
  assert.equal(url.startsWith(PlanningPoker.WS_BASE_URL + "?"), true);
  assert.match(url, /room=xk29-4plm/);
  assert.match(url, /name=Alice/);
  assert.doesNotMatch(url, /deck=/);

  const withDeck = PlanningPoker.buildSocketUrl("xk29-4plm", "Alice", "fibonacci");
  assert.match(withDeck, /deck=fibonacci/);
});

test("computeDisplayNames disambiguates repeated names in join order (AC06)", () => {
  const labels = PlanningPoker.computeDisplayNames([
    { id: "u1", name: "Alice" },
    { id: "u2", name: "Bob" },
    { id: "u3", name: "Alice" },
    { id: "u4", name: "Alice" },
  ]);
  assert.deepEqual(labels, {
    u1: "Alice",
    u2: "Bob",
    u3: "Alice (2)",
    u4: "Alice (3)",
  });
});

test("computeRoster marks the current user and the host (AC05)", () => {
  const rows = PlanningPoker.computeRoster(
    [
      { id: "host-1", name: "Alice", hasVoted: true },
      { id: "user-2", name: "Bob", hasVoted: false },
    ],
    "host-1",
    "user-2",
  );
  assert.deepEqual(rows, [
    { id: "host-1", label: "Alice", hasVoted: true, isYou: false, isHost: true },
    { id: "user-2", label: "Bob", hasVoted: false, isYou: true, isHost: false },
  ]);
});

test("classifyDisconnect distinguishes a failed join from a dropped connection", () => {
  assert.equal(PlanningPoker.classifyDisconnect(false), "join-failed"); // AC08
  assert.equal(PlanningPoker.classifyDisconnect(true), "reconnecting"); // AC09
});

test("reconnectDelayMs waits longer after a server shutdown close", () => {
  const shutdownDelay = PlanningPoker.reconnectDelayMs(PlanningPoker.SERVER_SHUTDOWN_CLOSE_CODE);
  const otherDelay = PlanningPoker.reconnectDelayMs(1006);
  assert.ok(shutdownDelay > otherDelay);
});
