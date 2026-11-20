"use strict";

const MAX_QUOTE_LENGTH = 512;

function validPage(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function pdfPageElement(node) {
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  return el?.closest?.(".page[data-page-number]") || null;
}

function nativePdfSelection(value) {
  if (typeof value !== "string" || !/^\d+,\d+,\d+,\d+$/.test(value)) return "";
  const parts = value.split(",").map(Number);
  if (!parts.every(Number.isSafeInteger)) return "";
  const [startIndex, startOffset, endIndex, endOffset] = parts;
  if (startIndex > endIndex || (startIndex === endIndex && startOffset >= endOffset)) return "";
  return parts.join(",");
}

function getQuote(text) {
  return typeof text === "string" ? text.trim().slice(0, MAX_QUOTE_LENGTH) : "";
}

function captureMarkdownSource(file, editor, text) {
  if (file?.extension !== "md" || !file.path) return null;
  const quote = getQuote(text);
  const source = { path: file.path, quote };
  if (!quote || !editor) return source;
  try {
    const from = editor.getCursor("from");
    const raw = editor.getRange(from, editor.getCursor("to"));
    // Only attach editor coordinates if they describe this selection, not an old
    // selection from an inactive editor or a different reading-view document.
    if (raw.trim() === text.trim()) {
      const offset = editor.posToOffset(from) + raw.length - raw.trimStart().length;
      if (Number.isSafeInteger(offset) && offset >= 0) source.offset = offset;
    }
  } catch (_) {}
  return source;
}

function captureDomSource(workspace, node, text, hostNode = node, endNode = null) {
  if (!hostNode) return null;
  for (const type of ["pdf", "markdown"]) {
    const leaves = workspace?.getLeavesOfType?.(type) || [];
    for (const { view } of leaves) {
      const file = view?.file;
      if (!file?.path || !view.containerEl?.contains?.(hostNode)) continue;
      if (type === "markdown") {
        return captureMarkdownSource(file, view.getMode?.() === "preview" ? null : view.editor, text);
      }
      if (file.extension !== "pdf") continue;
      const pageEl = pdfPageElement(node);
      if (pageEl && !view.containerEl.contains(pageEl) &&
          !(hostNode !== node && hostNode?.contentDocument === pageEl.ownerDocument)) continue;
      const page = validPage(pageEl?.getAttribute?.("data-page-number"));
      const source = { path: file.path, page };
      if (page && pdfPageElement(endNode) === pageEl && Number.isFinite(file.stat?.mtime) &&
          Number.isSafeInteger(file.stat?.size)) {
        // This internal helper is optional: older/different host layouts or
        // selections spanning pages still have a stable native page link.
        try {
          const selection = nativePdfSelection(view.viewer?.child?.getTextSelectionRangeStr?.(pageEl));
          if (selection) Object.assign(source, { selection, mtime: file.stat.mtime, size: file.stat.size });
        } catch (_) {}
      }
      return source;
    }
  }
  return null;
}

function resolveSourceFile(vault, entry) {
  const path = entry.locator?.path;
  if (path) {
    const file = vault.getFileByPath(path);
    return file && (file.extension === "md" || file.extension === "pdf")
      ? { file } : { status: "missing" };
  }
  if (!entry.file || typeof entry.file !== "string") return { status: "no_source" };
  const page = validPage(entry.page);
  const files = vault.getFiles().filter(file =>
    (file.extension === "pdf" && file.name === entry.file) ||
    (!page && file.extension === "md" && file.basename === entry.file)
  );
  if (files.length !== 1) return { status: files.length ? "ambiguous" : "missing" };
  return { file: files[0] };
}

// A stored offset is only a hint. If editing has moved the quote, prefer a
// unique literal match; do not pick a random occurrence on displaced duplicates.
function locateQuote(content, quote, offset) {
  if (!quote) return -1;
  if (Number.isSafeInteger(offset) && offset >= 0 && content.startsWith(quote, offset)) return offset;
  const first = content.indexOf(quote);
  if (first < 0 || content.indexOf(quote, first + 1) !== -1) return -1;
  return first;
}

async function openHistorySource(app, entry) {
  const { file, status } = resolveSourceFile(app.vault, entry);
  if (!file) return status;
  const ws = app.workspace;
  const page = validPage(entry.locator?.page ?? entry.page);
  if (file.extension === "pdf" && page && !file.path.includes("#")) {
    const locator = entry.locator;
    const selection = file.stat && locator?.mtime === file.stat.mtime && locator?.size === file.stat.size
      ? nativePdfSelection(locator?.selection) : "";
    const link = file.path + "#page=" + page;
    if (selection) {
      try {
        await ws.openLinkText(link + "&selection=" + selection, "", false);
        return "located";
      } catch (_) {
        // Navigation still works in hosts that reject a native selection.
      }
    }
    await ws.openLinkText(link, "", false);
    return "located";
  }
  const type = file.extension === "md" ? "markdown" : "pdf";
  let leaf = ws.getLeavesOfType(type).find(candidate => candidate.view?.file?.path === file.path);
  if (!leaf) {
    leaf = ws.getLeaf("tab");
    await leaf.openFile(file, { active: true });
  }
  await ws.revealLeaf(leaf);
  if (file.extension !== "md") return "file_only";
  const quote = getQuote(entry.locator?.quote || entry.pairs?.[0]?.en);
  const offset = entry.locator?.offset;
  if (!quote) return "file_only";
  if (leaf.view.getMode?.() === "preview") {
    if (locateQuote(await app.vault.cachedRead(file), quote, offset) < 0) return "file_only";
    const current = leaf.getViewState();
    await leaf.setViewState({ ...current, state: { ...current.state, mode: "source" } });
  }
  const editor = leaf.view.editor;
  if (!editor?.scrollIntoView || !editor?.offsetToPos || !editor?.getValue) return "file_only";
  const start = locateQuote(editor.getValue(), quote, offset);
  if (start < 0) return "file_only";
  // Scroll only: never set a DOM selection that could start auto-translation.
  editor.scrollIntoView({ from: editor.offsetToPos(start), to: editor.offsetToPos(start + quote.length) }, true);
  return "located";
}

function openPluginSettings(app, pluginId) {
  const settings = app?.setting;
  if (!pluginId || typeof settings?.open !== "function" || typeof settings.openTabById !== "function") return false;
  settings.open();
  settings.openTabById(pluginId);
  return true;
}

module.exports = { captureMarkdownSource, captureDomSource, openHistorySource, openPluginSettings };
