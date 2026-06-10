const STATE_KEY = "pixelSipState";
const CLOCK_ALARM = "pixelSipClock";
const ICON_ALARM = "pixelSipIconTick";
const NOTIFICATION_ID = "pixelSipDrink";
const MINUTE = 60 * 1000;
let creatingOffscreenDocument;
const DEFAULT_STATE = {
  status: "running",
  intervalMinutes: 60,
  nextReminderAt: 0,
  remainingMs: 60 * MINUTE,
  quietEnabled: true,
  quietStart: "22:00",
  quietEnd: "07:00",
  quietUntil: 0,
  volume: 0.5
};

chrome.runtime.onInstalled.addListener(() => initialize());
chrome.runtime.onStartup.addListener(() => reconcile());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLOCK_ALARM) reconcile();
  if (alarm.name === ICON_ALARM) updateToolbarIcon();
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId !== NOTIFICATION_ID) return;
  if (buttonIndex === 0) confirmDrink();
  if (buttonIndex === 1) snooze();
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === NOTIFICATION_ID) chrome.action.openPopup().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "get-state":
      await reconcile();
      return { ok: true, state: await getState() };
    case "confirm-drink":
      await confirmDrink();
      return { ok: true, state: await getState() };
    case "snooze":
      await snooze();
      return { ok: true, state: await getState() };
    case "toggle-pause":
      await togglePause();
      return { ok: true, state: await getState() };
    case "save-settings":
      await saveSettings(message.settings);
      return { ok: true, state: await getState() };
    case "set-volume":
      await setVolume(message.volume);
      return { ok: true, state: await getState() };
    default:
      return { ok: false, error: "Unknown message" };
  }
}

async function initialize() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  if (!stored[STATE_KEY]) {
    const state = { ...DEFAULT_STATE, nextReminderAt: Date.now() + DEFAULT_STATE.remainingMs };
    await setState(state);
  }
  await chrome.alarms.create(ICON_ALARM, { periodInMinutes: 1 });
  await reconcile();
}

async function getState() {
  const stored = await chrome.storage.local.get(STATE_KEY);
  return { ...DEFAULT_STATE, ...stored[STATE_KEY] };
}

async function setState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

async function confirmDrink() {
  const state = await getState();
  await stopAlertSound();
  state.status = "running";
  state.remainingMs = state.intervalMinutes * MINUTE;
  state.nextReminderAt = Date.now() + state.remainingMs;
  state.quietUntil = 0;
  await chrome.notifications.clear(NOTIFICATION_ID);
  await setState(state);
  await reconcile();
}

async function snooze() {
  const state = await getState();
  await stopAlertSound();
  state.status = "running";
  state.remainingMs = 10 * MINUTE;
  state.nextReminderAt = Date.now() + state.remainingMs;
  state.quietUntil = 0;
  await chrome.notifications.clear(NOTIFICATION_ID);
  await setState(state);
  await reconcile();
}

async function togglePause() {
  const state = await getState();
  if (state.status === "awaiting") return;
  const now = Date.now();
  if (state.status === "paused") {
    state.status = "running";
    state.nextReminderAt = now + Math.max(state.remainingMs, MINUTE);
  } else {
    if (state.status === "running") state.remainingMs = Math.max(state.nextReminderAt - now, 0);
    if (state.status === "quiet") state.remainingMs = Math.max(state.remainingMs, MINUTE);
    state.status = "paused";
    state.nextReminderAt = 0;
    state.quietUntil = 0;
  }
  await setState(state);
  await reconcile();
}

async function saveSettings(settings) {
  const state = await getState();
  state.quietEnabled = Boolean(settings.quietEnabled);
  state.quietStart = validateTime(settings.quietStart, state.quietStart);
  state.quietEnd = validateTime(settings.quietEnd, state.quietEnd);
  state.volume = normalizeVolume(settings.volume);
  await setState(state);
  await updateAlertVolume(state.volume);
  await reconcile();
}

async function setVolume(volume) {
  const state = await getState();
  state.volume = normalizeVolume(volume);
  await setState(state);
  await updateAlertVolume(state.volume);
}

function validateTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "") ? value : fallback;
}

function normalizeVolume(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : DEFAULT_STATE.volume;
}

async function reconcile() {
  const state = await getState();
  const now = Date.now();

  if (state.status === "paused" || state.status === "awaiting") {
    await chrome.alarms.clear(CLOCK_ALARM);
    if (state.status === "awaiting") await playAlertSound(state.volume);
    await updateToolbarIcon(state);
    return;
  }

  const quiet = getQuietWindow(now, state);
  if (state.quietEnabled && quiet.active) {
    if (state.status !== "quiet") {
      state.remainingMs = Math.max(state.nextReminderAt - now, 0);
      state.status = "quiet";
    }
    state.quietUntil = quiet.end;
    await setState(state);
    await chrome.alarms.create(CLOCK_ALARM, { when: quiet.end });
    await updateToolbarIcon(state);
    return;
  }

  if (state.status === "quiet") {
    state.status = "running";
    state.nextReminderAt = now + Math.max(state.remainingMs, MINUTE);
    state.quietUntil = 0;
  }

  if (now >= state.nextReminderAt) {
    state.status = "awaiting";
    state.remainingMs = 0;
    await setState(state);
    await chrome.alarms.clear(CLOCK_ALARM);
    await alertUser();
    return;
  }

  const nextQuietStart = state.quietEnabled ? getNextQuietStart(now, state.quietStart) : Infinity;
  await setState(state);
  await chrome.alarms.create(CLOCK_ALARM, { when: Math.min(state.nextReminderAt, nextQuietStart) });
  await updateToolbarIcon(state);
}

