const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "extension");
const html = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const script = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const offscreenScript = fs.readFileSync(path.join(root, "offscreen.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const selectors = [...script.matchAll(/querySelector\("([^"]+)"\)/g)].map((match) => match[1]);
for (const selector of selectors) {
  if (selector.startsWith("#")) {
    assert.match(html, new RegExp(`id="${selector.slice(1)}"`), `Missing popup element ${selector}`);
  }
}

const requiredFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  "offscreen.html",
  "offscreen.js",
  "audio/reminder.mp3",
  "popup.css",
  "popup.js",
  "icons/glass-0.png",
  "icons/glass-25.png",
  "icons/glass-50.png",
  "icons/glass-75.png",
  "icons/glass-100.png",
  "icons/glass-alert.png",
  "icons/glass-quiet.png"
];

for (const file of requiredFiles) {
  assert.equal(fs.existsSync(path.join(root, file)), true, `Missing required file ${file}`);
}

assert.match(html, /id="volume"/, "Popup must expose a reminder-volume control");
assert.match(offscreenScript, /reminder\.loop = true/, "Reminder audio must loop");
assert.match(offscreenScript, /stop-alert-sound/, "Reminder audio must support stopping");
assert.match(offscreenScript, /set-alert-volume/, "Reminder audio must support live volume updates");

console.log("PixelSip popup contract tests passed.");
