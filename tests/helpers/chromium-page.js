"use strict";

// Wait for real Worker promises via Chromium's loopback DevTools interface.
// Virtual-time/dump-dom exits too early for background PDF worker tasks.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runChromiumPage(browser, url, profile) {
  const child = spawn(browser, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-extensions", "--allow-file-access-from-files",
    "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "about:blank",
  ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let errors = "", launchError, socket;
  child.stderr.on("data", (data) => { errors += data; });
  child.on("error", (error) => { launchError = error; });
  const pending = new Map();
  let nextId = 0;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    const started = Date.now();
    let port;
    while (!port) {
      if (launchError) throw launchError;
      if (Date.now() - started > 10000) throw new Error("Chromium launch timed out: " + errors);
      // On Windows the file can exist while Chromium still has it locked or
      // has not finished writing its port. Wait for readable, valid contents.
      try {
        const candidate = Number(fs.readFileSync(portFile, "utf8").split("\n")[0]);
        if (Number.isInteger(candidate) && candidate > 0 && candidate <= 65535) port = candidate;
      } catch (error) {
        if (!["ENOENT", "EBUSY", "EACCES", "EPERM"].includes(error.code)) throw error;
      }
      if (port) break;
      await sleep(50);
    }
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = pages.find((target) => target.type === "page");
    if (!page) throw new Error("Chromium has no test page");
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id); clearTimeout(request.timer);
      message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + " timed out")); }, 35000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send("Page.enable");
    await send("Page.navigate", { url });
    // This expression tolerates navigation not having committed yet; then
    // wait for the asynchronous browser fixture to replace its pending result.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const response = await send("Runtime.evaluate", {
        expression: 'document.getElementById("result")?.textContent', returnByValue: true,
      });
      const value = response.result?.value;
      if (typeof value === "string" && value !== "pending") {
        await send("Browser.close").catch(() => {});
        return { value, stderr: errors };
      }
      await sleep(100);
    }
    throw new Error("PDF fixture did not finish: " + errors);
  } finally {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error("Browser closed")); }
    socket?.close();
    if (child.exitCode === null) child.kill();
  }
}

module.exports = { runChromiumPage };