function getQuietWindow(timestamp, state) {
  const now = new Date(timestamp);
  const startToday = atTime(now, state.quietStart);
  const endToday = atTime(now, state.quietEnd);
  const crossesMidnight = timeToMinutes(state.quietStart) >= timeToMinutes(state.quietEnd);

  if (!crossesMidnight) {
    return { active: timestamp >= startToday && timestamp < endToday, end: endToday };
  }
  if (timestamp >= startToday) return { active: true, end: addDays(endToday, 1) };
  if (timestamp < endToday) return { active: true, end: endToday };
  return { active: false, end: endToday };
}

function getNextQuietStart(timestamp, quietStart) {
  const date = new Date(timestamp);
  let start = atTime(date, quietStart);
  if (start <= timestamp) start = addDays(start, 1);
  return start;
}

function atTime(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result.getTime();
}

function addDays(timestamp, days) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

async function alertUser() {
  const state = await getState();
  await playAlertSound(state.volume);
  await shakeIcon();
  await chrome.notifications.create(NOTIFICATION_ID, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Your glass is empty",
    message: "Time for a drink of water.",
    contextMessage: "PixelSip is waiting for you",
    priority: 2,
    requireInteraction: true,
    buttons: [{ title: "I drank water" }, { title: "Remind me in 10 min" }]
  });
}

async function playAlertSound(volume) {
  await ensureOffscreenDocument();
  await chrome.runtime.sendMessage({ type: "play-alert-sound", volume: normalizeVolume(volume) });
}

async function stopAlertSound() {
  if (await hasOffscreenDocument()) {
    await chrome.runtime.sendMessage({ type: "stop-alert-sound" });
  }
}

async function updateAlertVolume(volume) {
  if (await hasOffscreenDocument()) {
    await chrome.runtime.sendMessage({ type: "set-alert-volume", volume: normalizeVolume(volume) });
  }
}

async function hasOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
  }
  const matchedClients = await clients.matchAll();
  return matchedClients.some((client) => client.url === offscreenUrl);
}

async function ensureOffscreenDocument() {
  if (!await hasOffscreenDocument()) {
    creatingOffscreenDocument ??= chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Loop the hydration reminder sound until the user responds."
    });
    await creatingOffscreenDocument;
    creatingOffscreenDocument = undefined;
  }
}

async function shakeIcon() {
  for (const offset of [-2, 2, -2, 2, -1, 1, 0]) {
    await setIconForState({ status: "awaiting", remainingMs: 0 }, offset);
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
}

async function updateToolbarIcon(providedState) {
  const state = providedState || await getState();
  await setIconForState(state, 0);
  const label = statusLabel(state);
  await chrome.action.setTitle({ title: `PixelSip — ${label}` });
}

async function setIconForState(state, offset) {
  const imageData = {};
  for (const size of [16, 32]) imageData[size] = drawPixelGlass(size, state, offset);
  await chrome.action.setIcon({ imageData });
}

function drawPixelGlass(size, state, offset = 0) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const unit = Math.max(1, Math.floor(size / 16));
  const x = Math.round((size - 16 * unit) / 2) + offset * unit;
  const y = Math.round((size - 16 * unit) / 2);
  const outline = state.status === "paused" || state.status === "quiet" ? "#687180" : "#0f1720";
  const pixel = (color, px, py, width = 1, height = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + px * unit, y + py * unit, width * unit, height * unit);
  };

  ctx.clearRect(0, 0, size, size);
  pixel("#c7cdd2", 12, 4, 1, 8);
  pixel("#c7cdd2", 5, 13);
  pixel("#c7cdd2", 11, 13);
  pixel("#c7cdd2", 6, 14, 5);
  pixel("#ffffff", 4, 3, 8, 8);
  pixel("#ffffff", 5, 11, 6);
  pixel(outline, 4, 2, 8);
  pixel(outline, 3, 3, 1, 8);
  pixel(outline, 12, 3, 1, 8);
  pixel(outline, 4, 11, 1, 2);
  pixel(outline, 11, 11, 1, 2);
  pixel(outline, 5, 13, 6);

  let ratio = 0;
  if (state.status === "running") {
    ratio = Math.min(1, Math.max(0, (state.nextReminderAt - Date.now()) / (state.intervalMinutes * MINUTE)));
  } else if (state.status === "quiet" || state.status === "paused") {
    ratio = Math.min(1, Math.max(0, state.remainingMs / (state.intervalMinutes * MINUTE)));
  }
  const rows = Math.round(ratio * 8);
  if (rows > 0) {
    const top = 12 - rows;
    if (top < 11) pixel("#42b7e2", 4, top, 8, Math.min(rows, 11 - top));
    if (top + rows > 11) pixel("#42b7e2", 5, 11, 6);
    pixel("#2a9ecc", 5, 11, 6);
    pixel("#e8fcff", 5, top, 3);
    pixel("#e8fcff", 5, top + 1);
  }
  if (state.status === "awaiting") {
    pixel("#f5b525", 1, 5);
    pixel("#f5b525", 2, 6);
    pixel("#f5b525", 1, 8);
    pixel("#f5b525", 14, 4);
    pixel("#f5b525", 15, 6);
    pixel("#f5b525", 14, 8);
  }
  if (state.status === "quiet") {
    pixel(outline, 6, 6);
    pixel(outline, 7, 5);
    pixel(outline, 8, 4);
  }
  return ctx.getImageData(0, 0, size, size);
}

function statusLabel(state) {
  if (state.status === "awaiting") return "Time to drink";
  if (state.status === "quiet") return "Quiet hours";
  if (state.status === "paused") return "Paused";
  const minutes = Math.max(0, Math.ceil((state.nextReminderAt - Date.now()) / MINUTE));
  return `${minutes} min until next drink`;
}

initialize().catch(console.error);
