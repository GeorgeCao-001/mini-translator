"use strict";

const assert = require("assert/strict");
const {
  attemptOrder,
  moveSource,
  normalizeEnabled,
  normalizeOrder,
  setSourceEnabled,
} = require("../src/source-order.js");

const sources = ["A", "B", "C", "D"];

assert.deepEqual(normalizeOrder(null, sources), sources);
assert.deepEqual(normalizeOrder(["C", "C", "unknown", "A"], sources), ["C", "A", "B", "D"]);
assert.deepEqual(normalizeEnabled(null, sources), sources);
assert.deepEqual(normalizeEnabled([], sources), []);
assert.deepEqual(normalizeEnabled(["D", "D", "unknown", "B"], sources), ["B", "D"]);

assert.deepEqual(attemptOrder("B", ["D", "C", "A", "B"], ["D", "A"], sources), ["B", "D", "A"]);
assert.deepEqual(attemptOrder("model-profile", ["D", "C", "B", "A"], ["C"], sources), ["C"]);
assert.deepEqual(attemptOrder("A", sources, [], sources), ["A"], "Selected source survives disabling all fallbacks");
assert.deepEqual(moveSource(["A", "B", "C", "D"], "C", -1, sources), ["A", "C", "B", "D"]);
assert.deepEqual(moveSource(sources, "A", -1, sources), sources);
assert.deepEqual(moveSource(sources, "D", 1, sources), sources);
assert.deepEqual(setSourceEnabled(null, "B", false, sources), ["A", "C", "D"]);
assert.deepEqual(setSourceEnabled([], "B", true, sources), ["B"]);

console.log("PASS source order normalization, primary choice, fallback eligibility, and reordering");
