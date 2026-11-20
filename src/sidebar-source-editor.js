"use strict";

function createSidebarSourceEditor(container, { t, setIcon, translate, showResult, copyResult, onModeChange }) {
  const root = container.createDiv({ cls: "mini-sidebar-source-editor" });
  const heading = root.createDiv({ cls: "mini-sidebar-source-heading" });
  heading.createSpan({ text: t("panel.source_title") });
  const toolbar = heading.createDiv({ cls: "mini-sidebar-source-toolbar" });
  const inlineActions = toolbar.createDiv();
  const tools = toolbar.createDiv({ cls: "mini-sidebar-source-tools" });
  function toolButton(cls, key, icon) {
    const label = t(key);
    const button = tools.createEl("button", { cls: cls + " clickable-icon" });
    button.type = "button";
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
    setIcon(button, icon);
    return button;
  }
  const edit = toolButton("mini-sidebar-source-edit", "panel.edit_source", "pencil");
  const copy = toolButton("mini-sidebar-source-copy", "panel.copy_translation", "copy");
  copy.onclick = () => active && hasResult ? copyResult() : undefined;
  const home = root.createDiv({ cls: "mini-sidebar-source-input-home" });
  const form = home.createDiv({ cls: "mini-sidebar-source-form" });
  const input = form.createEl("textarea");
  input.rows = 2;
  input.dir = "auto";
  input.placeholder = t("panel.source_placeholder");
  input.setAttribute("aria-label", t("panel.source_title"));
  const measure = form.createDiv({ cls: "mini-sidebar-source-measure" });
  measure.dir = "auto";
  measure.setAttribute("aria-hidden", "true");
  const actions = home.createDiv({ cls: "mini-sidebar-source-actions" });
  const submit = actions.createEl("button", { text: t("panel.translate_input"), cls: "mod-cta" });
  const cancel = actions.createEl("button", { text: t("common.cancel") });
  for (const b of [submit, cancel]) b.type = "button";
  const status = root.createDiv({ cls: "mini-sidebar-source-status" });
  status.setAttribute("role", "status");

  let editing = true, hasResult = false, previousSource = "", runId = 0, busy = false, active = true;
  let sourceSlot = null, mountedSlot = null, previewNodes = [];
  const place = (node, parent) => { if (node.parentNode !== parent) parent.appendChild(node); };
  function mountEditor(slot) {
    if (slot === mountedSlot) return;
    if (mountedSlot) {
      place(form, home);
      mountedSlot.replaceChildren(...previewNodes);
      mountedSlot.setAttribute("data-inline-source-editing", "false");
      previewNodes = [];
    }
    mountedSlot = slot;
    if (slot) {
      previewNodes = Array.from(slot.childNodes);
      slot.replaceChildren(form);
      slot.setAttribute("data-inline-source-editing", "true");
    }
  }
  const update = () => {
    const slot = editing ? sourceSlot : null;
    mountEditor(slot);
    // The invisible copy defines the inline height from the draft, not the old
    // preview. The final character preserves the height of an empty last line.
    if (slot) measure.textContent = input.value + "\u200b";
    place(actions, slot ? inlineActions : home);
    tools.hidden = !hasResult;
    form.hidden = !editing;
    actions.hidden = !editing;
    cancel.hidden = !hasResult;
    edit.setAttribute("aria-pressed", String(editing && hasResult));
    submit.disabled = busy || !input.value.trim();
    submit.textContent = t(busy ? "translation.in_progress" : "panel.translate_input");
    form.setAttribute("aria-busy", String(busy));
    onModeChange(editing, hasResult);
  };
  function accept(pairs, firstSource) {
    sourceSlot = firstSource || null;
    sourceSlot?.setAttribute("data-inline-source-editing", "false");
    ++runId;
    busy = false;
    hasResult = true;
    previousSource = pairs.map(pair => pair.en || "").join("\n\n");
    input.value = "";
    status.textContent = "";
    editing = false;
    update();
  }
  edit.onclick = () => {
    if (!active) return;
    if (!editing) {
      editing = true;
      input.value = previousSource;
      status.textContent = "";
      update();
    }
    input.focus({ preventScroll: true });
  };
  cancel.onclick = () => {
    if (!active || !hasResult) return;
    ++runId;
    busy = false;
    editing = false;
    input.value = "";
    status.textContent = "";
    update();
    edit.focus();
  };
  function onInput() {
    if (!active) return;
    ++runId;
    busy = false;
    status.textContent = "";
    update();
  }
  input.oninput = onInput;
  async function run() {
    if (!active || !editing || busy) return;
    const text = input.value;
    if (!text.trim()) return;
    const id = ++runId;
    busy = true;
    status.textContent = "";
    update();
    let result;
    try {
      result = await translate(text, () => active && id === runId);
    } catch (_) {
      if (active && id === runId) {
        busy = false;
        status.textContent = t("panel.input_failed");
        update();
      }
      return;
    }
    if (!active || id !== runId) return;
    showResult(result);
    edit.focus();
  }
  submit.onclick = run;
  input.onkeydown = event => {
    if (!active || event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (event.shiftKey) {
      input.setRangeText("\n\n", input.selectionStart, input.selectionEnd, "end");
      onInput();
      return;
    }
    return run();
  };
  update();
  return {
    accept,
    canAcceptExternal: () => active && (!editing || (!hasResult && !busy && !input.value.trim())),
    destroy() { active = false; ++runId; },
  };
}

// Only explicit newlines from the manual editor are structural. An inline or
// display formula is kept together even when its LaTeX spans several lines.
async function translateWithLineBreaks(text, { mathPattern, translate, format, stillCurrent = () => true }) {
  const input = text.replace(/\r\n?/g, "\n");
  const pattern = new RegExp(mathPattern.source + "|\n(?:[ \\t]*\n)*", "g");
  const parts = [], breaks = [];
  let cursor = 0;
  for (const match of input.matchAll(pattern)) {
    if (!match[0].startsWith("\n")) continue;
    parts.push(input.slice(cursor, match.index));
    breaks.push(match[0].replace(/[ \t]/g, ""));
    cursor = match.index + match[0].length;
  }
  parts.push(input.slice(cursor));

  const join = (chunks) => chunks.map((chunk, i) => chunk + (breaks[i] || "")).join("");
  const first = parts.findIndex(part => part.trim());
  if (first < 0) return { text: input, via: "", detectedLanguage: "" };
  let last = parts.length - 1;
  while (last > first && !parts[last].trim()) last--;
  const translated = Array(parts.length).fill("");

  if (first === last) {
    const result = await translate(parts[first].trim(), false);
    translated[first] = format(result.text);
    return { ...result, text: join(translated) };
  }

  let salt = 0;
  const upperInput = input.toUpperCase();
  while (upperInput.includes("__MTBR" + salt + "_")) salt++;
  const prefix = "__MTBR" + salt + "_";
  const boundary = new RegExp(prefix + "(\\d+)__", "gi");
  const packed = parts.slice(first, last + 1).map((part, i) =>
    i < last - first ? part + " " + prefix + i + "__ " : part).join("");
  const result = await translate(packed, true);
  const responseParts = result.text.split(boundary);
  const count = last - first;
  if (responseParts.length === count * 2 + 1 &&
      responseParts.every((part, i) => i % 2 === 0
        ? Boolean(part.trim()) && !part.toUpperCase().includes(prefix)
        : part === String((i - 1) / 2))) {
    for (let i = 0; i <= count; i++) translated[first + i] = format(responseParts[i * 2]);
    return { ...result, text: join(translated) };
  }

  // A provider can drop or reorder placeholders. Do not guess which translated
  // words belong on each line; translate the explicit sections individually.
  const sources = new Set();
  let detectedLanguage = "";
  for (let i = first; i <= last; i++) {
    if (!parts[i].trim()) continue;
    if (!stillCurrent()) return result;
    const line = await translate(parts[i].trim(), false);
    translated[i] = format(line.text);
    if (line.via) sources.add(line.via);
    detectedLanguage ||= line.detectedLanguage;
  }
  return { text: join(translated), via: Array.from(sources).join("/"), detectedLanguage };
}

module.exports = { createSidebarSourceEditor, translateWithLineBreaks };
