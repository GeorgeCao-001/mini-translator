"use strict";

// Per-popup state only: no persisted settings, provider requests or global listeners.
function createPopupLockControl(header, { t, setIcon, onChange }) {
  const button = header.createEl("button", { cls: "mini-popup-lock" });
  button.type = "button";
  let locked = false;
  let active = true;

  function render() {
    const label = t(locked ? "translation.unlock_popup" : "translation.lock_popup");
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(locked));
    button.title = label;
    setIcon(button, locked ? "lock" : "lock-open");
  }
  function setLocked(value) {
    if (!active) return;
    const next = !!value;
    if (next === locked) return;
    locked = next;
    render();
    onChange?.(locked);
  }

  // Header mousedown normally starts dragging; controls must not drag the popup.
  button.onmousedown = event => event.stopPropagation();
  button.onclick = event => { event.stopPropagation(); setLocked(!locked); };
  render();

  return {
    buttonEl: button,
    get locked() { return locked; },
    setLocked,
    destroy() {
      active = false;
      button.onclick = null;
      button.onmousedown = null;
      button.remove();
    },
  };
}

// Used for both first display and in-place replacement, so stale results,
// flow classes and scroll offsets cannot leak into the next selection.
function resetPopupContent(body, { text, pending, t }) {
  body.replaceChildren();
  body.classList.remove("mini-flow");
  body.scrollTop = 0;
  body.scrollLeft = 0;
  if (!pending) {
    body.setText(text);
    return null;
  }
  const spin = body.createSpan();
  spin.style.cssText =
    "display:inline-block;width:14px;height:14px;border:2px solid var(--background-modifier-border);border-top-color:var(--interactive-accent);border-radius:50%;margin-right:8px;vertical-align:-2px;";
  spin.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
    { duration: 700, iterations: Infinity }
  );
  const label = body.createSpan({ text: t("translation.in_progress") });
  label.style.color = "var(--text-muted)";
  return label;
}

module.exports = { createPopupLockControl, resetPopupContent };
