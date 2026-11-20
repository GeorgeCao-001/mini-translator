"use strict";

const LIMIT = 5;

// Reuse existing records. A live result that is also the newest stored
// translation does not count as an earlier entry.
function recentPopupHistory(history, currentPairs) {
  const result = [];
  let first = true;
  for (const entry of Array.isArray(history) ? history : []) {
    const pairs = Array.isArray(entry?.pairs) ? entry.pairs.filter(p =>
      typeof p?.en === "string" && typeof p?.zh === "string" && p.zh.trim()) : [];
    if (!pairs.length) continue;
    const skip = first && pairs.length === currentPairs?.length &&
      pairs.every((p, i) => p.en === currentPairs[i]?.en && p.zh === currentPairs[i]?.zh);
    first = false;
    if (skip) continue;
    result.push({ ...entry, pairs });
    if (result.length === LIMIT) break;
  }
  return result;
}

function createPopupHistoryControl(header, { t, setIcon, older, newer, current }) {
  const group = header.createDiv({ cls: "mini-popup-history-controls" });
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", t("popup_history.label"));
  function create(icon, label, className, activate) {
    const el = group.createEl("button", { cls: className });
    el.type = "button";
    el.setAttribute("aria-label", t(label));
    el.title = t(label);
    setIcon(el, icon);
    el.onmousedown = event => event.stopPropagation();
    el.onclick = event => { event.stopPropagation(); if (!el.disabled) activate(); };
    return el;
  }
  const back = create("undo-2", "popup_history.current", "mini-popup-history-current", current);
  const previous = create("chevron-up", "popup_history.older", "mini-popup-history-older", older);
  const next = create("chevron-down", "popup_history.newer", "mini-popup-history-newer", newer);
  function update(count, index = -1, historyOnly = false) {
    group.hidden = count === 0;
    previous.disabled = index >= count - 1;
    next.disabled = index < 0 || (historyOnly && index === 0);
    back.hidden = index < 0;
    back.disabled = historyOnly && index === 0;
    const label = t(historyOnly ? "popup_history.latest" : "popup_history.current");
    back.setAttribute("aria-label", label);
    back.title = label;
  }
  update(0);
  return { update };
}

module.exports = { recentPopupHistory, createPopupHistoryControl };
