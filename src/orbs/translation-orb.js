"use strict";

const { createInkWaterElement, destroyInkWaterElement } = require("./ink-water-orb.js");

const DEFAULT_SKIN_ID = "ink-wash";
const ORB_SIZE = 40;
const MIN_ORB_SIZE = 28;
const MAX_ORB_SIZE = 96;
const DEFAULT_MARGIN = 12;
const SVG_NS = "http://www.w3.org/2000/svg";

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeSize(value) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : ORB_SIZE, MIN_ORB_SIZE, MAX_ORB_SIZE);
}

function clampPosition(position, viewport, size = ORB_SIZE, margin = DEFAULT_MARGIN) {
  const width = Math.max(0, Number(viewport?.width) || 0);
  const height = Math.max(0, Number(viewport?.height) || 0);
  const safeMargin = Math.max(0, Number(margin) || 0);
  const availableX = Math.max(0, width - size);
  const availableY = Math.max(0, height - size);
  const minX = Math.min(safeMargin, availableX);
  const minY = Math.min(safeMargin, availableY);
  const maxX = Math.max(minX, availableX - safeMargin);
  const maxY = Math.max(minY, availableY - safeMargin);
  const fallbackX = maxX;
  const fallbackY = maxY;
  const rawX = Number(position?.x);
  const rawY = Number(position?.y);
  return {
    x: clamp(Number.isFinite(rawX) ? rawX : fallbackX, minX, maxX),
    y: clamp(Number.isFinite(rawY) ? rawY : fallbackY, minY, maxY)
  };
}

function normalizeTokens(tokens) {
  const normalized = {};
  for (const [name, value] of Object.entries(tokens || {})) {
    const serialized = String(value);
    if (!name.startsWith("--translation-orb-") || /url\s*\(|@import|[;{}]/i.test(serialized)) {
      throw new TypeError(`Unsafe translation-orb token: ${name}`);
    }
    normalized[name] = serialized;
  }
  return Object.freeze(normalized);
}

class TranslationOrbSkinRegistry {
  constructor(defaultSkinId = DEFAULT_SKIN_ID) {
    this.defaultSkinId = defaultSkinId;
    this._skins = new Map();
    this._warnedIds = new Set();
  }

  register(definition) {
    const id = definition?.id;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || "")) {
      throw new TypeError("Skin id must contain lowercase letters, numbers, and hyphens only");
    }
    if (this._skins.has(id)) throw new Error(`Duplicate skin id: ${id}`);
    const skin = Object.freeze({
      schemaVersion: 1,
      id,
      label: String(definition.label || id),
      description: String(definition.description || ""),
      tokens: Object.freeze({
        light: normalizeTokens(definition.tokens?.light),
        dark: normalizeTokens(definition.tokens?.dark)
      })
    });
    this._skins.set(id, skin);
    return skin;
  }

  get(id) {
    return this._skins.get(id);
  }

  resolve(id) {
    if (this._skins.has(id)) return this._skins.get(id);
    const fallback = this._skins.get(this.defaultSkinId) || this._skins.values().next().value;
    if (!fallback) throw new Error("No translation-orb skins are registered");
    if (!this._warnedIds.has(id)) {
      console.warn(`Unknown translation-orb skin: ${id}; using ${fallback.id}.`);
      this._warnedIds.add(id);
    }
    return fallback;
  }

  list() {
    return Object.freeze([...this._skins.values()].map(({ id, label, description }) =>
      Object.freeze({ id, label, description })));
  }
}

