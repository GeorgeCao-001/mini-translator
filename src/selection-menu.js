"use strict";

// Keep menu integration separate from translation: capture the source and its
// geometry BEFORE the menu takes focus, then reuse the existing paragraph flow.
function registerSelectionTranslationMenu(plugin, { Menu, document: doc, t }) {
  const addedMenus = new WeakSet();
  const snapshots = new WeakMap();
  const readingEvents = new WeakSet();
  let active = true;

  function snapshot(info) {
    const text = String(info?.text || "").trim();
    if (!text) return null;
    return {
      text,
      anchor: info.anchor ? { ...info.anchor } : null,
      x: info.x,
      y: info.y,
    };
  }

  function addTranslationItem(menu, selection) {
    if (!active || !selection || addedMenus.has(menu)) return;
    menu.addItem((item) => item
      .setTitle(t("menu.translate_selection"))
      .setIcon("languages")
      .setSection("selection")
      .onClick(() => {
        if (!active) return;
        plugin.cancelAutoTranslate();
        // Obsidian normally hides the menu AFTER invoking its callback. Close
        // it first so it cannot cover the immediate translation feedback.
        menu.hide?.();
        return plugin.translateSelection("paragraph", selection, { immediate: true });
      }));
    addedMenus.add(menu);
  }

  // Public Obsidian event for source mode, Live Preview and embedded editors.
  plugin.registerEvent(plugin.app.workspace.on("editor-menu", (menu, editor, info) => {
    let text;
    try { text = String(editor.getSelection() || "").trim(); }
    catch (_) { return; }
    if (!text) return;
    const root = info?.containerEl || editor.containerEl || null;
    const domInfo = plugin._readDomSelectionInfo(doc.defaultView?.getSelection(), root);
    const anchor = (domInfo?.text === text ? domInfo.anchor : null) ||
      plugin._editorSelectionAnchor(editor) || plugin._lastPointerAnchor(root);
    const selection = snapshot({ text, anchor });
    plugin.cancelAutoTranslate();
    addTranslationItem(menu, selection);
  }));

  // Reading/PDF selection menus do not emit editor-menu in Obsidian 1.13.7.
  // Append to the native Menu immediately before it is shown, but ONLY for the
  // exact contextmenu event captured in a reading/PDF text container. Never
  // replace a core Menu, consume PDF/link events, or change file/tab menus.
  const prototype = Menu?.prototype;
  const originalShow = prototype?.showAtMouseEvent;
  plugin.register(() => {
    active = false;
    // Do not overwrite a wrapper installed by another plugin after this one.
    // If such a wrapper still calls ours, ours is inert after unloading.
    if (prototype?.showAtMouseEvent === showWithTranslation) {
      prototype.showAtMouseEvent = originalShow;
    }
  });
  if (typeof originalShow !== "function") return;

  plugin.registerDomEvent(doc, "contextmenu", (event) => {
    if (!active || event.defaultPrevented) return;
    const target = event.target?.nodeType === 3 ? event.target.parentElement : event.target;
    const root = target?.closest?.(".markdown-preview-view, .pdf-viewer-container");
    if (!root || plugin.popupEl?.contains(target)) return;
    const selection = snapshot(plugin._readDomSelectionInfo(doc.defaultView?.getSelection(), root));
    if (!selection) return;
    snapshots.set(event, selection);
    if (root.matches?.(".markdown-preview-view")) readingEvents.add(event);
    plugin.cancelAutoTranslate();
  }, { capture: true });

  // Plain reading-view text has no Obsidian Menu at all (only Electron's default
  // Copy menu). At the bubbling phase, use the public shared menu API only if no
  // core/link/other-plugin handler has already claimed the event. Retain Copy;
  // links and PDFs continue to use their existing native menus via the adapter.
  if (typeof Menu.forEvent === "function") {
    plugin.registerDomEvent(doc, "contextmenu", (event) => {
      if (!active || event.defaultPrevented || !readingEvents.has(event)) return;
      const selection = snapshots.get(event);
      const menu = Menu.forEvent(event);
      menu.addItem((item) => item
        .setTitle(t("common.copy"))
        .setIcon("copy")
        .setSection("selection")
        .onClick(() => active && doc.defaultView.navigator.clipboard.writeText(selection.text)));
      addTranslationItem(menu, selection);
    });
  }

  function showWithTranslation(event) {
    addTranslationItem(this, snapshots.get(event));
    return originalShow.apply(this, arguments);
  }
  prototype.showAtMouseEvent = showWithTranslation;
}

module.exports = { registerSelectionTranslationMenu };
