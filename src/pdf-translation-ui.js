"use strict";

// Host dependencies are injected so both modal flows can be tested offline.
function createTranslationModals({ Modal, t, parsePageRange, pageRangeErrorMessage,
  createPdfFilePicker, extractDocBlocks, getPdfDocForFile, fmtTok, languageQualityNotice }) {
  const release = doc => { try { Promise.resolve(doc.destroy?.()).catch(() => {}); } catch (_) {} };
  const statsText = info => t("pages.stats", { count: info.selectedPages.length,
    total: info.pages, blocks: info.transN, tokens: fmtTok(info.tokensEst) });

  class FullTranslateModal extends Modal {
    constructor(app, plugin, info) {
      super(app); this.plugin = plugin; this.original = info; this.version = 0;
      this.active = false; this.chain = Promise.resolve(); this.info = null;
    }
    onOpen() {
      this.active = true;
      this.contentEl.addClass("mini-pdf-confirm");
      this.contentEl.createEl("h3", { text: t("full.confirm_title") });
      this.contentEl.createDiv({ text: t("full.document", { file: this.original.fileName, pages: this.original.doc.numPages }) });
      const row = this.contentEl.createDiv({ cls: "mini-pdf-range-controls" });
      const label = row.createEl("label"); label.createSpan({ text: t("pages.scope") });
      this.mode = label.createEl("select");
      this.mode.createEl("option", { text: t("pages.all"), attr: { value: "all" } });
      this.mode.createEl("option", { text: t("pages.custom"), attr: { value: "custom" } });
      this.mode.value = "all";
      this.range = row.createEl("input", { type: "text", attr: {
        placeholder: "1-3, 7, 10-12", "aria-label": t("pages.label") } });
      this.range.hidden = true;
      this.contentEl.createDiv({ cls: "mini-pdf-hint", text: t("pages.hint") });
      this.status = this.contentEl.createDiv({ cls: "mini-pick-summary", attr: { "aria-live": "polite" } });
      this.details = this.contentEl.createDiv({ cls: "mini-pdf-confirm-details" });
      const quality = languageQualityNotice(this.plugin.settings.sourceLanguage, this.plugin.settings.targetLanguage);
      if (quality) this.contentEl.createDiv({ cls: "mini-language-settings-notice", text: quality });
      const buttons = this.contentEl.createDiv({ cls: "mini-pdf-buttons" });
      const cancel = buttons.createEl("button", { text: t("common.cancel") }); cancel.onclick = () => this.close();
      this.start = buttons.createEl("button", { cls: "mod-cta", text: t("full.start") });
      this.start.onclick = () => {
        if (this.start.disabled || !this.info || !this.plugin.ensureLlmForFull()) return;
        const info = this.info; this.close();
        void this.plugin.runFullTranslate(info).catch(e => this.plugin.reportFullTranslateFailure(e, info));
      };
      this.mode.onchange = () => { this.range.hidden = this.mode.value !== "custom"; this.schedule(); };
      this.range.oninput = () => this.schedule();
      this.schedule();
    }
    schedule() {
      const version = ++this.version;
      this.info = null; this.start.disabled = true; this.details.empty();
      let selection;
      try {
        if (this.mode.value === "custom" && !this.range.value.trim()) throw Object.assign(new Error(), { code: "syntax" });
        selection = parsePageRange(this.mode.value === "all" ? "" : this.range.value, this.original.doc.numPages);
      } catch (e) {
        this.range.setAttribute("aria-invalid", "true"); this.status.setText(pageRangeErrorMessage(e, t)); return;
      }
      this.range.setAttribute("aria-invalid", "false"); this.status.setText(t("full.calculating"));
      this.chain = this.chain.catch(() => {}).then(async () => {
        const stale = () => !this.active || version !== this.version;
        if (stale()) return;
        try {
          const result = await extractDocBlocks(this.original.doc, null, selection.pages, stale);
          if (stale()) return;
          const info = this.plugin.buildDocInfo({ name: this.original.fileName, path: this.original.pdfPath }, result.blocks,
            { totalPages: this.original.doc.numPages, selectedPages: selection.pages });
          info.doc = this.original.doc; info.blocks = result.blocks;
          if (!info.chars) throw new Error(t("pages.no_text"));
          this.info = info; this.status.setText(statsText(info));
          for (const text of [t("full.requests", { tokens: fmtTok(info.tokensEst), requests: info.chunks }),
            t("full.provider", { source: info.source }), t("full.eta", { eta: info.eta }),
            this.plugin.settings.fullHtml ? t("full.output_html") : t("full.output_markdown")])
            this.details.createDiv({ text });
          this.start.disabled = false;
        } catch (e) { if (!stale()) this.status.setText(String(e.message || e)); }
      });
    }
    onClose() { this.active = false; ++this.version; this.contentEl.empty(); }
  }

  class FilePickTranslateModal extends Modal {
    constructor(app, plugin) {
      super(app); this.plugin = plugin; this.selected = new Set(); this.ranges = new Map();
      this.docs = new Map(); this.owned = new Set(); this.stats = new Map();
      this.errors = new Map(); this.pending = new Set(); this.versions = new Map();
      this.chain = Promise.resolve(); this.active = false; this.transferred = new Set();
    }
    onOpen() {
      this.active = true;
      this.modalEl?.addClass("mini-pdf-picker-modal");
      this.contentEl.addClass("mini-pdf-picker-content");
      this.contentEl.createEl("h3", { text: t("full.pick_title") });
      const files = this.plugin.app.vault.getFiles().filter(f => f.extension.toLowerCase() === "pdf");
      this.files = new Map(files.map(f => [f.path, f]));
      this.plugin._pdfPickerUiState ||= {};
      this.ui = createPdfFilePicker(this.contentEl, { files, t, state: this.plugin._pdfPickerUiState,
        onSelectionChange: chosen => this.select(chosen),
        onRangeChange: (file, range) => { this.ranges.set(file.path, range); this.queue(file); },
        onRetry: file => this.queue(file), onStart: () => this.startJobs(), onCancel: () => this.close() });
      this.refresh();
    }
    select(files) {
      const next = new Set(files.map(f => f.path));
      for (const p of this.selected) if (!next.has(p)) { this.versions.set(p, (this.versions.get(p) || 0) + 1); this.pending.delete(p); }
      const old = this.selected; this.selected = next;
      for (const file of files) if (!old.has(file.path) && !this.stats.has(file.path)) this.queue(file);
      this.refresh();
    }
    queue(file) {
      if (!this.active || !this.selected.has(file.path)) return;
      const p = file.path, version = (this.versions.get(p) || 0) + 1;
      this.versions.set(p, version); this.stats.delete(p); this.errors.delete(p); this.pending.add(p); this.refresh();
      this.chain = this.chain.catch(() => {}).then(async () => {
        const stale = () => !this.active || !this.selected.has(p) || this.versions.get(p) !== version;
        try {
          if (stale()) return;
          let doc = this.docs.get(p);
          if (!doc) {
            const loaded = await getPdfDocForFile(this.plugin, file); doc = loaded.doc;
            if (!this.active) { if (loaded.owned) release(doc); return; }
            this.docs.set(p, doc); if (loaded.owned) this.owned.add(p);
          }
          if (stale()) return;
          let selection;
          try { selection = parsePageRange(this.ranges.get(p) || "", doc.numPages); }
          catch (e) { throw new Error(pageRangeErrorMessage(e, t)); }
          const result = await extractDocBlocks(doc, null, selection.pages, stale);
          if (stale()) return;
          const info = this.plugin.buildDocInfo(file, result.blocks, { totalPages: doc.numPages, selectedPages: selection.pages });
          if (!info.chars) throw new Error(t("pages.no_text"));
          this.stats.set(p, { info, blocks: result.blocks });
        } catch (e) { if (!stale()) this.errors.set(p, String(e.message || e)); }
        finally { if (this.versions.get(p) === version) this.pending.delete(p); this.refresh(); }
      });
    }
    refresh() {
      if (!this.active || !this.ui) return;
      let tokens = 0, ready = 0;
      for (const p of this.selected) {
        const stat = this.stats.get(p), error = this.errors.get(p), busy = this.pending.has(p);
        if (stat && !busy && !error) { tokens += stat.info.tokensEst; ready++; }
        this.ui.updateFile(p, { text: busy ? t("full.calculating") : error || (stat ? statsText(stat.info) : ""),
          invalid: !!error, retry: !!error });
      }
      const pending = [...this.pending].filter(p => this.selected.has(p)).length;
      const errors = [...this.errors.keys()].filter(p => this.selected.has(p)).length;
      this.ui.setSummary([t("full.selected_files", { count: this.selected.size }),
        `≈${fmtTok(tokens)} tokens`, pending ? t("full.calculating_count", { count: pending }) : "",
        errors ? t("picker.error_count", { count: errors }) : ""].filter(Boolean).join(" · "),
        ready > 0 && ready === this.selected.size && !pending && !errors);
    }
    startJobs() {
      if (!this.active || this.ui.start.disabled || !this.plugin.ensureLlmForFull()) return;
      const jobs = [...this.selected].map(p => ({ file: this.files.get(p), doc: this.docs.get(p),
        blocks: this.stats.get(p).blocks, pageNumbers: this.stats.get(p).info.selectedPages,
        ownedDoc: this.owned.has(p) }));
      for (const job of jobs) this.transferred.add(job.file.path);
      this.close();
      void this.plugin.runPickedTranslate(jobs).catch(e => this.plugin.reportFullTranslateFailure(e));
    }
    onClose() {
      this.active = false; this.ui?.destroy();
      for (const p of this.owned) if (!this.transferred.has(p)) release(this.docs.get(p));
      this.docs.clear(); this.owned.clear(); this.contentEl.empty();
    }
  }
  return { FullTranslateModal, FilePickTranslateModal };
}

module.exports = { createTranslationModals };