const BUILTIN_SKINS = [
  {
    id: "ink-wash",
    label: "水墨游鱼",
    description: "墨环、池水与三尾墨鲤自由游动；不使用最外围绕圈的大鱼。",
    tokens: {
      light: { "--translation-orb-shell": "#d9dddb", "--translation-orb-tone-a": "#374045", "--translation-orb-tone-b": "#7f8b8e", "--translation-orb-tone-c": "#c1c6c2", "--translation-orb-accent": "#56646a", "--translation-orb-track": "rgb(31 39 41 / 0.22)", "--translation-orb-value": "#263238", "--translation-orb-ring-shadow": "rgb(255 255 255 / 0.8)" },
      dark: { "--translation-orb-shell": "#202627", "--translation-orb-tone-a": "#c4cece", "--translation-orb-tone-b": "#6e7c7e", "--translation-orb-tone-c": "#3f4948", "--translation-orb-accent": "#91a3a4", "--translation-orb-track": "rgb(230 238 236 / 0.28)", "--translation-orb-value": "#e5efed", "--translation-orb-ring-shadow": "rgb(0 0 0 / 0.7)" }
    }
  },
  {
    id: "galaxy",
    label: "星云斜带",
    description: "一条倾斜星云穿过深色球体，星点固定而微光起伏。",
    tokens: {
      light: { "--translation-orb-shell": "#363846", "--translation-orb-tone-a": "#726f87", "--translation-orb-tone-b": "#9c8794", "--translation-orb-tone-c": "#b6b6c1", "--translation-orb-accent": "#77738c", "--translation-orb-track": "rgb(30 29 42 / 0.3)", "--translation-orb-value": "#232535", "--translation-orb-ring-shadow": "rgb(255 255 255 / 0.72)" },
      dark: { "--translation-orb-shell": "#171823", "--translation-orb-tone-a": "#aaa6bc", "--translation-orb-tone-b": "#846f83", "--translation-orb-tone-c": "#c9cbd4", "--translation-orb-accent": "#8d8aa5", "--translation-orb-track": "rgb(236 234 245 / 0.25)", "--translation-orb-value": "#edeaf4", "--translation-orb-ring-shadow": "rgb(0 0 0 / 0.75)" }
    }
  },
  {
    id: "water-wave",
    label: "双层潮汐",
    description: "两道冷灰蓝潮线错拍起伏，强调水平流动与清透深度。",
    tokens: {
      light: { "--translation-orb-shell": "#d8e2e2", "--translation-orb-tone-a": "#476a72", "--translation-orb-tone-b": "#86a5aa", "--translation-orb-tone-c": "#b8cbce", "--translation-orb-accent": "#557a81", "--translation-orb-track": "rgb(37 61 65 / 0.22)", "--translation-orb-value": "#294f58", "--translation-orb-ring-shadow": "rgb(255 255 255 / 0.8)" },
      dark: { "--translation-orb-shell": "#17272a", "--translation-orb-tone-a": "#709da5", "--translation-orb-tone-b": "#315c64", "--translation-orb-tone-c": "#9fbabe", "--translation-orb-accent": "#75a0a6", "--translation-orb-track": "rgb(225 241 242 / 0.27)", "--translation-orb-value": "#d9ecee", "--translation-orb-ring-shadow": "rgb(0 0 0 / 0.72)" }
    }
  },
  {
    id: "amber-glow",
    label: "琥珀对流",
    description: "暖色池沉在底部，细小热羽向上舒展后缓慢回落。",
    tokens: {
      light: { "--translation-orb-shell": "#ded8cc", "--translation-orb-tone-a": "#9c6733", "--translation-orb-tone-b": "#c49258", "--translation-orb-tone-c": "#e0b677", "--translation-orb-accent": "#a36e37", "--translation-orb-track": "rgb(70 48 25 / 0.24)", "--translation-orb-value": "#64401f", "--translation-orb-ring-shadow": "rgb(255 255 255 / 0.78)" },
      dark: { "--translation-orb-shell": "#2b241b", "--translation-orb-tone-a": "#d3944f", "--translation-orb-tone-b": "#8c572c", "--translation-orb-tone-c": "#e2b36c", "--translation-orb-accent": "#c28a4d", "--translation-orb-track": "rgb(245 229 204 / 0.25)", "--translation-orb-value": "#f1d7b2", "--translation-orb-ring-shadow": "rgb(0 0 0 / 0.75)" }
    }
  },
  {
    id: "frost-prism",
    label: "静态冰棱",
    description: "以切面、折光和留白形成稳定的冷静状态。",
    tokens: {
      light: { "--translation-orb-shell": "#dfe4e5", "--translation-orb-tone-a": "#8f9ca3", "--translation-orb-tone-b": "#b5bdc0", "--translation-orb-tone-c": "#f0f2f1", "--translation-orb-accent": "#7c8b92", "--translation-orb-track": "rgb(47 59 63 / 0.2)", "--translation-orb-value": "#415158", "--translation-orb-ring-shadow": "rgb(255 255 255 / 0.86)" },
      dark: { "--translation-orb-shell": "#20282b", "--translation-orb-tone-a": "#8d9da4", "--translation-orb-tone-b": "#5c6b71", "--translation-orb-tone-c": "#c7d0d1", "--translation-orb-accent": "#93a5ab", "--translation-orb-track": "rgb(232 240 241 / 0.26)", "--translation-orb-value": "#e3ecec", "--translation-orb-ring-shadow": "rgb(0 0 0 / 0.72)" }
    }
  }
];

function createDefaultSkinRegistry() {
  const registry = new TranslationOrbSkinRegistry(DEFAULT_SKIN_ID);
  for (const skin of BUILTIN_SKINS) registry.register(skin);
  return registry;
}

