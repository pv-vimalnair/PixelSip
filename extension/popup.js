const MINUTE = 60 * 1000;
let state;

const elements = {
  title: document.querySelector("#status-title"),
  timer: document.querySelector("#timer"),
  detail: document.querySelector("#status-detail"),
  glass: document.querySelector("#glass"),
  drink: document.querySelector("#drink-button"),
  pause: document.querySelector("#pause-button"),
  settingsButton: document.querySelector("#settings-button"),
  settings: document.querySelector("#settings"),
  quietEnabled: document.querySelector("#quiet-enabled"),
  quietStart: document.querySelector("#quiet-start"),
  quietEnd: document.querySelector("#quiet-end"),
  saveSettings: document.querySelector("#save-settings"),
  quietSummary: document.querySelector("#quiet-summary")
};

elements.drink.addEventListener("click", () => send("confirm-drink"));
elements.pause.addEventListener("click", () => send("toggle-pause"));
elements.settingsButton.addEventListener("click", () => {
  elements.settings.hidden = !elements.settings.hidden;
});
elements.saveSettings.addEventListener("click", () => send("save-settings", {
  settings: {
    quietEnabled: elements.quietEnabled.checked,
    quietStart: elements.quietStart.value,
    quietEnd: elements.quietEnd.value
  }
}));

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (response?.ok) {
    state = response.state;
    render();
  }
}

function render() {
  if (!state) return;
  const remaining = getRemaining();
  const ratio = Math.min(1, Math.max(0, remaining / (state.intervalMinutes * MINUTE)));
  elements.glass.className = `glass ${state.status === "awaiting" ? "alert" : ""} ${state.status === "quiet" ? "quiet" : ""}`;
  elements.glass.src = getGlassAsset(ratio);
  elements.timer.textContent = formatDuration(remaining);
  elements.pause.textContent = state.status === "paused" ? "Resume" : "Pause";
  elements.pause.disabled = state.status === "awaiting";
  elements.drink.textContent = state.status === "awaiting" ? "I drank water — refill" : "I drank water";
  elements.quietEnabled.checked = state.quietEnabled;
  elements.quietStart.value = state.quietStart;
  elements.quietEnd.value = state.quietEnd;
  elements.quietSummary.textContent = state.quietEnabled
    ? `Quiet hours · ${formatTime(state.quietStart)} – ${formatTime(state.quietEnd)}`
    : "Quiet hours · Off";

  const copy = {
    running: ["Next drink", "Glass drains as the hour passes"],
    awaiting: ["Time to drink", "The timer waits until you confirm"],
    paused: ["Reminder paused", "Resume whenever you are ready"],
    quiet: ["Quiet hours", "The glass will continue after sleep"]
  }[state.status];
  [elements.title.textContent, elements.detail.textContent] = copy;
}

function getGlassAsset(ratio) {
  if (state.status === "awaiting") return "icons/glass-alert.png";
  if (state.status === "quiet") return "icons/glass-quiet.png";
  const level = Math.round(ratio * 4) * 25;
  return `icons/glass-${level}.png`;
}

function getRemaining() {
  if (state.status === "running") return Math.max(0, state.nextReminderAt - Date.now());
  if (state.status === "awaiting") return 0;
  return Math.max(0, state.remainingMs);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(value) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}${minute === "00" ? "" : `:${minute}`} ${suffix}`;
}

send("get-state");
setInterval(render, 1000);
