"use strict";

function cleanModelId(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (!value || typeof value !== "object") return "";
  for (const key of ["id", "name", "model", "model_id"]) {
    if (typeof value[key] === "string" || typeof value[key] === "number") {
      const id = String(value[key]).trim();
      if (id) return id;
    }
  }
  return "";
}

function uniqueModelIds(values) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = cleanModelId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * Resolve the model-catalog endpoint from an OpenAI-compatible request URL.
 * Users may enter a base URL, a Chat Completions URL, a Responses URL, or the
 * model URL itself. Query parameters are retained for gateways that require
 * them on every request.
 */
function resolveModelsUrl(rawEndpoint) {
  const endpoint = String(rawEndpoint || "").trim();
  if (!endpoint) throw new TypeError("A model endpoint URL is required");

  let url;
  try {
    url = new URL(endpoint);
  } catch (_error) {
    throw new TypeError("The model endpoint URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("The model endpoint must use HTTP or HTTPS");
  }

  url.hash = "";
  let pathname = url.pathname.replace(/\/+$/, "");
  if (!/\/models$/i.test(pathname)) {
    pathname = pathname
      .replace(/\/chat\/completions$/i, "")
      .replace(/\/responses$/i, "")
      .replace(/\/completions$/i, "")
      .replace(/\/+$/, "");
    pathname += "/models";
  }
  url.pathname = pathname || "/models";
  return url.toString();
}

/**
 * OpenAI-compatible providers normally return { data: [{ id }] }. Some local
 * gateways use { models: [{ name }] } or nest the list under data/result, so
 * accept those documented compatibility shapes without inventing model IDs.
 */
function extractModelIds(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.models,
    payload?.data?.models,
    payload?.result,
    payload?.result?.data,
    payload?.result?.models,
  ];
  const list = candidates.find(Array.isArray);
  return uniqueModelIds(list || []);
}

function replaceFetchedModels(profile, fetchedModels) {
  const models = uniqueModelIds(fetchedModels);
  if (!models.length) return [];
  const previous = String(profile?.activeModel || "").trim();
  profile.models = models;
  profile.activeModel = models.includes(previous) ? previous : models[0];
  return models;
}

/**
 * Preserve an explicitly stored empty array. This distinction prevents a
 * deleted last profile from being recreated on the next Obsidian startup.
 * Legacy single-profile fields are imported only when llmProfiles was absent.
 */
function profilesFromStoredSettings(storedSettings, defaultProfileName) {
  const stored = storedSettings && typeof storedSettings === "object"
    ? storedSettings
    : {};
  if (Array.isArray(stored.llmProfiles)) return stored.llmProfiles;

  const profiles = [];
  if (stored.llmUrl || stored.llmApiKey || stored.llmModel) {
    profiles.push({
      name: String(defaultProfileName || "Default configuration"),
      url: String(stored.llmUrl || ""),
      apiKey: String(stored.llmApiKey || ""),
      models: stored.llmModel ? [String(stored.llmModel)] : [],
      activeModel: String(stored.llmModel || ""),
    });
  }
  for (const preset of Array.isArray(stored.customPresets)
    ? stored.customPresets
    : []) {
    if (!preset || typeof preset !== "object" || !preset.name) continue;
    profiles.push({
      name: String(preset.name),
      url: String(preset.url || ""),
      apiKey: String(preset.apiKey || ""),
      models: preset.model ? [String(preset.model)] : [],
      activeModel: String(preset.model || ""),
    });
  }
  return profiles;
}

module.exports = {
  extractModelIds,
  profilesFromStoredSettings,
  replaceFetchedModels,
  resolveModelsUrl,
  uniqueModelIds,
};
