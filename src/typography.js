"use strict";

// Local presentation only. This module never changes request text, model prompts,
// copied translations, credentials or generated full-document files.
const SURFACES = ["popup", "sidebar"];
const ROLES = ["source", "target"];
const NUMBER_FIELDS = {
  fontSize: [10, 40, 1, "px"],
  lineHeight: [0.8, 3, 0.05, ""],
  letterSpacing: [-1, 8, 0.1, "px"],
  wordSpacing: [-2, 24, 0.5, "px"],
  paragraphSpacing: [0, 64, 1, "px"],
  spaceAfter: [0, 64, 1, "px"],
  firstLineIndent: [0, 6, 0.1, "em"],
  opacity: [0.2, 1, 0.05, ""],
};
const ENUM_FIELDS = {
  alignment: ["auto", "start", "left", "center", "right", "justify"],
  weight: ["auto", "normal", "500", "600", "700"],
  fontStyle: ["auto", "normal", "italic"],
  decoration: ["auto", "none", "underline", "line-through"],
};
const FONT_OPTIONS = [
  ["", "default"], ["@interface", "interface"], ["@text", "text"],
  ["serif", "serif"], ["sans-serif", "sans"], ["monospace", "mono"],
  ["Georgia", "Georgia"], ["Times New Roman", "Times New Roman"],
  ["Arial", "Arial"], ["Microsoft YaHei", "Microsoft YaHei"],
  ["SimSun", "SimSun"], ["Noto Serif CJK SC", "Noto Serif CJK SC"],
];
const CSS_FIELDS = {
  fontSize: "font-size", fontFamily: "font-family", lineHeight: "line-height",
  letterSpacing: "letter-spacing", wordSpacing: "word-spacing",
  paragraphSpacing: "--mini-paragraph-spacing", spaceAfter: "margin-bottom",
  alignment: "text-align", weight: "font-weight", fontStyle: "font-style",
  decoration: "text-decoration-line", color: "color", background: "background-color", opacity: "opacity",
};
const kebab = name => name.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
const own = (o, key) => Object.prototype.hasOwnProperty.call(o || {}, key);

