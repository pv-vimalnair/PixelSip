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
  quietUntil: 0
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
  await setState(state);
  await reconcile();
}

function validateTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "") ? value : fallback;
}

async function reconcile() {
  const state = await getState();
  const now = Date.now();

  if (state.status === "paused" || state.status === "awaiting") {
    await chrome.alarms.clear(CLOCK_ALARM);
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
  await playAlertSound();
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

async function playAlertSound() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  let hasDocument;
  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    hasDocument = contexts.length > 0;
  } else {
    const matchedClients = await clients.matchAll();
    hasDocument = matchedClients.some((client) => client.url === offscreenUrl);
  }
  if (!hasDocument) {
    creatingOffscreenDocument ??= chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play the hydration reminder sound."
    });
    await creatingOffscreenDocument;
    creatingOffscreenDocument = undefined;
  }
  await chrome.runtime.sendMessage({ type: "play-alert-sound" });
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
  const x = Math.round((size - 10 * unit) / 2) + offset * unit;
  const y = 2 * unit;
  const width = 10 * unit;
  const height = 12 * unit;
  const outline = state.status === "paused" || state.status === "quiet" ? "#6b7280" : "#172033";
  const water = state.status === "awaiting" ? "#f59e0b" : "#16bde8";

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = outline;
  ctx.fillRect(x, y, width, unit);
  ctx.fillRect(x, y, unit, height);
  ctx.fillRect(x + width - unit, y, unit, height);
  ctx.fillRect(x + unit, y + height - unit, width - 2 * unit, unit);

  let ratio = 0;
  if (state.status === "running") {
    ratio = Math.min(1, Math.max(0, (state.nextReminderAt - Date.now()) / (state.intervalMinutes * MINUTE)));
  } else if (state.status === "quiet" || state.status === "paused") {
    ratio = Math.min(1, Math.max(0, state.remainingMs / (state.intervalMinutes * MINUTE)));
  }
  const innerHeight = height - 3 * unit;
  const fillHeight = Math.round(innerHeight * ratio / unit) * unit;
  if (fillHeight > 0) {
    ctx.fillStyle = water;
    ctx.fillRect(x + 2 * unit, y + height - 2 * unit - fillHeight, width - 4 * unit, fillHeight);
    ctx.fillStyle = "#8de7f7";
    ctx.fillRect(x + 2 * unit, y + height - 2 * unit - fillHeight, width - 5 * unit, unit);
  }
  if (state.status === "awaiting") {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(x + 4 * unit, 0, 2 * unit, 2 * unit);
  }
  if (state.status === "quiet") {
    ctx.fillStyle = "#8791a5";
    ctx.fillRect(x + 4 * unit, y + 4 * unit, unit, unit);
    ctx.fillRect(x + 5 * unit, y + 3 * unit, unit, unit);
    ctx.fillRect(x + 6 * unit, y + 2 * unit, unit, unit);
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