function appendClassedElement(documentRef, parent, tag, className) {
  const element = documentRef.createElement(tag);
  element.className = className;
  parent.append(element);
  return element;
}

function createOrbElement(documentRef) {
  const orb = documentRef.createElement("div");
  orb.className = "translation-orb";
  orb.setAttribute("role", "progressbar");
  orb.setAttribute("aria-valuemin", "0");
  orb.setAttribute("aria-valuemax", "100");

  appendClassedElement(documentRef, orb, "span", "translation-orb__halo");
  const core = appendClassedElement(documentRef, orb, "span", "translation-orb__core");
  appendClassedElement(documentRef, core, "span", "translation-orb__layer translation-orb__layer--a");
  appendClassedElement(documentRef, core, "span", "translation-orb__layer translation-orb__layer--b");
  appendClassedElement(documentRef, core, "span", "translation-orb__layer translation-orb__layer--c");
  appendClassedElement(documentRef, core, "span", "translation-orb__texture");
  appendClassedElement(documentRef, core, "span", "translation-orb__highlight");
  appendClassedElement(documentRef, core, "span", "translation-orb__reflection");

  const svg = documentRef.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "translation-orb__progress");
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("aria-hidden", "true");
  for (const className of ["translation-orb__track", "translation-orb__value"]) {
    const circle = documentRef.createElementNS(SVG_NS, "circle");
    circle.setAttribute("class", className);
    circle.setAttribute("cx", "20");
    circle.setAttribute("cy", "20");
    circle.setAttribute("r", "17.5");
    circle.setAttribute("pathLength", "100");
    svg.append(circle);
  }
  orb.append(svg);
  orb.append(createInkWaterElement(documentRef));
  return orb;
}

