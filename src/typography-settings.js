"use strict";

// Native Obsidian UI; local presentation only. No remote fonts, provider calls,
// DOM recording or changes to translated/copied/full-document text.
function createTypographyModalClass({ Modal, typography: T, t, renderPreview, setIcon }) {
  let sequence = 0;
  return class TypographyModal extends Modal {
    constructor(app, plugin, surface = "popup", afterClose = null) {
      super(app);
      this.plugin = plugin;
      this.surface = T.SURFACES.includes(surface) ? surface : "popup";
      this.role = "target";
      this.uid = "mini-typography-" + (++sequence);
      this.sections = {};
      this.queue = Promise.resolve();
      this.revision = 0;
      this.alive = false;
      this.saveState = "ready";
      this.afterClose = afterClose;
    }
    onOpen() {
      this.alive = true;
      this.modalEl?.classList.add("mini-typography-modal");
      this.contentEl.classList.add("mini-typography-settings");
      this.draw();
    }
    onClose() { this.alive = false; this.afterClose?.(); }
    async persist() {
      const revision = ++this.revision;
      this.saveState = "saving"; this.updateStatus();
      this.plugin.refreshTypography?.();
      this.preview();
      this.updateSummary?.();
      // Serialize disk writes. A late result must never replace the newest status.
      const save = this.queue.catch(() => {}).then(() => this.plugin.saveData(this.plugin.settings));
      this.queue = save;
      try {
        await save;
        if (this.alive && revision === this.revision) {
          this.saveState = "saved"; this.updateStatus();
        }
      } catch (error) {
        if (this.alive && revision === this.revision) {
          this.saveState = "save_failed";
          this.saveError = error?.message || String(error);
          this.updateStatus();
        }
      }
    }
    change(role, key, value) {
      T.updateTypography(this.plugin.settings, this.surface, role, { [key]: value });
      if (this.preset) this.preset.value = "";
      return this.persist();
    }
    action(parent, text, run, cls = "mini-typography-quiet") {
      const button = parent.createEl("button", { text, cls });
      button.type = "button"; button.onclick = run;
      return button;
    }
    icon(parent, name) {
      const span = parent.createSpan({ cls: "mini-typography-icon" });
      span.setAttribute("aria-hidden", "true");
      setIcon?.(span, name);
      return span;
    }
    tablist(parent, values, selected, run, kind) {
      const list = parent.createDiv({ cls: "mini-typography-tabs mini-typography-" + kind + "-tabs" });
      list.setAttribute("role", "tablist");
      list.setAttribute("aria-label", t("typography." + kind + "_tabs"));
      const buttons = [];
      for (const value of values) {
        const activate = () => { run(value); };
        const button = this.action(list, t("typography.tab_" + value), activate);
        button.id = this.uid + "-" + kind + "-" + value;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", this.uid + "-" + kind + "-panel");
        button.setAttribute("aria-selected", String(value === selected));
        button.tabIndex = value === selected ? 0 : -1;
        button.onkeydown = event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const index = values.indexOf(value);
          const next = event.key === "Home" ? 0 : event.key === "End" ? values.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + values.length) % values.length;
          run(values[next]);
          (kind === "surface" ? this.tabs : this.roleTabs)[next].focus();
        };
        buttons.push(button);
      }
      return buttons;
    }
    draw() {
      const c = this.contentEl; c.empty();
      const header = c.createDiv({ cls: "mini-typography-header" });
      const heading = header.createDiv();
      const title = heading.createEl("h2", { text: t("typography.panel_title") });
      title.id = this.uid + "-title";
      this.modalEl?.setAttribute("aria-labelledby", title.id);
      heading.createDiv({ cls: "mini-typography-subtitle", text: t("typography.subtitle") });
      const close = this.action(header, "", () => this.close(), "mini-typography-quiet mini-typography-close");
      close.setAttribute("aria-label", t("common.close")); this.icon(close, "x");
      const navigation = c.createDiv({ cls: "mini-typography-navigation" });
      this.tabs = this.tablist(navigation, T.SURFACES, this.surface, value => {
        this.surface = value; this.draw();
        this.tabs[T.SURFACES.indexOf(value)].focus();
      }, "surface");
      const other = this.surface === "popup" ? "sidebar" : "popup";
      const sync = this.action(navigation, t("typography.sync_to", { target: t("typography." + other) }), async () => {
        T.copyTypography(this.plugin.settings, this.surface, other);
        await this.persist();
      });
      sync.classList.add("mini-typography-sync");
      sync.title = t("typography.sync_note"); this.icon(sync, "arrow-right");
      const workspace = c.createDiv({ cls: "mini-typography-workspace" });
      workspace.id = this.uid + "-surface-panel";
      workspace.setAttribute("role", "tabpanel");
      workspace.setAttribute("aria-labelledby", this.uid + "-surface-" + this.surface);
      this.editor = workspace.createDiv({ cls: "mini-typography-editor" });
      this.drawEditor();
      this.previewPane = workspace.createDiv({ cls: "mini-typography-preview-pane" });
      this.drawPreview();
      const footer = c.createDiv({ cls: "mini-typography-footer" });
      const reset = this.action(footer, t("typography.reset"), async () => {
        T.resetTypography(this.plugin.settings, this.surface);
        this.drawEditor(); await this.persist();
      });
      reset.title = t("typography.reset_scope", { target: t("typography." + this.surface) });
      this.status = footer.createDiv({ cls: "mini-typography-status" });
      this.status.setAttribute("role", "status"); this.status.setAttribute("aria-live", "polite");
      this.retry = this.action(footer, t("typography.retry_save"), () => this.persist());
      this.action(footer, t("typography.done"), () => this.close(), "mod-cta mini-typography-done");
      this.updateStatus();
    }
    updateStatus() {
      if (!this.status) return;
      this.status.setText(t("typography." + this.saveState, { message: this.saveError || "" }));
      this.status.dataset.state = this.saveState;
      this.retry.hidden = this.saveState !== "save_failed";
    }
    drawEditor() {
      this.editor.empty();
      const top = this.editor.createDiv({ cls: "mini-typography-editor-top" });
      this.roleTabs = this.tablist(top, T.ROLES, this.role, value => {
        this.role = value; this.drawEditor();
        this.roleTabs[T.ROLES.indexOf(value)].focus();
      }, "role");
      const preset = this.preset = top.createEl("select", { cls: "mini-typography-preset" });
      preset.setAttribute("aria-label", t("typography.preset"));
      for (const [id, key] of [["", "custom_preset"], ["compact", "compact"], ["comfortable", "comfortable"], ["paper", "paper"]]) {
        preset.createEl("option", { text: t("typography." + key), attr: { value: id } });
      }
      preset.value = "";
      preset.onchange = async () => {
        if (!preset.value) return;
        const selected = preset.value;
        T.presetTypography(this.plugin.settings, this.surface, selected);
        this.drawEditor(); this.preset.value = selected; await this.persist();
      };
      const panel = this.editor.createDiv({ cls: "mini-typography-role-panel" });
      panel.id = this.uid + "-role-panel";
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", this.uid + "-role-" + this.role);
      const key = this.surface + "/" + this.role;
      const state = this.sections[key] || (this.sections[key] = { common: true, more: false });
      const section = (name, label) => {
        const details = panel.createEl("details", { cls: "mini-typography-section mini-typography-section-" + name });
        details.open = state[name];
        const summary = details.createEl("summary");
        const chevron = this.icon(summary, details.open ? "chevron-up" : "chevron-down");
        summary.createSpan({ text: t("typography." + label) });
        const hint = summary.createSpan({ cls: "mini-typography-summary-hint" });
        details.ontoggle = () => {
          state[name] = details.open;
          setIcon?.(chevron, details.open ? "chevron-up" : "chevron-down");
        };
        return { details, hint, body: details.createDiv({ cls: "mini-typography-section-body" }) };
      };
      const common = section("common", "common_options");
      const more = section("more", "more_options");
      more.hint.setText(t("typography.more_hint"));
      // Keep common/advanced accordions independent. Both can be open, with only
      // this left-hand pane scrolling; the preview and footer never disappear.
      const current = T.readTypography(this.plugin.settings)[this.surface][this.role];
      const font = common.body.createDiv({ cls: "mini-typography-font-grid" });
      this.fontField(font, this.role, current);
      this.numberField(font, "fontSize", this.role, current);
      const emphasis = common.body.createDiv({ cls: "mini-typography-emphasis" });
      this.enumField(emphasis, "weight", this.role, current, true);
      this.emphasisFields(emphasis, this.role, current);
      common.body.createDiv({ cls: "mini-typography-group-title", text: t("typography.paragraph") });
      const paragraph = common.body.createDiv({ cls: "mini-typography-grid" });
      for (const field of ["lineHeight", "paragraphSpacing", "firstLineIndent"]) this.numberField(paragraph, field, this.role, current);
      this.enumField(paragraph, "alignment", this.role, current);
      const advanced = more.body.createDiv({ cls: "mini-typography-grid" });
      for (const field of ["letterSpacing", "wordSpacing", "spaceAfter", "opacity"]) this.numberField(advanced, field, this.role, current);
      for (const field of ["color", "background"]) this.colorField(advanced, field, this.role, current);
      more.body.createDiv({ cls: "mini-typography-help", text: t("typography.local_note") });
      const policy = panel.createDiv({ cls: "mini-typography-policy" });
      if (this.surface === "popup") {
        const label = policy.createEl("label", { text: t("typography.follow_resize") });
        const toggle = policy.createEl("input", { type: "checkbox", cls: "mini-typography-toggle" });
        toggle.id = this.uid + "-follow-resize"; label.htmlFor = toggle.id;
        toggle.setAttribute("role", "switch"); toggle.title = t("settings.popup_font_follow_desc");
        toggle.checked = !!this.plugin.settings.popupFontFollowResize;
        toggle.onchange = async () => {
          this.plugin.settings.popupFontFollowResize = toggle.checked;
          this.plugin._popupFontScale = 1;
          this.plugin._popupFontResizeBase = this.plugin._popupFontLastSize = null;
          this.plugin.settings.popupLastFontScale = 1;
          await this.persist();
        };
      } else policy.createSpan({ text: t("typography.sidebar_independent") });
      this.updateSummary = () => {
        const value = T.readTypography(this.plugin.settings)[this.surface][this.role];
        common.hint.setText([value.fontSize ? value.fontSize + " px" : t("typography.inherit"),
          value.lineHeight == null ? "" : value.lineHeight + " ×"].filter(Boolean).join(" · "));
      };
      this.updateSummary();
    }
    field(parent, key, role, hideLabel = false) {
      const box = parent.createDiv({ cls: "mini-typography-field" + (hideLabel ? " mini-typography-label-hidden" : "") });
      const label = box.createEl("label", { text: t("typography.label_" + key) });
      const controls = box.createDiv({ cls: "mini-typography-inputs" });
      const id = this.uid + "-field-" + (++sequence);
      label.htmlFor = id; box.dataset.role = role; box.dataset.field = key;
      return { box, controls, id, label };
    }
    numberField(parent, key, role, current) {
      const { controls, id } = this.field(parent, key, role);
      const factor = key === "opacity" ? 100 : 1;
      const [lo, hi, increment, unit] = T.NUMBER_FIELDS[key];
      const min = Math.round(lo * factor * 1000) / 1000, max = hi * factor, step = increment * factor;
      const input = controls.createEl("input", { type: "number" });
      input.id = id; input.min = String(min); input.max = String(max); input.step = String(step);
      input.placeholder = t("typography.inherit");
      const value = current[key];
      input.value = value == null || key === "fontSize" && !value ? "" : String(Math.round(value * factor * 1000) / 1000);
      input.title = t("typography.number_range", { min, max, step });
      const suffix = key === "opacity" ? "%" : key === "lineHeight" ? t("typography.multiple")
        : key === "firstLineIndent" ? "em" : unit;
      if (suffix) controls.createSpan({ cls: "mini-typography-unit", text: suffix });
      input.onchange = async () => {
        const raw = input.value.trim(), number = Number(raw);
        if (input.validity?.badInput || raw && (!Number.isFinite(number) || number < min || number > max ||
          Math.abs((number - min) / step - Math.round((number - min) / step)) > 0.000001)) {
          input.setCustomValidity(t("typography.number_range", { min, max, step })); return;
        }
        input.setCustomValidity("");
        await this.change(role, key, raw ? number / factor : key === "fontSize" ? 0 : null);
      };
    }
    enumField(parent, key, role, current, hideLabel = false) {
      const { controls, id } = this.field(parent, key, role, hideLabel);
      const select = controls.createEl("select"); select.id = id;
      for (const value of T.ENUM_FIELDS[key]) select.createEl("option", { text: t("typography.option_" + value), attr: { value } });
      select.value = current[key];
      select.onchange = () => this.change(role, key, select.value);
    }
    emphasisFields(parent, role, current) {
      const style = this.field(parent, "fontStyle", role, true);
      const decoration = this.field(parent, "decoration", role, true);
      const italic = this.action(style.controls, "I", () => {
        const value = T.readTypography(this.plugin.settings)[this.surface][role].fontStyle;
        return update({ fontStyle: value === "italic" ? "normal" : "italic" });
      }, "mini-typography-quiet mini-typography-italic");
      italic.id = style.id; italic.setAttribute("aria-label", t("typography.option_italic"));
      const under = this.action(decoration.controls, "U", () => toggleDecoration("underline"), "mini-typography-quiet mini-typography-underline");
      under.id = decoration.id; under.setAttribute("aria-label", t("typography.option_underline"));
      const strike = this.action(decoration.controls, "S", () => toggleDecoration("line-through"), "mini-typography-quiet mini-typography-strike");
      strike.setAttribute("aria-label", t("typography.option_line-through"));
      const restore = this.action(parent, "", () => update({ fontStyle: "auto", decoration: "auto" }), "mini-typography-quiet mini-typography-emphasis-reset");
      restore.setAttribute("aria-label", t("typography.inherit_emphasis")); restore.title = t("typography.inherit_emphasis");
      this.icon(restore, "rotate-ccw");
      const sync = () => {
        const value = T.readTypography(this.plugin.settings)[this.surface][role];
        italic.setAttribute("aria-pressed", String(value.fontStyle === "italic"));
        under.setAttribute("aria-pressed", String(value.decoration === "underline"));
        strike.setAttribute("aria-pressed", String(value.decoration === "line-through"));
        restore.hidden = value.fontStyle === "auto" && value.decoration === "auto";
      };
      const update = patch => {
        T.updateTypography(this.plugin.settings, this.surface, role, patch);
        this.preset.value = ""; sync(); return this.persist();
      };
      const toggleDecoration = kind => {
        const value = T.readTypography(this.plugin.settings)[this.surface][role].decoration;
        return update({ decoration: value === kind ? "none" : kind });
      };
      sync();
    }
    fontField(parent, role, current) {
      const { controls, id } = this.field(parent, "fontFamily", role);
      const dropdown = controls.createEl("select"); dropdown.id = id;
      for (const [value, label] of T.FONT_OPTIONS) dropdown.createEl("option", {
        text: ["default", "interface", "text", "serif", "sans", "mono"].includes(label) ? t("typography.font_" + label) : label,
        attr: { value },
      });
      dropdown.createEl("option", { text: t("typography.font_custom"), attr: { value: "@custom" } });
      const custom = controls.createEl("input", { type: "text" });
      custom.setAttribute("aria-label", t("typography.custom_font"));
      custom.placeholder = t("typography.custom_font_hint"); custom.title = custom.placeholder; custom.maxLength = 240;
      const known = T.FONT_OPTIONS.some(p => p[0] === current.fontFamily);
      dropdown.value = known ? current.fontFamily : "@custom";
      custom.value = known ? "" : current.fontFamily; custom.hidden = known;
      dropdown.onchange = async () => {
        custom.hidden = dropdown.value !== "@custom";
        if (!custom.hidden) { custom.focus(); return; }
        custom.setCustomValidity(""); await this.change(role, "fontFamily", dropdown.value);
      };
      custom.onchange = async () => {
        const raw = custom.value.trim(), value = T.fontFamily(raw);
        if (raw && (!value || raw.startsWith("@"))) { custom.setCustomValidity(t("typography.invalid_font")); return; }
        custom.setCustomValidity(""); await this.change(role, "fontFamily", value);
      };
    }
    colorField(parent, key, role, current) {
      const { controls, id } = this.field(parent, key, role);
      const input = controls.createEl("input", { type: "text" }); input.id = id;
      input.placeholder = t("typography." + (key === "background" ? "no_background" : "theme_color"));
      input.value = current[key]; input.maxLength = 7;
      const picker = controls.createEl("input", { type: "color" });
      picker.setAttribute("aria-label", t("typography." + key));
      const pickerColor = value => value.length === 4 ? "#" + value.slice(1).split("").map(c => c + c).join("") : value || "#808080";
      picker.value = pickerColor(current[key]);
      input.onchange = async () => {
        const raw = input.value.trim(), value = T.color(raw);
        if (raw && !value) { input.setCustomValidity(t("typography.invalid_color")); return; }
        input.setCustomValidity(""); picker.value = pickerColor(value);
        await this.change(role, key, value);
      };
      picker.onchange = async () => { input.value = picker.value; input.setCustomValidity(""); await this.change(role, key, picker.value); };
    }
    drawPreview() {
      this.previewPane.empty();
      const heading = this.previewPane.createDiv({ cls: "mini-typography-preview-heading" });
      heading.createSpan({ text: t("typography.preview") });
      heading.createSpan({ text: t("typography.actual_size"), cls: "mini-typography-help" });
      const card = this.previewPane.createDiv({ cls: "mini-typography-preview-card" });
      const header = card.createDiv({ cls: "mini-typography-preview-header" });
      header.setAttribute("aria-hidden", "true");
      if (this.surface === "popup") {
        header.createSpan({ text: t("typography.preview_header"), cls: "mini-typography-preview-caption" });
        const tools = header.createDiv({ cls: "mini-typography-preview-actions" });
        tools.createSpan({ text: t("common.copy") }); this.icon(tools, "lock"); this.icon(tools, "x");
      } else {
        header.classList.add("mini-typography-preview-sidebar");
        const languages = header.createDiv();
        languages.createSpan({ text: t("typography.preview_auto"), cls: "mini-typography-preview-select" });
        languages.createSpan({ text: "→" });
        languages.createSpan({ text: t("typography.preview_language"), cls: "mini-typography-preview-select" });
        const providers = header.createDiv();
        providers.createSpan({ text: t("typography.preview_provider"), cls: "mini-typography-preview-select" });
        providers.createSpan({ text: t("typography.preview_dictionary"), cls: "mini-typography-preview-select" });
      }
      this.previewEl = card.createDiv({ cls: "mini-typography-preview" });
      this.previewEl.setAttribute("aria-label", t("typography.preview"));
      // Render trusted local sample through the existing paragraph/MathJax path
      // once per surface. Changing a control only changes CSS variables.
      renderPreview(this.previewEl);
      const note = this.previewPane.createDiv({ cls: "mini-typography-preview-note" });
      note.createDiv({ text: t("typography.sample_note") });
      note.createDiv({ text: t("typography.display_note") });
      this.preview();
    }
    preview() {
      if (this.previewEl) T.applyTypography(this.previewEl, this.plugin.settings, this.surface, { preview: true });
    }
  };
}
module.exports = { createTypographyModalClass };
