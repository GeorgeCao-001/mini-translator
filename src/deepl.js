"use strict";

// Official text API only. Network and SecretStorage are injected by the plugin;
// this module never persists credentials, uses a proxy, or loads remote code.
const ENDPOINTS = Object.freeze({
  free: "https://api-free.deepl.com/v2/translate",
  pro: "https://api.deepl.com/v2/translate",
});
const MAX_REQUEST_BYTES = 128 * 1024;

function languageCode(code, source = false) {
  if (source && code === "auto") return "";
  if (code === "zh-Hans" || code === "zh-Hant") {
    return source ? "ZH" : code === "zh-Hant" ? "ZH-HANT" : "ZH-HANS";
  }
  if (code === "nb") return "NO";
  if (!source && code === "en") return "EN-US";
  if (!source && code === "pt") return "PT-PT";
  return String(code || "").toUpperCase();
}

function detectedLanguage(code) {
  const value = String(code || "").toLowerCase();
  if (value === "zh" || value === "zh-hans") return "zh-Hans";
  if (value === "zh-hant") return "zh-Hant";
  if (value === "no") return "nb";
  if (value.startsWith("en-")) return "en";
  if (value.startsWith("pt-")) return "pt";
  return value;
}

async function translate(text, from, to, { settings, secretStorage, requestUrl, t }) {
  const secretName = String(settings?.deeplSecret || "").trim();
  if (!secretName) throw new Error(t("deepl.key_required"));
  if (typeof secretStorage?.getSecret !== "function") {
    throw new Error(t("deepl.secret_unavailable"));
  }
  let key;
  try {
    key = String((await secretStorage.getSecret(secretName)) || "").trim();
  } catch (_) {
    throw new Error(t("deepl.secret_unavailable"));
  }
  if (!key) throw new Error(t("deepl.key_required"));
  if (/[\s\x00-\x1f\x7f]/.test(key)) throw new Error(t("deepl.key_invalid"));
  const payload = {
    text: [String(text)],
    target_lang: languageCode(to),
    preserve_formatting: true,
    split_sentences: "nonewlines",
  };
  if (from !== "auto") payload.source_lang = languageCode(from, true);
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) {
    throw new Error(t("deepl.input_too_large"));
  }
  let response;
  try {
    response = await requestUrl({
      url: key.endsWith(":fx") ? ENDPOINTS.free : ENDPOINTS.pro,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "DeepL-Auth-Key " + key },
      body,
      throw: false,
    });
  } catch (_) {
    // Do not forward request errors/body/headers: they may contain credentials
    // or private input. HTTP errors are handled below using status codes only.
    throw new Error(t("deepl.network_error"));
  }
  const status = Number(response?.status) || 0;
  if (status === 401 || status === 403) throw new Error(t("deepl.key_invalid"));
  if (status === 429) throw new Error(t("deepl.rate_limit"));
  if (status === 456) throw new Error(t("deepl.quota"));
  if (status === 413) throw new Error(t("deepl.input_too_large"));
  if (status !== 200) throw new Error(t("deepl.http", { status }));
  let result;
  try { result = response.json?.translations?.[0]; } catch (_) {}
  if (typeof result?.text !== "string" || !result.text.trim()) {
    throw new Error(t("deepl.empty_result"));
  }
  return {
    text: result.text,
    detectedLanguage: detectedLanguage(result.detected_source_language) || (from === "auto" ? "" : from),
  };
}

function addSettings({ container, app, settings, save, Setting, SecretComponent, t, notify }) {
  container.createDiv({ text: t("deepl.notice"), cls: "setting-item-description" });
  if (typeof app?.secretStorage?.getSecret !== "function" ||
      typeof SecretComponent !== "function") {
    container.createDiv({ text: t("deepl.secret_unavailable"), cls: "setting-item-description" });
    return;
  }
  const row = new Setting(container)
    .setName(t("deepl.key_name"))
    .setDesc(t("deepl.key_desc"));
  if (typeof row.addComponent !== "function") {
    container.createDiv({ text: t("deepl.secret_unavailable"), cls: "setting-item-description" });
    return;
  }
  row.addComponent(el => {
    const control = new SecretComponent(app, el).setValue(settings.deeplSecret || "");
    let queue = Promise.resolve();
    control.onChange(value => {
      const next = String(value || "").trim(); // Secret ID, never the key value.
      queue = queue.then(async () => {
        try {
          await save({ ...settings, deeplSecret: next });
          settings.deeplSecret = next;
        } catch (_) {
          control.setValue(settings.deeplSecret || "");
          notify(t("deepl.save_failed"));
        }
      });
      return queue;
    });
    return control;
  });
}

module.exports = { ENDPOINTS, MAX_REQUEST_BYTES, languageCode, detectedLanguage, translate, addSettings };