class TranslationOrbController {
  constructor(options = {}) {
    this.document = options.document || globalThis.document;
    this.window = options.window || this.document?.defaultView || globalThis.window;
    if (!this.document || !this.window) throw new Error("TranslationOrbController requires a DOM window and document");
    this.registry = options.registry || createDefaultSkinRegistry();
    const requestedMargin = Number(options.margin);
    this.margin = Number.isFinite(requestedMargin) && requestedMargin >= 0
      ? requestedMargin
      : DEFAULT_MARGIN;
    this.onStateChange = typeof options.onStateChange === "function" ? options.onStateChange : null;
    this.labels = {
      host: "Translation progress orb. Drag to move; use the arrow keys to move and Home to reset its position.",
      indeterminate: "Translation in progress; progress unknown",
      progress: (value) => `Translation in progress: ${value}%`,
      ...(options.labels || {})
    };
    this.state = {
      visible: options.visible !== false,
      skin: options.skin || DEFAULT_SKIN_ID,
      surface: ["auto", "light", "dark"].includes(options.surface) ? options.surface : "auto",
      size: normalizeSize(options.size),
      progress: options.progress == null ? null : clamp(Number(options.progress) || 0, 0, 100),
      position: options.position && Number.isFinite(Number(options.position.x)) && Number.isFinite(Number(options.position.y))
        ? { x: Number(options.position.x), y: Number(options.position.y) }
        : null
    };
    this.host = null;
    this.orb = null;
    this._actualSurface = "light";
    this._appliedTokens = new Set();
    this._listeners = [];
    this._themeObserver = null;
    this._drag = null;
    this._completionPulseTimer = null;
    this._destroyed = false;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  mount(parent = this.document.body) {
    if (this._destroyed) throw new Error("A destroyed TranslationOrbController cannot be remounted");
    if (this.host) return this.host;
    if (!parent) throw new Error("TranslationOrbController requires a mount parent");
    const host = this.document.createElement("div");
    host.className = "translation-orb-host";
    host.tabIndex = 0;
    host.setAttribute("role", "group");
    host.setAttribute("aria-label", String(this.labels.host));
    host.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight Home");
    this.orb = createOrbElement(this.document);
    host.append(this.orb);
    parent.append(host);
    this.host = host;

    this._listen(host, "pointerdown", this._onPointerDown);
    this._listen(this.window, "pointermove", this._onPointerMove);
    this._listen(this.window, "pointerup", this._onPointerUp);
    this._listen(this.window, "pointercancel", this._onPointerUp);
    this._listen(host, "keydown", this._onKeyDown);
    this._listen(this.window, "resize", this._onResize);
    this._installThemeObserver();

    this.setSkin(this.state.skin, false);
    this.setSurface(this.state.surface, false);
    this.setSize(this.state.size, false);
    this.setProgress(this.state.progress, false);
    if (this.state.position) this.setPosition(this.state.position, false);
    else this.resetPosition(false);
    this._syncVisibility();
    return host;
  }

  show(notify = true) {
    this.state.visible = true;
    this._syncVisibility();
    if (notify) this._notify("visibility");
    return this;
  }

  hide(notify = true) {
    this.state.visible = false;
    this._syncVisibility();
    if (notify) this._notify("visibility");
    return this;
  }

  toggle() {
    return this.state.visible ? this.hide() : this.show();
  }

  setProgress(value, notify = true) {
    if (value == null) {
      this.state.progress = null;
      this._clearCompletionPulse();
      if (this.orb) {
        this.orb.dataset.translationOrbState = "indeterminate";
        this.orb.removeAttribute("aria-valuenow");
        this.orb.setAttribute("aria-label", String(this.labels.indeterminate));
      }
    } else {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new TypeError("Progress must be a finite number or null");
      const progress = clamp(numeric, 0, 100);
      const previousProgress = this.state.progress;
      this.state.progress = progress;
      if (this.orb) {
        this.orb.dataset.translationOrbState = "determinate";
        this.orb.style.setProperty("--progress-offset", String(100 - progress));
        this.orb.setAttribute("aria-valuenow", String(progress));
        const progressLabel = typeof this.labels.progress === "function"
          ? this.labels.progress(Math.round(progress))
          : String(this.labels.progress).replace("{progress}", String(Math.round(progress)));
        this.orb.setAttribute("aria-label", progressLabel);
      }
      if (progress >= 100 && previousProgress !== 100) this._pulseCompletion();
      else if (progress < 100) this._clearCompletionPulse();
    }
    if (notify) this._notify("progress");
    return this;
  }

  setSkin(skinId, notify = true) {
    const skin = this.registry.resolve(skinId);
    this.state.skin = skin.id;
    if (this.orb) {
      this.orb.dataset.skin = skin.id;
      this.orb.dataset.translationOrbSkin = skin.id;
      this._applyTokens();
    }
    if (notify) this._notify("skin");
    return skin.id;
  }

  setSurface(surface, notify = true) {
    if (!["auto", "light", "dark"].includes(surface)) {
      throw new TypeError("Surface must be auto, light, or dark");
    }
    this.state.surface = surface;
    this._syncSurface();
    if (notify) this._notify("surface");
    return this;
  }

  registerSkin(definition) {
    return this.registry.register(definition);
  }

  listSkins() {
    return this.registry.list();
  }

  setSize(value, notify = true) {
    const size = normalizeSize(value);
    const scale = size / ORB_SIZE;
    const offset = (size - ORB_SIZE) / 2;
    this.state.size = size;
    if (this.host) {
      this.host.style.setProperty("--orb-size", `${size}px`);
      this.host.style.setProperty("--orb-scale", String(scale));
      this.host.style.setProperty("--orb-offset", `${offset}px`);
    }
    if (this.orb) {
      this.orb.style.setProperty("--orb-size", `${size}px`);
      this.orb.style.setProperty("--orb-scale", String(scale));
      this.orb.style.setProperty("--orb-offset", `${offset}px`);
    }
    if (this.state.position) this.setPosition(this.state.position, false);
    if (notify) this._notify("size");
    return size;
  }

  setPosition(position, notify = true) {
    const next = clampPosition(position, this._viewport(), this.state.size, this.margin);
    this.state.position = next;
    if (this.host) {
      this.host.style.setProperty("--translation-orb-x", `${next.x}px`);
      this.host.style.setProperty("--translation-orb-y", `${next.y}px`);
    }
    if (notify) this._notify("position");
    return { ...next };
  }

  resetPosition(notify = true) {
    const viewport = this._viewport();
    return this.setPosition({ x: viewport.width, y: viewport.height }, notify);
  }

  getState() {
    return Object.freeze({
      visible: this.state.visible,
      skin: this.state.skin,
      surface: this.state.surface,
      actualSurface: this._actualSurface,
      size: this.state.size,
      progress: this.state.progress,
      position: this.state.position ? Object.freeze({ ...this.state.position }) : null
    });
  }

  _clearCompletionPulse() {
    if (this._completionPulseTimer != null) {
      this.window.clearTimeout(this._completionPulseTimer);
      this._completionPulseTimer = null;
    }
    this.orb?.classList.remove("is-complete");
  }

  _pulseCompletion() {
    this._clearCompletionPulse();
    if (!this.orb || this._destroyed) return;
    // Force a reflow so repeated stage completions can replay the same bounce.
    void this.orb.offsetWidth;
    this.orb.classList.add("is-complete");
    this._completionPulseTimer = this.window.setTimeout(() => {
      this._completionPulseTimer = null;
      this.orb?.classList.remove("is-complete");
    }, 650);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const { target, type, listener, options } of this._listeners) {
      target.removeEventListener(type, listener, options);
    }
    this._listeners.length = 0;
    this._themeObserver?.disconnect();
    this._themeObserver = null;
    this._drag = null;
    this._clearCompletionPulse();
    const inkWater = this.orb?.querySelector?.(".translation-orb__ink-water");
    if (inkWater) destroyInkWaterElement(inkWater);
    this.host?.remove();
    this.host = null;
    this.orb = null;
    this._appliedTokens.clear();
  }

