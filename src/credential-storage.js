"use strict";

// Plaintext is the compatibility default. A nonempty reference is exclusive:
// an unavailable Keychain entry never falls back to old plaintext.
const trim = value => typeof value === "string" ? value.trim() : "";
const usesKeychain = (record, field) => !!trim(record?.[field + "Secret"]);
const hasCredential = (record, field) => usesKeychain(record, field) || !!trim(record?.[field]);

async function readCredential(record, field, storage, t) {
  if (!usesKeychain(record, field)) return trim(record?.[field]);
  if (typeof storage?.getSecret !== "function") throw new Error(t("deepl.secret_unavailable"));
  let value;
  try {
    value = trim(await storage.getSecret(trim(record[field + "Secret"])));
  } catch (_) {
    throw new Error(t("deepl.secret_unavailable"));
  }
  if (!value) throw new Error(t("credential.secret_missing"));
  return value;
}

function portableProfile(profile) {
  // Config exports/imports never dereference or transport a local Keychain
  // binding. In particular, an imported endpoint cannot claim an existing key.
  const { apiKeySecret, ...rest } = profile;
  if (trim(apiKeySecret)) rest.apiKey = "";
  return rest;
}

function clearLegacyCopies(settings, key) {
  // These are unused remnants of the pre-llmProfiles format. Remove only
  // copies of the particular credential the user just chose to protect.
  if (!trim(key)) return settings;
  const next = { ...settings };
  if (trim(next.llmApiKey) === trim(key)) delete next.llmApiKey;
  if (Array.isArray(next.customPresets)) {
    next.customPresets = next.customPresets.map(preset =>
      trim(preset?.apiKey) === trim(key) ? { ...preset, apiKey: "" } : preset
    );
  }
  return next;
}

function addField({ container, app, record, field, name, desc, placeholder, Setting,
  SecretComponent, t, persist, notify, onSwitch }) {
  const host = container.createDiv();
  const refField = field + "Secret";
  let stage = "", busy = false;
  let plainQueue = Promise.resolve();
  const canProtect = typeof app?.secretStorage?.getSecret === "function" &&
    typeof SecretComponent === "function" && typeof Setting.prototype.addComponent === "function";

  async function commitMode(patch) {
    if (busy) return;
    busy = true;
    try {
      if (patch[refField]) await readCredential(patch, field, app.secretStorage, t);
    } catch (error) {
      busy = false;
      notify(error.message);
      draw();
      return;
    }
    try {
      await persist(patch, patch[refField] ? record[field] : "");
      stage = "";
      draw();
      onSwitch?.();
    } catch (_) {
      notify(t("credential.save_failed"));
      draw();
    } finally {
      busy = false;
    }
  }

  function draw() {
    host.empty();
    const safe = usesKeychain(record, field);
    const row = new Setting(host).setName(name);
    const hint = (safe || stage === "protect") && stage !== "plain"
      ? t("credential.protected_hint") : t("credential.plain_hint");
    row.setDesc([desc, hint].filter(Boolean).join(" "));
    function button(label, click) {
      row.addButton(control => control.setButtonText(t(label)).onClick(async () => {
        await plainQueue;
        if (!busy) return click();
      }));
    }

    if (stage === "protect" || (safe && !stage)) {
      if (canProtect) row.addComponent(el => new SecretComponent(app, el)
        .setValue(stage === "protect" ? "" : record[refField])
        .onChange(value => {
          const reference = trim(value);
          if (!reference) { draw(); return; }
          return commitMode({ [field]: "", [refField]: reference });
        }));
      else row.setDesc(t("deepl.secret_unavailable"));
      if (stage) button("common.cancel", () => { stage = ""; draw(); });
      else button("credential.use_plain", () => { stage = "plain"; draw(); });
      return;
    }

    let draft = "";
    row.addText(control => {
      control.inputEl.type = "password";
      control.setPlaceholder(placeholder || "").setValue(stage ? "" : trim(record[field]));
      control.onChange(value => {
        if (stage === "plain") draft = trim(value);
        else {
          const valueToSave = trim(value);
          plainQueue = plainQueue.then(() => persist({ [field]: valueToSave }, "")).catch(() => {
            notify(t("credential.save_failed"));
          });
          return plainQueue;
        }
      });
    });
    if (stage === "plain") {
      // Never copy a protected key back into a plaintext input automatically.
      button("credential.save_plain", () => commitMode({ [field]: draft, [refField]: "" }));
      button("common.cancel", () => { stage = ""; draw(); });
    } else if (canProtect) {
      button("credential.enable", () => { stage = "protect"; draw(); });
    }
  }
  draw();
}

module.exports = { usesKeychain, hasCredential, readCredential, portableProfile, clearLegacyCopies, addField };
