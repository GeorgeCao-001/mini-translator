"use strict";

function createSidebarSourceEditor(container, { t, translate, showResult, onModeChange }) {
  const root = container.createDiv({ cls: "mini-sidebar-source-editor" });
  const heading = root.createDiv({ cls: "mini-sidebar-source-heading" });
  heading.createSpan({ text: t("panel.source_title") });
  const edit = heading.createEl("button", { text: t("panel.edit_source"), cls: "mini-sidebar-source-edit" });
  const form = root.createDiv({ cls: "mini-sidebar-source-form" });
  const input = form.createEl("textarea");
  input.rows = 4;
  input.dir = "auto";
  input.placeholder = t("panel.source_placeholder");
  input.setAttribute("aria-label", t("panel.source_title"));
  const actions = form.createDiv({ cls: "mini-sidebar-source-actions" });
  const submit = actions.createEl("button", { text: t("panel.translate_input"), cls: "mod-cta" });
  const cancel = actions.createEl("button", { text: t("common.cancel") });
  for (const b of [edit, submit, cancel]) b.type = "button";
  const status = form.createDiv({ cls: "mini-sidebar-source-status" });
  status.setAttribute("role", "status");

  let editing = true, hasResult = false, previousSource = "", runId = 0, busy = false, active = true;
  const update = () => {
    edit.hidden = editing;
    form.hidden = !editing;
    cancel.hidden = !hasResult;
    submit.disabled = busy || !input.value.trim();
    submit.textContent = t(busy ? "translation.in_progress" : "panel.translate_input");
    form.setAttribute("aria-busy", String(busy));
    onModeChange(editing, hasResult);
  };
  function accept(pairs) {
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
    editing = true;
    input.value = previousSource;
    status.textContent = "";
    update();
    input.focus();
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
  input.oninput = () => {
    if (!active) return;
    ++runId;
    busy = false;
    status.textContent = "";
    update();
  };
  async function run() {
    if (!active || !editing || busy) return;
    const text = input.value.trim();
    if (!text) return;
    const id = ++runId;
    busy = true;
    status.textContent = "";
    update();
    let result;
    try {
      result = await translate(text);
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
    if (!event.isComposing && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      void run();
    }
  };
  update();
  return {
    accept,
    canAcceptExternal: () => active && (!editing || (!hasResult && !busy && !input.value.trim())),
    destroy() { active = false; ++runId; },
  };
}

module.exports = { createSidebarSourceEditor };
