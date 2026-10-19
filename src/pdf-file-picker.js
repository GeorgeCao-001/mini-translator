"use strict";

// Native, keyboard-accessible DOM controls. Selection/stat updates never rebuild
// the list or basket: scrolling, focused range inputs and folder state survive.
function createPdfFilePicker(parent, { files, t, state = {}, onSelectionChange,
  onRangeChange, onRetry, onStart, onCancel }) {
  const selected = new Set(), ranges = new Map(), statuses = new Map();
  const openDirs = new Set(state.openDirs || []);
  const rows = new Map(), dirs = new Map(), basketRows = new Map();
  let lastPath = null, selectedOnly = false, disposed = false;
  const el = parent.createDiv({ cls: "mini-pdf-picker" });
  const tools = el.createDiv({ cls: "mini-pdf-picker-tools" });
  const search = tools.createEl("input", { type: "search", attr: {
    placeholder: t("picker.search"), "aria-label": t("picker.search") } });
  const onlyLabel = tools.createEl("label", { cls: "mini-pdf-only" });
  const only = onlyLabel.createEl("input", { type: "checkbox" });
  onlyLabel.createSpan({ text: t("picker.only_selected") });
  const body = el.createDiv({ cls: "mini-pdf-picker-body" });
  const browser = body.createDiv({ cls: "mini-pdf-browser" });
  const actions = browser.createDiv({ cls: "mini-pdf-list-actions" });
  const selectVisible = actions.createEl("button", { text: t("picker.select_visible") });
  const clear = actions.createEl("button", { text: t("picker.clear") });
  const list = browser.createDiv({ cls: "mini-pdf-list", attr: { "aria-label": t("picker.files") } });
  const empty = browser.createDiv({ cls: "mini-empty", text: t("picker.no_match") });
  const basket = body.createDiv({ cls: "mini-pdf-basket" });
  const basketTitle = basket.createDiv({ cls: "mini-pdf-basket-title" });
  basket.createDiv({ cls: "mini-pdf-hint", text: t("pages.hint") });
  const basketList = basket.createDiv({ cls: "mini-pdf-basket-list" });
  const basketEmpty = basketList.createDiv({ cls: "mini-empty", text: t("picker.choose_hint") });
  const footer = el.createDiv({ cls: "mini-pdf-picker-footer" });
  const summary = footer.createDiv({ cls: "mini-pick-summary", attr: { "aria-live": "polite" } });
  const buttons = footer.createDiv({ cls: "mini-pdf-buttons" });
  const cancel = buttons.createEl("button", { text: t("common.cancel") });
  const start = buttons.createEl("button", { text: t("full.start"), cls: "mod-cta" });
  start.disabled = true;
  const byPath = new Map(files.map(f => [f.path, f]));
  const root = { path: "", name: "", dirs: new Map(), files: [], ancestors: [] };
  for (const file of files) {
    let node = root;
    const parts = file.path.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i];
      if (!node.dirs.has(name)) node.dirs.set(name, {
        name, path: parts.slice(0, i + 1).join("/"), dirs: new Map(), files: [],
        ancestors: [...node.ancestors, ...(node.path ? [node.path] : [])],
      });
      node = node.dirs.get(name);
    }
    node.files.push(file);
  }
  const descendants = node => [...node.files, ...[...node.dirs.values()].flatMap(descendants)];
  function refreshVisibility() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const [p, ref] of dirs) ref.el.hidden = !!query || selectedOnly || ref.ancestors.some(a => !openDirs.has(a));
    for (const [p, ref] of rows) {
      ref.el.hidden = (selectedOnly && !selected.has(p)) || (query && !p.toLocaleLowerCase().includes(query)) ||
        (!selectedOnly && !query && ref.ancestors.some(a => !openDirs.has(a)));
      if (!ref.el.hidden) visible++;
    }
    empty.hidden = visible > 0 || (!query && !selectedOnly && dirs.size > 0);
  }
  function statusFor(p) {
    const s = statuses.get(p) || {};
    const row = rows.get(p), item = basketRows.get(p);
    for (const ref of [row, item]) if (ref) ref.stat.setText(s.text || "");
    if (item) {
      item.range.setAttribute("aria-invalid", s.invalid ? "true" : "false");
      item.retry.hidden = !s.retry;
    }
  }
  function refresh() {
    for (const [p, ref] of rows) { ref.check.checked = selected.has(p); ref.el.toggleClass("is-selected", selected.has(p)); }
    for (const ref of dirs.values()) {
      const count = ref.files.filter(f => selected.has(f.path)).length;
      ref.check.checked = count > 0 && count === ref.files.length;
      ref.check.indeterminate = count > 0 && count < ref.files.length;
      ref.name.setText(`${openDirs.has(ref.path) ? "▾" : "▸"} ${ref.label} (${count}/${ref.files.length})`);
      ref.toggle.setAttribute("aria-expanded", String(openDirs.has(ref.path)));
    }
    for (const [p, ref] of basketRows) if (!selected.has(p)) { ref.el.remove(); basketRows.delete(p); }
    for (const p of selected) if (!basketRows.has(p)) {
      const file = byPath.get(p);
      const item = basketList.createDiv({ cls: "mini-pdf-selected-item" });
      const top = item.createDiv({ cls: "mini-pdf-selected-head" });
      top.createSpan({ text: file.name, attr: { title: p } });
      const remove = top.createEl("button", { text: "×", attr: { "aria-label": t("picker.remove", { file: file.name }) } });
      remove.onclick = () => { selected.delete(p); changed(); };
      item.createDiv({ cls: "mini-pdf-path", text: p });
      const label = item.createEl("label", { cls: "mini-pdf-range-label" });
      label.createSpan({ text: t("pages.label") });
      const range = label.createEl("input", { type: "text", attr: { placeholder: t("pages.all_placeholder"), "aria-label": t("pages.for_file", { file: file.name }) } });
      range.value = ranges.get(p) || "";
      range.oninput = () => { ranges.set(p, range.value); onRangeChange?.(file, range.value); };
      const stat = item.createDiv({ cls: "mini-pick-stat", attr: { "aria-live": "polite" } });
      const retry = item.createEl("button", { text: t("picker.retry") }); retry.hidden = true;
      retry.onclick = () => onRetry?.(file);
      basketRows.set(p, { el: item, range, stat, retry }); statusFor(p);
    }
    basketTitle.setText(t("full.selected_files", { count: selected.size }));
    basketEmpty.hidden = selected.size > 0;
    refreshVisibility();
  }
  function changed() { if (disposed) return; refresh(); onSelectionChange?.([...selected].map(p => byPath.get(p))); }
  function choose(file, checked, shift) {
    const visible = [...rows].filter(([, r]) => !r.el.hidden).map(([p]) => p);
    const a = visible.indexOf(lastPath), b = visible.indexOf(file.path);
    const paths = shift && a >= 0 && b >= 0 ? visible.slice(Math.min(a, b), Math.max(a, b) + 1) : [file.path];
    for (const p of paths) checked ? selected.add(p) : selected.delete(p);
    lastPath = file.path; changed();
  }
  function build(node, depth = 0) {
    for (const dir of [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const row = list.createDiv({ cls: "mini-pdf-dir" }); row.style.paddingInlineStart = `${8 + depth * 16}px`;
      const check = row.createEl("input", { type: "checkbox", attr: { "aria-label": t("picker.folder", { folder: dir.path }) } });
      const toggle = row.createEl("button", { cls: "mini-pdf-dir-toggle" });
      const name = toggle.createSpan();
      const ref = { el: row, check, toggle, name, path: dir.path, label: dir.name, ancestors: dir.ancestors, files: descendants(dir) };
      dirs.set(dir.path, ref);
      toggle.onclick = () => { openDirs.has(dir.path) ? openDirs.delete(dir.path) : openDirs.add(dir.path); refresh(); };
      check.onchange = () => { for (const f of ref.files) check.checked ? selected.add(f.path) : selected.delete(f.path); changed(); };
      build(dir, depth + 1);
    }
    for (const file of node.files.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      const row = list.createDiv({ cls: "mini-pick-row" }); row.style.paddingInlineStart = `${8 + depth * 16}px`;
      row.setAttribute("data-path", file.path);
      const check = row.createEl("input", { type: "checkbox", attr: { "aria-label": file.path } });
      check.onclick = ev => { ev.stopPropagation(); choose(file, check.checked, ev.shiftKey); };
      const name = row.createEl("button", { cls: "mini-pdf-file-name", text: file.name, attr: { title: file.path } });
      name.onclick = ev => choose(file, !selected.has(file.path), ev.shiftKey);
      const stat = row.createSpan({ cls: "mini-pick-stat" });
      rows.set(file.path, { el: row, check, name, stat, ancestors: [...node.ancestors, ...(node.path ? [node.path] : [])] });
    }
  }
  build(root);
  let treeScroll = Number(state.scrollTop) || 0;
  search.value = "";
  search.oninput = () => {
    if (!search.dataset.filtered) treeScroll = list.scrollTop;
    const filtered = !!search.value.trim();
    search.dataset.filtered = filtered ? "true" : "";
    refreshVisibility(); list.scrollTop = filtered ? 0 : treeScroll;
  };
  only.onchange = () => { selectedOnly = only.checked; refreshVisibility(); };
  selectVisible.onclick = () => { for (const [p, ref] of rows) if (!ref.el.hidden) selected.add(p); changed(); };
  clear.onclick = () => { selected.clear(); changed(); };
  cancel.onclick = () => onCancel?.(); start.onclick = () => { if (!start.disabled) onStart?.(); };
  refresh(); list.scrollTop = treeScroll;
  return {
    el, search, list, start, summary, rows, dirs, basketRows, selected, ranges,
    updateFile(p, status) { if (disposed) return; statuses.set(p, status); statusFor(p); },
    setSummary(text, enabled) { if (disposed) return; summary.setText(text); start.disabled = !enabled; },
    destroy() { disposed = true; state.openDirs = [...openDirs]; state.scrollTop = search.value.trim() ? treeScroll : list.scrollTop; el.remove(); },
  };
}

module.exports = { createPdfFilePicker };
