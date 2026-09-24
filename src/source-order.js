"use strict";

// Keep this independent of Obsidian so saved preferences and fallback behavior
// can be tested without loading the plugin or contacting providers.
function normalizeOrder(saved, available) {
  const known = new Set(available);
  const order = [];
  for (const name of Array.isArray(saved) ? saved : []) {
    if (known.has(name) && !order.includes(name)) order.push(name);
  }
  for (const name of available) {
    if (!order.includes(name)) order.push(name);
  }
  return order;
}

function normalizeEnabled(saved, available) {
  const allowed = new Set(Array.isArray(saved) ? saved : available);
  return available.filter((name) => allowed.has(name));
}

// The explicitly selected built-in source always goes first, even when its
// checkbox is off (the checkbox controls fallback eligibility only).
function attemptOrder(primary, savedOrder, savedEnabled, available) {
  const order = normalizeOrder(savedOrder, available);
  const enabled = new Set(normalizeEnabled(savedEnabled, available));
  return [
    ...(available.includes(primary) ? [primary] : []),
    ...order.filter((name) => name !== primary && enabled.has(name)),
  ];
}

function moveSource(savedOrder, name, delta, available) {
  const order = normalizeOrder(savedOrder, available);
  const from = order.indexOf(name);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return order;
  [order[from], order[to]] = [order[to], order[from]];
  return order;
}

function setSourceEnabled(savedEnabled, name, value, available) {
  const enabled = new Set(normalizeEnabled(savedEnabled, available));
  if (available.includes(name)) {
    if (value) enabled.add(name);
    else enabled.delete(name);
  }
  return available.filter((candidate) => enabled.has(candidate));
}

module.exports = {
  attemptOrder,
  moveSource,
  normalizeEnabled,
  normalizeOrder,
  setSourceEnabled,
};
