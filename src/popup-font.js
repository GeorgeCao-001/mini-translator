"use strict";

// Popup body typography is independent of window limits and translation layout.
// Only explicit native resizing changes its scale; content reflow must not.
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 40;
const FONT_SCALE_MIN = 0.6;
const FONT_SCALE_MAX = 2.4;
const round = (value) => Math.round(value * 1000) / 1000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normalizePopupFontSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return 0; // follow Obsidian
  return Math.round(clamp(size, FONT_SIZE_MIN, FONT_SIZE_MAX));
}

function normalizePopupFontScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0
    ? round(clamp(scale, FONT_SCALE_MIN, FONT_SCALE_MAX))
    : 1;
}

function resizePopupFontScale(baseSize, nextSize, baseScale = 1) {
  const values = [baseSize?.width, baseSize?.height, nextSize?.width, nextSize?.height].map(Number);
  const scale = normalizePopupFontScale(baseScale);
  if (!values.every((value) => Number.isFinite(value) && value > 0)) return scale;
  const [width, height, nextWidth, nextHeight] = values;
  // Both dimensions count. Doubling both doubles the text, whereas changing
  // only one dimension has a gentler effect. A fixed gesture baseline prevents
  // compounding/rounding drift and returns to 1× when resized back to baseline.
  const next = scale * Math.sqrt((nextWidth / width) * (nextHeight / height));
  return round(clamp(next, FONT_SCALE_MIN, FONT_SCALE_MAX));
}

function readPopupResizeSize(el) {
  const rect = el.getBoundingClientRect();
  const inline = (value, fallback) => /^\d+(?:\.\d+)?px$/.test(value || "")
    ? Number.parseFloat(value) : Number(fallback);
  return { width: inline(el.style.width, rect.width), height: inline(el.style.height, rect.height) };
}

function popupFontStyles(settings = {}, { scale = 1, textBoost = 0, smallTextBoost = 0 } = {}) {
  const factor = settings.popupFontFollowResize ? normalizePopupFontScale(scale) : 1;
  const css = (size, variable, boost) => {
    const custom = normalizePopupFontSize(size);
    if (custom) return `${round(clamp(custom * factor, 8, 72))}px`;
    const extra = Number.isFinite(Number(boost)) ? round(Math.max(0, Number(boost))) : 0;
    if (factor === 1) return extra ? `calc(var(${variable}) + ${extra}px)` : `var(${variable})`;
    return `clamp(8px, calc((var(${variable}) + ${extra}px) * ${factor}), 72px)`;
  };
  return {
    source: css(settings.popupSourceFontSize, "--font-smaller", smallTextBoost),
    target: css(settings.popupTargetFontSize, "--font-text-size", textBoost),
    scale: factor,
  };
}

function addPopupFontSettings(container, { Setting, plugin, t, refreshPopup }) {
  const setting = new Setting(container)
    .setName(t("settings.popup_fonts"))
    .setDesc(t("settings.popup_font_desc", { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX }));
  setting.settingEl.addClass("mini-popup-font-setting");
  for (const [key, labelKey, nameKey] of [
    ["popupSourceFontSize", "settings.popup_source_label", "settings.popup_source_font"],
    ["popupTargetFontSize", "settings.popup_target_label", "settings.popup_target_font"],
  ]) {
    const label = setting.controlEl.createEl("label", { cls: "mini-popup-font-field" });
    label.createSpan({ text: t(labelKey) });
    label.title = t(nameKey);
    setting.addText((text) => {
        label.appendChild(text.inputEl);
        text.inputEl.type = "number";
        text.inputEl.min = String(FONT_SIZE_MIN);
        text.inputEl.max = String(FONT_SIZE_MAX);
        text.inputEl.step = "1";
        text.inputEl.setAttribute("aria-label", t(nameKey));
        const size = normalizePopupFontSize(plugin.settings[key]);
        text.setPlaceholder(t("settings.popup_font_auto"))
          .setValue(size ? String(size) : "")
          .onChange(async (raw) => {
            const value = String(raw).trim();
            const number = Number(value);
            if (value && (!Number.isInteger(number) || number < FONT_SIZE_MIN || number > FONT_SIZE_MAX)) {
              text.inputEl.setCustomValidity?.(t("settings.popup_font_invalid", { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX }));
              return; // never save an invalid/incomplete numeric input
            }
            text.inputEl.setCustomValidity?.("");
            plugin.settings[key] = value ? number : 0;
            refreshPopup();
            await plugin.saveData(plugin.settings);
          });
      });
  }
  const follow = setting.controlEl.createDiv({ cls: "mini-popup-font-follow" });
  follow.createSpan({ text: t("settings.popup_font_follow_label") });
  follow.title = t("settings.popup_font_follow_desc");
  setting.addToggle((toggle) => {
    const element = toggle.toggleEl || toggle.inputEl;
    if (element) {
      follow.appendChild(element);
      element.setAttribute("aria-label", t("settings.popup_font_follow"));
    }
    toggle.setValue(!!plugin.settings.popupFontFollowResize)
      .onChange(async (enabled) => {
        plugin.settings.popupFontFollowResize = !!enabled;
        // Changing policy starts at the chosen base font, not an old hidden zoom.
        plugin._popupFontScale = 1;
        plugin._popupFontResizeBase = null;
        plugin._popupFontLastSize = null;
        plugin.settings.popupLastFontScale = 1;
        refreshPopup();
        await plugin.saveData(plugin.settings);
      });
  });
  // A composite row is not a whole-row toggle; retain native styling only on
  // the toggle component itself, not on the two numeric input fields.
  setting.settingEl.classList.remove("mod-toggle");
}

module.exports = { normalizePopupFontSize, normalizePopupFontScale, resizePopupFontScale,
  readPopupResizeSize, popupFontStyles, addPopupFontSettings };
