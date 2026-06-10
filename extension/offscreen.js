const reminder = new Audio(chrome.runtime.getURL("audio/reminder.mp3"));
reminder.loop = true;
reminder.preload = "auto";

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "play-alert-sound") {
    reminder.volume = normalizeVolume(message.volume);
    reminder.play().catch(console.error);
  }
  if (message?.type === "stop-alert-sound") {
    reminder.pause();
    reminder.currentTime = 0;
  }
  if (message?.type === "set-alert-volume") {
    reminder.volume = normalizeVolume(message.volume);
  }
});

function normalizeVolume(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
