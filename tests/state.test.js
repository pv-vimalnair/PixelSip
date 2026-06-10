const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const noopEvent = { addListener() {} };
const chrome = {
  runtime: {
    onInstalled: noopEvent,
    onStartup: noopEvent,
    onMessage: noopEvent
  },
  alarms: { onAlarm: noopEvent },
  notifications: {
    onButtonClicked: noopEvent,
    onClicked: noopEvent
  }
};

let source = fs.readFileSync(path.join(__dirname, "..", "extension", "service-worker.js"), "utf8");
source = source.replace(
  "initialize().catch(console.error);",
  "globalThis.testApi = { getQuietWindow, getNextQuietStart, validateTime, timeToMinutes, normalizeVolume };"
);

const context = { chrome, console, Date, setTimeout, clearTimeout };
vm.createContext(context);
vm.runInContext(source, context);

const { getQuietWindow, getNextQuietStart, validateTime, timeToMinutes, normalizeVolume } = context.testApi;
const settings = { quietStart: "22:00", quietEnd: "07:00" };

function localTimestamp(year, month, day, hour, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

const lateNight = getQuietWindow(localTimestamp(2026, 6, 6, 23), settings);
assert.equal(lateNight.active, true);
assert.equal(lateNight.end, localTimestamp(2026, 6, 7, 7));

const earlyMorning = getQuietWindow(localTimestamp(2026, 6, 7, 6, 30), settings);
assert.equal(earlyMorning.active, true);
assert.equal(earlyMorning.end, localTimestamp(2026, 6, 7, 7));

const daytime = getQuietWindow(localTimestamp(2026, 6, 7, 12), settings);
assert.equal(daytime.active, false);
assert.equal(getNextQuietStart(localTimestamp(2026, 6, 7, 12), "22:00"), localTimestamp(2026, 6, 7, 22));

assert.equal(timeToMinutes("22:30"), 1350);
assert.equal(validateTime("07:15", "09:00"), "07:15");
assert.equal(validateTime("25:00", "09:00"), "09:00");
assert.equal(normalizeVolume(0.4), 0.4);
assert.equal(normalizeVolume(-1), 0);
assert.equal(normalizeVolume(2), 1);
assert.equal(normalizeVolume("not-a-number"), 0.5);

console.log("PixelSip state tests passed.");