  _listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this._listeners.push({ target, type, listener, options });
  }

  _viewport() {
    return {
      width: Number(this.window.innerWidth) || Number(this.document.documentElement?.clientWidth) || 1024,
      height: Number(this.window.innerHeight) || Number(this.document.documentElement?.clientHeight) || 768
    };
  }

  _resolveSurface() {
    if (this.state.surface !== "auto") return this.state.surface;
    const bodyClasses = this.document.body?.classList;
    if (bodyClasses?.contains("theme-dark")) return "dark";
    if (bodyClasses?.contains("theme-light")) return "light";
    return this.window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  }

  _syncSurface() {
    this._actualSurface = this._resolveSurface();
    if (this.orb) {
      this.orb.dataset.translationOrbSurface = this._actualSurface;
      this._applyTokens();
    }
  }

  _applyTokens() {
    if (!this.orb) return;
    for (const name of this._appliedTokens) this.orb.style.removeProperty(name);
    this._appliedTokens.clear();
    const skin = this.registry.resolve(this.state.skin);
    for (const [name, value] of Object.entries(skin.tokens[this._actualSurface])) {
      this.orb.style.setProperty(name, value);
      this._appliedTokens.add(name);
    }
  }

  _syncVisibility() {
    if (this.host) this.host.hidden = !this.state.visible;
  }

  _installThemeObserver() {
    const Observer = this.window.MutationObserver || globalThis.MutationObserver;
    if (!Observer || !this.document.body) return;
    this._themeObserver = new Observer(() => {
      if (this.state.surface === "auto") this._syncSurface();
    });
    this._themeObserver.observe(this.document.body, { attributes: true, attributeFilter: ["class"] });
  }

  _notify(reason) {
    const state = this.getState();
    this.onStateChange?.(state, reason);
    if (this.host && typeof this.window.CustomEvent === "function") {
      this.host.dispatchEvent(new this.window.CustomEvent("translation-orb:statechange", { detail: { state, reason } }));
    }
  }

  _onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault?.();
    this.host?.focus?.({ preventScroll: true });
    this.host?.setPointerCapture?.(event.pointerId);
    const position = this.state.position || this.resetPosition(false);
    this._drag = {
      pointerId: event.pointerId,
      startX: Number(event.clientX) || 0,
      startY: Number(event.clientY) || 0,
      originX: position.x,
      originY: position.y
    };
    this.host?.classList.add("is-dragging");
  }

  _onPointerMove(event) {
    if (!this._drag || event.pointerId !== this._drag.pointerId) return;
    event.preventDefault?.();
    this.setPosition({
      x: this._drag.originX + (Number(event.clientX) - this._drag.startX),
      y: this._drag.originY + (Number(event.clientY) - this._drag.startY)
    }, false);
  }

  _onPointerUp(event) {
    if (!this._drag || event.pointerId !== this._drag.pointerId) return;
    this.host?.releasePointerCapture?.(event.pointerId);
    this.host?.classList.remove("is-dragging");
    this._drag = null;
    this._notify("position");
  }

  _onKeyDown(event) {
    if (event.key === "Home") {
      event.preventDefault();
      this.resetPosition();
      return;
    }
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 1 : 10;
    const position = this.state.position || this.resetPosition(false);
    this.setPosition({ x: position.x + direction[0] * step, y: position.y + direction[1] * step });
  }

  _onResize() {
    if (this.state.position) this.setPosition(this.state.position, false);
  }
}

module.exports = {
  BUILTIN_SKINS,
  DEFAULT_SKIN_ID,
  ORB_SIZE,
  MIN_ORB_SIZE,
  MAX_ORB_SIZE,
  TranslationOrbController,
  TranslationOrbSkinRegistry,
  clampPosition,
  createDefaultSkinRegistry,
  createOrbElement
};
