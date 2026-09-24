// Model configuration regressions. Run: node tests/model-config.test.js
const assert = require("assert/strict");
const {
  extractModelIds,
  profilesFromStoredSettings,
  replaceFetchedModels,
  resolveModelsUrl,
} = require("../src/model-config.js");

let passed = 0;
function test(name, callback) {
  callback();
  passed++;
  console.log("PASS", name);
}

test("resolves DeepSeek Chat Completions to its real model catalog", () => {
  assert.equal(
    resolveModelsUrl("https://api.deepseek.com/chat/completions"),
    "https://api.deepseek.com/models"
  );
});

test("resolves versioned OpenAI-compatible endpoints", () => {
  assert.equal(
    resolveModelsUrl("https://example.invalid/v1/chat/completions/"),
    "https://example.invalid/v1/models"
  );
  assert.equal(
    resolveModelsUrl("https://example.invalid/v1/responses"),
    "https://example.invalid/v1/models"
  );
  assert.equal(
    resolveModelsUrl("https://example.invalid/v1"),
    "https://example.invalid/v1/models"
  );
});

test("resolves every bundled provider family without dropping its path prefix", () => {
  const cases = [
    ["https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "https://generativelanguage.googleapis.com/v1beta/openai/models"],
    ["https://api.x.ai/v1/chat/completions", "https://api.x.ai/v1/models"],
    ["https://api.mistral.ai/v1/chat/completions", "https://api.mistral.ai/v1/models"],
    ["https://api.groq.com/openai/v1/chat/completions", "https://api.groq.com/openai/v1/models"],
    ["https://openrouter.ai/api/v1/chat/completions", "https://openrouter.ai/api/v1/models"],
    ["https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", "https://dashscope.aliyuncs.com/compatible-mode/v1/models"],
    ["https://open.bigmodel.cn/api/paas/v4/chat/completions", "https://open.bigmodel.cn/api/paas/v4/models"],
    ["http://localhost:11434/v1/chat/completions", "http://localhost:11434/v1/models"],
    ["http://localhost:1234/v1/chat/completions", "http://localhost:1234/v1/models"],
    ["http://localhost:8000/v1/chat/completions", "http://localhost:8000/v1/models"],
  ];
  for (const [endpoint, modelsUrl] of cases) {
    assert.equal(resolveModelsUrl(endpoint), modelsUrl);
  }
});

test("keeps an explicit models URL and gateway query parameters", () => {
  assert.equal(
    resolveModelsUrl("https://example.invalid/v1/models?api-version=2026-01-01#ignored"),
    "https://example.invalid/v1/models?api-version=2026-01-01"
  );
});

test("rejects invalid or unsafe endpoint protocols", () => {
  assert.throws(() => resolveModelsUrl("not a URL"), /invalid/i);
  assert.throws(() => resolveModelsUrl("file:///tmp/models"), /HTTP/i);
});

test("extracts only model IDs actually returned by common API shapes", () => {
  assert.deepEqual(
    extractModelIds({ data: [{ id: "model-b" }, { id: "model-a" }, { id: "model-b" }] }),
    ["model-b", "model-a"]
  );
  assert.deepEqual(
    extractModelIds({ models: [{ name: "ollama-a" }, { model: "ollama-b" }] }),
    ["ollama-a", "ollama-b"]
  );
  assert.deepEqual(extractModelIds({ data: { models: ["nested-a"] } }), ["nested-a"]);
  assert.deepEqual(extractModelIds({ unrelated: ["invented"] }), []);
});

test("a successful fetch replaces stale entries and keeps a still-valid selection", () => {
  const profile = {
    models: ["stale-preset", "model-b"],
    activeModel: "model-b",
  };
  replaceFetchedModels(profile, ["model-a", "model-b", "model-a"]);
  assert.deepEqual(profile.models, ["model-a", "model-b"]);
  assert.equal(profile.activeModel, "model-b");

  replaceFetchedModels(profile, ["model-c"]);
  assert.deepEqual(profile.models, ["model-c"]);
  assert.equal(profile.activeModel, "model-c");
});

test("first startup without legacy settings has no implicit DeepSeek profile", () => {
  assert.deepEqual(profilesFromStoredSettings({}, "Default configuration"), []);
});

test("an explicitly empty profile list stays empty even when legacy fields remain", () => {
  assert.deepEqual(
    profilesFromStoredSettings(
      {
        llmProfiles: [],
        llmUrl: "https://old.invalid/v1/chat/completions",
        llmModel: "old-model",
      },
      "Default configuration"
    ),
    []
  );
});

test("legacy settings migrate only when llmProfiles is absent", () => {
  assert.deepEqual(
    profilesFromStoredSettings(
      {
        llmUrl: "https://old.invalid/v1/chat/completions",
        llmApiKey: "secret",
        llmModel: "old-model",
        customPresets: [
          { name: "Local", url: "http://localhost:11434/v1/chat/completions", model: "local-a" },
        ],
      },
      "Default configuration"
    ),
    [
      {
        name: "Default configuration",
        url: "https://old.invalid/v1/chat/completions",
        apiKey: "secret",
        models: ["old-model"],
        activeModel: "old-model",
      },
      {
        name: "Local",
        url: "http://localhost:11434/v1/chat/completions",
        apiKey: "",
        models: ["local-a"],
        activeModel: "local-a",
      },
    ]
  );
});

console.log(`ALL PASS (${passed} model configuration tests)`);
