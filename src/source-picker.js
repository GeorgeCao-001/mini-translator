"use strict";

// A compact, draggable replacement for the native source <select>. Native
// <option> elements cannot be reordered reliably across desktop platforms.
let activePicker = null;

function closeActiveSourcePicker() {
  activePicker?.close();
}

function createSourcePicker({
  parent, plugin, kind, document: ownerDocument, getOptions, getBuiltins, providerName, t,
  order, onSelectionChange, onError,
}) {
  const doc = parent.ownerDocument || ownerDocument || document;
  const primaryKey = kind === "translation" ? "primarySource" : "dictSource";
  const orderKey = kind === "translation" ? "translationSourceOrder" : "dictionarySourceOrder";
  const enabledKey = kind === "translation" ? "translationSourceEnabled" : "dictionarySourceEnabled";
  const trigger = doc.createElement("button");
  trigger.type = "button";
  trigger.className = "mini-source-picker-trigger";
  trigger.setAttribute?.("aria-haspopup", "dialog");
  trigger.setAttribute?.("aria-expanded", "false");
  parent.appendChild(trigger);

  let panel = null;
  let dragging = null;
  let busy = false;
  let outsideHandler = null;
  let keyHandler = null;

  const options = () => getOptions();
  const builtins = () => getBuiltins();
  const displayOrder = () => {
    const available = options();
    const saved = order.normalizeOrder(plugin.settings[orderKey], available);
    const selected = plugin.settings[primaryKey];
    return available.includes(selected)
      ? [selected, ...saved.filter((name) => name !== selected)]
      : saved;
  };

  const picker = {
    buttonEl: trigger,
    get panelEl() { return panel; },
    get order() { return displayOrder(); },
    sync() {
      const selected = plugin.settings[primaryKey];
      trigger.textContent = `${providerName(selected) || selected || "—"}  ▾`;
      trigger.title = t("settings.drag_source_hint");
      if (panel) render();
      return picker;
    },
    close() {
      if (!panel) return;
      doc.removeEventListener?.("pointerdown", outsideHandler, true);
      doc.removeEventListener?.("keydown", keyHandler, true);
      panel.remove?.();
      panel = null;
      dragging = null;
      trigger.setAttribute?.("aria-expanded", "false");
      if (activePicker === picker) activePicker = null;
    },
    open() {
      if (panel) return picker;
      closeActiveSourcePicker();
      panel = doc.createElement("div");
      panel.className = "mini-source-picker-panel";
      panel.setAttribute?.("role", "dialog");
      panel.setAttribute?.("aria-label", t("settings.drag_source_hint"));
      doc.body.appendChild(panel);
      activePicker = picker;
      trigger.setAttribute?.("aria-expanded", "true");
      render();
      const rect = trigger.getBoundingClientRect?.() || { left: 12, bottom: 48, top: 12 };
      const width = panel.getBoundingClientRect?.().width || 240;
      const height = panel.getBoundingClientRect?.().height || 360;
      const viewportWidth = doc.defaultView?.innerWidth || 1024;
      const viewportHeight = doc.defaultView?.innerHeight || 768;
      const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));
      const top = rect.bottom + height + 12 <= viewportHeight
        ? rect.bottom + 4
        : Math.max(12, rect.top - height - 4);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      outsideHandler = (event) => {
        if (trigger.contains?.(event.target) || panel?.contains?.(event.target)) return;
        picker.close();
      };
      keyHandler = (event) => {
        if (event.key === "Escape") {
          event.preventDefault?.();
          picker.close();
          trigger.focus?.();
        }
      };
      doc.addEventListener?.("pointerdown", outsideHandler, true);
      doc.addEventListener?.("keydown", keyHandler, true);
      return picker;
    },
    async choose(name) {
      if (!options().includes(name) || busy) return;
      const before = displayOrder();
      const next = [name, ...before.filter((candidate) => candidate !== name)];
      if (await persist(next, plugin.settings[enabledKey])) picker.close();
    },
    async reorder(from, target, after = false) {
      if (busy) return;
      const next = displayOrder();
      if (!next.includes(from) || !next.includes(target) || from === target) return;
      next.splice(next.indexOf(from), 1);
      const index = next.indexOf(target) + (after ? 1 : 0);
      next.splice(index, 0, from);
      if (next.join("\u0000") === displayOrder().join("\u0000")) return;
      await persist(next, plugin.settings[enabledKey]);
    },
    async setEnabled(name, value) {
      if (busy || !builtins().includes(name)) return;
      const enabled = order.setSourceEnabled(plugin.settings[enabledKey], name, value, builtins());
      await persist(displayOrder(), enabled);
    },
  };

  async function persist(nextOrder, nextEnabled) {
    const settings = plugin.settings;
    const oldPrimary = settings[primaryKey];
    const oldOrder = settings[orderKey];
    const oldEnabled = settings[enabledKey];
    busy = true;
    settings[primaryKey] = nextOrder[0];
    settings[orderKey] = nextOrder;
    settings[enabledKey] = nextEnabled;
    try {
      await plugin.saveData(settings);
      plugin.refreshPanel?.();
      onSelectionChange?.();
      return true;
    } catch (error) {
      settings[primaryKey] = oldPrimary;
      settings[orderKey] = oldOrder;
      settings[enabledKey] = oldEnabled;
      onError?.(error);
      return false;
    } finally {
      busy = false;
      picker.sync();
    }
  }

  function make(tag, className, text) {
    const element = doc.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function render() {
    if (!panel) return;
    panel.replaceChildren?.();
    const heading = make("div", "mini-source-picker-heading", t("settings.drag_source_short_hint"));
    panel.appendChild(heading);
    const names = displayOrder();
    const builtinNames = builtins();
    const enabled = new Set(order.normalizeEnabled(plugin.settings[enabledKey], builtinNames));
    for (const [index, name] of names.entries()) {
      const row = make("div", "mini-source-picker-row");
      row.dataset.sourceName = name;
      row.draggable = true;
      row.addEventListener("dragstart", (event) => {
        dragging = name;
        event.dataTransfer?.setData("text/plain", name);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        row.classList.add("is-dragging");
      });
      row.addEventListener("dragend", () => {
        dragging = null;
        row.classList.remove("is-dragging");
      });
      row.addEventListener("dragover", (event) => {
        if (!dragging || dragging === name) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        row.classList.add("is-drop-target");
      });
      row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
      row.addEventListener("drop", async (event) => {
        event.preventDefault();
        row.classList.remove("is-drop-target");
        if (!dragging) return;
        const rect = row.getBoundingClientRect();
        const after = event.clientY >= rect.top + rect.height / 2;
        const from = dragging;
        dragging = null;
        await picker.reorder(from, name, after);
      });

      const grip = make("span", "mini-source-picker-grip", "⋮⋮");
      grip.setAttribute?.("aria-hidden", "true");
      row.appendChild(grip);
      const select = make("button", "mini-source-picker-choice", `${index + 1}. ${providerName(name)}`);
      select.type = "button";
      select.setAttribute?.("aria-label", `${providerName(name)} · ${t("settings.select_source")}`);
      if (index === 0) select.classList.add("is-primary");
      select.addEventListener("click", () => picker.choose(name));
      select.addEventListener("keydown", (event) => {
        if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
        const neighbor = names[index + (event.key === "ArrowUp" ? -1 : 1)];
        if (!neighbor) return;
        event.preventDefault();
        picker.reorder(name, neighbor, event.key === "ArrowDown");
      });
      row.appendChild(select);

      if (builtinNames.includes(name)) {
        const checkbox = make("input", "mini-source-picker-enabled");
        checkbox.type = "checkbox";
        checkbox.checked = enabled.has(name);
        checkbox.title = t("settings.fallback_toggle_hint");
        checkbox.setAttribute?.("aria-label", `${providerName(name)} · ${t("settings.fallback_toggle_hint")}`);
        checkbox.addEventListener("change", () => picker.setEnabled(name, checkbox.checked));
        row.appendChild(checkbox);
      } else {
        const badge = make("span", "mini-source-picker-model-badge", t("settings.model_primary_only"));
        row.appendChild(badge);
      }
      panel.appendChild(row);
    }
  }

  trigger.addEventListener("click", () => panel ? picker.close() : picker.open());
  picker.sync();
  return picker;
}

module.exports = { createSourcePicker, closeActiveSourcePicker };