function fontFamily(value) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (["", "@interface", "@text"].includes(raw)) return raw;
  if (raw.length > 240) return "";
  const names = raw.split(",").map(s => s.trim().replace(/^(['"])(.*)\1$/, "$2"));
  if (names.length > 8 || names.some(s => !s || !/^[\p{L}\p{N} ._-]+$/u.test(s))) return "";
  return names.join(", ");
}
function color(value) {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? value.trim().toLowerCase() : "";
}
function normalizeRole(saved) {
  const result = { fontFamily: fontFamily(saved?.fontFamily), color: color(saved?.color), background: color(saved?.background) };
  for (const [name, limits] of Object.entries(NUMBER_FIELDS)) {
    const raw = saved?.[name], number = Number(raw);
    const empty = raw == null || raw === "" || typeof raw === "boolean" || !Number.isFinite(number) || (name === "fontSize" && number <= 0);
    const clamped = Math.min(limits[1], Math.max(limits[0], number));
    const stepped = limits[0] + Math.round((clamped - limits[0]) / limits[2]) * limits[2];
    result[name] = empty ? (name === "fontSize" ? 0 : null) : Math.round(stepped * 1000) / 1000;
  }
  for (const [name, options] of Object.entries(ENUM_FIELDS)) result[name] = options.includes(saved?.[name]) ? saved[name] : "auto";
  return result;
}
function readTypography(settings = {}) {
  const result = { version: 1 };
  for (const surface of SURFACES) {
    result[surface] = {};
    for (const role of ROLES) result[surface][role] = normalizeRole(settings.typography?.[surface]?.[role]);
  }
  // Existing compact popup controls remain authoritative, including an explicit
  // zero. A structured-only import can still migrate without legacy fields.
  for (const [role, key] of [["source", "popupSourceFontSize"], ["target", "popupTargetFontSize"]]) {
    if (own(settings, key)) result.popup[role].fontSize = normalizeRole({ fontSize: settings[key] }).fontSize;
  }
  return result;
}
function writeTypography(settings, value) {
  const normalized = readTypography({ typography: value });
  settings.typography = normalized;
  settings.popupSourceFontSize = normalized.popup.source.fontSize;
  settings.popupTargetFontSize = normalized.popup.target.fontSize;
  return normalized;
}
function updateTypography(settings, surface, role, patch) {
  if (!SURFACES.includes(surface) || !ROLES.includes(role)) throw Error("Unknown typography scope");
  const next = readTypography(settings);
  next[surface][role] = normalizeRole({ ...next[surface][role], ...patch });
  return writeTypography(settings, next);
}
function copyTypography(settings, from, to) {
  if (!SURFACES.includes(from) || !SURFACES.includes(to) || from === to) throw Error("Invalid typography copy");
  const next = readTypography(settings);
  for (const role of ROLES) next[to][role] = normalizeRole(next[from][role]);
  return writeTypography(settings, next);
}
function resetTypography(settings, surface) {
  if (!SURFACES.includes(surface)) throw Error("Unknown typography scope");
  const next = readTypography(settings);
  for (const role of ROLES) next[surface][role] = normalizeRole({});
  return writeTypography(settings, next);
}
function presetTypography(settings, surface, preset) {
  const values = {
    compact: { source: 13, target: 15, lineHeight: 1.45, paragraphSpacing: 8, spaceAfter: 6 },
    comfortable: { source: 15, target: 18, lineHeight: 1.8, paragraphSpacing: 16, spaceAfter: 12 },
    paper: { source: 16, target: 18, lineHeight: 1.85, paragraphSpacing: 18, spaceAfter: 12, fontFamily: "serif", alignment: "justify" },
  }[preset];
  if (!values || !SURFACES.includes(surface)) throw Error("Unknown typography preset");
  const next = readTypography(settings);
  for (const role of ROLES) next[surface][role] = normalizeRole({ ...values, fontSize: values[role] });
  return writeTypography(settings, next);
}
function fontCss(value) {
  if (value === "@interface") return "var(--font-interface)";
  if (value === "@text") return "var(--font-text)";
  const generic = /^(serif|sans-serif|monospace|system-ui|ui-serif|ui-sans-serif|ui-monospace|cursive|fantasy|emoji)$/;
  return value.split(",").map(s => s.trim()).map(s => generic.test(s) ? s : '"' + s + '"').join(", ");
}
function applyTypography(root, settings, surface, { preview = false } = {}) {
  if (!root) return;
  if (!SURFACES.includes(surface)) throw Error("Unknown typography surface");
  const config = readTypography(settings)[surface];
  root.classList.add("mini-typography");
  for (const role of ROLES) {
    const entry = config[role];
    for (const key of [...Object.keys(CSS_FIELDS), "firstLineIndent"]) {
      const value = entry[key];
      // Popup font sizes keep the existing opt-in manual-resize scaling. Sidebar
      // sizes and preview sizes use absolute base px, never a copied popup zoom.
      const enabled = key === "fontSize" ? value > 0 && (surface !== "popup" || preview)
        : value !== "" && value != null && value !== "auto";
      const name = kebab(role + key[0].toUpperCase() + key.slice(1));
      const dataKey = "miniType" + role[0].toUpperCase() + role.slice(1) + key[0].toUpperCase() + key.slice(1);
      root.dataset[dataKey] = enabled ? "custom" : "default";
      const css = key === "fontFamily" ? fontCss(value) : NUMBER_FIELDS[key] ? String(value) + NUMBER_FIELDS[key][3] : String(value);
      root.style.setProperty("--mini-type-" + name, enabled ? css : "");
    }
  }
}

// Only genuine blank-line boundaries are rendered as paragraphs. Keep complete
// math matches opaque, even when an aligned/display formula contains blank lines.
// There is no fixed-length split, semantic guess, extra model call or HTML parsing.
function splitParagraphs(text, mathPattern) {
  const input = String(text || "");
  const chunks = [];
  let current = "", cursor = 0;
  function plain(value) {
    const pieces = value.split(/\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/);
    current += pieces[0];
    for (const piece of pieces.slice(1)) { chunks.push(current); current = piece; }
  }
  if (mathPattern) {
    const pattern = new RegExp(mathPattern.source, mathPattern.flags.replace(/[gy]/g, "") + "g");
    for (const match of input.matchAll(pattern)) {
      plain(input.slice(cursor, match.index)); current += match[0]; cursor = match.index + match[0].length;
    }
  }
  plain(input.slice(cursor)); chunks.push(current);
  return chunks.filter(part => part.trim().length > 0);
}
function renderParagraphs(container, text, { renderRichText, mathPattern, dictionary = false }) {
  const paragraphs = dictionary ? [String(text || "")] : splitParagraphs(text, mathPattern);
  container.classList.remove("mini-text-multipara");
  if (paragraphs.length <= 1) { renderRichText(container, String(text || "")); return; }
  container.classList.add("mini-text-multipara");
  for (const paragraph of paragraphs) renderRichText(container.createDiv({ cls: "mini-text-paragraph" }), paragraph);
}

module.exports = { SURFACES, ROLES, NUMBER_FIELDS, ENUM_FIELDS, FONT_OPTIONS, CSS_FIELDS, kebab,
  fontFamily, color, normalizeRole, readTypography, writeTypography, updateTypography,
  copyTypography, resetTypography, presetTypography, applyTypography, splitParagraphs, renderParagraphs };
